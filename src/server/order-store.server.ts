import { isCategoryId, type Product } from "@/data/products";
import {
  MAX_ORDER_CUSTOMER_NAME_CHARS,
  MAX_ORDER_LOCATION_CHARS,
  type CreateOrderCartItem,
  type CreateOrderInput,
  type OrderSnapshot,
  type OrderSnapshotItem,
} from "@/data/orders";
import { listStoredProducts } from "@/server/catalog-store.server";
import { getRequest } from "@tanstack/start-server-core";

const CATALOG_KV_BINDING = "simplyclassy_catalog";
const ORDER_KEY_PREFIX = "orders/";
const ORDER_NUMBER_COUNTER_KEY = "orders/order-number-counter.json";
const ORDER_NUMBER_INDEX_PREFIX = "order-numbers/";
const FIRST_ORDER_SEQUENCE = 437001;
const ORDER_NUMBER_PREFIX = "SC-";
export const ORDER_RETENTION_SECONDS = 60 * 60 * 24 * 30;

type OrderPersistence = {
  getText: (key: string) => Promise<string | null>;
  setText: (key: string, value: string, expirationTtlSeconds: number) => Promise<void>;
  setTextPermanent: (key: string, value: string) => Promise<void>;
  deleteKey: (key: string) => Promise<void>;
};

let persistencePromise: Promise<OrderPersistence> | undefined;
let orderNumberLock: Promise<unknown> = Promise.resolve();

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
  };
}

async function createFilePersistence(): Promise<OrderPersistence> {
  const { mkdir, readFile, writeFile, unlink } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const root = join(process.cwd(), ".data", "orders");
  await mkdir(root, { recursive: true });

  const fileFor = (key: string) => join(root, key.replaceAll("/", "__"));

  return {
    async getText(key) {
      try {
        const raw = await readFile(fileFor(key), "utf8");
        const parsed: unknown = JSON.parse(raw);
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
      } catch {
        return null;
      }
    },
    async setText(key, value, expirationTtlSeconds) {
      const expiresAt = new Date(Date.now() + expirationTtlSeconds * 1000).toISOString();
      await writeFile(fileFor(key), JSON.stringify({ expiresAt, value }), "utf8");
    },
    async setTextPermanent(key, value) {
      await writeFile(fileFor(key), value, "utf8");
    },
    async deleteKey(key) {
      await unlink(fileFor(key)).catch(() => undefined);
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

const formatOrderNumber = (sequence: number) => `${ORDER_NUMBER_PREFIX}${sequence}`;

function normalizeCustomerField(value: string) {
  return value.trim().replace(/\s+/g, " ");
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

  return {
    id,
    orderNumber: typeof orderNumber === "string" && isOrderNumber(orderNumber) ? orderNumber : id,
    name,
    location,
    items: parsedItems,
    overallTotal,
    createdAt,
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
        await store.setText(indexKey, order.id, ORDER_RETENTION_SECONDS);
        await store.setText(snapshotKey, JSON.stringify(order), ORDER_RETENTION_SECONDS);
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
  };

  const store = await getPersistence();
  return createOrderWithNumber(store, orderData);
}

export async function readStoredOrder(orderId: string): Promise<OrderSnapshot | null> {
  const normalized = orderId.trim();
  if (!isSafeOrderId(normalized)) return null;

  const store = await getPersistence();
  const raw = await store.getText(orderKey(normalized));
  if (!raw) return null;

  try {
    return parseStoredOrder(JSON.parse(raw));
  } catch {
    await store.deleteKey(orderKey(normalized)).catch(() => undefined);
    return null;
  }
}
