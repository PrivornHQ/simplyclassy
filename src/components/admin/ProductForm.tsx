import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  categories,
  formatCedis,
  type CategoryId,
  type Product,
  type ProductBadge,
} from "@/data/products";
import { optimizeProductImage } from "@/lib/optimize-product-image";

export type ProductFormValues = {
  name: string;
  category: CategoryId;
  price: string;
  description: string;
  available: boolean;
  badge: ProductBadge;
  imageFile: File | null;
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.image ?? null);

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
        await onSave({
          name,
          category,
          price,
          description,
          available,
          badge,
          imageFile,
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
              className="aspect-square w-full object-cover sm:max-h-80"
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
        {optimizing && <p className="text-sm text-muted-foreground">Preparing image…</p>}
        {imageError && <p className="text-sm text-destructive">{imageError}</p>}
      </div>

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
            step="1"
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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || optimizing}>
          {saving ? "Saving…" : "Save product"}
        </Button>
      </div>
    </form>
  );
}
