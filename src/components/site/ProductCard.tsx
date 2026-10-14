import { useState } from "react";
import { toast } from "sonner";
import { formatCedis, type Product } from "@/data/products";
import { cn } from "@/lib/utils";
import { useOrderCart } from "./OrderCart";
import { ProductDetails } from "./ProductDetails";

export function ProductCard({ product }: { product: Product }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { addProduct } = useOrderCart();
  const addToOrder = (colorId?: string) => {
    addProduct(product, colorId);
    setJustAdded(true);
    const color = product.colors?.find((value) => value.id === colorId);
    toast.success(`${product.name}${color ? ` (${color.name})` : ""} added to your order.`);
    window.setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <>
      <article
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest("button")) setDetailsOpen(true);
        }}
        className={cn(
          "group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          aria-label={`View ${product.name}`}
          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div className="relative aspect-square overflow-hidden bg-ash">
            <img
              src={product.image}
              alt={product.alt}
              width={900}
              height={900}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {product.badge && (
              <span className="absolute top-3 left-3 rounded-full bg-primary px-3 py-1 text-[0.65rem] font-medium tracking-wide text-primary-foreground uppercase">
                {product.badge}
              </span>
            )}
          </div>
        </button>
        <div className="flex flex-col p-4">
          <div className="min-h-[4.25rem]">
            <h3 className="line-clamp-2 break-words font-sans text-base leading-5 font-medium text-foreground">
              <button
                type="button"
                className="text-left hover:underline"
                onClick={() => setDetailsOpen(true)}
              >
                {product.name}
              </button>
            </h3>
            <p className="mt-1 text-sm font-semibold text-primary">{formatCedis(product.price)}</p>
          </div>
          <div className="pt-3">
            {product.available ? (
              <button
                type="button"
                onClick={() => (product.colors?.length ? setDetailsOpen(true) : addToOrder())}
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-whatsapp px-3 py-1.5 text-sm font-medium whitespace-nowrap text-background transition-all hover:opacity-90 sm:px-4 sm:py-2",
                  justAdded && "scale-[0.98] bg-primary/90",
                )}
              >
                {justAdded ? "Added" : product.colors?.length ? "Choose color" : "Add to Order"}
              </button>
            ) : (
              <p className="inline-flex w-full items-center justify-center rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground sm:px-4 sm:py-2">
                Currently unavailable
              </p>
            )}
          </div>
        </div>
      </article>
      <ProductDetails
        product={product}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onAdd={addToOrder}
      />
    </>
  );
}
