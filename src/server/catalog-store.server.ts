import type { Product } from "@/data/products";
import { isCategoryId, seedProducts } from "@/data/products";
import { getRequest } from "@tanstack/start-server-core";

const CATALOG_KV_BINDING = "simplyclassy_catalog";
const PRODUCTS_KEY = "products.json";

type StoredImage = {
  data: Uint8Array;
  contentType: string;
};

type CatalogPersistence = {
  getText: (key: string) => Promise<string | null>;
  setText: (key: string, value: string) => Promise<void>;
  getBytes: (key: string) => Promise<StoredImage | null>;
  setBytes: (key: string, data: Uint8Array, contentType: string) => Promise<void>;
  deleteKey: (key: string) => Promise<void>;
};

let persistencePromise: Promise<CatalogPersistence> | undefined;
let seedLock: Promise<void> | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type KVImageMetadata = {
  contentType?: unknown;
};

type CatalogKVNamespace = {
  get: {
    (key: string, options: { type: "text" }): Promise<string | null>;
    (key: string, options: { type: "arrayBuffer" }): Promise<ArrayBuffer | null>;
  };
  getWithMetadata: <TMetadata extends Record<string, unknown>>(
    key: string,
    options: { type: "arrayBuffer" },
  ) => Promise<{ value: ArrayBuffer | null; metadata: TMetadata | null }>;
  put: (
    key: string,
    value: string | ArrayBuffer | ArrayBufferView,
    options?: { metadata?: Record<string, unknown> },
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

const isCatalogKVNamespace = (value: unknown): value is CatalogKVNamespace =>
  isRecord(value) &&
  typeof value.get === "function" &&
  typeof value.getWithMetadata === "function" &&
  typeof value.put === "function" &&
  typeof value.delete === "function";

function getCatalogKVBinding(): CatalogKVNamespace | null {
  try {
    const request = getRequest() as RuntimeRequest;
    const binding = request.runtime?.cloudflare?.env?.[CATALOG_KV_BINDING];
    return isCatalogKVNamespace(binding) ? binding : null;
  } catch {
    return null;
  }
}

function createCloudflareKVPersistence(kv: CatalogKVNamespace): CatalogPersistence {
  return {
    async getText(key) {
      return kv.get(key, { type: "text" });
    },
    async setText(key, value) {
      await kv.put(key, value, { metadata: { contentType: "application/json" } });
    },
    async getBytes(key) {
      const result = await kv.getWithMetadata<KVImageMetadata>(key, { type: "arrayBuffer" });
      if (!result.value) return null;
      const contentType =
        typeof result.metadata?.contentType === "string"
          ? result.metadata.contentType
          : "application/octet-stream";
      return { data: new Uint8Array(result.value), contentType };
    },
    async setBytes(key, data, contentType) {
      await kv.put(key, data, { metadata: { contentType } });
    },
    async deleteKey(key) {
      await kv.delete(key);
    },
  };
}

async function createFilePersistence(): Promise<CatalogPersistence> {
  const { mkdir, readFile, writeFile, unlink } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const root = join(process.cwd(), ".data", "catalog");
  await mkdir(root, { recursive: true });

  const fileFor = (key: string) => join(root, key.replaceAll("/", "__"));
  const metaFor = (key: string) => `${fileFor(key)}.meta.json`;

  return {
    async getText(key) {
      try {
        return await readFile(fileFor(key), "utf8");
      } catch {
        return null;
      }
    },
    async setText(key, value) {
      await writeFile(fileFor(key), value, "utf8");
    },
    async getBytes(key) {
      try {
        const [buf, metaRaw] = await Promise.all([
          readFile(fileFor(key)),
          readFile(metaFor(key), "utf8").catch(() => '{"contentType":"application/octet-stream"}'),
        ]);
        const parsed = JSON.parse(metaRaw) as { contentType?: string };
        return {
          data: new Uint8Array(buf),
          contentType: parsed.contentType ?? "application/octet-stream",
        };
      } catch {
        return null;
      }
    },
    async setBytes(key, data, contentType) {
      await writeFile(fileFor(key), data);
      await writeFile(metaFor(key), JSON.stringify({ contentType }), "utf8");
    },
    async deleteKey(key) {
      await Promise.all([
        unlink(fileFor(key)).catch(() => undefined),
        unlink(metaFor(key)).catch(() => undefined),
      ]);
    },
  };
}

async function getPersistence(): Promise<CatalogPersistence> {
  if (!persistencePromise) {
    persistencePromise = (async () => {
      const kv = getCatalogKVBinding();
      return kv ? createCloudflareKVPersistence(kv) : createFilePersistence();
    })();
  }
  return persistencePromise;
}

const isProductBadge = (value: unknown): value is Product["badge"] =>
  value === null || value === "New Arrival" || value === "Best Seller";

function parseProduct(value: unknown): Product | null {
  if (!isRecord(value)) return null;
  const { id, name, category, price, image, alt, badge, available, createdAt } = value;
  if (typeof id !== "string" || typeof name !== "string") return null;
  if (typeof category !== "string" || !isCategoryId(category)) return null;
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (typeof image !== "string" || typeof alt !== "string") return null;
  if (!isProductBadge(badge) || typeof available !== "boolean") return null;
  if (typeof createdAt !== "string") return null;

  const product: Product = {
    id,
    name,
    category,
    price,
    image,
    alt,
    badge,
    available,
    createdAt,
  };

  if (typeof value["description"] === "string" && value["description"].trim()) {
    product.description = value["description"].trim();
  }

  return product;
}

async function readProductsRaw(store: CatalogPersistence): Promise<Product[] | null> {
  const raw = await store.getText(PRODUCTS_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const products = parsed.map(parseProduct).filter((p): p is Product => p !== null);
    return products;
  } catch {
    return null;
  }
}

async function ensureSeeded(store: CatalogPersistence): Promise<void> {
  if (!seedLock) {
    seedLock = (async () => {
      const existing = await readProductsRaw(store);
      if (existing && existing.length > 0) return;
      await store.setText(PRODUCTS_KEY, JSON.stringify(seedProducts));
    })().finally(() => {
      seedLock = undefined;
    });
  }
  await seedLock;
}

export async function listStoredProducts(): Promise<Product[]> {
  const store = await getPersistence();
  await ensureSeeded(store);
  const products = await readProductsRaw(store);
  return products ?? [...seedProducts];
}

export async function writeStoredProducts(products: Product[]): Promise<void> {
  const store = await getPersistence();
  await store.setText(PRODUCTS_KEY, JSON.stringify(products));
}

export function managedImageKeyFromUrl(image: string): string | null {
  const prefix = "/api/catalog/images/";
  if (!image.startsWith(prefix)) return null;
  const key = image.slice(prefix.length).trim();
  if (!key || key.includes("..") || key.includes("/")) return null;
  return key;
}

export async function saveProductImage(
  imageId: string,
  data: Uint8Array,
  contentType: string,
): Promise<string> {
  const store = await getPersistence();
  await store.setBytes(`images/${imageId}`, data, contentType);
  return `/api/catalog/images/${imageId}`;
}

export async function readProductImage(imageId: string): Promise<StoredImage | null> {
  if (!imageId || imageId.includes("..") || imageId.includes("/")) return null;
  const store = await getPersistence();
  return store.getBytes(`images/${imageId}`);
}

export async function deleteProductImageByUrl(image: string): Promise<void> {
  const imageId = managedImageKeyFromUrl(image);
  if (!imageId) return;
  const store = await getPersistence();
  await store.deleteKey(`images/${imageId}`);
}
