import type { CreateOrderInput, OrderSnapshot } from "@/data/orders";

declare global {
  interface Window {
    variantCheckout?: CreateOrderInput;
    variantWhatsApp?: string;
    variantForm?: {
      colors: { name: string; images: number }[];
      defaultColorId: string;
      mainImage: boolean;
    };
  }
}

export async function createOrder({ data }: { data: CreateOrderInput }): Promise<OrderSnapshot> {
  window.variantCheckout = data;
  const createdAt = new Date().toISOString();
  return {
    id: "browser-order",
    orderNumber: "SC-437001",
    name: data.name,
    location: data.location,
    createdAt,
    status: "pending",
    statusHistory: [{ status: "pending", changedAt: createdAt, changedBy: "system" }],
    overallTotal: data.cart.reduce((sum, item) => sum + item.quantity * 250, 0),
    items: data.cart.map((item) => ({
      productId: item.productId,
      productName: "Classic Watch",
      productImage: "/catalog/placeholder-watch.jpg",
      category: "watches",
      quantity: item.quantity,
      unitPrice: 250,
      lineSubtotal: item.quantity * 250,
      ...(item.colorId
        ? { colorId: item.colorId, colorName: item.colorId === "gold" ? "Gold" : "Black" }
        : {}),
    })),
  };
}
