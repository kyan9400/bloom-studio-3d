# Bloom Studio — 3D nail & beauty studio site

A concept website for **Bloom Studio**, a fictional nail and beauty studio. Its signature moment is the **Shade Lab**:
a glass polish bottle and a fan of almond nail swatches, rendered in real time, that repaint themselves with an
iridescent thin-film finish when you pick a shade. The chosen shade then follows you into a four-step booking flow.

Live: https://bloom-studio-3d.vercel.app

> Concept project — fictional brand.

## Tech stack
- Next.js 16 (App Router, TypeScript strict, `src/` dir), React 19
- three.js + @react-three/fiber, loaded with `next/dynamic(..., { ssr: false })`
- Tailwind CSS 4 (`@theme` tokens) with a small hand-written component layer
- Fonts: Fraunces + Manrope via `next/font/google`
- Versions pinned exactly (see `package.json`). GSAP and Lenis from the shared stack are intentionally **not**
  installed: nothing on this page is scroll-linked, so native scrolling is used and the JS budget stays smaller.
  `@react-three/drei` is not installed either: its `PerformanceMonitor` misreads render-on-demand pauses as
  frame drops, so the site uses its own adaptive-DPR controller and the lazy 3D chunk gets lighter.

## The signature 3D technique
- **Geometry, all procedural** (`src/three/geometry.ts`): lathe profiles for the glass, polish, cap and brush stem;
  a parametric lens-shaped solid for each almond swatch (C-curve across the width); the swatch fan is one
  `InstancedMesh` with a per-instance seed attribute.
- **Thin-film shader** (`src/three/shaders.ts`): the pigment sits under a clear coat whose reflection is tinted by
  thin-film interference — optical path difference `2·n·d·cosθt` evaluated at 650/532/450 nm. The film thickness is
  swirled with 3D value noise, so the colour flows as the bottle turns. Finishes (Glass / Aurora / Chrome) are just
  uniform presets; changing shade or finish tweens the uniforms for 0.75 s.
- **Procedural studio light**: soft boxes, top light and floor bounce are computed from the reflected vector inside
  the shader — no HDRI, no texture downloads. Glass is a fresnel-rim shader; the contact shadow is a radial-gradient plane.

## Performance
- `frameloop="demand"`: frames are drawn only while a colour tween, drag inertia or the idle sway is running.
  The loop stops when idle, when the stage is off-screen (IntersectionObserver) and in hidden tabs.
- Quality tier picked **before** the Canvas is created (GPU name probe, touch, cores, memory; `?quality=low|medium|high`):
  DPR cap 2 / 1.5 / 1, lathe segments 96 / 64 / 40, 7 / 6 / 5 swatches, micro-flake sparkle on high only.
  A small gap-aware adaptive-DPR controller (`src/three/adaptive-dpr.ts`) lowers the DPR if frames drop. It only
  measures unbroken chains of animation frames, so render-on-demand idle gaps never count as slow frames.
- Shaders are compiled with `gl.compileAsync` behind a small "Mixing pigments" veil; the SVG poster is visible until then.
- No allocations or React state updates per frame; no `backdrop-filter`; CSS animates only transform/opacity.
- The 3D chunk loads after the page is idle, so the server-rendered HTML (and the poster) paint first.
- No WebGL or a lost context → the designed SVG poster stays, and the shade picker still recolours it.
- Motion: `prefers-reduced-motion` is respected by default (no idle sway, colour changes cut instead of tween);
  a **Turn on full motion** button (hero + footer) overrides it, remembered in `localStorage`, `?motion=full` also works.

## Run it
```bash
npm install
npm run dev      # local development
npm run build    # production build
npm run lint
```

## Project layout
```
src/app/            layout, page, 404, OG/Twitter image, icon, robots, sitemap, globals.css (design tokens)
src/components/     Header, Stage (poster + lazy canvas), ShadePicker, Booking, MotionToggle, Poster
src/three/          BloomCanvas (R3F), scene (BloomScene class), geometry, shaders, quality tiers
src/lib/            shade data, shared studio store, motion preference, page content
SPEC.md             concept, design system, copy and performance budget
```

## Credits
See [CREDITS.md](./CREDITS.md). Fonts are OFL; libraries are MIT/Apache-2.0; all visuals are made in code.

## License
© 2026 Alhassan Alfarran. All rights reserved — see [LICENSE](./LICENSE).
