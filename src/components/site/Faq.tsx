export const faqs = [
  {
    q: "What does SimplyClassy sell?",
    a: "SimplyClassy sells authentic wrist watches, Nike Mind001 sneakers and long-lasting designer perfumes. In short: time, scent and style — affordable luxury for everyday wear and gifting.",
  },
  {
    q: "Does SimplyClassy deliver nationwide in Ghana?",
    a: "Yes. SimplyClassy delivers nationwide across Ghana, including Accra, Kumasi, Takoradi, Tamale, Cape Coast and every town between. Delivery usually takes 1–3 days depending on your location.",
  },
  {
    q: "How do I contact SimplyClassy?",
    a: "Message SimplyClassy on WhatsApp at +233 24 395 4370. Tap any \"Order on WhatsApp\" button on this page and your message opens ready to send.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-ash py-14 md:py-20">
      <div className="section-shell">
        <p className="eyebrow">FAQ</p>
        <h2 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">
          Frequently asked questions
        </h2>

        <dl className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-xl border border-border bg-card p-6 shadow-soft">
              <dt className="text-base font-semibold text-foreground">{f.q}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
