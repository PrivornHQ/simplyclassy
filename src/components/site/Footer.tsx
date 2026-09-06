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
                hello@simplyclassy.org
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
          <div className="mt-3 flex gap-3">
            {[
              {
                Icon: Instagram,
                label: "Instagram",
                href: "https://www.instagram.com/be_real_370?stkn=bTJ1ajNtOWQwN2s2&utm_source=ig_contact_invite",
              },
              { Icon: Facebook, label: "Facebook" },
              {
                Icon: Music2,
                label: "TikTok",
                href: "https://www.tiktok.com/@classy.outlets?_r=1&_t=ZS-99W5JUVsSai",
              },
            ].map(({ Icon, label, href }) => (
              <a
                key={label}
                href={href ?? "#"}
                target={href ? "_blank" : undefined}
                rel={href ? "noopener noreferrer" : undefined}
                aria-label={label}
                className="inline-flex size-10 items-center justify-center rounded-full border border-white/25 text-white/70 shadow-card transition-colors hover:border-white hover:text-white"
              >
                <Icon className="size-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="section-shell mt-8 flex flex-col gap-2 border-t border-white/15 pt-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} SimplyClassy. All rights reserved.</span>
        <span>
          Powered by{" "}
          <a
            href="https://privorn.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white transition-colors hover:text-white/80 hover:underline"
          >
            Privorn
          </a>
        </span>
      </div>
    </footer>
  );
}
