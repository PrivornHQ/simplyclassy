import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);

// Compile the real server modules with isolated storage and request dependencies.
async function loadModule(path, dependencies = {}, cwd = process.cwd()) {
  const source = await readFile(new URL(path, root), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const resolve = (id) => (id in dependencies ? dependencies[id] : require(id));
  new Function("require", "module", "exports", "process", "crypto", compiled.outputText)(
    resolve,
    module,
    module.exports,
    { ...process, cwd: () => cwd },
    webcrypto,
  );
  return module.exports;
}

const orderData = await loadModule("src/data/orders.ts");

async function loadStore(kv, cwd) {
  return loadModule(
    "src/server/order-store.server.ts",
    {
      "@/data/products": { isCategoryId: (id) => ["sneakers", "watches", "perfumes"].includes(id) },
      "@/data/orders": orderData,
      "@/server/catalog-store.server": { listStoredProducts: async () => [] },
      "@tanstack/start-server-core": {
        getRequest: () => ({ runtime: { cloudflare: { env: { simplyclassy_catalog: kv } } } }),
      },
    },
    cwd,
  );
}

function snapshot(id, number) {
  return {
    id,
    orderNumber: `SC-${number}`,
    name: "Test Customer",
    location: "Accra",
    items: [
      {
        productId: "watch",
        productName: "Watch",
        productImage: "/watch.jpg",
        category: "watches",
        unitPrice: 20,
        quantity: 1,
        lineSubtotal: 20,
      },
    ],
    overallTotal: 20,
    createdAt: "2026-10-14T10:00:00.000Z",
    status: "pending",
    statusHistory: [
      { status: "pending", changedAt: "2026-10-14T10:00:00.000Z", changedBy: "system" },
    ],
  };
}

function memoryKV(orders) {
  const values = new Map();
  values.set("orders/index.json", JSON.stringify(orders.map((order) => order.id)));
  values.set("orders/order-number-counter.json", JSON.stringify({ nextSequence: 437010 }));
  for (const order of orders) {
    values.set(`orders/${order.id}.json`, JSON.stringify(order));
    values.set(`order-numbers/${order.orderNumber}.json`, order.id);
  }
  return {
    values,
    failPut: null,
    failDelete: null,
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value) {
      if (key === this.failPut) throw new Error("Storage write failed");
      values.set(key, value);
    },
    async delete(key) {
      if (key === this.failDelete) throw new Error("Storage delete failed");
      values.delete(key);
    },
    async list({ prefix }) {
      return {
        keys: [...values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

test("deletion removes snapshot and indexes and remains absent in a fresh session", async () => {
  const order = snapshot("order-one", 437001);
  const other = snapshot("order-two", 437002);
  const kv = memoryKV([order, other]);
  const store = await loadStore(kv);
  await store.deleteStoredOrder(order.id);
  assert.equal(kv.values.has(`orders/${order.id}.json`), false);
  assert.equal(kv.values.has(`order-numbers/${order.orderNumber}.json`), false);
  assert.deepEqual(JSON.parse(kv.values.get("orders/index.json")), [other.id]);
  const fresh = await loadStore(kv);
  assert.equal(await fresh.readStoredOrder(order.id), null);
  assert.equal(await fresh.readOrderForCustomerTracking(order), null);
  assert.deepEqual(
    (await fresh.listStoredOrders()).map((item) => item.id),
    [other.id],
  );
  assert.equal(
    kv.values.get("orders/order-number-counter.json"),
    JSON.stringify({ nextSequence: 437010 }),
  );
});

test("stale snapshots and indexes cannot restore a deleted order or allow a stale save", async () => {
  const order = snapshot("order-one", 437001);
  const kv = memoryKV([order]);
  const store = await loadStore(kv);
  await store.deleteStoredOrder(order.id);
  kv.values.set(`orders/${order.id}.json`, JSON.stringify(order));
  kv.values.set("orders/index.json", JSON.stringify([order.id]));
  kv.values.set(`order-numbers/${order.orderNumber}.json`, order.id);
  const fresh = await loadStore(kv);
  assert.deepEqual(await fresh.listStoredOrders(), []);
  assert.equal(await fresh.readOrderForCustomerTracking(order), null);
  await assert.rejects(
    fresh.updateStoredOrder({ orderId: order.id, status: "confirmed" }),
    /could not be found/,
  );
});

test("cancellation persists as a status update with its history", async () => {
  const order = snapshot("order-one", 437001);
  const kv = memoryKV([order]);
  const store = await loadStore(kv);
  await store.updateStoredOrder({
    orderId: order.id,
    status: "cancelled",
    statusNote: "Customer request",
  });
  const fresh = await loadStore(kv);
  const saved = await fresh.readStoredOrder(order.id);
  assert.equal(saved.status, "cancelled");
  assert.equal(saved.statusHistory.at(-1).note, "Customer request");
  assert.equal((await fresh.listStoredOrders({ status: "cancelled" })).length, 1);
  assert.equal(kv.values.has(`deleted-orders/${order.id}.json`), false);
});

test("bulk deletion targets only supplied IDs and can be retried safely", async () => {
  const orders = [
    snapshot("order-one", 437001),
    snapshot("order-two", 437002),
    snapshot("order-three", 437003),
  ];
  const kv = memoryKV(orders);
  const store = await loadStore(kv);
  const result = await store.deleteStoredOrders([orders[0].id, orders[0].id, orders[1].id]);
  assert.deepEqual(result, { deletedIds: [orders[0].id, orders[1].id], failedIds: [] });
  assert.deepEqual(
    (await store.listStoredOrders()).map((order) => order.id),
    [orders[2].id],
  );
  assert.equal(await store.deleteStoredOrder(orders[0].id), orders[0].id);
  await assert.rejects(store.deleteStoredOrders([orders[2].id, "../unsafe"]), /valid orders/);
  assert.ok(await store.readStoredOrder(orders[2].id));
});

test("a failed deletion write reports failure and keeps the order", async () => {
  const order = snapshot("order-one", 437001);
  const kv = memoryKV([order]);
  kv.failPut = `deleted-orders/${order.id}.json`;
  const store = await loadStore(kv);
  await assert.rejects(store.deleteStoredOrder(order.id), /Storage write failed/);
  assert.ok(await store.readStoredOrder(order.id));
  kv.failPut = null;
  await store.deleteStoredOrder(order.id);
  assert.equal(await store.readStoredOrder(order.id), null);
});

test("partial bulk failure reports failed IDs and retry finishes cleanup", async () => {
  const first = snapshot("order-one", 437001);
  const second = snapshot("order-two", 437002);
  const kv = memoryKV([first, second]);
  kv.failDelete = `order-numbers/${first.orderNumber}.json`;
  const store = await loadStore(kv);
  const result = await store.deleteStoredOrders([first.id, second.id]);
  assert.deepEqual(result, { deletedIds: [second.id], failedIds: [first.id] });
  assert.equal(await store.readStoredOrder(first.id), null);
  const fresh = await loadStore(kv);
  kv.failDelete = null;
  await fresh.deleteStoredOrder(first.id);
  assert.equal(kv.values.has(`order-numbers/${first.orderNumber}.json`), false);
  assert.deepEqual(JSON.parse(kv.values.get("orders/index.json")), []);
});

test("concurrent stale update cannot recreate a deleted order", async () => {
  const order = snapshot("order-one", 437001);
  const kv = memoryKV([order]);
  const store = await loadStore(kv);
  const results = await Promise.allSettled([
    store.deleteStoredOrder(order.id),
    store.updateStoredOrder({ orderId: order.id, status: "confirmed" }),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(kv.values.has(`orders/${order.id}.json`), false);
});

test("a save that read a stale snapshot checks deletion again before writing", async () => {
  const order = snapshot("order-one", 437001);
  const kv = memoryKV([order]);
  const deletingInstance = await loadStore(kv);
  const updatingInstance = await loadStore(kv);
  const originalGet = kv.get.bind(kv);
  let deleteDuringRead = true;
  kv.get = async (key) => {
    const value = await originalGet(key);
    if (key === `orders/${order.id}.json` && deleteDuringRead) {
      deleteDuringRead = false;
      await deletingInstance.deleteStoredOrder(order.id);
    }
    return value;
  };
  await assert.rejects(
    updatingInstance.updateStoredOrder({ orderId: order.id, status: "confirmed" }),
    /has been deleted/,
  );
  assert.equal(kv.values.has(`orders/${order.id}.json`), false);
  assert.deepEqual(await updatingInstance.listStoredOrders(), []);
});

test("file persistence survives reload and deletes only the selected order", async () => {
  const directory = await mkdtemp(join(tmpdir(), "simplyclassy-order-test-"));
  try {
    const first = snapshot("order-one", 437001);
    const second = snapshot("order-two", 437002);
    const storageDirectory = join(directory, ".data", "orders");
    await mkdir(storageDirectory, { recursive: true });
    for (const [key, value] of memoryKV([first, second]).values) {
      await writeFile(join(storageDirectory, key.replaceAll("/", "__")), value);
    }
    const store = await loadStore(null, directory);
    await store.deleteStoredOrder(first.id);
    const fresh = await loadStore(null, directory);
    assert.equal(await fresh.readStoredOrder(first.id), null);
    assert.deepEqual(
      (await fresh.listStoredOrders()).map((order) => order.id),
      [second.id],
    );
    await assert.rejects(readFile(join(storageDirectory, `orders__${first.id}.json`)), {
      code: "ENOENT",
    });
    await assert.rejects(
      readFile(join(storageDirectory, `order-numbers__${first.orderNumber}.json`)),
      { code: "ENOENT" },
    );
  } finally {
    assert.equal(resolve(dirname(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("simplyclassy-order-test-"));
    await rm(directory, { recursive: true, force: true });
  }
});

test("delete and clear endpoints require admin authorization and validate the complete scope", async () => {
  const order = snapshot("order-one", 437001);
  const kv = memoryKV([order]);
  const store = await loadStore(kv);
  let authorized = false;
  const endpoints = await loadModule("src/lib/order.functions.ts", {
    "@/data/orders": orderData,
    "@/server/order-store.server": store,
    "@/server/admin-auth.server": {
      requireAdminSession: async () => {
        if (!authorized) throw new Error("Unauthorized");
      },
    },
    "@tanstack/react-start": {
      createServerFn: () => ({
        validator: (validator) => ({
          handler:
            (handler) =>
            async ({ data }) =>
              handler({
                data: typeof validator === "function" ? validator(data) : validator.parse(data),
              }),
        }),
      }),
    },
  });
  await assert.rejects(endpoints.deleteAdminOrder({ data: { orderId: order.id } }), /Unauthorized/);
  await assert.rejects(
    endpoints.clearAdminOrders({ data: { orderIds: [order.id] } }),
    /Unauthorized/,
  );
  assert.ok(await store.readStoredOrder(order.id));
  authorized = true;
  await assert.rejects(endpoints.clearAdminOrders({ data: { orderIds: [order.id, "../unsafe"] } }));
  assert.ok(await store.readStoredOrder(order.id));
  kv.failPut = `deleted-orders/${order.id}.json`;
  await assert.rejects(endpoints.deleteAdminOrder({ data: { orderId: order.id } }), /Please retry/);
  kv.failPut = null;
  assert.deepEqual(await endpoints.deleteAdminOrder({ data: { orderId: order.id } }), {
    deletedId: order.id,
  });
});
