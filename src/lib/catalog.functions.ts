import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  isCategoryId,
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PRODUCT_UPLOAD_BYTES,
  type Product,
  type ProductBadge,
  type ProductColor,
} from "@/data/products";
import { colorUploadSchema, type ColorUploadManifest } from "@/lib/product-variants";
import { requireAdminSession } from "@/server/admin-auth.server";
import {
  deleteProductImageByUrl,
  listStoredProducts,
  saveProductImage,
  withCatalogMutation,
  writeStoredProducts,
} from "@/server/catalog-store.server";

export const listPublicProducts = createServerFn({ method: "GET" }).handler(async () => {
  const products = await listStoredProducts();
  return products.filter((p) => p.available);
});

export const listAdminProducts = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  return listStoredProducts();
});

const formString = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const parseBadge = (value: string): ProductBadge => {
  if (value === "New Arrival" || value === "Best Seller") return value;
  return null;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function validateImage(file: File) {
  if (!IMAGE_TYPES.has(file.type)) throw new Error("Upload a JPG, PNG, WebP or AVIF image.");
  if (file.size === 0 || file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("Each image must be nonempty and under 4MB.");
  }
}

function readColorManifest(form: FormData): ColorUploadManifest | null {
  const raw = form.get("colors");
  if (raw === null) return null;
  if (typeof raw !== "string") throw new Error("The available colors could not be read.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The available colors could not be read.");
  }
  const result = colorUploadSchema.safeParse(parsed);
  if (!result.success)
    throw new Error(result.error.issues[0]?.message ?? "Check the available colors.");
  return result.data;
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export const saveAdminProduct = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected form data.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await requireAdminSession();
    return withCatalogMutation(() => persistProduct(data));
  });

async function persistProduct(data: FormData): Promise<Product> {
  const id = formString(data, "id");
  const name = formString(data, "name");
  const category = formString(data, "category");
  const priceRaw = formString(data, "price");
  const description = formString(data, "description");
  const available = formString(data, "available") !== "false";
  const badge = parseBadge(formString(data, "badge"));
  const imageField = data.get("image");
  const imageFile = imageField instanceof File && imageField.size > 0 ? imageField : null;
  const colorManifest = readColorManifest(data);

  if (!name) throw new Error("Product name is required.");
  if (name.length > 120) throw new Error("Product name is too long.");
  if (!isCategoryId(category)) {
    throw new Error("Choose an existing product category.");
  }
  const price = Number(priceRaw);
  if (!priceRaw || !Number.isFinite(price) || price < 0) throw new Error("Enter a valid price.");
  if (description.length > 600) throw new Error("Description is too long.");

  let uploadBytes = 0;
  for (const value of data.values()) {
    if (!(value instanceof File)) continue;
    validateImage(value);
    uploadBytes += value.size;
  }
  if (uploadBytes > MAX_PRODUCT_UPLOAD_BYTES)
    throw new Error("Upload no more than 24MB of images at once.");

  const products = await listStoredProducts();
  const existing = id ? products.find((p) => p.id === id) : undefined;

  if (id && !existing) throw new Error("That product no longer exists.");
  if (!existing && !imageFile) throw new Error("A product image is required.");

  const uploadKeys = new Set<string>();
  for (const color of colorManifest?.colors ?? []) {
    const oldColor = existing?.colors?.find((value) => value.id === color.id);
    for (const image of color.images) {
      if ("url" in image) {
        if (!oldColor?.images.includes(image.url)) {
          throw new Error("An existing image must belong to this product and color.");
        }
      } else {
        const file = data.get(image.uploadKey);
        if (!(file instanceof File)) throw new Error(`Upload the images for ${color.name}.`);
        if (uploadKeys.has(image.uploadKey))
          throw new Error("Each uploaded image must belong to one color.");
        uploadKeys.add(image.uploadKey);
      }
    }
  }
  for (const [key, value] of data.entries()) {
    if (value instanceof File && key !== "image" && !uploadKeys.has(key)) {
      throw new Error("An uploaded image is not assigned to a color.");
    }
  }

  const uploadedUrls: string[] = [];
  const upload = async (file: File) => {
    const imageId = crypto.randomUUID();
    uploadedUrls.push(`/api/catalog/images/${imageId}`);
    return saveProductImage(imageId, await fileToBytes(file), file.type);
  };

  try {
    const image = imageFile ? await upload(imageFile) : existing!.image;
    const colors: ProductColor[] = [];
    if (colorManifest) {
      for (const color of colorManifest.colors) {
        const images: string[] = [];
        for (const source of color.images) {
          images.push(
            "url" in source ? source.url : await upload(data.get(source.uploadKey) as File),
          );
        }
        colors.push({
          id: color.id,
          name: color.name,
          images,
          ...(color.swatch ? { swatch: color.swatch } : {}),
        });
      }
    } else {
      colors.push(...(existing?.colors ?? []));
    }

    const product: Product = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      category,
      price,
      image,
      alt: `${name} from SimplyClassy`,
      badge,
      available,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    if (description) {
      product.description = description;
    }
    if (colors.length > 0) {
      product.colors = colors;
      const defaultColorId =
        colorManifest?.defaultColorId ?? existing?.defaultColorId ?? colors[0]?.id;
      if (defaultColorId) product.defaultColorId = defaultColorId;
    }

    const next = existing
      ? products.map((p) => (p.id === product.id ? product : p))
      : [product, ...products];

    await writeStoredProducts(next);
    // Saved order snapshots reference committed image URLs, so keep those images available.
    return product;
  } catch (error) {
    await Promise.all(
      uploadedUrls.map((url) => deleteProductImageByUrl(url).catch(() => undefined)),
    );
    throw error;
  }
}

export const deleteAdminProduct = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireAdminSession();
    return withCatalogMutation(async () => {
      const products = await listStoredProducts();
      const existing = products.find((p) => p.id === data.id);
      if (!existing) throw new Error("That product no longer exists.");
      await writeStoredProducts(products.filter((p) => p.id !== data.id));
      return { ok: true as const };
    });
  });
