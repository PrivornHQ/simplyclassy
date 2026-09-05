import heroImage from "@/assets/hero.jpg";
import { WHATSAPP_LINK } from "@/data/products";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-ash pt-24 pb-14 md:pt-32 md:pb-24">
      <div className="section-shell grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <p className="eyebrow">Affordable luxury · Ghana</p>
          <h1 className="mt-4 text-4xl leading-[1.05] font-semibold text-foreground sm:text-5xl md:text-6xl">
            SimplyClassy
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Your home for authentic wrist watches, Nike Mind001 sneakers and long-lasting designer
            perfumes. We sell time, scent and style — delivered nationwide in Ghana.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#perfumes"
              className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
            >
              Shop the collection
            </a>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-primary/30 px-7 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              Order on WhatsApp
            </a>
          </div>
        </div>

        <div className="relative">
          <img
            src={heroImage}
            alt="Authentic wrist watch, designer perfume and Nike Mind001 sneaker from SimplyClassy"
            width={1600}
            height={1008}
            fetchPriority="high"
            className="w-full rounded-2xl object-cover shadow-lift"
          />
        </div>
      </div>
    </section>
  );
}
