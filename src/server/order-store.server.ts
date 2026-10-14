import { isCategoryId, type Product } from "@/data/products";
import {
  MAX_ORDER_CUSTOMER_NAME_CHARS,
  MAX_ORDER_ADMIN_NOTES_CHARS,
  MAX_ORDER_LOCATION_CHARS,
  MAX_ORDER_STATUS_NOTE_CHARS,
  type CreateOrderCartItem,
  type CreateOrderInput,
  type AdminOrderSearchInput,
  type OrderSnapshot,
  type OrderSnapshotItem,
  type OrderStatus,
  type OrderStatusHistoryEntry,
  type PublicOrderTrackingInput,
  type UpdateOrderInput,
  isOrderStatus,
} from "@/data/orders";
import { listStoredProducts } from "@/server/catalog-store.server";
import { getRequest } from "@tanstack/start-server-core";

const CATALOG_KV_BINDING = "simplyclassy_catalog";
const ORDER_KEY_PREFIX = "orders/";
const ORDER_NUMBER_COUNTER_KEY = "orders/order-number-counter.json";
const ORDER_NUMBER_INDEX_PREFIX = "order-numbers/";
const ORDER_INDEX_KEY = "orders/index.json";
const DELETED_ORDER_PREFIX = "deleted-orders/";
const FIRST_ORDER_SEQUENCE = 437001;
const ORDER_NUMBER_PREFIX = "SC-";
export const ORDER_RETENTION_SECONDS = 60 * 60 * 24 * 30;

type OrderPersistence = {
  getText: (key: string) => Promise<string | null>;
  setText: (key: string, value: string, expirationTtlSeconds: number) => Promise<void>;
  setTextPermanent: (key: string, value: string) => Promise<void>;
  deleteKey: (key: string) => Promise<void>;
  listKeys: (prefix: string) => Promise<string[]>;
};

let persistencePromise: Promise<OrderPersistence> | undefined;
let orderNumberLock: Promise<unknown> = Promise.resolve();
let orderMutationLock: Promise<unknown> = Promise.resolve();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type OrderKVNamespace = {
  get: (key: string, options: { type: "text" }) => Promise<string | null>;
  put: (
    key: string,
    value: string | ArrayBuffer | ArrayBufferView,
    options?: { metadata?: Record<string, unknown>; expirationTtl?: number },
  ) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list?: (options?: {
    prefix?: string;
    cursor?: string;
    limit?: number;
  }) => Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
};

type RuntimeRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: Record<string, unknown>;
    };
  };
};

const isOrderKVNamespace = (value: unknown): value is OrderKVNamespace =>
  isRecord(value) &&
  typeof value["get"] === "function" &&
  typeof value["put"] === "function" &&
  typeof value["delete"] === "function";

function getOrderKVBinding(): OrderKVNamespace | null {
  try {
    const request = getRequest() as RuntimeRequest;
    const binding = request.runtime?.cloudflare?.env?.[CATALOG_KV_BINDING];
    return isOrderKVNamespace(binding) ? binding : null;
  } catch {
    return null;
  }
}

function createCloudflareKVPersistence(kv: OrderKVNamespace): OrderPersistence {
  return {
    async getText(key) {
      return kv.get(key, { type: "text" });
    },
    async setText(key, value, expirationTtlSeconds) {
      await kv.put(key, value, {
        metadata: { contentType: "application/json" },
        expirationTtl: expirationTtlSeconds,
      });
    },
    async setTextPermanent(key, value) {
      await kv.put(key, value, { metadata: { contentType: "application/json" } });
    },
    async deleteKey(key) {
      await kv.delete(key);
    },
    async listKeys(prefix) {
      if (typeof kv.list !== "function") return [];
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const result = await kv.list({ prefix, ...(cursor ? { cursor } : {}), limit: 1000 });
        keys.push(...result.keys.map((item) => item.name));
        cursor = result.list_complete ? undefined : result.cursor;
      } while (cursor);
      return keys;
    },
  };
}

