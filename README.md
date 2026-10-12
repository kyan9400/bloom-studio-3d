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
  installed: the one scroll-linked value (the "Uncap & paint" progress) comes from a passive listener and is eased
  inside the render loop, so native scrolling stays and the JS budget stays smaller.
  `@react-three/drei` is not installed either: its `PerformanceMonitor` misreads render-on-demand pauses as
  frame drops, so the site uses its own adaptive-DPR controller and the lazy 3D chunk gets lighter.

## The signature 3D technique
- **Geometry, all procedural** (`src/three/geometry.ts`): filleted spline profiles (centripetal Catmull-Rom,
  resampled by arc length) turned on a lathe for a thick-walled glass bottle (lip roll, inner wall, thick base with a
  punt), the polish (0.004 inside the glass), the cap, a brushed-metal collar and the brush. Each almond swatch is one
  closed parametric surface (superellipse section, rounded rim bead, analytic normals); the fan is one `InstancedMesh`
  threaded on a split key ring through punched holes.
- **Lacquer shader** (`src/three/shaders.ts`): a pigment layer under a GGX clear coat whose reflection is tinted by
  thin-film interference — optical path difference `2·n·d·cosθt` at 650/532/450 nm, thickness swirled with gradient
  noise, so the colour flows as the bottle turns. The coat's Fresnel darkens the base; diffuse light comes from an
  analytic three-tap irradiance. Finishes (Glass / Aurora / Chrome) are uniform presets, tweened over 0.75 s.
- **Details**: 36 analytic grip ribs on the cap, a Ward anisotropic highlight on the collar and ring, a frosted label
  band with an SDF petal mark on the glass, a Beer–Lambert thickness tint and a caustic glow in the glass base.
- **The moment — "Uncap & paint"**: scrolling the hero (desktop, sticky stage) or reaching the stage (phones) twists
  the cap off, lifts the brush with a drop of polish, opens the fan and paints each nail from cuticle to tip with a
  wet leading edge, with a subtle dolly zoom. Plus a "lights on" ramp after the reveal and a light sweep on every
  shade change.
- **Procedural studio light**: soft boxes, top light and floor bounce are computed from the reflected vector inside
  the shader — no HDRI, no texture downloads. The contact shadow and AO are one code-made plane.

## Performance
- `frameloop="demand"`: frames are drawn only while a colour tween, the light ramp or sweep, drag inertia, the scroll
  follower or the idle sway is running.
  The loop stops when idle, when the stage is off-screen (IntersectionObserver) and in hidden tabs.
- Quality tier picked **before** the Canvas is created (GPU name probe, touch, cores, memory; `?quality=low|medium|high`):
  DPR cap 2 / 1.5 / 1, lathe segments 96 / 64 / 48, profile samples 96 / 72 / 48, 7 / 6 / 5 swatches; sparkle and
  floor glow on high, cap ribs and refraction on high + medium (shader `#define`s, so low compiles smaller programs).
  A small gap-aware adaptive-DPR controller (`src/three/adaptive-dpr.ts`) lowers the DPR if frames drop. It only
  measures unbroken chains of animation frames, so render-on-demand idle gaps never count as slow frames.
- Shaders are compiled with `gl.compileAsync` behind a small "Mixing pigments" veil; the SVG poster is visible until then.
- No allocations or React state updates per frame; no `backdrop-filter`; CSS animates only transform/opacity.
- The 3D chunk is requested only after window `load` + `requestIdleCallback` (2.5 s timeout), never during
  hydration, so the server-rendered HTML (hero text and the poster) paints and becomes interactive first. Scene
  geometry is built in small steps that yield to the main thread, with one more yield before `compileAsync`.
- Software WebGL (SwiftShader, llvmpipe, softpipe, Microsoft Basic Render, Mesa offscreen, or a context that only
  exists with `failIfMajorPerformanceCaveat` off) → the 3D chunk is never downloaded; the poster stays.
  `?quality=low|medium|high` still forces the canvas on. The probe is a 1×1 context, no three.js import.
- No WebGL or a lost context → the designed SVG poster stays, and the shade picker still recolours it.
- Hero copy has no intro animation; the display face uses `font-display: optional` so the LCP headline never repaints late.
  Only the two Fraunces files the H1 uses are preloaded (Manrope is not).
- The 2D polish (H2 word reveals, progress bar, section dots, magnetic buttons, shade cursor) is one small client
  module with no libraries, started after `load` + idle; it never touches the hero.
- Motion: `prefers-reduced-motion` is respected by default (no idle sway, colour changes cut instead of tween);
  a **Turn on full motion** button (hero + footer) overrides it, remembered in `localStorage`, `?motion=full` also works.

## Run it
```bash
npm install
npm run dev      # local development
npm run build    # production build
npm run lint
npm run build:pages  # static GitHub Pages mirror in out/ (basePath /bloom-studio-3d)
```

## Project layout
```
src/app/            layout, page, 404, OG/Twitter image (site screenshot PNG), icon, robots, sitemap, globals.css (design tokens)
src/components/     Header, Stage (poster + lazy canvas + scroll moment), ShadePicker, Booking, MotionToggle, Poster, Enhance
src/three/          BloomCanvas (R3F), scene (BloomScene class), geometry, shaders, quality tiers
src/lib/            shade data, shared studio store, motion preference, page content
SPEC.md             concept, design system, copy and performance budget
```

## Credits
See [CREDITS.md](./CREDITS.md). Fonts are OFL; libraries are MIT/Apache-2.0; all visuals are made in code.

## License
© 2026 Alhassan Alfarran. All rights reserved — see [LICENSE](./LICENSE).
