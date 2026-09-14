import { ShoppingBag } from "lucide-react";
import { useOrderCart } from "./OrderCart";

export function WhatsAppButton() {
  const { itemCount, setOpen } = useOrderCart();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`Open order summary with ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      className="fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full bg-whatsapp px-4 py-3 text-sm font-medium text-background shadow-lift transition-transform hover:scale-105"
    >
      <ShoppingBag className="size-5" aria-hidden />
      <span className="hidden sm:inline">Order ({itemCount})</span>
    </button>
  );
}
