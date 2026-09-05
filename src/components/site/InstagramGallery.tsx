import { Instagram } from "lucide-react";
import placeholderPerfume from "@/assets/placeholder-perfume.jpg";
import placeholderSneaker from "@/assets/placeholder-sneaker.jpg";
import placeholderWatch from "@/assets/placeholder-watch.jpg";

/**
 * Instagram gallery placeholder.
 * Swap each `src` below for a real photo in src/assets/ (e.g. instagram-1.jpg).
 */
const posts = [
  { src: placeholderWatch, alt: "SimplyClassy wrist watch styled on Instagram" },
  { src: placeholderPerfume, alt: "SimplyClassy designer perfume flat lay on Instagram" },
  { src: placeholderSneaker, alt: "Nike Mind001 sneakers from SimplyClassy on Instagram" },
  { src: placeholderPerfume, alt: "SimplyClassy perfume gift set on Instagram" },
  { src: placeholderSneaker, alt: "SimplyClassy sneaker delivery in Ghana on Instagram" },
  { src: placeholderWatch, alt: "SimplyClassy watch close-up on Instagram" },
];

export function InstagramGallery() {
  return (
    <section aria-labelledby="instagram-title" className="bg-ash py-14 md:py-20">
      <div className="section-shell">
        <p className="eyebrow">Gallery</p>
        <h2
          id="instagram-title"
          className="mt-2 flex items-center gap-2 text-3xl font-semibold text-foreground sm:text-4xl"
        >
          <Instagram className="size-7 text-primary" aria-hidden />
          Follow SimplyClassy
        </h2>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {posts.map((p, i) => (
            <img
              key={i}
              src={p.src}
              alt={p.alt}
              width={900}
              height={900}
              loading="lazy"
              decoding="async"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
