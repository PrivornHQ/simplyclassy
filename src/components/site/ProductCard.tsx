import { useState, type MouseEvent } from "react";
import { formatCedis, productWhatsAppLink, type Product } from "@/data/products";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const [expanded, setExpanded] = useState(false);
  const description = product.description?.trim();
  const hasDescription = Boolean(description);

  const toggleDescription = (event: MouseEvent<HTMLElement>) => {
    if (!hasDescription) return;
    if ((event.target as HTMLElement).closest("a,button")) return;
    setExpanded((current) => !current);
  };

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift",
        hasDescription && "cursor-pointer",
      )}
      onClick={toggleDescription}
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
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-sans text-base font-medium text-foreground">{product.name}</h3>
        <p className="mt-1 text-sm font-semibold text-primary">{formatCedis(product.price)}</p>
        {description && (
          <div
            className={cn(
              "grid grid-rows-[0fr] opacity-0 transition-all duration-300 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-within:grid-rows-[1fr] group-focus-within:opacity-100",
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
        <div className="mt-auto pt-3">
          {product.available ? (
            <a
              href={productWhatsAppLink(product.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-full bg-whatsapp px-3 py-1.5 text-sm font-medium whitespace-nowrap text-background transition-opacity hover:opacity-90 sm:px-4 sm:py-2"
            >
              <span className="sm:hidden">Order Now</span>
              <span className="hidden sm:inline">Order on WhatsApp</span>
            </a>
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
