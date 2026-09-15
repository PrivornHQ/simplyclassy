import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PackageX, ShoppingBag } from "lucide-react";
import logoAsset from "@/assets/logo.png";
import { categoryById, formatCedis } from "@/data/products";
import { getPublicOrder } from "@/lib/order.functions";

export const Route = createFileRoute("/order/$orderId")({
  loader: async ({ params }) => {
    return getPublicOrder({ data: { orderId: params.orderId } });
  },
  head: ({ params, loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Order ${loaderData.id} | SimplyClassy`
          : "Order not found | SimplyClassy",
      },
      {
        name: "description",
        content: loaderData
          ? `Read-only SimplyClassy order summary for ${params.orderId}.`
          : "The SimplyClassy order link could not be found.",
      },
    ],
  }),
  pendingComponent: OrderPending,
  component: OrderPage,
});

const formatOrderDate = (createdAt: string) =>
  new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));

function OrderPending() {
  return (
    <div className="min-h-screen bg-background">
      <main className="section-shell flex min-h-screen items-center py-10">
        <p className="text-sm text-muted-foreground">Loading order summary...</p>
      </main>
    </div>
  );
}

function OrderPage() {
  const order = Route.useLoaderData();

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <main className="section-shell flex min-h-screen items-center py-10">
          <div className="mx-auto max-w-md text-center">
            <img
              src={logoAsset}
              alt="SimplyClassy"
              className="mx-auto size-16 rounded-md object-cover"
            />
            <PackageX className="mx-auto mt-8 size-10 text-muted-foreground" aria-hidden />
            <h1 className="mt-4 font-display text-3xl font-semibold text-foreground">
              Order not found
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This order link may be incorrect or expired. Ask the customer to create a fresh
              WhatsApp order link from their cart.
            </p>
            <Link
              to="/"
              className="mt-7 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go to SimplyClassy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

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
              <p className="mt-1 text-xs text-muted-foreground">Read-only order summary</p>
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

      <main className="section-shell py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
          <section aria-labelledby="order-title" className="min-w-0">
            <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Order Summary</p>
                <h1
                  id="order-title"
                  className="mt-2 font-display text-4xl font-semibold text-foreground sm:text-5xl"
                >
                  Customer Order
                </h1>
              </div>
              <div className="rounded-md border border-border px-4 py-3 text-sm">
                <p className="text-muted-foreground">Reference</p>
                <p className="mt-1 max-w-full break-all font-semibold text-foreground">
                  {order.id}
                </p>
              </div>
            </div>

            <dl className="grid gap-3 border-b border-border py-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="mt-1 font-medium text-foreground">{order.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd className="mt-1 font-medium text-foreground">{order.location}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {formatOrderDate(order.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Items</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </dd>
              </div>
            </dl>

            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li
                  key={item.productId}
                  className="grid gap-4 py-5 sm:grid-cols-[7rem_1fr] sm:gap-5"
                >
                  <img
                    src={item.productImage}
                    alt=""
                    className="aspect-square w-28 rounded-md bg-ash object-cover sm:w-full"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground">
                          {item.productName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {categoryById(item.category).title}
                        </p>
                      </div>
                      <p className="shrink-0 text-base font-semibold text-foreground">
                        {formatCedis(item.lineSubtotal)}
                      </p>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Quantity</dt>
                        <dd className="mt-1 font-medium text-foreground">{item.quantity}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Unit price</dt>
                        <dd className="mt-1 font-medium text-foreground">
                          {formatCedis(item.unitPrice)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Subtotal</dt>
                        <dd className="mt-1 font-medium text-foreground">
                          {formatCedis(item.lineSubtotal)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside className="rounded-md border border-border bg-background p-5 shadow-soft lg:sticky lg:top-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ShoppingBag className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Overall total</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatCedis(order.overallTotal)}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              This shared link is a saved snapshot of the customer's cart. Product details and
              quantities cannot be changed from this page.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
