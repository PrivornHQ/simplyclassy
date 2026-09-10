import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isCategoryId, type Product, type ProductBadge } from "@/data/products";
import { requireAdminSession } from "@/server/admin-auth.server";
import {
  deleteProductImageByUrl,
  listStoredProducts,
  managedImageKeyFromUrl,
  saveProductImage,
  writeStoredProducts,
} from "@/server/catalog-store.server";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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

const isImageFile = (file: File) => file.type.startsWith("image/");

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

    const id = formString(data, "id");
    const name = formString(data, "name");
    const category = formString(data, "category");
    const priceRaw = formString(data, "price");
    const description = formString(data, "description");
    const available = formString(data, "available") !== "false";
    const badge = parseBadge(formString(data, "badge"));
    const imageField = data.get("image");
    const imageFile = imageField instanceof File && imageField.size > 0 ? imageField : null;

    if (!name) throw new Error("Product name is required.");
    if (name.length > 120) throw new Error("Product name is too long.");
    if (!isCategoryId(category)) {
      throw new Error("Choose an existing product category.");
    }
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid price.");
    if (description.length > 600) throw new Error("Description is too long.");

    if (imageFile) {
      if (!isImageFile(imageFile)) throw new Error("Please upload an image file.");
      if (imageFile.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 4MB.");
    }

    const products = await listStoredProducts();
    const existing = id ? products.find((p) => p.id === id) : undefined;

    if (id && !existing) throw new Error("That product no longer exists.");
    if (!existing && !imageFile) throw new Error("A product image is required.");

    let image = existing?.image ?? "";
    let alt = existing?.alt ?? `${name} from SimplyClassy`;

    if (imageFile) {
      const imageId = crypto.randomUUID();
      const bytes = await fileToBytes(imageFile);
      const previousImage = image;
      image = await saveProductImage(imageId, bytes, imageFile.type || "image/jpeg");
      alt = `${name} from SimplyClassy`;
      if (previousImage && managedImageKeyFromUrl(previousImage)) {
        await deleteProductImageByUrl(previousImage);
      }
    }

    const product: Product = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      category,
      price,
      image,
      alt,
      badge,
      available,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    if (description) {
      product.description = description;
    }

    const next = existing
      ? products.map((p) => (p.id === product.id ? product : p))
      : [product, ...products];

    await writeStoredProducts(next);
    return product;
  });

export const deleteAdminProduct = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const products = await listStoredProducts();
    const existing = products.find((p) => p.id === data.id);
    if (!existing) throw new Error("That product no longer exists.");
    await writeStoredProducts(products.filter((p) => p.id !== data.id));
    await deleteProductImageByUrl(existing.image);
    return { ok: true as const };
  });
