import { getRequest } from "@tanstack/start-server-core";
import {
  countReviewWords,
  MAX_REVIEW_LOCATION_CHARS,
  MAX_REVIEW_NAME_CHARS,
  MAX_REVIEW_WORDS,
  type CustomerReview,
} from "@/data/reviews";

const CATALOG_KV_BINDING = "simplyclassy_catalog";
const REVIEWS_KEY = "reviews.json";

type StoredImage = {
  data: Uint8Array;
  contentType: string;
};

type ReviewPersistence = {
  getText: (key: string) => Promise<string | null>;
  setText: (key: string, value: string) => Promise<void>;
  getBytes: (key: string) => Promise<StoredImage | null>;
  setBytes: (key: string, data: Uint8Array, contentType: string) => Promise<void>;
  deleteKey: (key: string) => Promise<void>;
};

let persistencePromise: Promise<ReviewPersistence> | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type KVImageMetadata = {
  contentType?: unknown;
};

type ReviewKVNamespace = {
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

const isReviewKVNamespace = (value: unknown): value is ReviewKVNamespace =>
  isRecord(value) &&
  typeof value.get === "function" &&
  typeof value.getWithMetadata === "function" &&
  typeof value.put === "function" &&
  typeof value.delete === "function";

function getReviewKVBinding(): ReviewKVNamespace | null {
  try {
    const request = getRequest() as RuntimeRequest;
    const binding = request.runtime?.cloudflare?.env?.[CATALOG_KV_BINDING];
    return isReviewKVNamespace(binding) ? binding : null;
  } catch {
    return null;
  }
}

function createCloudflareKVPersistence(kv: ReviewKVNamespace): ReviewPersistence {
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

async function createFilePersistence(): Promise<ReviewPersistence> {
  const { mkdir, readFile, writeFile, unlink } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const root = join(process.cwd(), ".data", "reviews");
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

async function getPersistence(): Promise<ReviewPersistence> {
  if (!persistencePromise) {
    persistencePromise = (async () => {
      const kv = getReviewKVBinding();
      return kv ? createCloudflareKVPersistence(kv) : createFilePersistence();
    })();
  }
  return persistencePromise;
}

function parseReview(value: unknown): CustomerReview | null {
  if (!isRecord(value)) return null;
  const { id, name, location, text, rating, imageUrls, createdAt } = value;
  if (typeof id !== "string" || typeof text !== "string") return null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  if (!Array.isArray(imageUrls) || !imageUrls.every((url) => typeof url === "string")) return null;
  if (typeof createdAt !== "string") return null;
  if (!text.trim() || countReviewWords(text) > MAX_REVIEW_WORDS) return null;

  const review: CustomerReview = {
    id,
    text: text.trim(),
    rating,
    imageUrls,
    createdAt,
  };

  if (typeof name === "string") {
    const trimmedName = name.trim();
    if (trimmedName && trimmedName.length <= MAX_REVIEW_NAME_CHARS) {
      review.name = trimmedName;
    }
  }

  if (typeof location === "string") {
    const trimmedLocation = location.trim();
    if (trimmedLocation && trimmedLocation.length <= MAX_REVIEW_LOCATION_CHARS) {
      review.location = trimmedLocation;
    }
  }

  return review;
}

async function readReviewsRaw(store: ReviewPersistence): Promise<CustomerReview[]> {
  const raw = await store.getText(REVIEWS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseReview).filter((review): review is CustomerReview => review !== null);
  } catch {
    return [];
  }
}

export async function listStoredReviews(): Promise<CustomerReview[]> {
  const store = await getPersistence();
  const reviews = await readReviewsRaw(store);
  return reviews.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function writeStoredReviews(reviews: CustomerReview[]): Promise<void> {
  const store = await getPersistence();
  await store.setText(REVIEWS_KEY, JSON.stringify(reviews));
}

export function managedReviewImageKeyFromUrl(image: string): string | null {
  const prefix = "/api/reviews/images/";
  if (!image.startsWith(prefix)) return null;
  const key = image.slice(prefix.length).trim();
  if (!key || key.includes("..") || key.includes("/")) return null;
  return key;
}

export async function saveReviewImage(
  imageId: string,
  data: Uint8Array,
  contentType: string,
): Promise<string> {
  const store = await getPersistence();
  await store.setBytes(`review-images/${imageId}`, data, contentType);
  return `/api/reviews/images/${imageId}`;
}

export async function readReviewImage(imageId: string): Promise<StoredImage | null> {
  if (!imageId || imageId.includes("..") || imageId.includes("/")) return null;
  const store = await getPersistence();
  return store.getBytes(`review-images/${imageId}`);
}

export async function deleteReviewImageByUrl(image: string): Promise<void> {
  const imageId = managedReviewImageKeyFromUrl(image);
  if (!imageId) return;
  const store = await getPersistence();
  await store.deleteKey(`review-images/${imageId}`);
}

export async function deleteStoredReview(reviewId: string): Promise<boolean> {
  const reviews = await listStoredReviews();
  const existing = reviews.find((review) => review.id === reviewId);
  if (!existing) return false;
  await writeStoredReviews(reviews.filter((review) => review.id !== reviewId));
  await Promise.all(existing.imageUrls.map((url) => deleteReviewImageByUrl(url)));
  return true;
}
