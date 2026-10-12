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
2. **Hero / Shade Lab** — a two-line editorial headline ("Colour, mixed / *for your hands.*", the italic line hangs
   right on desktop), intro, the live 3D bottle + swatches on a sticky, shade-tinted stage with overlay text (shade name,
   finish, shade number), keyboard "Turn left / right" buttons, shade picker (8 named shades + custom colour), finish
   selector (Glass, Aurora, Chrome), "Book this shade" CTA that carries the shade into the booking flow, and a 3-step
   ritual list ("Uncap. / Load the brush. / Lay it down, coat by coat.") that scrolls past the sticky stage.
3. **Shade ribbon** — a decorative, `aria-hidden` strip of the 8 shade names scrolling sideways (static under reduced motion).
4. **Menu** — services with duration and price.
5. **Studio** — the approach: hygiene, products, pace; three numbers.
6. **Artists** — three artists with code-made portrait tiles (no photos).
7. **Reviews** — "Hands that came back": one large pull-quote and two smaller ones, each with a first name, a service
   and the shade worn (almond swatch in that shade). Footnote: "Reviews are part of this concept project."
8. **Book** — a 4-step booking flow UI: service → artist → day & time → details → confirmation.
9. **Visit / FAQ** — address, hours, four questions.
10. **Footer** — a big clipped "Bloom *Studio*" sign-off line, contacts, motion toggle, "Concept project — fictional brand.",
    "© 2026 Alhassan Alfarran".

Desktop extras (all in one idle-loaded module, `Enhance.tsx`, no libraries): word-by-word reveals on the H2s (never
the hero), a rise-in for leads and cards, a 2 px scroll progress bar, a section-dot rail (≥ 1100 px, fine pointer),
magnetic primary buttons and a shade-coloured cursor dot (decoration only; the native cursor stays).

## 4. Signature 3D moment
**What**: a thick-walled glass bottle with a ribbed cap, a brushed-metal collar and a real brush inside, the polish,
and a fan of 5–7 almond nail swatches threaded on a split key ring. All geometry is procedural.

**Geometry** (`src/three/geometry.ts`):
- Lathe profiles are built by `profile()`: control points with a fillet on every corner (≥ 0.012), a centripetal
  Catmull-Rom spline through them, resampled evenly by arc length (48 / 72 / 96 samples per 1.6 units by tier).
  Both poles end flat on the axis, so there are no pinched dark spots under the bottle or on the cap crown.
- The glass is one closed solid in a single lathe: outer skin, a lip roll at the neck, an inner skin 0.035 inside and
  a thick base (inner floor at y 0.13, shallow punt dome underneath). The polish sits 0.004 inside the inner skin.
- The swatch is one closed parametric surface: a superellipse section (exponent 2.6) swept along the almond outline,
  with a rounded rim bead and normals from the parametric derivatives (no seams, no knife edge).
- The ring is two torus coils 0.02 apart; each swatch's punched hole sits on the ring's arc, and the fan turns around it.

**Shaders** (custom `ShaderMaterial`s, no textures, no HDRI):
- **Lacquer**: a pigment layer (diffuse + rough GGX) under a clear coat (GGX, roughness per finish: glass 0.06, aurora
  0.10, chrome 0.18) whose reflection is tinted by thin-film interference — optical path difference `2·n·d·cosθt` at
  R 650 / G 532 / B 450 nm. The coat's Fresnel darkens the base (energy conservation). Film thickness is swirled by
  2-octave gradient noise. Diffuse light is an analytic irradiance from three fixed taps (normal, key box, floor).
- **Cap**: 36 grip ribs from an analytic normal perturbation (no geometry). **Collar + ring**: brushed champagne metal
  with a Ward anisotropic highlight along the circumference.
- **Glass**: Fresnel reflection, env refraction, Beer–Lambert thickness tint (denser at the rim and in the base), a soft
  caustic glow in the thick glass base in the polish colour, and a frosted label band with an SDF petal mark and hairlines
  (a ghost from behind). Drawn as back faces then front faces, so transparent sorting is stable from every angle.
- **Swatches**: the underside is the bare milky plastic tip; the paint mask (`uPaint`) runs cuticle to tip with a
  glossy wet leading edge.
- Procedural studio light in every shader (two soft boxes, top light, floor bounce). Khronos PBR Neutral tone mapping
  on purpose: it keeps the named hex values recognisable (ACES pushes pinks orange, AgX desaturates them).
- Contact shadow: one plane with a soft wide pool plus tight AO ellipses under the bottle and the ring, which follow
  the scroll pose. High tier: an additive floor glow under the bottle in the polish colour.

**The scroll moment — "Uncap & paint"** (progress `u` 0→1):
- 0–0.35: the cap twists a quarter turn and lifts the brush clear of the neck, then tilts it toward the fan; a drop
  of polish forms at the bristle tip.
