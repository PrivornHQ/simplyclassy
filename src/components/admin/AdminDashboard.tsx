import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useRouter } from "@tanstack/react-router";
import { Check, LoaderCircle, RotateCw, Search, Star, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { categories, formatCedis, orderLineKey, type CategoryId, type Product } from "@/data/products";
import type { CustomerReview } from "@/data/reviews";
import {
  MAX_ORDER_ADMIN_NOTES_CHARS,
  MAX_ORDER_STATUS_NOTE_CHARS,
  ORDER_STATUSES,
  orderStatusMeta,
  type OrderSnapshot,
  type OrderStatus,
} from "@/data/orders";
import { deleteAdminProduct, saveAdminProduct } from "@/lib/catalog.functions";
import {
  clearAdminOrders,
  deleteAdminOrder,
  listAdminOrders,
  saveAdminOrder,
} from "@/lib/order.functions";
import { createOrderAutosave, type OrderChanges, type OrderSaveState } from "@/lib/order-autosave";
import { deleteAdminReview } from "@/lib/review.functions";
import { cn } from "@/lib/utils";
import { ProductForm, type ProductFormValues } from "./ProductForm";

type Mode = { type: "list" } | { type: "form"; product: Product | null };
type AdminFilter = "all" | CategoryId | "orders" | "reviews";

const adminFilters: { id: AdminFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "orders", label: "Orders" },
  { id: "sneakers", label: "Slides" },
  { id: "watches", label: "Watches" },
  { id: "perfumes", label: "Perfumes" },
  { id: "reviews", label: "Reviews" },
];

const orderStatusOptions = [
  { id: "all", label: "All statuses" },
  ...ORDER_STATUSES.map((id) => ({
    id,
    label: orderStatusMeta[id].label,
  })),
];

