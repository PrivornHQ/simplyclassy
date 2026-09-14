const MAX_DIMENSION = 1200;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const OUTPUT_BYTES_HINT = 4 * 1024 * 1024;

export async function optimizeReviewImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose image files only.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Each image must be under 8MB.");
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error("Couldn't read one of those images. Try JPG or PNG.");
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Couldn't process one of those images.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/jpeg", 0.82);
  });
  if (!blob) {
    throw new Error("Couldn't process one of those images.");
  }
  if (blob.size > OUTPUT_BYTES_HINT) {
    throw new Error("One image is still too large after resizing. Try a smaller photo.");
  }

  return new File([blob], "review-photo.jpg", { type: "image/jpeg" });
}
