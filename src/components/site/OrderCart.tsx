import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  categoryById,
  formatCedis,
  orderWhatsAppLink,
  type CategoryId,
  type Product,
} from "@/data/products";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "simplyclassy-order-cart";

export type OrderCartItem = {
  id: string;
  name: string;
  price: number;
  category: CategoryId;
  image: string;
  quantity: number;
};

type OrderCartContextValue = {
  items: OrderCartItem[];
  itemCount: number;
  total: number;
  open: boolean;
  addProduct: (product: Product) => void;
  increaseQuantity: (productId: string) => void;
  decreaseQuantity: (productId: string) => void;
  removeProduct: (productId: string) => void;
  clearCart: () => void;
  setOpen: (open: boolean) => void;
};

const OrderCartContext = createContext<OrderCartContextValue | null>(null);

const isStoredItem = (value: unknown): value is OrderCartItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    typeof item.category === "string" &&
    ["perfumes", "sneakers", "watches"].includes(item.category) &&
    typeof item.image === "string" &&
    typeof item.quantity === "number" &&
    Number.isFinite(item.price) &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  );
};

const readStoredCart = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredItem);
  } catch {
    return [];
  }
};

export function OrderCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<OrderCartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (items.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const addProduct = useCallback((product: Product) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          image: product.image,
          quantity: 1,
        },
      ];
    });
  }, []);

  const increaseQuantity = useCallback((productId: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }, []);

  const decreaseQuantity = useCallback((productId: string) => {
    setItems((current) =>
      current.flatMap((item) => {
        if (item.id !== productId) return [item];
        if (item.quantity <= 1) return [];
        return [{ ...item, quantity: item.quantity - 1 }];
      }),
    );
  }, []);

  const removeProduct = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<OrderCartContextValue>(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      items,
      itemCount,
      total,
      open,
      addProduct,
      increaseQuantity,
      decreaseQuantity,
      removeProduct,
      clearCart,
      setOpen,
    };
  }, [
    addProduct,
    clearCart,
    decreaseQuantity,
    increaseQuantity,
    items,
    open,
    removeProduct,
  ]);

  return (
    <OrderCartContext.Provider value={value}>
      {children}
      <OrderSummarySheet />
    </OrderCartContext.Provider>
  );
}

export function useOrderCart() {
  const context = useContext(OrderCartContext);
  if (!context) {
    throw new Error("useOrderCart must be used within an OrderCartProvider.");
  }

  return context;
}

export function OrderCartTrigger({ className }: { className?: string }) {
  const { itemCount, setOpen } = useOrderCart();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`Open order summary with ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/30 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10 sm:px-4",
        itemCount > 0 && "border-white bg-white text-primary hover:bg-white/90",
        className,
      )}
    >
      <ShoppingBag className="size-4" aria-hidden />
      <span>Order ({itemCount})</span>
    </button>
  );
}

function OrderSummarySheet() {
  const {
    clearCart,
    decreaseQuantity,
    increaseQuantity,
    items,
    open,
    removeProduct,
    setOpen,
    total,
  } = useOrderCart();

  const checkout = () => {
    if (items.length === 0) return;

    const checkoutWindow = window.open(orderWhatsAppLink(items), "_blank");
    if (!checkoutWindow) {
      toast.error("WhatsApp could not be opened. Please allow pop-ups and try again.");
      return;
    }

    checkoutWindow.opener = null;
    clearCart();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-full flex-col p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-5 py-5 text-left">
          <SheetTitle className="font-display text-2xl">Order Summary</SheetTitle>
          <SheetDescription>
            {items.length === 0
              ? "Your order is empty."
              : `${items.length} product${items.length === 1 ? "" : "s"} selected.`}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
              <ShoppingBag className="size-10 text-muted-foreground" aria-hidden />
              <p className="mt-4 text-sm font-medium text-foreground">No products selected yet.</p>
              <p className="mt-1 max-w-64 text-sm text-muted-foreground">
                Add your favorite watches, slides or perfumes and they will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[4.5rem_1fr] gap-3 border-b border-border pb-4 last:border-b-0"
                >
                  <img
                    src={item.image}
                    alt=""
                    width={120}
                    height={120}
                    className="aspect-square w-full rounded-md bg-ash object-cover"
                  />
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {categoryById(item.category).title}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProduct(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-primary">{formatCedis(item.price)}</p>
                      <div className="flex items-center rounded-full border border-border bg-background">
                        <button
                          type="button"
                          onClick={() => decreaseQuantity(item.id)}
                          aria-label={`Decrease quantity for ${item.name}`}
                          className="inline-flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
                        >
                          <Minus className="size-3.5" aria-hidden />
                        </button>
                        <span className="min-w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => increaseQuantity(item.id)}
                          aria-label={`Increase quantity for ${item.name}`}
                          className="inline-flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
                        >
                          <Plus className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>

                    <p className="mt-2 text-right text-xs text-muted-foreground">
                      Subtotal: {formatCedis(item.price * item.quantity)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <SheetFooter className="border-t border-border px-5 py-5">
          <div className="w-full space-y-4">
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatCedis(total)}</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <SheetClose asChild>
                <Button type="button" variant="outline" className="rounded-full">
                  Continue shopping
                </Button>
              </SheetClose>
              <Button
                type="button"
                onClick={checkout}
                disabled={items.length === 0}
                className="rounded-full bg-whatsapp text-background hover:bg-whatsapp/90"
              >
                Order on WhatsApp
              </Button>
            </div>

            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="w-full text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear order
              </button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
