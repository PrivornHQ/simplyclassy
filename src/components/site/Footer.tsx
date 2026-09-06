import { Instagram, Facebook, Music2, Phone, Mail, MapPin } from "lucide-react";
import { WHATSAPP_LINK } from "@/data/products";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-primary py-12">
      <div className="section-shell grid gap-8 md:grid-cols-3">
        <div>
          <p className="font-display text-xl font-semibold text-white">
            Simply<span className="text-white/70">Classy</span>
          </p>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            Authentic wrist watches, Nike Mind001 sneakers and long-lasting designer perfumes.
            Affordable luxury delivered nationwide in Ghana.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-white" aria-hidden />
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                WhatsApp +233 24 395 4370
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-white" aria-hidden />
              <a href="mailto:hello@simplyclassy.gh" className="hover:text-white">
                hello@simplyclassy.gh
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-white" aria-hidden />
              Accra, Ghana — nationwide delivery
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white">Follow</h2>
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
                className="inline-flex size-10 items-center justify-center rounded-full border border-white/25 text-white/70 transition-colors hover:border-white hover:text-white"
              >
                <Icon className="size-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="section-shell mt-8 border-t border-white/15 pt-6 text-xs text-white/60">
        © {new Date().getFullYear()} SimplyClassy. All rights reserved.
      </div>
    </footer>
  );
}
