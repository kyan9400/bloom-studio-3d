"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#lab", label: "Shade Lab" },
  { href: "#menu", label: "Menu" },
  { href: "#studio", label: "Studio" },
  { href: "#artists", label: "Artists" },
  { href: "#visit", label: "Visit" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <a href="#top" className="wordmark" aria-label="Bloom Studio, back to top">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <path d="M16 3c4 4 5 9 0 14-5-5-4-10 0-14Z" fill="#8c2457" />
            <path d="M16 17c5-3 10-3 13 1-4 4-9 3-13-1Z" fill="#d9668f" />
            <path d="M16 17c-5-3-10-3-13 1 4 4 9 3 13-1Z" fill="#b79bd8" />
            <path d="M16 17v12" stroke="#46604f" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>
            Bloom <em>Studio</em>
          </span>
        </a>

        <nav aria-label="Main" className="nav-desktop">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <a href="#book" className="btn btn-primary btn-small">
            Book a chair
          </a>
          <button
            type="button"
            className="menu-button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span className="menu-bars" aria-hidden="true" data-open={open || undefined} />
          </button>
        </div>
      </div>

      <nav id="mobile-nav" aria-label="Mobile" className="nav-mobile" hidden={!open}>
        <ul className="wrap">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
