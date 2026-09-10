const MAX_DIMENSION = 1200;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const OUTPUT_BYTES_HINT = 4 * 1024 * 1024;

export async function optimizeProductImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Image must be under 8MB.");
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error("Couldn't read that image. Try a JPG or PNG.");
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
    throw new Error("Couldn't process that image.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/jpeg", 0.82);
  });
  if (!blob) {
    throw new Error("Couldn't process that image.");
  }
  if (blob.size > OUTPUT_BYTES_HINT) {
    throw new Error("Image is still too large after resizing. Try a smaller photo.");
  }

  return new File([blob], "product.jpg", { type: "image/jpeg" });
}
