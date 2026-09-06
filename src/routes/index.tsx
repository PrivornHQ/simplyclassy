import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { TrustBadges } from "@/components/site/TrustBadges";
import { CategorySection } from "@/components/site/CategorySection";
import { About } from "@/components/site/About";
import { Testimonials } from "@/components/site/Testimonials";
import { InstagramGallery } from "@/components/site/InstagramGallery";
import { Newsletter } from "@/components/site/Newsletter";
import { Faq, faqs } from "@/components/site/Faq";
import { Footer } from "@/components/site/Footer";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";
import { categories, WHATSAPP_NUMBER } from "@/data/products";

const title = "SimplyClassy | Authentic Watches, Sneakers & Perfumes in Ghana";

const description =
  "SimplyClassy is your home for authentic wrist watches, Nike Mind001 sneakers and long-lasting designer perfumes. Affordable luxury delivered nationwide in Ghana.";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SimplyClassy",
  description,
  areaServed: "GH",
  address: {
    "@type": "PostalAddress",
    addressCountry: "GH",
    addressLocality: "Accra",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: `+${WHATSAPP_NUMBER}`,
    contactType: "sales",
    areaServed: "GH",
    availableLanguage: "English",
  },
};

const productSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: categories.flatMap((c) =>
    c.products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.name,
        category: c.title,
        brand: {
          "@type": "Brand",
          name: "SimplyClassy",
        },
        offers: {
          "@type": "Offer",
          price: p.price,
          priceCurrency: "GHS",
          availability: "https://schema.org/InStock",
        },
      },
    })),
  ),
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],

    links: [
      {
        rel: "canonical",
        href: "/",
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon.png",
      },
    ],

    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(organizationSchema),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(productSchema),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(faqSchema),
      },
    ],
  }),

  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        <Hero />

        <TrustBadges />

        {categories.map((c) => (
          <CategorySection
            key={c.id}
            category={c}
          />
        ))}

        <About />
        <Testimonials />
        <InstagramGallery />
        <Newsletter />
        <Faq />
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
}