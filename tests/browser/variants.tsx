import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductCard } from "@/components/site/ProductCard";
import { OrderCartProvider, OrderCartTrigger } from "@/components/site/OrderCart";
import type { Product } from "@/data/products";
import "@/styles.css";

const product: Product = {
  id: "test-watch",
  name: "Classic Watch",
  category: "watches",
  price: 250,
  image: "/catalog/placeholder-watch.jpg",
  alt: "Classic Watch",
  badge: null,
  available: true,
  createdAt: "2026-10-14T10:00:00Z",
  description: "A classic watch with interchangeable color choices.",
  defaultColorId: "gold",
  colors: [
    {
      id: "black",
      name: "Black",
      swatch: "#000000",
      images: [
        "/catalog/placeholder-watch.jpg?black-front",
        "/catalog/placeholder-watch.jpg?black-back",
      ],
    },
    {
      id: "gold",
      name: "Gold",
      swatch: "#c7a145",
      images: ["/catalog/placeholder-watch.jpg?gold-front"],
    },
  ],
};

function Fixture() {
  const admin = new URLSearchParams(location.search).has("admin");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  if (admin)
    return (
      <main className="mx-auto max-w-2xl p-4 sm:p-8">
        <ProductForm
          product={null}
          saving={saving}
          onCancel={() => {}}
          onSave={async (values) => {
            setSaving(true);
            await new Promise((resolve) => setTimeout(resolve, 300));
            window.variantForm = {
              mainImage: values.imageFile !== null,
              defaultColorId: values.defaultColorId,
              colors: values.colors.map((color) => ({
                name: color.name,
                images: color.images.length,
              })),
            };
            setSaving(false);
            setSaved(true);
          }}
        />
        {saved && <p role="status">Product saved</p>}
      </main>
    );
  const { colors: omittedColors, defaultColorId: omittedDefault, ...plainProduct } = product;
  return (
    <OrderCartProvider>
      <main className="mx-auto max-w-5xl p-4 sm:p-8">
        <div className="mb-6 flex justify-end">
          <OrderCartTrigger className="border-border text-foreground" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ProductCard product={product} />
          <ProductCard
            product={{
              ...plainProduct,
              id: "test-perfume",
              name: "Perfume",
              category: "perfumes",
              image: "/catalog/placeholder-perfume.jpg",
              alt: "Perfume bottle",
            }}
          />
        </div>
      </main>
      <Toaster />
    </OrderCartProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
