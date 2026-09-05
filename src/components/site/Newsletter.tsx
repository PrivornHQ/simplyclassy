import { useState, type FormEvent } from "react";

export function Newsletter() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setDone(true);
  };

  return (
    <section id="newsletter" className="scroll-mt-20 py-14 md:py-20">
      <div className="section-shell">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-10">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="eyebrow">WhatsApp broadcast</p>
              <h2 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">
                Get new arrivals first
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Join the SimplyClassy WhatsApp list for new watches, sneakers and perfumes — plus
                restocks and deals before anyone else.
              </p>
            </div>

            {done ? (
              <p className="self-center rounded-xl bg-accent p-5 text-sm text-accent-foreground">
                Thanks {name || "friend"} — you're on the SimplyClassy WhatsApp list. We'll message
                you when new pieces land.
              </p>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3 self-center">
                <div>
                  <label htmlFor="nl-name" className="text-sm font-medium text-foreground">
                    Name
                  </label>
                  <input
                    id="nl-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Your name"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="nl-phone" className="text-sm font-medium text-foreground">
                    WhatsApp number
                  </label>
                  <input
                    id="nl-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="024 000 0000"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Join the broadcast list
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
