import type { CategoryId } from "@/data/products";

export type OrderSnapshotItem = {
  productId: string;
  productName: string;
  productImage: string;
  category: CategoryId;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
};

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderStatusHistoryEntry = {
  status: OrderStatus;
  changedAt: string;
  note?: string;
  changedBy: "system" | "admin";
};

export type OrderSnapshot = {
  id: string;
  orderNumber: string;
  name: string;
  location: string;
  items: OrderSnapshotItem[];
  overallTotal: number;
  createdAt: string;
  updatedAt?: string;
  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntry[];
  adminNotes?: string;
};

export const MAX_ORDER_CUSTOMER_NAME_CHARS = 80;
export const MAX_ORDER_LOCATION_CHARS = 120;
export const MAX_ORDER_ADMIN_NOTES_CHARS = 800;
export const MAX_ORDER_STATUS_NOTE_CHARS = 240;

export type CreateOrderCartItem = {
  productId: string;
  quantity: number;
};

export type CreateOrderInput = {
  name: string;
  location: string;
  cart: CreateOrderCartItem[];
};

export type PublicOrderTrackingInput = {
  orderNumber: string;
  name: string;
  location: string;
};

export type AdminOrderSearchInput = {
  query?: string;
  status?: OrderStatus | "all";
  limit?: number;
};

export type UpdateOrderInput = {
  orderId: string;
  status?: OrderStatus;
  adminNotes?: string;
  statusNote?: string;
};

export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; customerLabel: string; description: string }
> = {
  pending: {
    label: "Pending",
    customerLabel: "Order received",
    description: "Your order has been received and is waiting for confirmation.",
  },
  confirmed: {
    label: "Confirmed",
    customerLabel: "Confirmed",
    description: "SimplyClassy has confirmed your order details.",
  },
  preparing: {
    label: "Preparing",
    customerLabel: "Preparing",
    description: "Your selected products are being prepared.",
  },
  ready: {
    label: "Ready",
    customerLabel: "Ready",
    description: "Your order is ready for pickup or delivery arrangements.",
  },
  out_for_delivery: {
    label: "Out for delivery",
    customerLabel: "Out for delivery",
    description: "Your order is on the way.",
  },
  completed: {
    label: "Completed",
    customerLabel: "Completed",
    description: "This order has been completed.",
  },
  cancelled: {
    label: "Cancelled",
    customerLabel: "Cancelled",
    description: "This order has been cancelled.",
  },
};

export const isOrderStatus = (value: string): value is OrderStatus =>
  ORDER_STATUSES.includes(value as OrderStatus);
