import { formatCedis, productWhatsAppLink, type Product } from "@/data/products";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift">
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
      <div className="p-4">
        <h3 className="font-sans text-base font-medium text-foreground">{product.name}</h3>
        <p className="mt-1 text-sm font-semibold text-primary">{formatCedis(product.price)}</p>
        {product.available ? (
          <a
            href={productWhatsAppLink(product.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-whatsapp px-3 py-1.5 text-sm font-medium whitespace-nowrap text-background transition-opacity hover:opacity-90 sm:px-4 sm:py-2"
          >
            <span className="sm:hidden">Order Now</span>
            <span className="hidden sm:inline">Order on WhatsApp</span>
          </a>
        ) : (
          <p className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground sm:px-4 sm:py-2">
            Currently unavailable
          </p>
        )}
      </div>
    </article>
  );
}