- 0.25–0.6: the fan opens from a tight stack (spread 0.25) to the full fan (1.45) and lifts 0.12.
- 0.4–1: each nail paints itself, cuticle to tip, staggered per nail.
- Camera: a 6° arc and a subtle dolly zoom (fov 31 → 27), framed so the lifted cap stays in view.
- Desktop (≥ 960 px): the hero is 190svh tall and the stage is sticky; progress = the hero's scrolled fraction, read in
  one passive scroll listener (one rAF), eased in the render loop with a critically damped follower. No GSAP, no Lenis.
- Phones and touch: plays once over 2.2 s when the stage is 60 % in view; a "Replay" button runs it again.
- Reduced motion: the final pose, instantly. The SVG poster has its own uncapped state (`.stage[data-uncap]`), so
  visitors without 3D still see the moment.

**Secondary touches**: a "lights on" ramp after the reveal (key box first, warm box 0.2 s later) and a narrow soft box
that sweeps across the objects on every shade or finish change. Drag horizontally to turn (touch-action: pan-y), or
use the "Turn left / right" buttons.

**Quality tiers** (decided before the Canvas is created — GPU name probe, touch, cores, `?quality=` override):
| tier | DPR cap | lathe seg | profile pts | swatches | sparkle | sway | cap ribs | label | floor glow | refraction |
|---|---|---|---|---|---|---|---|---|---|---|
| high | 2 | 96 | 96 | 7 | yes | yes | yes | yes | yes | yes |
| medium | 1.5 | 64 | 72 | 6 | no | yes | yes | yes | no | yes |
| low | 1 | 48 | 48 | 5 | no | no | no | yes | no | no |

Tier features are shader `#define`s, so the low tier compiles smaller programs. A gap-aware adaptive-DPR controller
(`src/three/adaptive-dpr.ts`) lowers DPR when frames slow down. drei's `<PerformanceMonitor>` was dropped: with
`frameloop="demand"` it reads idle gaps as slow frames.

**Render on demand**: `frameloop="demand"`. A loop runs only while a colour tween, the light sweep or ramp, a drag
inertia, the scroll follower or the idle sway (full motion, canvas on screen, tab visible) is active.
IntersectionObserver + visibilitychange pause it.

**Reduced motion**: no idle sway, colour changes cut instantly, lights on at once, the scroll moment snaps to its
final pose; drag still works. "Turn on full motion" toggle in the hero and footer (localStorage `bloom-motion`,
`?motion=full` overrides).

**Warm-up**: shaders compiled with `gl.compileAsync(scene, camera)` behind a small "Mixing pigments" veil; the
poster stays visible until then.

**Loading**: the 3D chunk is imported only after window `load` + an idle callback, never during hydration.
Software renderers (SwiftShader, llvmpipe, Basic Render, failIfMajorPerformanceCaveat refusal) never load it and
keep the poster; `?quality=` forces the canvas on.

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

**Spacing scale** (4 px base): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Section padding: 128 wide desktop (≥ 1200 px) /
96 tablet / 64 mobile.
Radius: 8 (inputs), 20 (cards), 999 (pills). Max content width 1200 px, 16 px mobile gutter.

**Type scale**: 14 / 16 / 18 / 22 / 30 / 44 / H2 clamp(40→80) / display clamp(52→128), line-height 0.9, −0.035em.
Section eyebrows are "01 / Services" in small caps on a hairline; prices, durations and stats use tabular figures.

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
- Poster, favicon, artist portraits: code-made (SVG / CSS). OG/Twitter image: a 1200×630 screenshot of the live site.
- Fonts: Fraunces, Manrope — SIL Open Font License 1.1, self-hosted at build time by next/font.
- Libraries: next, react, three, @react-three/fiber (MIT).
- No external runtime requests.

## 8. Performance budget
- Route first-load JS < 250 KB gzip, excluding the lazy 3D chunk (three + r3f loaded via next/dynamic ssr:false).
- No GSAP / Lenis: the one scroll-linked value (the "Uncap & paint" progress) comes from a passive listener and is
  eased inside the render loop, so native scroll stays (zero smoothing layers).
- Only the two Fraunces files used by the H1 are preloaded; Manrope is not preloaded.
- All 2D enhancements live in one idle-loaded client module with no libraries.
- LCP = hero H1 text (server-rendered, no intro animation, display face `font-display: optional`); poster is inline SVG (no image request).
- 3D: about 13 draw calls (polish, glass back + front, cap, stem, bristles, drop, collar, instanced swatches, ring,
  shadow + AO plane, floor glow on high only). No textures are downloaded.
- No per-frame allocations, no React state per frame, loop stops when idle / off-screen / hidden tab.
- No backdrop-filter anywhere.
- Lighthouse mobile targets: Perf ≥ 85, A11y/BP/SEO ≥ 95.
