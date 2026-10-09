# Bloom Studio — SPEC

## 1. Concept
Bloom Studio is a (fictional) small nail and beauty studio in a converted flower shop. Its whole pitch is colour:
every visit starts at the "Shade Lab", where you mix the exact finish you want before you sit down.
The site turns that ritual into the signature moment — a glass polish bottle and a fan of nail swatches,
rendered in real time, that repaint themselves with an iridescent thin-film finish when you pick a shade.

Tone: warm, precise, a little editorial. Think a botanical print shop rather than a salon flyer.

## 2. Audience
- Primary: 22–45, city-based, books on a phone, cares about hygiene and craft, follows nail art online.
- Secondary: studio owners / hiring managers looking at the portfolio — they should see a real design system,
  real interaction design (the booking flow) and a polished 3D moment that stays fast.

## 3. Sections (in order)
1. **Header** — wordmark, anchor nav (Shade Lab, Menu, Studio, Artists, Book), "Book a chair" button. Skip link first.
2. **Hero / Shade Lab** — headline, intro, the live 3D bottle + swatches, shade picker (8 named shades + custom colour),
   finish selector (Glass, Aurora, Chrome), "Book this shade" CTA that carries the shade into the booking flow.
3. **Menu** — services with duration and price.
4. **Studio** — the approach: hygiene, products, pace; three numbers.
5. **Artists** — three artists with code-made portrait tiles (no photos).
6. **Book** — a 4-step booking flow UI: service → artist → day & time → details → confirmation.
7. **Visit / FAQ** — address, hours, four questions.
8. **Footer** — contacts, motion toggle, "Concept project — fictional brand.", "© 2026 Alhassan Alfarran".

## 4. Signature 3D moment
**What**: a lathe-turned glass bottle with a brush cap, the polish inside, and a fan of 5–7 almond nail swatches.
All geometry is procedural (LatheGeometry, ExtrudeGeometry from a Shape, InstancedMesh for the swatches).

**Technique — thin-film shader** (custom `ShaderMaterial`, no textures, no HDRI):
- Base pigment colour + a clear coat whose reflectance is computed with thin-film interference:
  optical path difference `2·n·d·cosθt` for three wavelengths (R 650 nm, G 532 nm, B 450 nm) → per-channel interference term.
- Film thickness `d` varies over the surface with cheap value-noise ("swirl"), so the hue shifts as the object turns.
- Finish presets change uniforms: **Glass** (thin film off-peak, high gloss), **Aurora** (strong film, colour-shifting),
  **Chrome** (metallic: pigment tints the reflection, film on top).
- Procedural studio environment inside the shader (two soft-box strips + floor bounce, from the reflected vector).
- High tier only: micro-flake sparkle (hashed cells that glint with view angle).
- Glass bottle: fresnel-rim glass shader (transparent, depth-write off), liquid rendered first.
- Ground: a code-made radial shadow plane (no shadow maps).

**Interaction**: picking a shade lerps the pigment uniform over ~0.7 s (frame loop runs only during the tween).
Drag horizontally to turn the bottle (touch-action: pan-y, so vertical page scroll still works).

**Quality tiers** (decided before the Canvas is created — GPU name probe, touch, cores, `?quality=` override):
| tier | DPR cap | lathe segments | swatches | sparkle | idle sway |
|---|---|---|---|---|---|
| high | 2 | 96 | 7 | yes | yes |
| medium | 1.5 | 64 | 6 | no | yes |
| low | 1 | 40 | 5 | no | no |
Plus a gap-aware adaptive-DPR controller (`src/three/adaptive-dpr.ts`) lowering DPR on decline. drei's
`<PerformanceMonitor>` was dropped: with `frameloop="demand"` it reads idle gaps as slow frames.

**Render on demand**: `frameloop="demand"`. A loop only while a colour tween, a drag inertia, or the idle sway
(full motion, canvas on screen, tab visible) is active. IntersectionObserver + visibilitychange pause it.

**Reduced motion**: no idle sway, colour changes cut instantly; drag still works. "Turn on full motion" toggle in the
hero and footer (localStorage `bloom-motion`, `?motion=full` overrides).

**Warm-up**: shaders compiled with `gl.compileAsync(scene, camera)` behind a small "Mixing pigments" veil; the
poster stays visible until then.

**No-WebGL / context lost**: a designed SVG poster (bottle silhouette, swatch fan, gradient) — always rendered on the
server, so it is also the LCP placeholder. The picker still works (poster recolours via CSS custom properties).

## 5. Design system
**Palette**
| token | hex | use |
|---|---|---|
| milk | #FBF6F1 | page background |
| petal | #F4E4DE | panels, cards |
| blush | #E9C9C1 | lines, soft fills |
| plum | #2A1B2D | text, dark sections |
| plum-2 | #3B2740 | dark section panels |
| berry | #8C2457 | accent / CTA (7.4:1 on milk) |
| mute | #6B5868 | secondary text (6.1:1 on milk) |
| leaf | #46604F | small botanical accents |
| cream-on-plum | #F6E9E3 | text on plum (13:1) |

**Fonts** (Google Fonts, OFL, via next/font): **Fraunces** (display, soft optical serif, italic for accents) +
**Manrope** (UI and body).

