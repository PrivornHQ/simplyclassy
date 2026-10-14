import {
  getDefaultProductColor,
  isCategoryId,
  orderLineKey,
  type CategoryId,
  type Product,
} from "@/data/products";

export type OrderCartItem = {
  id: string;
  name: string;
  price: number;
  category: CategoryId;
  image: string;
  quantity: number;
  colorId?: string;
  colorName?: string;
};

export function parseStoredCartItems(value: unknown): OrderCartItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is OrderCartItem => {
    if (!item || typeof item !== "object") return false;
    const colorValid =
      (item.colorId === undefined && item.colorName === undefined) ||
      (typeof item.colorId === "string" &&
        /^[a-zA-Z0-9_-]{1,80}$/.test(item.colorId) &&
        typeof item.colorName === "string" &&
        item.colorName.trim().length > 0 &&
        item.colorName.length <= 40);
    return (
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.price === "number" &&
      Number.isFinite(item.price) &&
      item.price >= 0 &&
      typeof item.category === "string" &&
      isCategoryId(item.category) &&
      typeof item.image === "string" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 999 &&
      colorValid
    );
  });
}

export function addProductToCart(
  items: OrderCartItem[],
  product: Product,
  colorId?: string,
): OrderCartItem[] {
  const color = colorId
    ? product.colors?.find((value) => value.id === colorId)
    : getDefaultProductColor(product);
  if (colorId && !color) throw new Error("Choose an available color.");
  const key = orderLineKey(product.id, color?.id);
  if (items.some((item) => orderLineKey(item.id, item.colorId) === key)) {
    return items.map((item) =>
      orderLineKey(item.id, item.colorId) === key
        ? { ...item, quantity: Math.min(999, item.quantity + 1) }
        : item,
    );
  }
  return [
    ...items,
    {
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      image: color?.images[0] ?? product.image,
      quantity: 1,
      ...(color ? { colorId: color.id, colorName: color.name } : {}),
    },
  ];
}
