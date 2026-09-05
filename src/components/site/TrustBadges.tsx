import { BadgeCheck, Truck, ShieldCheck } from "lucide-react";

const badges = [
  { icon: BadgeCheck, title: "Authentic Products", copy: "Every watch, sneaker and perfume is genuine." },
  { icon: Truck, title: "Nationwide Delivery", copy: "Delivered to every region in Ghana." },
  { icon: ShieldCheck, title: "Secure Payment", copy: "Mobile money and bank transfer, safely." },
];

export function TrustBadges() {
  return (
    <section aria-label="Why shop with SimplyClassy" className="border-y border-border bg-background">
      <div className="section-shell grid gap-6 py-8 sm:grid-cols-3">
        {badges.map(({ icon: Icon, title, copy }) => (
          <div key={title} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{copy}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
