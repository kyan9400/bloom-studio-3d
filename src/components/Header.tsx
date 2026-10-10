"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "#lab", label: "Shade Lab" },
  { href: "#menu", label: "Menu" },
  { href: "#studio", label: "Studio" },
  { href: "#artists", label: "Artists" },
  { href: "#visit", label: "Visit" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Unlock scroll synchronously so an in-page link click can still scroll to its target.
  const close = useCallback((restoreFocus = true) => {
    document.body.style.overflow = "";
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true });
  }, []);

  // A link hands the keyboard to its section; pulling focus back to the button would undo that.
  const onLinkClick = () => close(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // The sheet doesn't cover the whole screen: a tap on the page below it, or tabbing out of it, dismisses it.
    const outside = (target: EventTarget | null) =>
      !panelRef.current?.contains(target as Node) && !buttonRef.current?.contains(target as Node);
    const onPointerDown = (e: PointerEvent) => outside(e.target) && close();
    const onFocusIn = (e: FocusEvent) => outside(e.target) && close(false);
    // The panel only exists below the desktop breakpoint; close it if the viewport grows past it.
    const wide = window.matchMedia("(min-width: 960px)");
    const onWide = () => wide.matches && close(false);

    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      wide.removeEventListener("change", onWide);
      document.body.style.overflow = "";
    };
  }, [open, close]);

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
          <a href="#book" className="btn btn-primary btn-small header-cta">
            Book a chair
          </a>
          <button
            ref={buttonRef}
            type="button"
            className="menu-button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => (open ? close() : setOpen(true))}
          >
            <span className="sr-only">Menu</span>
            <span className="menu-bars" aria-hidden="true" data-open={open || undefined} />
          </button>
        </div>
      </div>

      <nav id="mobile-nav" ref={panelRef} aria-label="Mobile" className="nav-mobile" hidden={!open}>
        <div className="wrap">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={onLinkClick}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a href="#book" className="btn btn-primary nav-mobile-cta" onClick={onLinkClick}>
            Book a chair
          </a>
        </div>
      </nav>
    </header>
  );
}
