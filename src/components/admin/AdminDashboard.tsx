import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { categories, formatCedis, type CategoryId, type Product } from "@/data/products";
import type { CustomerReview } from "@/data/reviews";
import { deleteAdminProduct, saveAdminProduct } from "@/lib/catalog.functions";
import { deleteAdminReview } from "@/lib/review.functions";
import { cn } from "@/lib/utils";
import { ProductForm, type ProductFormValues } from "./ProductForm";

type Mode = { type: "list" } | { type: "form"; product: Product | null };

export function AdminDashboard({
  products,
  reviews,
  loading,
  error,
  onRefresh,
  onLogout,
}: {
  products: Product[];
  reviews: CustomerReview[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>({ type: "list" });
  const [filter, setFilter] = useState<"all" | CategoryId>("all");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [pendingReviewDelete, setPendingReviewDelete] = useState<CustomerReview | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? products : products.filter((p) => p.category === filter)),
    [filter, products],
  );

  const save = async (values: ProductFormValues) => {
    const form = new FormData();
    const existing = mode.type === "form" ? mode.product : null;
    if (existing) form.set("id", existing.id);
    form.set("name", values.name.trim());
    form.set("category", values.category);
    form.set("price", values.price);
    form.set("description", values.description.trim());
    form.set("available", values.available ? "true" : "false");
    form.set("badge", values.badge ?? "");
    if (values.imageFile) form.set("image", values.imageFile);

    setSaving(true);
    try {
      await saveAdminProduct({ data: form });
      toast.success(existing ? "Product updated." : "Product added.");
      setMode({ type: "list" });
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the product.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeletingId(id);
    try {
      await deleteAdminProduct({ data: { id } });
      toast.success("Product deleted.");
      setPendingDelete(null);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the product.");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmReviewDelete = async () => {
    if (!pendingReviewDelete) return;
    const id = pendingReviewDelete.id;
    setDeletingReviewId(id);
    try {
      await deleteAdminReview({ data: { id } });
      toast.success("Review deleted.");
      setPendingReviewDelete(null);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the review.");
    } finally {
      setDeletingReviewId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="section-shell flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="eyebrow">SimplyClassy</p>
            <h1 className="font-display text-2xl font-semibold">Catalogue admin</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/">View site</Link>
            </Button>
            <Button variant="outline" onClick={() => void onLogout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="section-shell py-8">
        {mode.type === "form" ? (
          <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-5 shadow-soft sm:p-8">
            <ProductForm
              product={mode.product}
              saving={saving}
              onCancel={() => setMode({ type: "list" })}
              onSave={save}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {products.length === 0
                  ? "No products yet."
                  : `${products.length} product${products.length === 1 ? "" : "s"} in the catalogue.`}
              </p>
              <Button
                className="rounded-full"
                onClick={() => setMode({ type: "form", product: null })}
              >
                Add product
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
              {categories.map((c) => (
                <FilterChip
                  key={c.id}
                  active={filter === c.id}
                  onClick={() => setFilter(c.id)}
                  label={c.title}
                />
              ))}
            </div>

            {loading && <p className="mt-8 text-sm text-muted-foreground">Loading products…</p>}
            {error && (
              <div className="mt-8 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="text-destructive">{error}</p>
                <Button className="mt-3" size="sm" onClick={() => void onRefresh()}>
                  Try again
                </Button>
              </div>
            )}

            {!loading && !error && visible.length === 0 && (
              <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {products.length === 0
                  ? "The catalogue is empty. Add your first product to get started."
                  : "No products in this category yet."}
              </p>
            )}

            <ul className="mt-6 grid gap-4">
              {visible.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center"
                >
                  <img
                    src={product.image}
                    alt={product.alt}
                    className="size-24 rounded-lg object-cover sm:size-20"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {categories.find((c) => c.id === product.category)?.title} ·{" "}
                      {formatCedis(product.price)}
                      {product.available ? "" : " · Unavailable"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMode({ type: "form", product })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deletingId === product.id}
                      onClick={() => setPendingDelete(product)}
                    >
                      {deletingId === product.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <section className="mt-12">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Reviews</p>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
                    Customer reviews
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {reviews.length === 0
                    ? "No reviews yet."
                    : `${reviews.length} review${reviews.length === 1 ? "" : "s"}.`}
                </p>
              </div>

              {!loading && reviews.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Customer reviews submitted on the site will appear here.
                </p>
              ) : (
                <ul className="mt-4 grid gap-4">
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-xl border border-border bg-card p-4 shadow-soft"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {review.name?.trim() || "SimplyClassy customer"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {review.location ? `${review.location} - ` : ""}
                                {new Intl.DateTimeFormat("en", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }).format(new Date(review.createdAt))}
                              </p>
                            </div>
                            <div
                              className="flex gap-1 text-primary"
                              aria-label={`${review.rating} out of 5 stars`}
                            >
                              {Array.from({ length: 5 }).map((_, index) => (
                                <Star
                                  key={index}
                                  className={cn(
                                    "size-4",
                                    index < review.rating ? "fill-current" : "fill-none",
                                  )}
                                  aria-hidden
                                />
                              ))}
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {review.text}
                          </p>
                          {review.imageUrls.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {review.imageUrls.map((url) => (
                                <img
                                  key={url}
                                  src={url}
                                  alt="Customer review upload"
                                  className="size-20 rounded-lg object-cover"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingReviewId === review.id}
                          onClick={() => setPendingReviewDelete(review)}
                        >
                          {deletingReviewId === review.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${pendingDelete.name} will be removed from the website. This cannot be undone.`
                : "This product will be removed from the website."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} disabled={deletingId !== null}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingReviewDelete !== null}
        onOpenChange={(open) => !open && setPendingReviewDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              The review and its uploaded customer photos will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingReviewId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmReviewDelete()}
              disabled={deletingReviewId !== null}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground"
          : "rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground"
      }
    >
      {label}
    </button>
  );
}