async function createFilePersistence(): Promise<OrderPersistence> {
  const { mkdir, readFile, writeFile, unlink, readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const root = join(process.cwd(), ".data", "orders");
  await mkdir(root, { recursive: true });

  const fileFor = (key: string) => join(root, key.replaceAll("/", "__"));
  const keyFor = (fileName: string) => fileName.replaceAll("__", "/");

  return {
    async getText(key) {
      let raw: string;
      try {
        raw = await readFile(fileFor(key), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return raw;
      }
      if (
        isRecord(parsed) &&
        typeof parsed["value"] === "string" &&
        typeof parsed["expiresAt"] === "string"
      ) {
        if (Date.parse(parsed["expiresAt"]) <= Date.now()) {
          await unlink(fileFor(key)).catch(() => undefined);
          return null;
        }
        return parsed["value"];
      }
      return raw;
    },
    async setText(key, value, expirationTtlSeconds) {
      const expiresAt = new Date(Date.now() + expirationTtlSeconds * 1000).toISOString();
      await writeFile(fileFor(key), JSON.stringify({ expiresAt, value }), "utf8");
    },
    async setTextPermanent(key, value) {
      await writeFile(fileFor(key), value, "utf8");
    },
    async deleteKey(key) {
      await unlink(fileFor(key)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    },
    async listKeys(prefix) {
      try {
        const files = await readdir(root);
        return files.map(keyFor).filter((key) => key.startsWith(prefix));
      } catch {
        return [];
      }
    },
  };
}

async function getPersistence(): Promise<OrderPersistence> {
  if (!persistencePromise) {
    persistencePromise = (async () => {
      const kv = getOrderKVBinding();
      return kv ? createCloudflareKVPersistence(kv) : createFilePersistence();
    })();
  }
  return persistencePromise;
}

const isSafeOrderId = (value: string) => /^[a-zA-Z0-9_-]{6,80}$/.test(value);
const isOrderNumber = (value: string) => /^SC-\d{6,}$/.test(value);
const LOCATION_ADDRESS_PATTERN = /[\d#]/;

const orderKey = (orderId: string) => `${ORDER_KEY_PREFIX}${orderId}.json`;
const orderNumberKey = (orderNumber: string) => `${ORDER_NUMBER_INDEX_PREFIX}${orderNumber}.json`;
const deletedOrderKey = (orderId: string) => `${DELETED_ORDER_PREFIX}${orderId}.json`;

async function runOrderMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const run = orderMutationLock.then(mutation);
  orderMutationLock = run.catch(() => undefined);
  return run;
}

const formatOrderNumber = (sequence: number) => `${ORDER_NUMBER_PREFIX}${sequence}`;

function normalizeCustomerField(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOrderNumber(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d{6,}$/.test(normalized)) return `${ORDER_NUMBER_PREFIX}${normalized}`;
  return normalized;
}

function sameCustomerField(left: string, right: string) {
  return normalizeCustomerField(left).toLocaleLowerCase() === normalizeCustomerField(right).toLocaleLowerCase();
}

function truncateField(value: string, maxChars: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxChars);
}

function validateCustomerInfo(nameInput: string, locationInput: string) {
  const name = normalizeCustomerField(nameInput);
  const location = normalizeCustomerField(locationInput);

  if (!name) throw new Error("Name is required.");
  if (name.length < 2) throw new Error("Name must be at least 2 characters.");
  if (name.length > MAX_ORDER_CUSTOMER_NAME_CHARS) {
    throw new Error(`Name must be ${MAX_ORDER_CUSTOMER_NAME_CHARS} characters or fewer.`);
  }

  if (!location) throw new Error("Location is required.");
  if (location.length < 2) throw new Error("Location must be at least 2 characters.");
  if (location.length > MAX_ORDER_LOCATION_CHARS) {
    throw new Error(`Location must be ${MAX_ORDER_LOCATION_CHARS} characters or fewer.`);
  }
  if (LOCATION_ADDRESS_PATTERN.test(location)) {
    throw new Error("Use a city or area for location, not an exact address.");
  }

  return { name, location };
}

function parseOrderItem(value: unknown): OrderSnapshotItem | null {
  if (!isRecord(value)) return null;
  const { productId, productName, productImage, category, unitPrice, quantity, lineSubtotal } =
    value;
  if (typeof productId !== "string" || typeof productName !== "string") return null;
  if (typeof productImage !== "string") return null;
  if (typeof category !== "string" || !isCategoryId(category)) return null;
  if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) return null;
  if (typeof lineSubtotal !== "number" || !Number.isFinite(lineSubtotal) || lineSubtotal < 0) {
    return null;
  }

  return {
    productId,
    productName,
    productImage,
    category,
    unitPrice,
    quantity,
    lineSubtotal,
  };
}

function parseStoredOrder(value: unknown): OrderSnapshot | null {
  if (!isRecord(value)) return null;
  const { id, orderNumber, name, location, items, overallTotal, createdAt } = value;
  if (typeof id !== "string" || !isSafeOrderId(id)) return null;
  if (typeof orderNumber !== "string" && orderNumber !== undefined) return null;
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof location !== "string" || !location.trim()) return null;
  if (!Array.isArray(items)) return null;
  if (typeof overallTotal !== "number" || !Number.isFinite(overallTotal) || overallTotal < 0) {
    return null;
  }
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) return null;

  const parsedItems = items.map(parseOrderItem).filter((item): item is OrderSnapshotItem => !!item);
  if (parsedItems.length !== items.length || parsedItems.length === 0) return null;

  const status =
    typeof value["status"] === "string" && isOrderStatus(value["status"])
      ? value["status"]
      : "pending";
  const statusHistoryRaw = Array.isArray(value["statusHistory"]) ? value["statusHistory"] : [];
  const statusHistory = statusHistoryRaw
    .map(parseStatusHistoryEntry)
    .filter((entry): entry is OrderStatusHistoryEntry => entry !== null);
  const updatedAt =
    typeof value["updatedAt"] === "string" && !Number.isNaN(Date.parse(value["updatedAt"]))
      ? value["updatedAt"]
      : undefined;
  const adminNotes =
    typeof value["adminNotes"] === "string"
      ? truncateField(value["adminNotes"], MAX_ORDER_ADMIN_NOTES_CHARS)
      : undefined;

  return {
    id,
    orderNumber: typeof orderNumber === "string" && isOrderNumber(orderNumber) ? orderNumber : id,
    name,
    location,
    items: parsedItems,
    overallTotal,
    createdAt,
    ...(updatedAt ? { updatedAt } : {}),
    status,
    statusHistory:
      statusHistory.length > 0
        ? statusHistory
        : [{ status, changedAt: createdAt, changedBy: "system" }],
    ...(adminNotes ? { adminNotes } : {}),
  };
}

