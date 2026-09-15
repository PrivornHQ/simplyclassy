import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { toast } from "sonner";
import { formatCedis, type Product } from "@/data/products";
import { cn } from "@/lib/utils";
import { useOrderCart } from "./OrderCart";

export function ProductCard({ product }: { product: Product }) {
  const [expanded, setExpanded] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { addProduct } = useOrderCart();
  const description = product.description?.trim();
  const hasDescription = Boolean(description);

  const interactiveSelector = "a,button,input,select,textarea,[role='button']";
  const descriptionId = `product-description-${product.id}`;

  const toggleDescription = (event: MouseEvent<HTMLElement>) => {
    if (!hasDescription) return;
    if ((event.target as HTMLElement).closest(interactiveSelector)) return;
    setExpanded((current) => !current);
  };

  const toggleDescriptionFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!hasDescription || event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    setExpanded((current) => !current);
  };

  const addToOrder = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    addProduct(product);
    setJustAdded(true);
    toast.success(`${product.name} added to your order.`);
    window.setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        hasDescription && "cursor-pointer",
      )}
      tabIndex={hasDescription ? 0 : undefined}
      aria-expanded={hasDescription ? expanded : undefined}
      aria-controls={hasDescription ? descriptionId : undefined}
      onClick={toggleDescription}
      onKeyDown={toggleDescriptionFromKeyboard}
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
      <div className="flex flex-col p-4">
        <div className="min-h-[4.25rem]">
          <h3 className="line-clamp-2 font-sans text-base leading-5 font-medium text-foreground">
            {product.name}
          </h3>
          <p className="mt-1 text-sm font-semibold text-primary">{formatCedis(product.price)}</p>
        </div>
        {description && (
          <div
            id={descriptionId}
            className={cn(
              "grid grid-rows-[0fr] opacity-0 transition-all duration-300 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus:grid-rows-[1fr] group-focus:opacity-100",
              expanded && "grid-rows-[1fr] opacity-100",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <p className="mt-3 max-h-24 overflow-y-auto text-sm leading-5 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        )}
        <div className="pt-3">
          {product.available ? (
            <button
              type="button"
              onClick={addToOrder}
              className={cn(
                "inline-flex w-full items-center justify-center rounded-full bg-whatsapp px-3 py-1.5 text-sm font-medium whitespace-nowrap text-background transition-all hover:opacity-90 sm:px-4 sm:py-2",
                justAdded && "scale-[0.98] bg-primary/90",
              )}
            >
              {justAdded ? "Added" : "Add to Order"}
            </button>
          ) : (
            <p className="inline-flex w-full items-center justify-center rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground sm:px-4 sm:py-2">
              Currently unavailable
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
