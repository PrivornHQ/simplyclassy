import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { countReviewWords, MAX_REVIEW_IMAGES, MAX_REVIEW_WORDS, type CustomerReview } from "@/data/reviews";
import { requireAdminSession } from "@/server/admin-auth.server";
import {
  deleteReviewImageByUrl,
  deleteStoredReview,
  listStoredReviews,
  saveReviewImage,
  writeStoredReviews,
} from "@/server/review-store.server";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const formString = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const isImageFile = (file: File) => file.type.startsWith("image/");

async function fileToBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export const listPublicReviews = createServerFn({ method: "GET" }).handler(async () => {
  return listStoredReviews();
});

export const submitCustomerReview = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected form data.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const text = formString(data, "text");
    const rating = Number(formString(data, "rating"));
    const imageFiles = data
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (!text) throw new Error("Review text is required.");
    if (countReviewWords(text) > MAX_REVIEW_WORDS) {
      throw new Error(`Review must be ${MAX_REVIEW_WORDS} words or fewer.`);
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("Choose a star rating from 1 to 5.");
    }
    if (imageFiles.length > MAX_REVIEW_IMAGES) {
      throw new Error(`Please upload no more than ${MAX_REVIEW_IMAGES} images.`);
    }

    for (const imageFile of imageFiles) {
      if (!isImageFile(imageFile)) throw new Error("Please upload image files only.");
      if (imageFile.size > MAX_IMAGE_BYTES) throw new Error("Each image must be under 4MB.");
    }

    const savedImageUrls: string[] = [];
    try {
      for (const imageFile of imageFiles) {
        const imageId = crypto.randomUUID();
        const bytes = await fileToBytes(imageFile);
        const url = await saveReviewImage(imageId, bytes, imageFile.type || "image/jpeg");
        savedImageUrls.push(url);
      }

      const review: CustomerReview = {
        id: crypto.randomUUID(),
        text,
        rating,
        imageUrls: savedImageUrls,
        createdAt: new Date().toISOString(),
      };

      const reviews = await listStoredReviews();
      await writeStoredReviews([review, ...reviews]);
      return review;
    } catch (error) {
      await Promise.all(savedImageUrls.map((url) => deleteReviewImageByUrl(url)));
      throw error;
    }
  });

export const listAdminReviews = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  return listStoredReviews();
});

export const deleteAdminReview = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const deleted = await deleteStoredReview(data.id);
    if (!deleted) throw new Error("That review no longer exists.");
    return { ok: true as const };
  });
