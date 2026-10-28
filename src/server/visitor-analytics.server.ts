import { getRequest } from "@tanstack/start-server-core";

const KV_BINDING = "simplyclassy_catalog";
const RETENTION_SECONDS = 60 * 60 * 24 * 45;
const DAY_COUNT = 30;

type KVNamespace = {
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  list: (options: {
    prefix: string;
    limit?: number;
    cursor?: string;
  }) => Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
};

type RuntimeRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: Record<string, unknown>;
    };
  };
};

function getKVNamespace(): KVNamespace | null {
  try {
    const request = getRequest() as RuntimeRequest;
    const binding = request.runtime?.cloudflare?.env?.[KV_BINDING];
    if (
      typeof binding === "object" &&
      binding !== null &&
      "put" in binding &&
      typeof binding.put === "function" &&
      "list" in binding &&
      typeof binding.list === "function"
    ) {
      return binding as KVNamespace;
    }
    return null;
  } catch {
    return null;
  }
}

function utcDate(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function localStore() {
  const { mkdir, readdir, unlink, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const root = join(process.cwd(), ".data", "visitor-analytics");
  await mkdir(root, { recursive: true });
  const oldestDate = utcDate(RETENTION_SECONDS / (60 * 60 * 24));
  const entries = await readdir(root);
  await Promise.all(
    entries
      .filter((entry) => {
        const match = /^analytics__(\d{4}-\d{2}-\d{2})__/.exec(entry);
        return match?.[1] !== undefined && match[1] < oldestDate;
      })
      .map((entry) => unlink(join(root, entry))),
  );
  const fileFor = (key: string) => join(root, key.replaceAll(":", "__"));

  return {
    async put(key: string) {
      await writeFile(fileFor(key), "");
    },
    async list(prefix: string) {
      const entries = await readdir(root);
      return entries
        .filter((entry) => entry.startsWith(prefix.replaceAll(":", "__")))
        .map((entry) => entry.replaceAll("__", ":"));
    },
  };
}

async function putAnalyticsKey(key: string): Promise<void> {
  const kv = getKVNamespace();
  if (kv) {
    await kv.put(key, "", { expirationTtl: RETENTION_SECONDS });
    return;
  }
  await (await localStore()).put(key);
}

async function listAnalyticsKeys(prefix: string): Promise<string[]> {
  const kv = getKVNamespace();
  if (!kv) return (await localStore()).list(prefix);

  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await kv.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    keys.push(...result.keys.map(({ name }) => name));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return keys;
}

export async function recordVisitorPageview(sessionId: string): Promise<void> {
  const date = utcDate(0);
  const sessionDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sessionId),
  );
  const digest = Array.from(new Uint8Array(sessionDigest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  await Promise.all([
    putAnalyticsKey(`analytics:${date}:view:${crypto.randomUUID()}`),
    putAnalyticsKey(`analytics:${date}:session:${digest}`),
  ]);
}

export async function getVisitorAnalytics() {
  const dates = Array.from({ length: DAY_COUNT }, (_, index) => utcDate(DAY_COUNT - index - 1));
  return Promise.all(
    dates.map(async (date) => {
      const keys = await listAnalyticsKeys(`analytics:${date}:`);
      const pageViews = keys.filter((key) => key.includes(":view:")).length;
      const sessions = keys.filter((key) => key.includes(":session:")).length;
      return { date, pageViews, sessions };
    }),
  );
}
