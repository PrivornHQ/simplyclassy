import heroImage from "@/assets/hero.jpeg";
import { useOrderCart } from "./OrderCart";

export function Hero() {
  const { setOpen } = useOrderCart();

  return (
    <section id="top" className="relative overflow-hidden bg-ash pt-24 pb-14 md:pt-32 md:pb-24">
      <div className="section-shell grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <p className="eyebrow">Affordable luxury · Ghana</p>
          <h1 className="mt-4 text-4xl leading-[1.05] font-semibold text-foreground sm:text-5xl md:text-6xl">
            SimplyClassy
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Your home for authentic wrist watches, Nike Mind001 Slides and long-lasting designer
            perfumes. We sell time, scent and style — delivered nationwide in Ghana.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#perfumes"
              className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-white px-7 py-3 text-sm font-medium text-primary shadow-soft transition-opacity hover:opacity-90"
            >
              Shop the collection
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center rounded-full bg-whatsapp px-7 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              View Order
            </button>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl shadow-lift">
          <img
            src={heroImage}
            alt="Authentic wrist watch, designer perfume and Nike Mind001 Slides from SimplyClassy"
            width={1600}
            height={1008}
            fetchPriority="high"
            className="block w-full object-cover transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none md:[@media(hover:hover)]:group-hover:scale-[1.04] motion-reduce:md:[@media(hover:hover)]:group-hover:scale-100"
          />
        </div>
      </div>
    </section>
  );
}
