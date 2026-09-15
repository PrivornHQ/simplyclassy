import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  MAX_ORDER_CUSTOMER_NAME_CHARS,
  MAX_ORDER_LOCATION_CHARS,
} from "@/data/orders";
import { createStoredOrder, readStoredOrder } from "@/server/order-store.server";

const cartItemSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(999),
});

export const createOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(1).max(MAX_ORDER_CUSTOMER_NAME_CHARS),
      location: z.string().trim().min(1).max(MAX_ORDER_LOCATION_CHARS),
      cart: z.array(cartItemSchema).min(1).max(50),
    }),
  )
  .handler(async ({ data }) => {
    return createStoredOrder(data);
  });

export const getPublicOrder = createServerFn({ method: "GET" })
  .validator(z.object({ orderId: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) => {
    return readStoredOrder(data.orderId);
  });
