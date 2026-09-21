import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import logoAsset from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrderStatusTimeline } from "@/components/site/OrderStatusTimeline";
import { formatCedis } from "@/data/products";
import {
  MAX_ORDER_CUSTOMER_NAME_CHARS,
  MAX_ORDER_LOCATION_CHARS,
  type OrderSnapshot,
} from "@/data/orders";
import { getTrackedOrder } from "@/lib/order.functions";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Order | SimplyClassy" },
      {
        name: "description",
        content: "Track a SimplyClassy order with your order number and customer details.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrackOrderPage,
});

function TrackOrderPage() {
  const [order, setOrder] = useState<OrderSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const orderNumber = String(form.get("orderNumber") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const location = String(form.get("location") ?? "").trim();

    if (!orderNumber || !name || !location) {
      setError("Enter the order number, name and location used for the order.");
      setOrder(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const found = await getTrackedOrder({ data: { orderNumber, name, location } });
      if (!found) {
        setOrder(null);
        setError("We couldn't verify that order. Please check the details and try again.");
        return;
      }
      setOrder(found);
    } catch {
      setOrder(null);
      setError("We couldn't load this order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="section-shell flex items-center justify-between gap-4 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src={logoAsset} alt="" className="size-11 rounded-md object-cover" />
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold leading-none text-foreground">
                SimplyClassy
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Order tracking</p>
            </div>
          </Link>
          <Link
            to="/"
            className="hidden items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent sm:inline-flex"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Shop
          </Link>
        </div>
      </header>

      <main className="section-shell grid gap-8 py-8 lg:grid-cols-[22rem_1fr] lg:items-start">
        <section className="rounded-md border border-border bg-card p-5 shadow-soft">
          <p className="eyebrow">Track Order</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Find your order</h1>
          <form onSubmit={submit} className="mt-5 grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="track-order-number">Order number</Label>
              <Input
                id="track-order-number"
                name="orderNumber"
                placeholder="SC-437001"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="track-name">Name</Label>
              <Input
                id="track-name"
                name="name"
                maxLength={MAX_ORDER_CUSTOMER_NAME_CHARS}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="track-location">Location</Label>
              <Input
                id="track-location"
                name="location"
                maxLength={MAX_ORDER_LOCATION_CHARS}
                autoComplete="address-level2"
                required
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="rounded-full" disabled={loading}>
              <Search className="size-4" aria-hidden />
              {loading ? "Checking..." : "Track order"}
            </Button>
          </form>
        </section>

        <section className="min-w-0">
          {order ? (
            <div className="grid gap-5">
              <div className="rounded-md border border-border bg-card p-5 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="eyebrow">Order</p>
                    <h2 className="mt-1 font-display text-3xl font-semibold">
                      {order.orderNumber}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {order.name} - {order.location}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold">{formatCedis(order.overallTotal)}</p>
                </div>
              </div>
              <OrderStatusTimeline order={order} />
              <ul className="divide-y divide-border rounded-md border border-border bg-card p-5 shadow-soft">
                {order.items.map((item) => (
                  <li key={item.productId} className="grid grid-cols-[4rem_1fr] gap-3 py-4 first:pt-0 last:pb-0">
                    <img
                      src={item.productImage}
                      alt=""
                      className="aspect-square w-full rounded-md bg-ash object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-medium text-foreground">{item.productName}</p>
                        <p className="font-semibold">{formatCedis(item.lineSubtotal)}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.quantity} x {formatCedis(item.unitPrice)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed border-border p-8 text-center">
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Enter the order details shared during checkout to see the current tracking status.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
