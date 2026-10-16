# Credits

The hero of Bloom Studio is made in code for this project: the 3D bottle, polish, cap and nail swatches
(procedural lathe and parametric geometry), the plinth, the thin-film shader and its procedural studio lighting, the
fallback poster (inline SVG), the favicon (SVG), the artist tiles (CSS) and the Open Graph / Twitter image (a screenshot
of this site). The only third-party assets are the two CC0 photogrammetry scans listed under "CC0 assets" below; they
are bundled in `public/models/` and served from this site's own domain (no runtime CDN requests).

## Fonts (SIL Open Font License 1.1)
- **Fraunces** — Undercase Type / Phaedra Charles & Flavia Zimbardi — https://fonts.google.com/specimen/Fraunces
- **Manrope** — Mikhail Sharanda — https://fonts.google.com/specimen/Manrope

Both are self-hosted at build time through `next/font/google`; no runtime requests go to Google.

## npm libraries
| package | license |
|---|---|
| next | MIT |
| react, react-dom | MIT |
| three | MIT |
| @react-three/fiber | MIT |
| tailwindcss, @tailwindcss/postcss | MIT |
| typescript | Apache-2.0 |
| eslint, eslint-config-next | MIT |
| @types/* | MIT |

Full license texts ship with each package in `node_modules`.

## CC0 assets (Poly Haven, CC0 1.0 public domain — https://polyhaven.com/license)
Photogrammetry scans standing behind the plinth, converted to meshopt-compressed glTF binaries with 1024 px WebP
textures (`@gltf-transform/cli optimize --compress meshopt --texture-compress webp --texture-size 1024`).

| file in `public/models/` | asset | author | source |
|---|---|---|---|
| `potted_plant_04.glb` | Potted Plant 04 | James Ray Cock | https://polyhaven.com/a/potted_plant_04 |
| `ceramic_vase_01.glb` | Ceramic Vase 01 | James Ray Cock | https://polyhaven.com/a/ceramic_vase_01 |
