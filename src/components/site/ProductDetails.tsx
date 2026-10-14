import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatCedis,
  getDefaultProductColor,
  getProductGallery,
  type Product,
} from "@/data/products";
import { cn } from "@/lib/utils";

export function ProductDetails({
  product,
  open,
  onOpenChange,
  onAdd,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (colorId?: string) => void;
}) {
  const [colorId, setColorId] = useState(getDefaultProductColor(product)?.id);
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => {
    if (!open) return;
    setColorId(getDefaultProductColor(product)?.id);
    setImageIndex(0);
  }, [open, product]);
  const color =
    product.colors?.find((value) => value.id === colorId) ?? getDefaultProductColor(product);
  const images = getProductGallery(product, color?.id);
  const image = images[imageIndex] ?? images[0] ?? product.image;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="break-words font-display text-2xl">{product.name}</DialogTitle>
          <DialogDescription>{formatCedis(product.price)}</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-6 md:grid-cols-2">
          <div className="min-w-0">
            <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
              <img
                src={image}
                alt={`${product.name}${color ? ` - ${color.name}` : ""}`}
                className="size-full object-contain"
              />
              {images.length > 1 && (
                <div className="absolute inset-x-2 bottom-2 flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 bg-background"
                    title="Previous image"
                    aria-label="Previous image"
                    onClick={() =>
                      setImageIndex((index) => (index - 1 + images.length) % images.length)
                    }
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 bg-background"
                    title="Next image"
                    aria-label="Next image"
                    onClick={() => setImageIndex((index) => (index + 1) % images.length)}
                  >
                    <ChevronRight className="size-5" aria-hidden />
                  </Button>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    aria-label={`View image ${index + 1}${color ? ` of ${color.name}` : ""}`}
                    aria-pressed={index === imageIndex}
                    onClick={() => setImageIndex(index)}
                    className={cn(
                      "size-16 shrink-0 overflow-hidden rounded-md border-2",
                      index === imageIndex ? "border-primary" : "border-transparent",
                    )}
                  >
                    <img src={url} alt="" className="size-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid min-w-0 content-start gap-5">
            {product.description && (
              <p className="break-words whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {product.description}
              </p>
            )}
            {(product.colors?.length ?? 0) > 0 && (
              <fieldset className="min-w-0">
                <legend className="mb-3 text-sm font-medium">Available colors</legend>
                <div className="flex flex-wrap gap-2">
                  {product.colors?.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      aria-pressed={color?.id === variant.id}
                      onClick={() => {
                        setColorId(variant.id);
                        setImageIndex(0);
                      }}
                      className={cn(
                        "flex min-h-11 max-w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                        color?.id === variant.id
                          ? "border-primary bg-accent ring-1 ring-primary"
                          : "border-border",
                      )}
                    >
                      {variant.swatch ? (
                        <span
                          aria-hidden
                          className="size-5 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: variant.swatch }}
                        />
                      ) : (
                        <img
                          src={variant.images[0]}
                          alt=""
                          className="size-6 shrink-0 rounded-full object-cover"
                        />
                      )}
                      <span className="min-w-0 break-words">{variant.name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <Button
              type="button"
              className="min-h-11 bg-whatsapp text-background hover:bg-whatsapp/90"
              disabled={!product.available}
              onClick={() => {
                onAdd(color?.id);
                onOpenChange(false);
              }}
            >
              {product.available ? "Add to Order" : "Currently unavailable"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