**Spacing scale** (4 px base): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Section padding: 96 desktop / 64 mobile.
Radius: 8 (inputs), 20 (cards), 999 (pills). Max content width 1200 px, 16 px mobile gutter.

**Type scale**: 14 / 16 / 18 / 22 / 30 / 44 / clamp(48→104) display.

## 6. Final copy
**Hero**
- Eyebrow: "Nail & beauty studio · Old Flower Market"
- H1: "Colour, mixed for your hands."
- Intro: "Every appointment at Bloom starts in the Shade Lab. Pick a pigment, choose a finish, watch it catch the light —
  then we lay it down, coat by coat, in a quiet studio that never runs late."
- Picker label: "Choose a shade" · Finish label: "Finish" · CTA: "Book this shade" · secondary: "See the menu"
- Hint: "Drag the bottle to turn it."

**Shades**: Peony Glaze #D9668F · Fig Velvet #6E2A4F · Matcha Milk #A9C29A · Saffron Silk #E3A33B ·
Tidepool #2F7A8A · Lilac Hour #B79BD8 · Bare Petal #E8B9A8 · Midnight Plum #2E1838

**Menu** — H2 "The menu" · lead "Clear prices, honest timings. Every service includes cuticle care, a hand massage and
a shade from the lab."
- Signature Gel Manicure — 60 min — €42 — "Shape, cuticle care and a long-wear gel in any lab shade."
- BIAB Strength Overlay — 75 min — €55 — "A builder gel that lets weak or bitten nails grow out strong."
- Aurora & Chrome Finish — +20 min — €12 — "A thin-film top layer that shifts colour as your hands move."
- Hand-painted Nail Art — from 30 min — from €15 — "Florals, fine lines and tiny botanicals, drawn freehand."
- Garden Pedicure — 70 min — €48 — "A warm soak, gentle exfoliation, polish and a long calf massage."
- Brow Shape & Tint — 30 min — €26 — "Mapped to your face, tinted to your colouring."

**Studio** — H2 "A slower kind of studio" · lead "We left the flower shop's tiled floor and big windows and built
four chairs around them. Nobody is rushed and nothing is reused."
- "Hospital-grade hygiene" — "Metal tools go through an autoclave and arrive in a sealed pouch you open yourself."
- "Kind formulas" — "Our gels are HEMA-free and 10-free. We will tell you exactly what goes on your nails."
- "Time on your side" — "Appointments are booked with a ten-minute buffer, so we start when we say we will."
- Stats: "4 chairs, never more" · "38 lab shades in rotation" · "4.9 average from 1,200+ visits"

**Artists** — H2 "The hands behind it"
- Mira Okafor — Studio lead & colourist — "Mixes every lab shade herself. Ask her about undertones."
- Jun Halvorsen — Nail artist — "Freehand florals and fine-line work. Booked out on Fridays."
- Selin Arda — Pedicure & brows — "Calm, careful and the best hand massage in the building."

**Book** — H2 "Book a chair" · lead "Four quick steps. No account, no deposit — we confirm by message within the hour."
- Steps: "Service" · "Artist" · "Day & time" · "Your details"
- Shade line: "Your shade: {name} · {finish}"
- Details: Name, Phone or email, Notes (optional)
- Buttons: "Back", "Continue", "Request booking"
- Confirmation: "Your chair is pencilled in." / "We'll message you within the hour to confirm {service} with {artist}
  on {day} at {time}." · "Book another"

**Visit** — H2 "Visit the studio" — "14 Old Flower Market, Riverside" · Hours "Tue–Fri 10:00–20:00 · Sat 9:00–18:00 ·
Sun–Mon closed"
- FAQ: "How long does gel last?" — "Two to three weeks for most people. We remove it gently, without drilling the natural nail."
- "Can I bring my own design?" — "Yes. Send a picture with your booking and we'll plan the time it needs."
- "What if I'm running late?" — "Message us. Up to fifteen minutes we can usually keep the full service."
- "Is the aurora finish safe?" — "It's a cosmetic top coat with a fine shimmer pigment, cured like any gel."

**Footer**: "Bloom Studio" · contact links (portfolio owner's real contacts) · "Concept project — fictional brand." ·
"© 2026 Alhassan Alfarran"

## 7. Assets & licenses
- 3D: 100 % procedural code. No models, no textures, no HDRIs.
- Poster, favicon, OG image, artist portraits: code-made (SVG / next/og / CSS).
- Fonts: Fraunces, Manrope — SIL Open Font License 1.1, self-hosted at build time by next/font.
- Libraries: next, react, three, @react-three/fiber (MIT).
- No external runtime requests.

## 8. Performance budget
- Route first-load JS < 250 KB gzip, excluding the lazy 3D chunk (three + r3f loaded via next/dynamic ssr:false).
- No GSAP / Lenis: nothing on this page is scroll-linked, so native scroll is used (zero smoothing layers).
- LCP = hero H1 text (server-rendered); poster is inline SVG (no image request).
- 3D: one draw call per object (bottle glass, liquid, cap, brush stem, swatches instanced, shadow) ≈ 6 draw calls.
- No per-frame allocations, no React state per frame, loop stops when idle / off-screen / hidden tab.
- No backdrop-filter anywhere.
- Lighthouse mobile targets: Perf ≥ 85, A11y/BP/SEO ≥ 95.
