import { useMemo, useState } from "react";
import { ProductCard } from "./ProductCard";
import type { Category } from "@/data/products";

type SortKey = "featured" | "price-asc" | "newest";

const options: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "newest", label: "Newest" },
];

export function CategorySection({ category }: { category: Category }) {
  const [sort, setSort] = useState<SortKey>("featured");

  const products = useMemo(() => {
    const list = [...category.products];
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    if (sort === "newest") list.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return list;
  }, [category.products, sort]);

  return (
    <section id={category.id} className="scroll-mt-20 py-14 md:py-20">
      <div className="section-shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{category.title}</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">
              {category.heading}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {category.blurb}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label={`Sort ${category.title}`}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
