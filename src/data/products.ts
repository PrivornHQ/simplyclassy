/**
 * Product catalogue for SimplyClassy.
 *
 * SWAPPING IN REAL PHOTOS:
 * 1. Drop your photo into `src/assets/` (e.g. src/assets/perfume-oud-royale.jpg)
 * 2. Import it at the top of this file.
 * 3. Replace the `image` value of that product with the new import.
 * Nothing else needs to change.
 */
import placeholderPerfume from "@/assets/placeholder-perfume.jpg";
import placeholderSneaker from "@/assets/placeholder-sneaker.jpg";
import placeholderWatch from "@/assets/placeholder-watch.jpg";

export type ProductBadge = "New Arrival" | "Best Seller" | null;

export type Product = {
  id: string;
  name: string;
  price: number; // Ghana Cedis
  image: string;
  alt: string;
  badge: ProductBadge;
  addedAt: string; // ISO date, used for "Newest" sorting
};

export type CategoryId = "perfumes" | "sneakers" | "watches";

export type Category = {
  id: CategoryId;
  title: string;
  heading: string;
  blurb: string;
  products: Product[];
};

export const categories: Category[] = [
  {
    id: "perfumes",
    title: "Perfumes",
    heading: "Long-Lasting Designer Perfumes",
    blurb:
      "Rich, long-wearing designer fragrances for day and night — bottled scent that stays with you from morning meetings to late evenings.",
    products: [
      {
        id: "p1",
        name: "Oud Royale Eau de Parfum",
        price: 420,
        image: placeholderPerfume,
        alt: "Oud Royale designer perfume bottle sold by SimplyClassy in Ghana",
        badge: "Best Seller",
        addedAt: "2026-07-02",
      },
      {
        id: "p2",
        name: "Amber Noir Intense",
        price: 350,
        image: placeholderPerfume,
        alt: "Amber Noir Intense long-lasting perfume bottle",
        badge: "New Arrival",
        addedAt: "2026-08-21",
      },
      {
        id: "p3",
        name: "Velvet Rose Extrait",
        price: 480,
        image: placeholderPerfume,
        alt: "Velvet Rose Extrait designer perfume bottle",
        badge: null,
        addedAt: "2026-05-14",
      },
      {
        id: "p4",
        name: "Citrus Blanc Cologne",
        price: 260,
        image: placeholderPerfume,
        alt: "Citrus Blanc fresh cologne bottle",
        badge: null,
        addedAt: "2026-06-30",
      },
    ],
  },
  {
    id: "sneakers",
    title: "Sneakers",
    heading: "Nike Mind001 Sneakers",
    blurb:
      "Authentic Nike Mind001 sneakers in the sizes and colourways that move fastest. Clean silhouettes that dress up or down.",
    products: [
      {
        id: "s1",
        name: "Nike Mind001 — Triple White",
        price: 890,
        image: placeholderSneaker,
        alt: "Nike Mind001 sneaker in triple white available at SimplyClassy",
        badge: "Best Seller",
        addedAt: "2026-07-18",
      },
      {
        id: "s2",
        name: "Nike Mind001 — Ash Grey",
        price: 920,
        image: placeholderSneaker,
        alt: "Nike Mind001 sneaker in ash grey",
        badge: "New Arrival",
        addedAt: "2026-08-29",
      },
      {
        id: "s3",
        name: "Nike Mind001 — Coffee Suede",
        price: 950,
        image: placeholderSneaker,
        alt: "Nike Mind001 sneaker in coffee brown suede",
        badge: null,
        addedAt: "2026-06-11",
      },
      {
        id: "s4",
        name: "Nike Mind001 — Midnight",
        price: 870,
        image: placeholderSneaker,
        alt: "Nike Mind001 sneaker in midnight black",
        badge: null,
        addedAt: "2026-04-27",
      },
    ],
  },
  {
    id: "watches",
    title: "Watches",
    heading: "Authentic Wrist Watches",
    blurb:
      "Authentic wrist watches with clean dials and quality straps — the finishing touch on every outfit.",
    products: [
      {
        id: "w1",
        name: "Heritage Classic 40mm",
        price: 1250,
        image: placeholderWatch,
        alt: "Heritage Classic 40mm wrist watch with brown leather strap",
        badge: "Best Seller",
        addedAt: "2026-08-05",
      },
      {
        id: "w2",
        name: "Ash Steel Automatic",
        price: 1680,
        image: placeholderWatch,
        alt: "Ash Steel automatic wrist watch",
        badge: "New Arrival",
        addedAt: "2026-08-30",
      },
      {
        id: "w3",
        name: "Espresso Leather Minimal",
        price: 980,
        image: placeholderWatch,
        alt: "Minimal wrist watch with espresso leather strap",
        badge: null,
        addedAt: "2026-05-02",
      },
      {
        id: "w4",
        name: "Ivory Dial Dress Watch",
        price: 1120,
        image: placeholderWatch,
        alt: "Ivory dial dress wrist watch",
        badge: null,
        addedAt: "2026-06-19",
      },
    ],
  },
];

export const WHATSAPP_NUMBER = "233243954370";
export const WHATSAPP_LINK =
  "https://wa.me/233243954370?text=" +
  encodeURIComponent("Hi, I'm interested in a product from SimplyClassy");

export const formatCedis = (value: number) => `₵${value.toLocaleString("en-GH")}`;

export const productWhatsAppLink = (name: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=` +
  encodeURIComponent(`Hi, I'm interested in the ${name} from SimplyClassy`);
