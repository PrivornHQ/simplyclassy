import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  categories,
  formatCedis,
  MAX_COLOR_IMAGES,
  MAX_PRODUCT_COLORS,
  MAX_PRODUCT_UPLOAD_BYTES,
  type CategoryId,
  type Product,
  type ProductBadge,
} from "@/data/products";
import { optimizeProductImage } from "@/lib/optimize-product-image";

export type ProductImageDraft = { id: string; value: string | File };
export type ProductColorDraft = {
  id: string;
  name: string;
  swatch: string | null;
  images: ProductImageDraft[];
};

export type ProductFormValues = {
  name: string;
  category: CategoryId;
  price: string;
  description: string;
  available: boolean;
  badge: ProductBadge;
  imageFile: File | null;
  colors: ProductColorDraft[];
  defaultColorId: string;
};

export function ProductForm({
  product,
  saving,
  onCancel,
  onSave,
}: {
  product: Product | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (values: ProductFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<CategoryId>(product?.category ?? "perfumes");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [available, setAvailable] = useState(product?.available ?? true);
  const [badge, setBadge] = useState<ProductBadge>(product?.badge ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [activeColorUpload, setActiveColorUpload] = useState<string | null>(null);
  const [colorImageError, setColorImageError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.image ?? null);
  const [colors, setColors] = useState<ProductColorDraft[]>(() =>
    (product?.colors ?? []).map((color) => ({
      id: color.id,
      name: color.name,
      swatch: color.swatch ?? null,
      images: color.images.map((value, index) => ({ id: `${color.id}-${index}`, value })),
    })),
  );
  const [defaultColorId, setDefaultColorId] = useState(
    product?.defaultColorId ?? product?.colors?.[0]?.id ?? "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const changeColor = (id: string, values: Partial<ProductColorDraft>) => {
    setColors((current) =>
      current.map((color) => (color.id === id ? { ...color, ...values } : color)),
    );
  };

  const uploadColorImages = async (id: string, files: File[], replaceId?: string) => {
    const color = colors.find((value) => value.id === id);
    if (!color || files.length === 0) return;
    setColorImageError(null);
    if (!replaceId && color.images.length + files.length > MAX_COLOR_IMAGES) {
      setColorImageError({ id, message: `Each color can have up to ${MAX_COLOR_IMAGES} images.` });
      return;
    }
    setOptimizing(true);
    setActiveColorUpload(id);
    try {
      const uploads: ProductImageDraft[] = [];
      for (const file of files) {
        uploads.push({ id: crypto.randomUUID(), value: await optimizeProductImage(file) });
      }
      setColors((current) =>
        current.map((value) =>
          value.id === id
            ? {
                ...value,
                images: replaceId
                  ? value.images.map((image) => (image.id === replaceId ? uploads[0]! : image))
                  : [...value.images, ...uploads],
              }
            : value,
        ),
      );
    } catch (error) {
      setColorImageError({
        id,
        message: error instanceof Error ? error.message : "Couldn't prepare these images.",
      });
    } finally {
      setOptimizing(false);
      setActiveColorUpload(null);
    }
  };

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const previewLabel = useMemo(() => {
    if (imageFile) return "Selected image preview";
    if (product) return "Current product image";
    return "Image preview";
  }, [imageFile, product]);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving || optimizing) return;
        setValidationError(null);
        if (!product && !imageFile) {
          setValidationError("Upload a main product image.");
          return;
        }
        if (colors.some((color) => !color.name.trim() || color.images.length === 0)) {
          setValidationError("Give every color a name and at least one image.");
          return;
        }
        if (
          new Set(colors.map((color) => color.name.trim().toLocaleLowerCase())).size !==
          colors.length
        ) {
          setValidationError("Use a different name for each color.");
          return;
        }
        if (colors.length > 0 && !colors.some((color) => color.id === defaultColorId)) {
          setValidationError("Choose a default color.");
          return;
        }
        const uploadBytes =
          (imageFile?.size ?? 0) +
          colors.reduce(
            (sum, color) =>
              sum +
              color.images.reduce(
                (total, image) => total + (typeof image.value === "string" ? 0 : image.value.size),
                0,
              ),
            0,
          );
        if (uploadBytes > MAX_PRODUCT_UPLOAD_BYTES) {
          setValidationError("Upload no more than 24MB of images at once.");
          return;
        }
        await onSave({
          name,
          category,
          price,
          description,
          available,
          badge,
          imageFile,
          colors,
          defaultColorId,
        });
      }}
    >
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">
          {product ? "Edit product" : "Add product"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {product
            ? "Update this item in the live catalogue."
            : "This item will appear on the website after you save."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-image">Product image</Label>
        <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={previewLabel}
              className="aspect-square w-full object-contain sm:max-h-80"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-muted-foreground sm:max-h-80">
              No image selected
            </div>
          )}
        </div>
        <Input
          id="product-image"
          type="file"
          accept="image/*"
          disabled={saving || optimizing}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            setImageError(null);
            if (!file) return;
            setOptimizing(true);
            try {
              const optimized = await optimizeProductImage(file);
              setImageFile(optimized);
            } catch (error) {
              setImageError(error instanceof Error ? error.message : "Couldn't use that image.");
            } finally {
              setOptimizing(false);
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          JPG, PNG or similar. Images are resized before upload. Max 8MB original file.
        </p>
        {imageError && (
          <p role="alert" className="text-sm text-destructive">
            {imageError}
          </p>
        )}
      </div>

      {optimizing && !activeColorUpload && (
        <p role="status" className="text-sm text-muted-foreground">
          Preparing image...
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="product-name">Product name</Label>
        <Input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          disabled={saving}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="product-category">Category</Label>
          <select
            id="product-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryId)}
            disabled={saving}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-price">Price (GHS)</Label>
          <Input
            id="product-price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            disabled={saving}
          />
          {Number.isFinite(Number(price)) && Number(price) > 0 && (
            <p className="text-xs text-muted-foreground">{formatCedis(Number(price))}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-description">Description (optional)</Label>
        <Textarea
          id="product-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={600}
          disabled={saving}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="product-badge">Badge</Label>
          <select
            id="product-badge"
            value={badge ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setBadge(value === "New Arrival" || value === "Best Seller" ? value : null);
            }}
            disabled={saving}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">None</option>
            <option value="New Arrival">New Arrival</option>
            <option value="Best Seller">Best Seller</option>
          </select>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Available</p>
            <p className="text-xs text-muted-foreground">
              Unavailable items are hidden from the shop.
            </p>
          </div>
          <Switch checked={available} onCheckedChange={setAvailable} disabled={saving} />
        </div>
      </div>

      <section
        className="space-y-4 border-t border-border pt-5"
        aria-labelledby="available-colors-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="available-colors-title" className="text-base font-semibold">
            Available Colors <span className="font-normal text-muted-foreground">(Optional)</span>
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || optimizing || colors.length >= MAX_PRODUCT_COLORS}
            onClick={() => {
              const id = crypto.randomUUID();
              setColors((current) => [...current, { id, name: "", swatch: null, images: [] }]);
              if (colors.length === 0) setDefaultColorId(id);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add color
          </Button>
        </div>
        {colors.map((color) => (
          <fieldset key={color.id} className="min-w-0 space-y-3 border-t border-border pt-4">
            <legend className="sr-only">{color.name || "New color"}</legend>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={`color-name-${color.id}`}>Color name</Label>
                <Input
                  id={`color-name-${color.id}`}
                  value={color.name}
                  required
                  maxLength={40}
                  disabled={saving || optimizing}
                  onChange={(event) => changeColor(color.id, { name: event.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Remove color"
                aria-label={`Remove ${color.name || "color"}`}
                disabled={saving || optimizing}
                onClick={() => {
                  const next = colors.filter((value) => value.id !== color.id);
                  setColors(next);
                  if (defaultColorId === color.id) setDefaultColorId(next[0]?.id ?? "");
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="default-product-color"
                  checked={defaultColorId === color.id}
                  disabled={saving || optimizing}
                  onChange={() => setDefaultColorId(color.id)}
                />
                Default color
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={color.swatch !== null}
                  disabled={saving || optimizing}
                  onChange={(event) =>
                    changeColor(color.id, {
                      swatch: event.target.checked ? (color.swatch ?? "#000000") : null,
                    })
                  }
                />
                Swatch
              </label>
              {color.swatch && (
                <input
                  type="color"
                  aria-label={`Swatch for ${color.name || "color"}`}
                  value={color.swatch}
                  disabled={saving || optimizing}
                  onChange={(event) => changeColor(color.id, { swatch: event.target.value })}
                  className="h-11 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                />
              )}
            </div>
            {color.images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {color.images.map((image, index) => (
                  <ColorImageEditor
                    key={image.id}
                    image={image}
                    label={`${color.name || "Color"} image ${index + 1}`}
                    disabled={saving || optimizing}
                    onReplace={(file) => void uploadColorImages(color.id, [file], image.id)}
                    onRemove={() =>
                      changeColor(color.id, {
                        images: color.images.filter((value) => value.id !== image.id),
                      })
                    }
                  />
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`color-images-${color.id}`}>Images</Label>
              <Input
                id={`color-images-${color.id}`}
                type="file"
                accept="image/*"
                multiple
                disabled={saving || optimizing || color.images.length >= MAX_COLOR_IMAGES}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void uploadColorImages(color.id, files);
                }}
              />
              {activeColorUpload === color.id && (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Preparing images...
                </p>
              )}
              {colorImageError?.id === color.id && (
                <p role="alert" className="text-sm text-destructive">
                  {colorImageError.message}
                </p>
              )}
            </div>
          </fieldset>
        ))}
      </section>
      {validationError && (
        <p role="alert" className="text-sm text-destructive">
          {validationError}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving || optimizing}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || optimizing}>
          {saving ? "Saving…" : "Save product"}
        </Button>
      </div>
    </form>
  );
}

function ColorImageEditor({
  image,
  label,
  disabled,
  onReplace,
  onRemove,
}: {
  image: ProductImageDraft;
  label: string;
  disabled: boolean;
  onReplace: (file: File) => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState(typeof image.value === "string" ? image.value : "");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (typeof image.value === "string") {
      setUrl(image.value);
      return;
    }
    const preview = URL.createObjectURL(image.value);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [image.value]);
  return (
    <div className="min-w-0">
      <div className="aspect-square overflow-hidden rounded-md border border-border bg-muted">
        {url && <img src={url} alt={label} className="size-full object-contain" />}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Replace image"
          aria-label={`Replace ${label}`}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <RefreshCw className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Remove image"
          aria-label={`Remove ${label}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={`Replacement for ${label}`}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onReplace(file);
        }}
      />
    </div>
  );
}
