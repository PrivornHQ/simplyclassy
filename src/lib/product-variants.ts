import { z } from "zod";
import { MAX_COLOR_IMAGES, MAX_PRODUCT_COLORS } from "@/data/products";

const colorId = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/, "Choose a valid color identifier.");
const colorFields = {
  id: colorId,
  name: z.string().trim().min(1, "Give every color a name.").max(40),
  swatch: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/, "Choose a valid swatch.")
    .optional(),
};

function distinctColors(colors: { id: string; name: string }[]) {
  return (
    new Set(colors.map((color) => color.id)).size === colors.length &&
    new Set(colors.map((color) => color.name.toLocaleLowerCase())).size === colors.length
  );
}

export const productColorsSchema = z
  .array(
    z.object({
      ...colorFields,
      images: z.array(z.string().min(1).max(2048)).min(1).max(MAX_COLOR_IMAGES),
    }),
  )
  .max(MAX_PRODUCT_COLORS)
  .refine(distinctColors, "Each color must have a unique name and identifier.");

export const colorUploadSchema = z
  .object({
    colors: z
      .array(
        z.object({
          ...colorFields,
          images: z
            .array(
              z.union([
                z.object({ url: z.string().min(1).max(2048) }).strict(),
                z
                  .object({ uploadKey: z.string().regex(/^color-image-[a-zA-Z0-9_-]{1,160}$/) })
                  .strict(),
              ]),
            )
            .min(1, "Upload at least one image for each color.")
            .max(MAX_COLOR_IMAGES),
        }),
      )
      .max(MAX_PRODUCT_COLORS)
      .refine(distinctColors, "Each color must have a unique name and identifier."),
    defaultColorId: colorId.optional(),
  })
  .refine(
    (value) =>
      value.colors.length === 0
        ? value.defaultColorId === undefined
        : value.colors.some((color) => color.id === value.defaultColorId),
    "Choose a default color from the available colors.",
  );

export type ColorUploadManifest = z.infer<typeof colorUploadSchema>;
