import { Star } from "lucide-react";

const reviews = [
  {
    name: "Ama K.",
    city: "Accra",
    text: "My perfume arrived the same day and it lasts all day at work. Exactly what was advertised.",
  },
  {
    name: "Kwesi B.",
    city: "Kumasi",
    text: "The Nike Mind001 sneakers are 100% authentic. Delivery to Kumasi took two days.",
  },
  {
    name: "Nana Y.",
    city: "Takoradi",
    text: "Bought a watch as a gift — beautiful packaging and honest pricing. I'll be back.",
  },
];

export function Testimonials() {
  return (
    <section aria-labelledby="reviews-title" className="py-14 md:py-20">
      <div className="section-shell">
        <p className="eyebrow">Reviews</p>
        <h2 id="reviews-title" className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">
          What SimplyClassy customers say
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
          {reviews.map((r) => (
            <figure key={r.name} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="flex gap-1 text-primary" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" aria-hidden />
                ))}
              </div>
              <blockquote className="mt-3 text-sm text-muted-foreground">"{r.text}"</blockquote>
              <figcaption className="mt-4 text-sm font-medium text-foreground">
                {r.name} — {r.city}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
