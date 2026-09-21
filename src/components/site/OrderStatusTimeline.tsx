import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import {
  ORDER_STATUSES,
  orderStatusMeta,
  type OrderSnapshot,
  type OrderStatus,
} from "@/data/orders";
import { cn } from "@/lib/utils";

const visibleProgressStatuses: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
];

const formatStatusDate = (createdAt: string) =>
  new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(createdAt));

export function OrderStatusTimeline({ order }: { order: OrderSnapshot }) {
  const currentIndex = visibleProgressStatuses.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const statuses = isCancelled ? ORDER_STATUSES.filter((status) => status !== "completed") : visibleProgressStatuses;
  const latestHistory = [...order.statusHistory].reverse();

  return (
    <section aria-labelledby="tracking-title" className="rounded-md border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Tracking</p>
          <h2 id="tracking-title" className="mt-1 font-display text-2xl font-semibold">
            {orderStatusMeta[order.status].customerLabel}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {orderStatusMeta[order.status].description}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium",
            isCancelled ? "bg-destructive/10 text-destructive" : "bg-accent text-foreground",
          )}
        >
          {orderStatusMeta[order.status].label}
        </span>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map((status, index) => {
          const active = status === order.status;
          const complete = !isCancelled && currentIndex >= index;
          const cancelled = status === "cancelled";
          const Icon = active ? Clock3 : complete ? CheckCircle2 : Circle;

          return (
            <li
              key={status}
              className={cn(
                "flex min-w-0 gap-3 rounded-md border border-border p-3",
                complete && "border-primary/30 bg-accent",
                active && "border-primary bg-background",
                cancelled && "border-destructive/30 bg-destructive/5",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-5 shrink-0",
                  cancelled ? "text-destructive" : complete || active ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {orderStatusMeta[status].customerLabel}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {orderStatusMeta[status].description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {latestHistory.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-sm font-semibold">Latest updates</p>
          <ul className="mt-3 grid gap-2">
            {latestHistory.slice(0, 4).map((entry) => (
              <li key={`${entry.status}-${entry.changedAt}`} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{orderStatusMeta[entry.status].label}</span>
                {" - "}
                {formatStatusDate(entry.changedAt)}
                {entry.note ? ` - ${entry.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
