import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/logo.png";

const links = [
  { href: "#perfumes", label: "Perfumes" },
  { href: "#sneakers", label: "Sneakers" },
  { href: "#watches", label: "Watches" },
  { href: "#about", label: "About" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "bg-primary/95 shadow-soft backdrop-blur-md" : "bg-primary/85 backdrop-blur",
      )}
    >
      <nav
        aria-label="Main navigation"
        className="section-shell flex h-16 items-center justify-between"
      >
       <a
  href="#top"
  aria-label="SimplyClassy home"
  className="flex min-w-0 items-center gap-0 sm:gap-1"
>
<span
  className="relative size-12 shrink-0 overflow-hidden sm:size-14"
  aria-hidden="true"
>
  <img
    src={logoAsset}
    alt=""
    className="absolute left-1/2 top-1/2 size-[65px] max-w-none -translate-x-1/2 -translate-y-1/2 sm:size-[75px]"
  />
</span>

  <span className="-ml-1 truncate font-display text-[1.25rem] font-semibold tracking-tight text-white sm:-ml-1.5 sm:text-[1.45rem]">
    SimplyClassy
  </span>
</a>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-sm text-white/75 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href="#newsletter"
            className="hidden rounded-full bg-white px-5 py-2 text-sm font-medium text-primary transition-opacity hover:opacity-90 sm:inline-flex"
          >
            Join the list
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/30 text-white md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-white/15 bg-primary md:hidden">
          <ul className="section-shell flex flex-col py-2">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-sm text-white"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
