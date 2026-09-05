import { Instagram, Facebook, Music2, Phone, Mail, MapPin } from "lucide-react";
import { WHATSAPP_LINK } from "@/data/products";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="section-shell grid gap-8 md:grid-cols-3">
        <div>
          <p className="font-display text-xl font-semibold text-primary">
            Simply<span className="text-foreground">Classy</span>
          </p>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Authentic wrist watches, Nike Mind001 sneakers and long-lasting designer perfumes.
            Affordable luxury delivered nationwide in Ghana.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-primary" aria-hidden />
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                WhatsApp +233 24 395 4370
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-primary" aria-hidden />
              <a href="mailto:hello@simplyclassy.gh" className="hover:text-primary">
                hello@simplyclassy.gh
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" aria-hidden />
              Accra, Ghana — nationwide delivery
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground">Follow</h2>
          {/* Replace "#" with your real profile links. */}
          <div className="mt-3 flex gap-3">
            {[
              { Icon: Instagram, label: "Instagram" },
              { Icon: Facebook, label: "Facebook" },
              { Icon: Music2, label: "TikTok" },
            ].map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Icon className="size-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="section-shell mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} SimplyClassy. All rights reserved.
      </div>
    </footer>
  );
}
