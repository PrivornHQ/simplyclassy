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

export type OrderSnapshot = {
  id: string;
  name: string;
  location: string;
  items: OrderSnapshotItem[];
  overallTotal: number;
  createdAt: string;
};

export const MAX_ORDER_CUSTOMER_NAME_CHARS = 80;
export const MAX_ORDER_LOCATION_CHARS = 120;

export type CreateOrderCartItem = {
  productId: string;
  quantity: number;
};

export type CreateOrderInput = {
  name: string;
  location: string;
  cart: CreateOrderCartItem[];
};