export function AdminDashboard({
  products,
  reviews,
  orders,
  loading,
  error,
  onRefresh,
  onLogout,
}: {
  products: Product[];
  reviews: CustomerReview[];
  orders: OrderSnapshot[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ type: "list" });
  const [filter, setFilter] = useState<AdminFilter>("all");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [pendingReviewDelete, setPendingReviewDelete] = useState<CustomerReview | null>(null);
  const [orderResults, setOrderResults] = useState<OrderSnapshot[]>(orders);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState<OrderStatus | "all">("all");
  const [searchingOrders, setSearchingOrders] = useState(false);
  const [orderSaveStates, setOrderSaveStates] = useState<Record<string, OrderSaveState>>({});
  const [signingOut, setSigningOut] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [pendingOrderDelete, setPendingOrderDelete] = useState<OrderSnapshot | null>(null);
  const [pendingClearOrders, setPendingClearOrders] = useState<OrderSnapshot[]>([]);
  const [clearingOrders, setClearingOrders] = useState(false);
  const deletedOrderIds = useRef(new Set<string>());
  const confirmedOrders = useRef(new Map<string, OrderSnapshot>());
  const [orderAutosave] = useState(() =>
    createOrderAutosave({
      save: (input) => saveAdminOrder({ data: input }),
      onSaved: (updated) => {
        if (deletedOrderIds.current.has(updated.id)) return;
        confirmedOrders.current.set(updated.id, updated);
        setOrderResults((current) =>
          current.map((order) => (order.id === updated.id ? updated : order)),
        );
      },
      onStateChange: (id, state) => setOrderSaveStates((current) => ({ ...current, [id]: state })),
      onError: (message) => toast.error(message),
    }),
  );
  const savingOrders = Object.values(orderSaveStates).some((state) => state.phase === "saving");
  const orderMutationBusy = savingOrders || deletingOrderId !== null || clearingOrders || signingOut;

  const reconcileOrders = useCallback(
    (incoming: OrderSnapshot[]) =>
      incoming
        .filter((order) => !deletedOrderIds.current.has(order.id))
        .map((order) => {
          const confirmed = confirmedOrders.current.get(order.id);
          return confirmed &&
            Date.parse(confirmed.updatedAt ?? confirmed.createdAt) >=
              Date.parse(order.updatedAt ?? order.createdAt)
            ? confirmed
            : order;
        }),
    [],
  );

  const blockPendingSaves = useCallback(async () => {
    if (await orderAutosave.flush()) return false;
    toast.error("Some order changes could not be saved. Retry the failed changes before leaving.");
    return true;
  }, [orderAutosave]);

  useBlocker({
    shouldBlockFn: blockPendingSaves,
    enableBeforeUnload: orderAutosave.hasPendingChanges,
  });

  const visible = useMemo(
    () =>
      filter === "all" || filter === "reviews"
        ? products
        : products.filter((p) => p.category === filter),
    [filter, products],
  );
  const showingReviews = filter === "reviews";
  const showingOrders = filter === "orders";

  useEffect(() => {
    setOrderResults(reconcileOrders(orders));
  }, [orders, reconcileOrders]);

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
    form.set("colors", JSON.stringify({
      colors: values.colors.map((color) => ({
        id: color.id,
        name: color.name.trim(),
        ...(color.swatch ? { swatch: color.swatch } : {}),
        images: color.images.map((image) => {
          if (typeof image.value === "string") return { url: image.value };
          const uploadKey = `color-image-${color.id}-${image.id}`;
          form.set(uploadKey, image.value);
          return { uploadKey };
        }),
      })),
      ...(values.colors.length > 0 ? { defaultColorId: values.defaultColorId } : {}),
    }));

    setSaving(true);
    try {
      await saveAdminProduct({ data: form });
      toast.success(existing ? "Product updated." : "Product added.");
      setMode({ type: "list" });
      await onRefresh();
      await router.invalidate();
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
      await router.invalidate();
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

  const searchOrders = async () => {
    if (await blockPendingSaves()) return;
    setSearchingOrders(true);
    try {
      const nextOrders = await listAdminOrders({
        data: {
          query: orderQuery.trim() || undefined,
          status: orderStatus,
          limit: 100,
        },
      });
      setOrderResults(reconcileOrders(nextOrders));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't search orders.");
    } finally {
      setSearchingOrders(false);
    }
  };

  const removeDeletedOrders = (ids: string[]) => {
    for (const id of ids) deletedOrderIds.current.add(id);
    orderAutosave.forget(ids);
    for (const id of ids) confirmedOrders.current.delete(id);
    setOrderSaveStates((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => !deletedOrderIds.current.has(id)),
      ),
    );
    setOrderResults((current) => current.filter((order) => !deletedOrderIds.current.has(order.id)));
  };

  const confirmOrderDelete = async () => {
    if (!pendingOrderDelete || orderMutationBusy) return;
    setDeletingOrderId(pendingOrderDelete.id);
    try {
      const result = await deleteAdminOrder({ data: { orderId: pendingOrderDelete.id } });
      removeDeletedOrders([result.deletedId]);
      setPendingOrderDelete(null);
      toast.success("Order permanently deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the order. Please try again.");
    } finally {
      setDeletingOrderId(null);
    }
  };

  const confirmClearOrders = async () => {
    if (pendingClearOrders.length === 0 || orderMutationBusy) return;
    setClearingOrders(true);
    try {
      const result = await clearAdminOrders({
        data: { orderIds: pendingClearOrders.map((order) => order.id) },
      });
      removeDeletedOrders(result.deletedIds);
      setPendingClearOrders((current) =>
        current.filter((order) => result.failedIds.includes(order.id)),
      );
      if (result.failedIds.length > 0) {
        toast.error(
          `${result.deletedIds.length} deleted; ${result.failedIds.length} could not be fully deleted. Please retry.`,
        );
      } else {
        toast.success(`${result.deletedIds.length} order(s) permanently deleted.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't clear orders. Please try again.");
    } finally {
      setClearingOrders(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      if (!(await blockPendingSaves())) await onLogout();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't sign out. Please try again.");
    } finally {
      setSigningOut(false);
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
            <Button
              variant="outline"
              disabled={signingOut || deletingOrderId !== null || clearingOrders}
              onClick={() => void signOut()}
            >
              {signingOut ? "Signing out..." : "Sign out"}
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
                {showingOrders
                  ? orderResults.length === 0
                    ? "No orders found."
                    : `${orderResults.length} order${orderResults.length === 1 ? "" : "s"} found.`
                  : showingReviews
                    ? reviews.length === 0
                      ? "No reviews yet."
                      : `${reviews.length} review${reviews.length === 1 ? "" : "s"}.`
                    : products.length === 0
                      ? "No products yet."
                      : `${products.length} product${products.length === 1 ? "" : "s"} in the catalogue.`}
              </p>
              {!showingReviews && !showingOrders && (
                <Button
                  className="rounded-full"
                  onClick={() => setMode({ type: "form", product: null })}
                >
                  Add product
                </Button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {adminFilters.map((item) => (
                <FilterChip
                  key={item.id}
                  active={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  label={item.label}
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

            {!showingOrders && !showingReviews && !loading && !error && visible.length === 0 && (
              <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {products.length === 0
                  ? "The catalogue is empty. Add your first product to get started."
                  : "No products in this category yet."}
              </p>
            )}

            {showingOrders && (
              <section className="mt-6">
                <form
                  className="grid gap-3 rounded-md border border-border bg-card p-4 shadow-soft lg:grid-cols-[1fr_14rem_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void searchOrders();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="admin-order-search">Search orders</Label>
                    <Input
                      id="admin-order-search"
                      value={orderQuery}
                      onChange={(event) => setOrderQuery(event.target.value)}
                      placeholder="SC-437001, customer, location or product"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={orderStatus}
                      onValueChange={(value) => setOrderStatus(value as OrderStatus | "all")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {orderStatusOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    className="self-end rounded-full"
                    disabled={searchingOrders || orderMutationBusy}
                  >
                    <Search className="size-4" aria-hidden />
                    {searchingOrders ? "Searching..." : "Search"}
                  </Button>
                </form>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={
                      orderResults.length === 0 || searchingOrders || orderMutationBusy || loading
                    }
                    onClick={() => setPendingClearOrders([...orderResults])}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Clear shown orders
                  </Button>
                </div>

                {orderResults.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Submitted orders will appear here.
                  </p>
                ) : (
                  <ul className="mt-4 grid gap-4">
                    {orderResults.map((order) => (
                      <AdminOrderCard
                        key={order.id}
                        order={order}
                        saveState={orderSaveStates[order.id]}
                        deleting={deletingOrderId === order.id || clearingOrders}
                        busy={orderMutationBusy || searchingOrders || loading}
                        editingDisabled={
                          deletingOrderId !== null || clearingOrders || signingOut || loading
                        }
                        onChange={(changes) => orderAutosave.change(order.id, changes)}
                        onRetry={() => orderAutosave.retry(order.id)}
                        onDelete={setPendingOrderDelete}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}

            {!showingOrders && !showingReviews && (
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
            )}

            {showingReviews && (
            <section className="mt-6">
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
            )}
          </>
        )}
      </main>

      <AlertDialog
        open={pendingOrderDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingOrderId) setPendingOrderDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingOrderDelete?.orderNumber} will be permanently removed, including its notes and
              history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingOrderId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmOrderDelete();
              }}
              disabled={orderMutationBusy}
            >
              {deletingOrderId ? "Deleting..." : "Delete order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingClearOrders.length > 0}
        onOpenChange={(open) => {
          if (!open && !clearingOrders) setPendingClearOrders([]);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear these {pendingClearOrders.length} orders?</AlertDialogTitle>
            <AlertDialogDescription>
              Only the orders shown when you selected Clear will be permanently deleted. Other orders
              will be kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingOrders}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmClearOrders();
              }}
              disabled={orderMutationBusy}
            >
              {clearingOrders ? "Clearing..." : "Permanently clear orders"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

const formatOrderDate = (createdAt: string) =>
  new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));

function AdminOrderCard({
  order,
  saveState,
  deleting,
  busy,
  editingDisabled,
  onChange,
  onRetry,
  onDelete,
}: {
  order: OrderSnapshot;
  saveState: OrderSaveState | undefined;
  deleting: boolean;
  busy: boolean;
  editingDisabled: boolean;
  onDelete: (order: OrderSnapshot) => void;
  onChange: (changes: OrderChanges) => void;
  onRetry: () => void;
}) {
  const status = saveState?.changes.status ?? order.status;
  const adminNotes = saveState?.changes.adminNotes ?? order.adminNotes ?? "";
  const statusNote = saveState?.changes.statusNote ?? order.statusHistory.at(-1)?.note ?? "";
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <li className="min-w-0 max-w-full rounded-md border border-border bg-card p-4 shadow-soft">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">{order.orderNumber}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.name} - {order.location}
              </p>
            </div>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-foreground">
              {orderStatusMeta[order.status].label}
            </span>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-1 font-medium">{formatOrderDate(order.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Items</dt>
              <dd className="mt-1 font-medium">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="mt-1 font-medium">{formatCedis(order.overallTotal)}</dd>
            </div>
          </dl>

          <ul className="mt-4 grid gap-2">
            {order.items.map((item) => (
              <li key={orderLineKey(item.productId, item.colorId)} className="flex min-w-0 max-w-full items-center gap-3 text-sm">
                <img
                  src={item.productImage}
                  alt=""
                  className="size-12 shrink-0 rounded-md bg-ash object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="whitespace-normal break-words font-medium">{item.productName}</p>
                  {item.colorName && <p className="break-words text-xs text-muted-foreground">Color: {item.colorName}</p>}
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} x {formatCedis(item.unitPrice)}
                  </p>
                </div>
                <p className="shrink-0 font-medium">{formatCedis(item.lineSubtotal)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="grid min-w-0 content-start gap-3"
          aria-busy={saveState?.phase === "saving"}
        >
          <div className="space-y-2">
            <Label htmlFor={`order-status-${order.id}`}>Status</Label>
            <Select
              value={status}
              disabled={editingDisabled}
              onValueChange={(value) => onChange({ status: value as OrderStatus, statusNote: "" })}
            >
              <SelectTrigger id={`order-status-${order.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {orderStatusMeta[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`status-note-${order.id}`}>Status note</Label>
            <Input
              id={`status-note-${order.id}`}
              value={statusNote}
              onChange={(event) => onChange({ statusNote: event.target.value })}
              placeholder="Optional customer-visible update"
              disabled={editingDisabled}
              maxLength={MAX_ORDER_STATUS_NOTE_CHARS}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`admin-notes-${order.id}`}>Internal notes</Label>
            <Textarea
              id={`admin-notes-${order.id}`}
              value={adminNotes}
              onChange={(event) => onChange({ adminNotes: event.target.value })}
              disabled={editingDisabled}
              maxLength={MAX_ORDER_ADMIN_NOTES_CHARS}
              className="min-h-24 resize-none"
            />
          </div>
          {saveState && saveState.phase !== "error" && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              {saveState.phase === "saving" ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {saveState.phase === "saving" ? "Saving..." : "Saved"}
            </p>
          )}
          {saveState?.phase === "error" && (
            <div role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <p className="min-w-0 flex-1 break-words">{saveState.error}</p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Retry saving"
                aria-label={`Retry saving ${order.orderNumber}`}
                disabled={editingDisabled}
                onClick={onRetry}
              >
                <RotateCw className="size-4" aria-hidden />
              </Button>
            </div>
          )}
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => onDelete(order)}
          >
            <Trash2 className="size-4" aria-hidden />
            {deleting ? "Deleting..." : "Delete order"}
          </Button>
        </div>
      </div>
    </li>
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