function parseStatusHistoryEntry(value: unknown): OrderStatusHistoryEntry | null {
  if (!isRecord(value)) return null;
  const { status, changedAt, changedBy, note } = value;
  if (typeof status !== "string" || !isOrderStatus(status)) return null;
  if (typeof changedAt !== "string" || Number.isNaN(Date.parse(changedAt))) return null;
  if (changedBy !== "system" && changedBy !== "admin") return null;

  return {
    status,
    changedAt,
    changedBy,
    ...(typeof note === "string" && note.trim()
      ? { note: truncateField(note, MAX_ORDER_STATUS_NOTE_CHARS) }
      : {}),
  };
}

function aggregateCartItems(items: CreateOrderCartItem[]) {
  const quantities = new Map<string, number>();

  for (const item of items) {
    const productId = item.productId.trim();
    const current = quantities.get(productId) ?? 0;
    quantities.set(productId, current + item.quantity);
  }

  return [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function snapshotProduct(product: Product, quantity: number): OrderSnapshotItem {
  const unitPrice = product.price;
  const lineSubtotal = unitPrice * quantity;

  return {
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    category: product.category,
    unitPrice,
    quantity,
    lineSubtotal,
  };
}

function parseNextSequence(raw: string | null) {
  if (!raw) return FIRST_ORDER_SEQUENCE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && typeof parsed["nextSequence"] === "number") {
      const nextSequence = parsed["nextSequence"];
      if (Number.isInteger(nextSequence) && nextSequence >= FIRST_ORDER_SEQUENCE) {
        return nextSequence;
      }
    }
  } catch {
    const sequence = Number(raw);
    if (Number.isInteger(sequence) && sequence >= FIRST_ORDER_SEQUENCE) return sequence;
  }

  return FIRST_ORDER_SEQUENCE;
}

