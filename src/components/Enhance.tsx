"use client";

import { useEffect } from "react";
import { studioStore } from "@/lib/studio-store";

/*
  Progressive 2D polish, started after window "load" + idle (like the 3D), no libraries:
  H2 word reveals, rise-in for leads and cards, scroll progress bar, section dots,
  magnetic buttons and the shade cursor. It never touches the hero copy (the LCP).
  Everything reads the .reduce-motion class at the moment it acts, so the toggle works live.
*/

const SECTIONS: [string, string][] = [
  ["lab", "Shade Lab"],
  ["menu", "Menu"],
  ["studio", "Studio"],
  ["artists", "Artists"],
  ["reviews", "Reviews"],
  ["book", "Booking"],
  ["visit", "Visit"],
];

let started = false;
const html = () => document.documentElement;
const calm = () => html().classList.contains("reduce-motion");
const el = (tag: string, cls: string, parent: Element = document.body) => {
  const n = document.createElement(tag);
  n.className = cls;
  parent.appendChild(n);
  return n;
};

/** Wrap every word of the H2s in a mask span; the heading keeps its text as aria-label. */
function splitHeadings() {
  document.querySelectorAll<HTMLElement>("main section:not(#lab) .h2").forEach((h) => {
    if (h.dataset.split) return;
    h.dataset.split = "1";
    h.setAttribute("aria-label", (h.textContent || "").replace(/\s+/g, " ").trim());
    let i = 0;
    const walk = (node: Node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType !== 3) {
          walk(child);
          continue;
        }
        const frag = document.createDocumentFragment();
        for (const part of (child.textContent || "").split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.append(part);
            continue;
          }
          const w = document.createElement("span");
          w.className = "w";
          w.setAttribute("aria-hidden", "true");
          const inner = document.createElement("span");
          inner.textContent = part;
          inner.style.setProperty("--i", String(i++));
          w.append(inner);
          frag.append(w);
        }
        child.replaceWith(frag);
      }
    };
    walk(h);
  });
}

function reveals() {
  splitHeadings();
  const targets = document.querySelectorAll(
    "main section:not(#lab) :is(.h2, .section-lead, .menu-item, .pillar, .stat, .artist, .review, .faq-item)",
  );
  // 40% in view; an element too tall to ever reach 40% counts once it fills a third of the viewport
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (e.intersectionRatio < 0.4 && e.intersectionRect.height < innerHeight / 3) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    },
    { threshold: [0.15, 0.4] },
  );
  targets.forEach((t) => {
    if (!t.classList.contains("h2")) t.classList.add("rise");
    io.observe(t);
  });
  html().classList.add("js-reveal");
}

function progressAndDots() {
  const bar = el("div", "scroll-progress");
  bar.setAttribute("aria-hidden", "true");
  let raf = 0;
  const paint = () => {
    raf = 0;
    const max = html().scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener("scroll", () => raf || (raf = requestAnimationFrame(paint)), { passive: true });
  paint();

  const rail = el("nav", "section-rail");
  rail.setAttribute("aria-label", "Sections");
  const links = new Map<Element, HTMLAnchorElement>();
  for (const [id, name] of SECTIONS) {
    const section = document.getElementById(id);
    if (!section) continue;
    const a = el("a", "rail-dot", rail) as HTMLAnchorElement;
    a.href = `#${id}`;
    a.setAttribute("aria-label", `Go to ${name}`);
    links.set(section, a);
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.removeAttribute("aria-current"));
        links.get(e.target)?.setAttribute("aria-current", "true");
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  links.forEach((_, s) => io.observe(s));
}

/* Uses the CSS `translate` property, so the buttons keep their own transform (press) and transitions. */
function magnetic() {
  let active: HTMLElement | null = null;
  const release = () => {
    if (!active) return;
    delete active.dataset.mag;
    active.style.translate = "";
    active = null;
  };
  addEventListener(
    "pointermove",
    (e) => {
      const b = (e.target as Element).closest?.<HTMLElement>(".btn-primary, .btn-ghost") ?? null;
      if (b !== active || calm()) release();
      if (!b || calm()) return;
      active = b;
      const r = b.getBoundingClientRect();
      const x = Math.max(-6, Math.min(6, (e.clientX - r.left - r.width / 2) * 0.2));
      const y = Math.max(-6, Math.min(6, (e.clientY - r.top - r.height / 2) * 0.3));
      b.dataset.mag = "";
      b.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", release);
}

function shadeCursor() {
  const c = el("div", "shade-cursor");
  c.setAttribute("aria-hidden", "true");
  const ring = el("span", "shade-cursor-ring", c);
  el("span", "shade-cursor-label", ring).textContent = "Drag";
  const dot = el("span", "shade-cursor-dot", c);
  const tint = () => c.style.setProperty("--shade", studioStore.get().hex);
  studioStore.subscribe(tint);
  tint();

  let x = 0;
  let y = 0;
  let rx = 0;
  let ry = 0;
  let raf = 0;
  let placed = false;
  const loop = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.3 ? requestAnimationFrame(loop) : 0;
  };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse" || calm()) {
        c.dataset.state = "off";
        return;
      }
      x = e.clientX;
      y = e.clientY;
      // the ring starts under the pointer instead of flying in from the corner
      if (!placed) {
        placed = true;
        rx = x;
        ry = y;
      }
      const t = e.target as Element;
      // "Drag" only where dragging works: over the live 3D, not the poster
      c.dataset.state = t.closest?.("input, textarea, select, [contenteditable]")
        ? "off"
        : t.closest?.('.stage[data-phase="ready"] .stage-view')
          ? "drag"
          : "on";
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (!raf) raf = requestAnimationFrame(loop);
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => (c.dataset.state = "off"));
}

function start() {
  reveals();
  progressAndDots();
  const fine = matchMedia("(pointer: fine)").matches;
  if (fine) {
    magnetic();
    shadeCursor();
  }
}

export default function Enhance() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const go = () => {
      if (started) return;
      started = true;
      start();
    };
    const idle = () => (w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 600));
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
  }, []);
  return null;
}
