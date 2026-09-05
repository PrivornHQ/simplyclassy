import { MessageCircle } from "lucide-react";
import { WHATSAPP_LINK } from "@/data/products";

export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with SimplyClassy on WhatsApp"
      className="fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full bg-whatsapp px-4 py-3 text-sm font-medium text-white shadow-lift transition-transform hover:scale-105"
    >
      <MessageCircle className="size-5" aria-hidden />
      <span className="hidden sm:inline">Chat on WhatsApp</span>
    </a>
  );
}