async function readNextOrderSequence(store: OrderPersistence) {
  return parseNextSequence(await store.getText(ORDER_NUMBER_COUNTER_KEY));
}

function parseOrderIdIndex(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string" && isSafeOrderId(value));
  } catch {
    return [];
  }
}

async function readOrderIdIndex(store: OrderPersistence) {
  return parseOrderIdIndex(await store.getText(ORDER_INDEX_KEY));
}

async function writeOrderIdIndex(store: OrderPersistence, orderIds: string[]) {
  const unique = [...new Set(orderIds.filter(isSafeOrderId))];
  await store.setTextPermanent(ORDER_INDEX_KEY, JSON.stringify(unique));
}

async function rememberOrderId(store: OrderPersistence, orderId: string) {
  const existing = await readOrderIdIndex(store);
  if (existing.includes(orderId)) return;
  await writeOrderIdIndex(store, [orderId, ...existing]);
}

function orderIdFromOrderKey(key: string) {
  if (!key.startsWith(ORDER_KEY_PREFIX) || !key.endsWith(".json")) return null;
  if (key === ORDER_NUMBER_COUNTER_KEY || key === ORDER_INDEX_KEY) return null;
  const id = key.slice(ORDER_KEY_PREFIX.length, -".json".length);
  return isSafeOrderId(id) ? id : null;
}

async function discoverOrderIds(store: OrderPersistence) {
  const [indexed, listed] = await Promise.all([
    readOrderIdIndex(store),
    store.listKeys(ORDER_KEY_PREFIX),
  ]);
  const listedIds = listed.map(orderIdFromOrderKey).filter((id): id is string => id !== null);
  const all = [...new Set([...indexed, ...listedIds])];
  if (all.length !== indexed.length || all.some((id, index) => id !== indexed[index])) {
    await writeOrderIdIndex(store, all).catch(() => undefined);
  }
  return all;
}

async function writeOrderSnapshot(store: OrderPersistence, order: OrderSnapshot) {
  if (await store.getText(deletedOrderKey(order.id))) {
    throw new Error("This order has been deleted and cannot be updated.");
  }
  await store.setTextPermanent(orderKey(order.id), JSON.stringify(order));
  await store.setTextPermanent(orderNumberKey(order.orderNumber), order.id);
  await rememberOrderId(store, order.id);
}

async function createOrderWithNumber(
  store: OrderPersistence,
  orderData: Omit<OrderSnapshot, "id" | "orderNumber">,
) {
  const run = orderNumberLock.then(async () => {
    let sequence = await readNextOrderSequence(store);

    for (let attempts = 0; attempts < 100; attempts += 1) {
      const orderNumber = formatOrderNumber(sequence);
      const existingOrderId = await store.getText(orderNumberKey(orderNumber));
      if (existingOrderId) {
        sequence += 1;
        continue;
      }

      const order: OrderSnapshot = {
        id: crypto.randomUUID(),
        orderNumber,
        ...orderData,
      };
      const indexKey = orderNumberKey(orderNumber);
      const snapshotKey = orderKey(order.id);

      try {
        await store.setTextPermanent(indexKey, order.id);
        await store.setTextPermanent(snapshotKey, JSON.stringify(order));
        await rememberOrderId(store, order.id);
        await store.setTextPermanent(
          ORDER_NUMBER_COUNTER_KEY,
          JSON.stringify({
            nextSequence: sequence + 1,
            updatedAt: new Date().toISOString(),
          }),
        );
        return order;
      } catch (error) {
        await Promise.all([
          store.deleteKey(indexKey).catch(() => undefined),
          store.deleteKey(snapshotKey).catch(() => undefined),
        ]);
        throw error;
      }
    }

    throw new Error("Could not reserve a unique order number.");
  });

  orderNumberLock = run.catch(() => undefined);
  return run;
}

