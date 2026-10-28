import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);

async function loadModule(
  path,
  dependencies = {},
  { cwd = process.cwd(), production = false } = {},
) {
  const source = await readFile(new URL(path, root), "utf8");
  const { outputText } = ts.transpileModule(
    source.replaceAll("import.meta.env.PROD", 'process.env.NODE_ENV === "production"'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  );
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "crypto", outputText)(
    (id) => (id in dependencies ? dependencies[id] : require(id)),
    module,
    module.exports,
    {
      ...process,
      env: { ...process.env, NODE_ENV: production ? "production" : "development" },
      cwd: () => cwd,
    },
    webcrypto,
  );
  return module.exports;
}

function requestContext(kv) {
  let binding = kv;
  return {
    getRequest: () => ({
      runtime: { cloudflare: { env: binding ? { simplyclassy_catalog: binding } : {} } },
    }),
    setBinding(value) {
      binding = value;
    },
  };
}

function memoryKV() {
  const values = new Map();
  return {
    values,
    failPut: false,
    failList: false,
    async put(key, value, options) {
      if (this.failPut) throw new Error("KV write failed");
      values.set(key, { value, options });
    },
    async list({ prefix, limit = 1000 }) {
      if (this.failList) throw new Error("KV list failed");
      return {
        keys: [...values.keys()]
          .filter((key) => key.startsWith(prefix))
          .slice(0, limit)
          .map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

const sessionA = "c2f7b371-3e60-4f70-a654-bf9ed050c9a0";
const sessionB = "d3f8c482-4f71-5a81-b765-c0fe160da1b1";

test("Cloudflare KV data remains available after a new server module instance", async () => {
  const kv = memoryKV();
  const context = requestContext(kv);
  const visitorHelpers = await loadModule("src/lib/visitor-analytics.ts");
  const dependencies = {
    "@tanstack/start-server-core": context,
    "@/lib/visitor-analytics": visitorHelpers,
  };
  const analytics = await loadModule("src/server/visitor-analytics.server.ts", dependencies);
  const today = new Date().toISOString().slice(0, 10);

  await analytics.recordVisitorPageview(sessionA, "home");
  await analytics.recordVisitorPageview(sessionA, "home");
  await analytics.recordVisitorPageview(sessionB, "order_status");

  const restartedWorker = await loadModule("src/server/visitor-analytics.server.ts", dependencies);
  const counts = await restartedWorker.getVisitorAnalytics({ from: today, to: today });
  assert.equal(counts.daily[0].date, today);
  assert.equal(counts.pageViews, 3);
  assert.equal(counts.uniqueVisitors, 2);
  assert.deepEqual(counts.pages, [
    { pageId: "home", pageViews: 2 },
    { pageId: "order_status", pageViews: 1 },
  ]);
  assert.ok([...kv.values.values()].every(({ options }) => options.expirationTtl === 45 * 86400));
});

test("local development storage persists across server module reloads", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "simplyclassy-analytics-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const context = requestContext(null);
  const dependencies = {
    "@tanstack/start-server-core": context,
    "@/lib/visitor-analytics": await loadModule("src/lib/visitor-analytics.ts"),
  };

  const firstProcess = await loadModule("src/server/visitor-analytics.server.ts", dependencies, {
    cwd,
  });
  await firstProcess.recordVisitorPageview(sessionA, "home");

  const restartedProcess = await loadModule(
    "src/server/visitor-analytics.server.ts",
    dependencies,
    {
      cwd,
    },
  );
  const today = new Date().toISOString().slice(0, 10);
  const counts = await restartedProcess.getVisitorAnalytics({ from: today, to: today });
  assert.equal(counts.pageViews, 1);
  assert.equal(counts.uniqueVisitors, 1);
  assert.deepEqual(counts.pages, [{ pageId: "home", pageViews: 1 }]);
});

test("production refuses missing KV and never creates local analytics files", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "simplyclassy-analytics-prod-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const context = requestContext(null);
  const visitorHelpers = await loadModule("src/lib/visitor-analytics.ts");
  const analytics = await loadModule(
    "src/server/visitor-analytics.server.ts",
    {
      "@tanstack/start-server-core": context,
      "@/lib/visitor-analytics": visitorHelpers,
    },
    { cwd, production: true },
  );

  const today = new Date().toISOString().slice(0, 10);
  await assert.rejects(analytics.recordVisitorPageview(sessionA, "home"), /Cloudflare KV binding/);
  await assert.rejects(
    analytics.getVisitorAnalytics({ from: today, to: today }),
    /Cloudflare KV binding/,
  );
  await assert.rejects(readFile(join(cwd, ".data", "visitor-analytics")), { code: "ENOENT" });
});

test("Cloudflare KV errors propagate to the caller", async () => {
  const kv = memoryKV();
  const context = requestContext(kv);
  const visitorHelpers = await loadModule("src/lib/visitor-analytics.ts");
  const analytics = await loadModule("src/server/visitor-analytics.server.ts", {
    "@tanstack/start-server-core": context,
    "@/lib/visitor-analytics": visitorHelpers,
  });

  kv.failPut = true;
  await assert.rejects(analytics.recordVisitorPageview(sessionA, "home"), /KV write failed/);
  kv.failPut = false;
  kv.failList = true;
  const today = new Date().toISOString().slice(0, 10);
  await assert.rejects(analytics.getVisitorAnalytics({ from: today, to: today }), /KV list failed/);
});

test("admin analytics requires an authenticated session", async () => {
  let authenticated = false;
  const adminFn = {
    method() {
      return this;
    },
    validator() {
      return this;
    },
    handler(handler) {
      return handler;
    },
  };
  const visitorHelpers = await loadModule("src/lib/visitor-analytics.ts");
  const functions = await loadModule("src/lib/visitor-analytics.functions.ts", {
    "@tanstack/react-start": { createServerFn: () => ({ ...adminFn }) },
    zod: {
      z: {
        object: () => ({}),
        string: () => ({ uuid: () => ({}) }),
        enum: () => ({}),
      },
    },
    "@/lib/visitor-analytics": visitorHelpers,
    "@/server/visitor-analytics.server": {
      getVisitorAnalytics: async () => ({
        from: "2026-10-28",
        to: "2026-10-28",
        today: "2026-10-28",
        daily: [{ date: "2026-10-28", pageViews: 4, sessions: 2 }],
        pageViews: 4,
        uniqueVisitors: 2,
        todayVisitors: 2,
        pages: [],
      }),
      recordVisitorPageview: async () => undefined,
    },
    "@/server/admin-auth.server": {
      requireAdminSession: async () => {
        if (!authenticated) throw new Error("Unauthorized");
      },
    },
  });

  const range = { data: { from: "2026-10-28", to: "2026-10-28" } };
  await assert.rejects(functions.getAdminVisitorAnalytics(range), /Unauthorized/);
  authenticated = true;
  assert.deepEqual(await functions.getAdminVisitorAnalytics(range), {
    from: "2026-10-28",
    to: "2026-10-28",
    today: "2026-10-28",
    daily: [{ date: "2026-10-28", pageViews: 4, sessions: 2 }],
    pageViews: 4,
    uniqueVisitors: 2,
    todayVisitors: 2,
    pages: [],
  });
});

test("public route filtering excludes admin, API, and unrelated paths", async () => {
  const { isTrackableVisitorPath } = await loadModule("src/lib/visitor-analytics.ts");

  assert.equal(isTrackableVisitorPath("/"), true);
  assert.equal(isTrackableVisitorPath("/track"), true);
  assert.equal(isTrackableVisitorPath("/order/SC-437001"), true);
  assert.equal(isTrackableVisitorPath("/admin"), false);
  assert.equal(isTrackableVisitorPath("/api/catalog/images/id"), false);
  assert.equal(isTrackableVisitorPath("/not-found"), false);
});

test("page identifiers normalize public routes without retaining dynamic order IDs", async () => {
  const { getVisitorPageId } = await loadModule("src/lib/visitor-analytics.ts");

  assert.equal(getVisitorPageId("/"), "home");
  assert.equal(getVisitorPageId("/track"), "order_tracking");
  assert.equal(getVisitorPageId("/order/SC-437001"), "order_status");
  assert.equal(getVisitorPageId("/admin"), null);
  assert.equal(getVisitorPageId("/order/SC-437001/private"), null);
});

test("the browser tab session id remains stable across page reloads", async () => {
  const { getOrCreateVisitorSessionId } = await loadModule("src/lib/visitor-analytics.ts");
  const values = new Map();
  const sessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  const firstPageLoad = getOrCreateVisitorSessionId(sessionStorage);
  const afterReload = getOrCreateVisitorSessionId(sessionStorage);
  assert.match(firstPageLoad, /^[0-9a-f-]{36}$/i);
  assert.equal(afterReload, firstPageLoad);
});

test("date range presets use inclusive UTC dates and validation caps KV work", async () => {
  const { getVisitorAnalyticsRange, validateVisitorAnalyticsRange } = await loadModule(
    "src/lib/visitor-analytics.ts",
  );
  const now = new Date("2026-03-01T00:15:00+02:00");

  assert.deepEqual(getVisitorAnalyticsRange("today", now), {
    from: "2026-02-28",
    to: "2026-02-28",
  });
  assert.deepEqual(getVisitorAnalyticsRange("7d", now), {
    from: "2026-02-22",
    to: "2026-02-28",
  });
  assert.throws(
    () => validateVisitorAnalyticsRange("2026-01-01", "2026-02-28", "2026-02-28"),
    /cannot exceed 45 days/,
  );
  assert.throws(
    () => validateVisitorAnalyticsRange("2026-03-01", "2026-02-28", "2026-02-28"),
    /valid visitor analytics date range/,
  );
  assert.throws(
    () => validateVisitorAnalyticsRange("2026-02-28", "2026-03-01", "2026-02-28"),
    /valid visitor analytics date range/,
  );
});

test("summary fills missing dates and deduplicates estimated visitors across days", async () => {
  const { buildVisitorAnalyticsSummary } = await loadModule("src/lib/visitor-analytics.ts");
  const digestA = "a".repeat(64);
  const digestB = "b".repeat(64);
  const summary = buildVisitorAnalyticsSummary(
    { from: "2026-02-26", to: "2026-02-28" },
    "2026-03-01",
    {
      "2026-02-27": [
        `analytics:2026-02-27:session:${digestA}`,
        `analytics:2026-02-27:view:home:${crypto.randomUUID()}`,
        `analytics:2026-02-27:view:home:${crypto.randomUUID()}`,
        `analytics:2026-02-27:view:admin:${crypto.randomUUID()}`,
      ],
      "2026-02-28": [
        `analytics:2026-02-28:session:${digestA}`,
        `analytics:2026-02-28:session:${digestB}`,
        `analytics:2026-02-28:view:order_status:${crypto.randomUUID()}`,
        `analytics:2026-02-28:view:${crypto.randomUUID()}`,
      ],
      "2026-03-01": [`analytics:2026-03-01:session:${digestB}`],
    },
  );

  assert.equal(summary.pageViews, 4);
  assert.equal(summary.uniqueVisitors, 2);
  assert.equal(summary.todayVisitors, 1);
  assert.deepEqual(summary.daily, [
    { date: "2026-02-26", pageViews: 0, sessions: 0 },
    { date: "2026-02-27", pageViews: 2, sessions: 1 },
    { date: "2026-02-28", pageViews: 2, sessions: 2 },
  ]);
  assert.deepEqual(summary.pages, [
    { pageId: "home", pageViews: 2 },
    { pageId: "order_status", pageViews: 1 },
  ]);
});

test("empty analytics returns zero-safe totals and empty page rankings", async () => {
  const { buildVisitorAnalyticsSummary } = await loadModule("src/lib/visitor-analytics.ts");
  const summary = buildVisitorAnalyticsSummary(
    { from: "2026-03-01", to: "2026-03-01" },
    "2026-03-01",
    {},
  );

  assert.equal(summary.pageViews, 0);
  assert.equal(summary.uniqueVisitors, 0);
  assert.equal(summary.todayVisitors, 0);
  assert.deepEqual(summary.daily, [{ date: "2026-03-01", pageViews: 0, sessions: 0 }]);
  assert.deepEqual(summary.pages, []);
});
