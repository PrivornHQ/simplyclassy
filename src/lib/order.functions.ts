import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  MAX_ORDER_ADMIN_NOTES_CHARS,
  MAX_ORDER_CUSTOMER_NAME_CHARS,
  MAX_ORDER_LOCATION_CHARS,
  MAX_ORDER_STATUS_NOTE_CHARS,
  type CreateOrderInput,
  isOrderStatus,
} from "@/data/orders";
import { requireAdminSession } from "@/server/admin-auth.server";
import {
  createStoredOrder,
  listStoredOrders,
  readOrderForCustomerTracking,
  readStoredOrder,
  updateStoredOrder,
} from "@/server/order-store.server";

const PUBLIC_ORDER_ERROR = "We couldn't create your order. Please try again.";
const PUBLIC_LOAD_ERROR = "We couldn't load this order. Please try again.";
const PUBLIC_TRACKING_ERROR = "We couldn't verify that order. Please check the details and try again.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validateCreateOrderInput(value: unknown): CreateOrderInput {
  if (!isRecord(value)) throw new Error("An order must contain at least one product.");
  const { name, location, cart } = value;
  if (typeof name !== "string" || !name.trim()) throw new Error("Name is required.");
  if (name.trim().length > MAX_ORDER_CUSTOMER_NAME_CHARS) {
    throw new Error(`Name must be ${MAX_ORDER_CUSTOMER_NAME_CHARS} characters or fewer.`);
  }
  if (typeof location !== "string" || !location.trim()) throw new Error("Location is required.");
  if (location.trim().length > MAX_ORDER_LOCATION_CHARS) {
    throw new Error(`Location must be ${MAX_ORDER_LOCATION_CHARS} characters or fewer.`);
  }
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error("An order must contain at least one product.");
  }
  if (cart.length > 50) throw new Error("Please reduce the number of products and try again.");

  return {
    name,
    location,
    cart: cart.map((item) => {
      if (!isRecord(item)) throw new Error("One or more products could not be read.");
      const { productId, quantity } = item;
      if (typeof productId !== "string" || !productId.trim() || productId.length > 120) {
        throw new Error("One or more products could not be read.");
      }
      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
        throw new Error("One or more product quantities could not be read.");
      }
      return { productId, quantity };
    }),
  };
}

function publicMessage(error: unknown, fallback: string) {
  const friendlyPrefixes = [
    "Name ",
    "Location ",
    "Use a city",
    "Add at least one",
    "An order must contain",
    "One or more",
    "Please reduce",
  ];
  if (
    error instanceof Error &&
    friendlyPrefixes.some((prefix) => error.message.startsWith(prefix))
  ) {
    return error.message;
  }
  return fallback;
}

export const createOrder = createServerFn({ method: "POST" })
  .validator(validateCreateOrderInput)
  .handler(async ({ data }) => {
    try {
      return await createStoredOrder(data);
    } catch (error) {
      throw new Error(publicMessage(error, PUBLIC_ORDER_ERROR));
    }
  });

export const getPublicOrder = createServerFn({ method: "GET" })
  .validator((value: unknown) => {
    if (!isRecord(value) || typeof value["orderId"] !== "string") {
      throw new Error(PUBLIC_LOAD_ERROR);
    }
    return { orderId: value["orderId"].trim().slice(0, 120) };
  })
  .handler(async ({ data }) => {
    try {
      return await readStoredOrder(data.orderId);
    } catch {
      throw new Error(PUBLIC_LOAD_ERROR);
    }
  });

export const getTrackedOrder = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    if (!isRecord(value)) throw new Error(PUBLIC_TRACKING_ERROR);
    const orderNumber = typeof value["orderNumber"] === "string" ? value["orderNumber"].trim() : "";
    const name = typeof value["name"] === "string" ? value["name"].trim() : "";
    const location = typeof value["location"] === "string" ? value["location"].trim() : "";
    if (!orderNumber || !name || !location) throw new Error(PUBLIC_TRACKING_ERROR);
    return {
      orderNumber: orderNumber.slice(0, 40),
      name: name.slice(0, MAX_ORDER_CUSTOMER_NAME_CHARS),
      location: location.slice(0, MAX_ORDER_LOCATION_CHARS),
    };
  })
  .handler(async ({ data }) => {
    try {
      return await readOrderForCustomerTracking(data);
    } catch {
      throw new Error(PUBLIC_TRACKING_ERROR);
    }
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .validator(
    z.object({
      query: z.string().max(120).optional(),
      status: z.string().max(40).optional(),
      limit: z.number().int().min(1).max(250).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    return listStoredOrders({
      query: data.query,
      status: data.status && isOrderStatus(data.status) ? data.status : "all",
      limit: data.limit,
    });
  });

export const saveAdminOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      orderId: z.string().trim().min(1).max(120),
      status: z.string().refine(isOrderStatus, "Choose a valid order status."),
      adminNotes: z.string().max(MAX_ORDER_ADMIN_NOTES_CHARS).optional(),
      statusNote: z.string().max(MAX_ORDER_STATUS_NOTE_CHARS).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    try {
      return await updateStoredOrder({
        orderId: data.orderId,
        status: data.status,
        adminNotes: data.adminNotes,
        statusNote: data.statusNote,
      });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Couldn't update the order.");
    }
  });
