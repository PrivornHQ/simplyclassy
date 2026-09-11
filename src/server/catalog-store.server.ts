import type { Product } from "@/data/products";
import { isCategoryId, seedProducts } from "@/data/products";

const STORE_NAME = "simplyclassy-catalog";
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

const env = (name: string) => (process.env[name] ?? "").trim();

const canUseNetlifyBlobs = () =>
  Boolean(
    env("NETLIFY_BLOBS_CONTEXT") ||
    env("NETLIFY") ||
    (env("NETLIFY_SITE_ID") &&
      (env("NETLIFY_BLOBS_TOKEN") || env("NETLIFY_TOKEN") || env("NETLIFY_AUTH_TOKEN"))),
  );

async function createNetlifyPersistence(): Promise<CatalogPersistence | null> {
  const onNetlify = Boolean(env("NETLIFY") || env("NETLIFY_BLOBS_CONTEXT"));
  if (!canUseNetlifyBlobs()) return null;

  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: STORE_NAME, consistency: "strong" });

    return {
      async getText(key) {
        try {
          const value = await store.get(key, { type: "text" });
          return value ? value : null;
        } catch {
          return null;
        }
      },
      async setText(key, value) {
        await store.set(key, value, { metadata: { contentType: "application/json" } });
      },
      async getBytes(key) {
        const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
        if (!result?.data) return null;
        const contentType =
          typeof result.metadata["contentType"] === "string"
            ? result.metadata["contentType"]
            : "application/octet-stream";
        return { data: new Uint8Array(result.data), contentType };
      },
      async setBytes(key, data, contentType) {
        await store.set(key, new Blob([data as BlobPart]), { metadata: { contentType } });
      },
      async deleteKey(key) {
        await store.delete(key);
      },
    };
  } catch (error) {
    if (onNetlify) throw error;
    console.warn("Netlify Blobs unavailable; using local file catalog store.", error);
    return null;
  }
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
      const blobs = await createNetlifyPersistence();
      return blobs ?? createFilePersistence();
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