export async function createStoredOrder(data: CreateOrderInput): Promise<OrderSnapshot> {
  const customer = validateCustomerInfo(data.name, data.location);
  const cartItems = aggregateCartItems(data.cart);
  if (cartItems.length === 0) throw new Error("Add at least one product before ordering.");

  const products = await listStoredProducts();
  const productById = new Map(products.map((product) => [product.id, product]));
  const orderItems = cartItems.map(({ productId, quantity }) => {
    const product = productById.get(productId);
    if (!product || !product.available) {
      throw new Error("One or more selected products are no longer available.");
    }
    return snapshotProduct(product, quantity);
  });

  const overallTotal = orderItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const orderData: Omit<OrderSnapshot, "id" | "orderNumber"> = {
    name: customer.name,
    location: customer.location,
    items: orderItems,
    overallTotal,
    createdAt: new Date().toISOString(),
    status: "pending",
    statusHistory: [
      {
        status: "pending",
        changedAt: new Date().toISOString(),
        changedBy: "system",
      },
    ],
  };

  const store = await getPersistence();
  return createOrderWithNumber(store, orderData);
}

export async function readStoredOrder(orderId: string): Promise<OrderSnapshot | null> {
  const normalized = orderId.trim();
  if (!isSafeOrderId(normalized)) return null;

  const store = await getPersistence();
  if (await store.getText(deletedOrderKey(normalized))) return null;
  const raw = await store.getText(orderKey(normalized));
  if (!raw) return null;

  try {
    const order = parseStoredOrder(JSON.parse(raw));
    if (order) {
      await rememberOrderId(store, order.id).catch(() => undefined);
    }
    return order;
  } catch {
    await store.deleteKey(orderKey(normalized)).catch(() => undefined);
    return null;
  }
}

export async function resolveOrderNumber(orderNumberInput: string): Promise<string | null> {
  const orderNumber = normalizeOrderNumber(orderNumberInput);
  if (!isOrderNumber(orderNumber)) return null;

  const store = await getPersistence();
  const indexedOrderId = await store.getText(orderNumberKey(orderNumber));
  if (indexedOrderId && isSafeOrderId(indexedOrderId.trim())) return indexedOrderId.trim();

  const orders = await listStoredOrders({ query: orderNumber, status: "all", limit: 250 });
  const order = orders.find((item) => item.orderNumber === orderNumber);
  if (!order) return null;
  await store.setTextPermanent(orderNumberKey(order.orderNumber), order.id).catch(() => undefined);
  return order.id;
}

export async function readOrderForCustomerTracking(
  input: PublicOrderTrackingInput,
): Promise<OrderSnapshot | null> {
  const orderId = await resolveOrderNumber(input.orderNumber);
  if (!orderId) return null;
  const order = await readStoredOrder(orderId);
  if (!order) return null;
  if (!sameCustomerField(input.name, order.name)) return null;
  if (!sameCustomerField(input.location, order.location)) return null;
  return order;
}

export async function listStoredOrders({
  query = "",
  status = "all",
  limit = 100,
}: AdminOrderSearchInput = {}): Promise<OrderSnapshot[]> {
  const store = await getPersistence();
  const orderIds = await discoverOrderIds(store);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const normalizedStatus = typeof status === "string" && isOrderStatus(status) ? status : "all";
  const cappedLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 250) : 100;

  const orders = (
    await Promise.all(orderIds.map((orderId) => readStoredOrder(orderId)))
  ).filter((order): order is OrderSnapshot => order !== null);

  return orders
    .filter((order) => {
      if (normalizedStatus !== "all" && order.status !== normalizedStatus) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        order.orderNumber,
        order.name,
        order.location,
        order.id,
        ...order.items.map((item) => item.productName),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(normalizedQuery);
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, cappedLimit);
}

