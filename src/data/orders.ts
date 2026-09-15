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
  items: OrderSnapshotItem[];
  overallTotal: number;
  createdAt: string;
};

export type CreateOrderCartItem = {
  productId: string;
  quantity: number;
};
