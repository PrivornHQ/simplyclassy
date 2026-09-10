/**
 * Product catalogue types and category metadata for SimplyClassy.
 *
 * Live product records are persisted on the server (Netlify Blobs in production).
 * Seeded products below are migrated into that store on first load.
 */
export type ProductBadge = "New Arrival" | "Best Seller" | null;

export type CategoryId = "perfumes" | "sneakers" | "watches";

export type Product = {
  id: string;
  name: string;
  category: CategoryId;
  price: number; // Ghana Cedis
  image: string;
  alt: string;
  badge: ProductBadge;
  available: boolean;
  createdAt: string; // ISO date, used for "Newest" sorting
  description?: string;
};

export type CategoryMeta = {
  id: CategoryId;
  title: string;
  heading: string;
  blurb: string;
};

export type Category = CategoryMeta & {
  products: Product[];
};

export const categories: CategoryMeta[] = [
  {
    id: "perfumes",
    title: "Perfumes",
    heading: "Long-Lasting Designer Perfumes",
    blurb:
      "Rich, long-wearing designer fragrances for day and night — bottled scent that stays with you from morning meetings to late evenings.",
  },
  {
    id: "sneakers",
    title: "Sneakers",
    heading: "Nike Mind001 Sneakers",
    blurb:
      "Authentic Nike Mind001 sneakers in the sizes and colourways that move fastest. Clean silhouettes that dress up or down.",
  },
  {
    id: "watches",
    title: "Watches",
    heading: "Authentic Wrist Watches",
    blurb:
      "Authentic wrist watches with clean dials and quality straps — the finishing touch on every outfit.",
  },
];

export const CATEGORY_IDS: CategoryId[] = ["perfumes", "sneakers", "watches"];

export const isCategoryId = (value: string): value is CategoryId =>
  CATEGORY_IDS.includes(value as CategoryId);

export const categoryById = (id: CategoryId): CategoryMeta => {
  const found = categories.find((c) => c.id === id);
  if (!found) {
    throw new Error(`Unknown category: ${id}`);
  }
  return found;
};

/** Original catalogue, used to seed the persistent store. */
export const seedProducts: Product[] = [
  {
    id: "p1",
    name: "Oud Royale Eau de Parfum",
    category: "perfumes",
    price: 420,
    image: "/catalog/placeholder-perfume.jpg",
    alt: "Oud Royale designer perfume bottle sold by SimplyClassy in Ghana",
    badge: "Best Seller",
    available: true,
    createdAt: "2026-07-02T00:00:00.000Z",
  },
  {
    id: "p2",
    name: "Amber Noir Intense",
    category: "perfumes",
    price: 350,
    image: "/catalog/placeholder-perfume.jpg",
    alt: "Amber Noir Intense long-lasting perfume bottle",
    badge: "New Arrival",
    available: true,
    createdAt: "2026-08-21T00:00:00.000Z",
  },
  {
    id: "p3",
    name: "Velvet Rose Extrait",
    category: "perfumes",
    price: 480,
    image: "/catalog/placeholder-perfume.jpg",
    alt: "Velvet Rose Extrait designer perfume bottle",
    badge: null,
    available: true,
    createdAt: "2026-05-14T00:00:00.000Z",
  },
  {
    id: "p4",
    name: "Citrus Blanc Cologne",
    category: "perfumes",
    price: 260,
    image: "/catalog/placeholder-perfume.jpg",
    alt: "Citrus Blanc fresh cologne bottle",
    badge: null,
    available: true,
    createdAt: "2026-06-30T00:00:00.000Z",
  },
  {
    id: "s1",
    name: "Nike Mind001 — Triple White",
    category: "sneakers",
    price: 890,
    image: "/catalog/placeholder-sneaker.jpg",
    alt: "Nike Mind001 sneaker in triple white available at SimplyClassy",
    badge: "Best Seller",
    available: true,
    createdAt: "2026-07-18T00:00:00.000Z",
  },
  {
    id: "s2",
    name: "Nike Mind001 — Ash Grey",
    category: "sneakers",
    price: 920,
    image: "/catalog/placeholder-sneaker.jpg",
    alt: "Nike Mind001 sneaker in ash grey",
    badge: "New Arrival",
    available: true,
    createdAt: "2026-08-29T00:00:00.000Z",
  },
  {
    id: "s3",
    name: "Nike Mind001 — Coffee Suede",
    category: "sneakers",
    price: 950,
    image: "/catalog/placeholder-sneaker.jpg",
    alt: "Nike Mind001 sneaker in coffee brown suede",
    badge: null,
    available: true,
    createdAt: "2026-06-11T00:00:00.000Z",
  },
  {
    id: "s4",
    name: "Nike Mind001 — Midnight",
    category: "sneakers",
    price: 870,
    image: "/catalog/placeholder-sneaker.jpg",
    alt: "Nike Mind001 sneaker in midnight black",
    badge: null,
    available: true,
    createdAt: "2026-04-27T00:00:00.000Z",
  },
  {
    id: "w1",
    name: "Heritage Classic 40mm",
    category: "watches",
    price: 1250,
    image: "/catalog/placeholder-watch.jpg",
    alt: "Heritage Classic 40mm wrist watch with brown leather strap",
    badge: "Best Seller",
    available: true,
    createdAt: "2026-08-05T00:00:00.000Z",
  },
  {
    id: "w2",
    name: "Ash Steel Automatic",
    category: "watches",
    price: 1680,
    image: "/catalog/placeholder-watch.jpg",
    alt: "Ash Steel automatic wrist watch",
    badge: "New Arrival",
    available: true,
    createdAt: "2026-08-30T00:00:00.000Z",
  },
  {
    id: "w3",
    name: "Espresso Leather Minimal",
    category: "watches",
    price: 980,
    image: "/catalog/placeholder-watch.jpg",
    alt: "Minimal wrist watch with espresso leather strap",
    badge: null,
    available: true,
    createdAt: "2026-05-02T00:00:00.000Z",
  },
  {
    id: "w4",
    name: "Ivory Dial Dress Watch",
    category: "watches",
    price: 1120,
    image: "/catalog/placeholder-watch.jpg",
    alt: "Ivory dial dress wrist watch",
    badge: null,
    available: true,
    createdAt: "2026-06-19T00:00:00.000Z",
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

export const withCategoryProducts = (products: Product[]): Category[] =>
  categories.map((meta) => ({
    ...meta,
    products: products.filter((p) => p.category === meta.id),
  }));