export async function updateStoredOrder(input: UpdateOrderInput): Promise<OrderSnapshot> {
  return runOrderMutation(() => updateOrderSnapshot(input));
}

async function updateOrderSnapshot(input: UpdateOrderInput): Promise<OrderSnapshot> {
  const store = await getPersistence();
  const order = await readStoredOrder(input.orderId);
  if (!order) throw new Error("That order could not be found.");
  if (input.status !== undefined && !isOrderStatus(input.status)) {
    throw new Error("Choose a valid order status.");
  }

  const now = new Date().toISOString();
  const status = input.status ?? order.status;
  const adminNotes = truncateField(
    input.adminNotes ?? order.adminNotes ?? "",
    MAX_ORDER_ADMIN_NOTES_CHARS,
  );
  const statusNote = truncateField(input.statusNote ?? "", MAX_ORDER_STATUS_NOTE_CHARS);
  const statusChanged = order.status !== status;
  let statusHistory: OrderStatusHistoryEntry[] = statusChanged
    ? [
        ...order.statusHistory,
        {
          status,
          changedAt: now,
          changedBy: "admin",
          ...(statusNote ? { note: statusNote } : {}),
        },
      ]
    : order.statusHistory;

  // A note edited after an automatic status save belongs to the current history entry.
  if (!statusChanged && input.statusNote !== undefined) {
    statusHistory = statusHistory.map((entry, index) => {
      if (index !== statusHistory.length - 1) return entry;
      const { note: previousNote, ...historyEntry } = entry;
      return { ...historyEntry, ...(statusNote ? { note: statusNote } : {}) };
    });
  }

  const updated: OrderSnapshot = {
    ...order,
    status,
    statusHistory,
    updatedAt: now,
    ...(adminNotes ? { adminNotes } : {}),
  };

  if (!adminNotes && "adminNotes" in updated) {
    delete updated.adminNotes;
  }

  await writeOrderSnapshot(store, updated);
  return updated;
}

async function deleteOrderSnapshot(store: OrderPersistence, orderId: string): Promise<void> {
  const marker = await store.getText(deletedOrderKey(orderId));
  const order = marker ? null : await readStoredOrder(orderId);
  // Keep only the number so a failed cleanup can be retried after the snapshot is gone.
  const parsedMarker: unknown = marker ? JSON.parse(marker) : null;
  const orderNumber =
    isRecord(parsedMarker) && typeof parsedMarker["orderNumber"] === "string"
      ? parsedMarker["orderNumber"]
      : order?.orderNumber;

  if (!marker) {
    await store.setTextPermanent(
      deletedOrderKey(orderId),
      JSON.stringify({ orderNumber, deletedAt: new Date().toISOString() }),
    );
  }
  await store.deleteKey(orderKey(orderId));
  if (orderNumber) await store.deleteKey(orderNumberKey(orderNumber));
  const indexed = await readOrderIdIndex(store);
  await writeOrderIdIndex(
    store,
    indexed.filter((id) => id !== orderId),
  );
}

function normalizeDeletionIds(orderIds: string[]) {
  const ids = [...new Set(orderIds.map((id) => id.trim()))];
  if (ids.some((id) => !isSafeOrderId(id))) throw new Error("Choose valid orders to delete.");
  return ids;
}

export async function deleteStoredOrder(orderId: string): Promise<string> {
  const id = orderId.trim();
  normalizeDeletionIds([id]);
  return runOrderMutation(async () => {
    const store = await getPersistence();
    await deleteOrderSnapshot(store, id);
    return id;
  });
}

export async function deleteStoredOrders(orderIds: string[]) {
  const ids = normalizeDeletionIds(orderIds);
  return runOrderMutation(async () => {
    const store = await getPersistence();
    const deletedIds: string[] = [];
    const failedIds: string[] = [];
    for (const id of ids) {
      try {
        await deleteOrderSnapshot(store, id);
        deletedIds.push(id);
      } catch {
        failedIds.push(id);
      }
    }
    return { deletedIds, failedIds };
  });
}
