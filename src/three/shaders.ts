/*
  Shaders for the Shade Lab. One family, all procedural (no textures, no HDRI).

  Lacquer ("film"): a pigment layer (diffuse + rough GGX) under a clear coat (sharp GGX + Fresnel).
  The coat's reflection is tinted by thin-film interference: the optical path difference 2·n·d·cosθt
  is evaluated at three wavelengths (R/G/B), and d is swirled by 2-octave gradient noise, so the
  aurora finish flows as the bottle turns. The coat's Fresnel darkens the base (energy conservation).
  HOLE_Y, NAIL_LEN and WALL are #defines set by the scene from the geometry constants.

  Studio light: two soft boxes, a top light and a warm floor bounce, computed from the reflected
  vector. uLights (key, warm) switches the boxes on after the reveal; uSweep runs a narrow vertical
  soft box across the objects on every shade change.
*/

const ENV = /* glsl */ `
uniform vec2 uLights;
uniform float uSweep;
const vec3 KEY_DIR = vec3(-0.7533, 0.2216, 0.4874);
const vec3 WARM_DIR = vec3(0.9480, 0.1497, 0.2495);

vec3 studioEnv(vec3 r) {
  float y = r.y;
  float amb = 0.35 + 0.65 * max(uLights.x, uLights.y);
  vec3 col = mix(vec3(0.20, 0.12, 0.16), vec3(0.95, 0.88, 0.86), smoothstep(-0.35, 0.9, y) * 0.6) * amb;
  // tall soft box, camera-left
  float b1 = smoothstep(0.80, 0.96, dot(r, KEY_DIR));
  b1 *= (1.0 - smoothstep(0.3, 0.75, abs(r.y - 0.25)));
  // smaller warm box, camera-right
  float b2 = smoothstep(0.88, 0.98, dot(r, WARM_DIR));
  float top = smoothstep(0.86, 0.99, y);
  col += vec3(1.0, 0.98, 0.97) * b1 * 2.6 * uLights.x;
  col += vec3(1.0, 0.82, 0.80) * b2 * 1.5 * uLights.y;
  col += vec3(1.0) * top * 1.4 * uLights.x;
  col += vec3(0.35, 0.16, 0.18) * (1.0 - smoothstep(-0.6, 0.0, y)) * amb;
  // light sweep: a narrow vertical box that crosses from left to right
  if (uSweep > 0.0 && uSweep < 1.0) {
    float a = mix(-1.2, 1.2, uSweep);
    vec2 d = vec2(sin(a), cos(a));
    float band = smoothstep(0.975, 0.998, dot(normalize(r.xz + 1e-5), d)) * (1.0 - smoothstep(0.45, 0.85, abs(y)));
    col += vec3(1.0, 0.97, 0.95) * band * 2.2 * sin(uSweep * 3.14159);
  }
  return col;
}

// Smooth, low-frequency light for diffuse surfaces (what studioEnv would give after a wide blur).
vec3 studioIrr(vec3 n) {
  float amb = 0.35 + 0.65 * max(uLights.x, uLights.y);
  vec3 col = mix(vec3(0.24, 0.15, 0.19), vec3(0.86, 0.80, 0.79), smoothstep(-0.6, 0.9, n.y)) * amb;
  col += vec3(1.0, 0.97, 0.95) * pow(max(dot(n, KEY_DIR), 0.0), 2.0) * 0.55 * uLights.x;
  col += vec3(1.0, 0.85, 0.82) * pow(max(dot(n, WARM_DIR), 0.0), 2.0) * 0.3 * uLights.y;
  col += vec3(0.42, 0.2, 0.22) * (1.0 - smoothstep(-0.7, 0.1, n.y)) * amb;
  return col;
}

// Irradiance from three fixed taps: the normal, the normal leaning to the key box, and to the floor.
vec3 irradiance(vec3 n) {
  return (studioIrr(n) + studioIrr(normalize(n + KEY_DIR * 0.8)) + studioIrr(normalize(n + vec3(0.0, -0.9, 0.0)))) / 3.0;
}
`;

const BRDF = /* glsl */ `
float dGGX(float NdH, float a) {
  float a2 = a * a;
  float d = NdH * NdH * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * d * d);
}
float gSmith(float NdV, float NdL, float a) {
  float k = a * 0.5;
  return (NdV / (NdV * (1.0 - k) + k)) * (NdL / (NdL * (1.0 - k) + k));
}
// GGX specular, already multiplied by N·L
float ggx(vec3 N, vec3 V, vec3 L, float a) {
  vec3 H = normalize(L + V);
  float NdL = max(dot(N, L), 0.0);
  float NdV = max(dot(N, V), 1e-3);
  float NdH = max(dot(N, H), 0.0);
  return min(dGGX(NdH, a) * gSmith(NdV, NdL, a) * NdL / (4.0 * NdV), 24.0);
}
`;

const NOISE = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 grad3(vec3 i) {
  return normalize(vec3(hash13(i), hash13(i + 17.13), hash13(i + 41.71)) * 2.0 - 1.0 + 1e-4);
}
// 3D gradient noise in 0..1 (no grid-aligned blobs like value noise)
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(grad3(i), f);
  float n100 = dot(grad3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0));
  float n010 = dot(grad3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0));
  float n110 = dot(grad3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0));
  float n001 = dot(grad3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1));
  float n101 = dot(grad3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1));
  float n011 = dot(grad3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1));
  float n111 = dot(grad3(i + vec3(1, 1, 1)), f - vec3(1, 1, 1));
  float n = mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
  return clamp(n * 0.9 + 0.5, 0.0, 1.0);
}
`;

/** Shared vertex shader: world/object position, normals and the lathe's circumferential tangent. */
export const filmVertex = /* glsl */ `
#ifdef USE_INSTANCING
attribute float aSeed;
#endif
varying vec3 vNormalW;
varying vec3 vNormalO;
varying vec3 vTanW;
varying vec3 vPosW;
varying vec3 vPosO;
varying float vSeed;

void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  vec3 t = vec3(-position.z, 0.0, position.x) + vec3(1e-5, 0.0, 0.0);
  vSeed = 0.0;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
    vSeed = aSeed;
  #endif
  vec4 world = modelMatrix * p;
  vPosW = world.xyz;
  vPosO = position;
  vNormalO = normal;
  vNormalW = normalize(mat3(modelMatrix) * n);
  vTanW = normalize(mat3(modelMatrix) * t);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const filmFragment = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uBare;
uniform float uFilm;
uniform float uThickness;
uniform float uMetal;
uniform float uSparkle;
uniform float uTime;
uniform float uSwirlScale;
uniform float uSeedShade;
uniform float uRough;
uniform float uPaint;

varying vec3 vNormalW;
varying vec3 vNormalO;
varying vec3 vTanW;
varying vec3 vPosW;
varying vec3 vPosO;
varying float vSeed;

${NOISE}
${ENV}
${BRDF}

vec3 thinFilm(float cosI, float d) {
  const float n = 1.42;
  float sinT2 = (1.0 - cosI * cosI) / (n * n);
  float cosT = sqrt(max(0.0, 1.0 - sinT2));
  float opd = 2.0 * n * d * cosT;
  vec3 phase = 6.28318530718 * opd / vec3(650.0, 532.0, 450.0);
  return 0.5 + 0.5 * cos(phase);
}

void main() {
  float bare = 0.0;
  float wet = 0.0;
  float rimDark = 0.0;
  #ifdef SWATCH
    // punched hole for the ring, near the cuticle end
    float hole = length(vPosO.xy - vec2(0.0, HOLE_Y));
    if (hole < 0.03) discard;
    rimDark = 1.0 - smoothstep(0.03, 0.045, hole);
    // underside (and anything seen through the hole) is the bare plastic tip
    float under = gl_FrontFacing ? 1.0 - smoothstep(-0.5, -0.2, normalize(vNormalO).z) : 1.0;
    // paint runs from cuticle to tip, staggered per nail
    // (the -0.03 start keeps the cuticle edge fully bare at uPaint = 0)
    float front = (uPaint - vSeed * 0.5) * (NAIL_LEN + 0.06) - 0.03;
    float y = vPosO.y + 0.035;
    float m = smoothstep(y - 0.03, y + 0.03, front);
    bare = 1.0 - m * (1.0 - under);
    wet = 4.0 * m * (1.0 - m) * (1.0 - under);
  #endif

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  if (dot(N, V) < 0.0) N = -N;

  #ifdef CAP_RIBS
    // 36 vertical grip ribs, a rounded-square wave in the normal (no geometry)
    float ang = atan(vPosO.z, vPosO.x) * 36.0;
    float slope = cos(ang) * exp(-4.0 * sin(ang) * sin(ang));
    float band = smoothstep(1.60, 1.62, vPosO.y) * (1.0 - smoothstep(2.40, 2.42, vPosO.y));
    N = normalize(N + normalize(vTanW) * slope * 0.55 * band);
  #endif

  float NdV = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);
  vec3 keyCol = vec3(1.0, 0.98, 0.96) * uLights.x;
  vec3 warmCol = vec3(1.0, 0.84, 0.8) * uLights.y * 0.6;
  vec3 irr = irradiance(N);
  float Fc = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);

  // per-swatch tone: seed 0..1 runs from a lighter tint to a deeper shade of the pigment
  vec3 base = min(uBase * mix(1.35, 0.62, vSeed * uSeedShade), vec3(1.0));

  // film thickness: swirled by gradient noise, offset per swatch
  float sw = gnoise(vPosO * uSwirlScale + vec3(0.0, uTime * 0.07, uTime * 0.03));
  sw = mix(sw, gnoise(vPosO * uSwirlScale * 2.3 - uTime * 0.05), 0.35);
  float d = uThickness * (0.55 + 0.9 * sw) + vSeed * 160.0;
  vec3 film = thinFilm(NdV, d);
  vec3 filmCol = mix(vec3(1.0), film * 1.7, uFilm);

  // pigment layer: diffuse + a rough lobe, darkened by what the coat reflects
  vec3 diffuse = base * (irr * 0.85 + keyCol * 0.25 * max(dot(N, KEY_DIR), 0.0)) * (1.0 - uMetal * 0.85);
  vec3 pigment = diffuse + base * keyCol * ggx(N, V, KEY_DIR, 0.35) * 0.25;
  pigment *= 1.0 - Fc;

  // clear coat (or tinted metal)
  float a = mix(uRough, 0.035, wet);
  float reflAmt = mix(Fc + uFilm * 0.18 + wet * 0.25, 0.9, uMetal);
  vec3 specTint = mix(vec3(1.0), base * 1.25 + 0.05, uMetal);
  vec3 coat = studioEnv(R) * specTint * filmCol * reflAmt;
  float lobe = mix(0.22, 1.0, uMetal) + wet * 0.4;
  coat += filmCol * specTint * (ggx(N, V, KEY_DIR, a) * keyCol + ggx(N, V, WARM_DIR, a) * warmCol) * lobe;
  coat += film * uFilm * 0.14 * pow(1.0 - NdV, 1.5);

  vec3 col = pigment + coat;

  // micro flakes (high tier only: uSparkle stays 0 otherwise)
  if (uSparkle > 0.001) {
    vec3 H = normalize(KEY_DIR + V);
    vec3 cell = floor(vPosO * 140.0);
    float h = hash13(cell);
    vec3 fd = normalize(vec3(hash13(cell + 1.7), hash13(cell + 4.1), hash13(cell + 7.3)) * 2.0 - 1.0);
    float glint = pow(max(dot(normalize(N + fd * 0.6), H), 0.0), 220.0) * step(0.55, h);
    col += mix(vec3(1.0), film, 0.7) * glint * uSparkle * 3.0 * (1.0 - bare);
  }

  #ifdef SWATCH
    // bare milky tip: diffuse + a soft rough sheen
    vec3 bareCol = uBare * (irr * 0.9 + keyCol * 0.2 * max(dot(N, KEY_DIR), 0.0));
    bareCol += keyCol * ggx(N, V, KEY_DIR, 0.4) * 0.08 + studioEnv(R) * Fc * 0.35;
    col = mix(col, bareCol, bare);
    col *= 1.0 - rimDark * 0.35;
  #endif

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Brushed champagne metal: Ward anisotropic highlight along the lathe's circumference. */
export const metalFragment = /* glsl */ `
uniform vec3 uMetalCol;
varying vec3 vNormalW;
varying vec3 vTanW;
varying vec3 vPosW;
${ENV}

float ward(vec3 N, vec3 T, vec3 B, vec3 V, vec3 L, float ax, float ay) {
  float NdL = dot(N, L);
  float NdV = dot(N, V);
  if (NdL <= 0.0 || NdV <= 0.0) return 0.0;
  vec3 H = normalize(L + V);
  float hT = dot(H, T) / ax;
  float hB = dot(H, B) / ay;
  float hN = max(dot(H, N), 1e-3);
  return min(NdL * exp(-(hT * hT + hB * hB) / (hN * hN)) / (12.566 * ax * ay * sqrt(NdL * NdV)), 20.0);
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  if (dot(N, V) < 0.0) N = -N;
  vec3 B = normalize(cross(N, normalize(vTanW)));
  vec3 T = cross(B, N);
  vec3 R = reflect(-V, N);
  // brushed along T: the reflection smears across it (along B)
  vec3 env = (studioEnv(R) + studioEnv(normalize(R + B * 0.22)) + studioEnv(normalize(R - B * 0.22))) / 3.0;
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  vec3 F = uMetalCol + (1.0 - uMetalCol) * pow(1.0 - NdV, 5.0);
  vec3 col = env * F * 0.9 + uMetalCol * irradiance(N) * 0.12;
  col += F * (ward(N, T, B, V, KEY_DIR, 0.06, 0.32) * uLights.x + ward(N, T, B, V, WARM_DIR, 0.06, 0.32) * 0.5 * uLights.y);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const glassVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosO;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  vPosO = position;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const glassFragment = /* glsl */ `
uniform vec3 uTint;
uniform vec3 uBase;
uniform vec3 uInk;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosO;
${ENV}

float ellipse(vec2 p, vec2 c, vec2 r, float rot) {
  p -= c;
  float s = sin(rot), co = cos(rot);
  p = vec2(co * p.x + s * p.y, -s * p.x + co * p.y);
  return length(p / r) - 1.0;
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  if (dot(N, V) < 0.0) N = -N;
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.03 + 0.97 * pow(1.0 - NdV, 4.0);
  vec3 env = studioEnv(reflect(-V, N));
  float rim = 1.0 - smoothstep(0.0, 0.35, NdV);
  float radius = length(vPosO.xz);

  // path length through the wall (thicker at grazing angles and in the base), Beer-Lambert density
  float t = WALL / max(NdV, 0.12);
  t += step(vPosO.y, 0.13) * step(radius, 0.56) * 0.12;
  vec3 absorb = (vec3(1.0) - uTint) * 9.0 + 0.4;
  vec3 trans = exp(-t * absorb);
  float density = 1.0 - (trans.r + trans.g + trans.b) / 3.0;

  vec3 col = env * (0.18 + F) + uTint * rim * 0.35 + uTint * (1.0 - trans) * 0.25;
  float alpha = 0.05 + F * 0.85 + rim * 0.25 + max(env.r - 1.2, 0.0) * 0.4 + density * 0.35;

  #ifdef REFRACT
    col += studioEnv(refract(-V, N, 1.0 / 1.5)) * (1.0 - F) * 0.25;
  #endif

  // caustic glow in the thick base, in the polish colour (the inner floor itself sits under the
  // opaque polish, so the light is drawn where it shows: through the foot, below the floor line)
  float baseBand = smoothstep(0.015, 0.05, vPosO.y) * (1.0 - smoothstep(0.09, 0.135, vPosO.y));
  float ring = baseBand * (0.35 + 0.65 * NdV);
  col += uBase * ring * 0.55;
  alpha += ring * 0.18;

  #ifdef LABEL
    // frosted label band on the front: a petal mark and two hairlines, all SDF
    float ang = atan(vPosO.x, vPosO.z);
    float lab = (1.0 - smoothstep(0.53, 0.55, abs(ang))) * smoothstep(0.38, 0.39, vPosO.y) * (1.0 - smoothstep(0.71, 0.72, vPosO.y));
    lab *= step(0.6, radius);
    if (lab > 0.0) {
      vec2 uv = vec2(ang / 0.55, (vPosO.y - 0.55) / 0.17);
      float e1 = ellipse(uv, vec2(0.0, 0.18), vec2(0.13, 0.36), 0.0);
      float e2 = ellipse(uv, vec2(0.17, -0.18), vec2(0.11, 0.26), -1.1);
      float e3 = ellipse(uv, vec2(-0.17, -0.18), vec2(0.11, 0.26), 1.1);
      float mark = 1.0 - smoothstep(0.0, 0.08, min(e1, min(e2, e3)));
      float lines = (1.0 - smoothstep(0.012, 0.03, abs(abs(uv.y) - 0.78))) * step(abs(uv.x), 0.8);
      float ink = max(mark, lines) * 0.7;
      vec3 frost = vec3(0.97, 0.93, 0.92) * (0.75 + 0.25 * irradiance(N));
      vec3 labelCol = mix(frost + env * 0.05, uInk, ink);
      float labelA = max(0.55, ink);
      // from behind it reads as a ghost
      if (!gl_FrontFacing) labelA *= 0.45;
      col = mix(col, labelCol, lab);
      alpha = mix(alpha, labelA, lab);
    }
  #endif

  gl_FragColor = vec4(col, clamp(alpha, 0.08, 0.92));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const planeVertex = /* glsl */ `
varying vec2 vUv;
varying vec2 vP;
void main() {
  vUv = uv;
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Contact shadow: the soft wide pool plus two tight ambient-occlusion ellipses (bottle, fan ring).
 * uBottle / uFan = (x, y, strength, scale) in the plane's own units, updated with the scroll pose.
 */
export const shadowFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec4 uBottle;
uniform vec4 uFan;
uniform float uSpread;
varying vec2 vUv;
varying vec2 vP;
float ao(vec4 o, vec2 r) {
  vec2 p = (vP - o.xy) / (r * o.w);
  return (1.0 - smoothstep(0.0, 1.0, length(p))) * o.z;
}
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.0 / uSpread, 1.6);
  float a = (1.0 - smoothstep(0.0, 0.5, length(p))) * 0.3;
  a += ao(uBottle, vec2(0.78, 0.7)) * 0.42;
  a += ao(uFan, vec2(0.34, 0.24)) * 0.38;
  gl_FragColor = vec4(uColor, min(a, 0.75));
}
`;

/** High tier: additive glow on the floor, light through the coloured glass. */
export const glowFragment = /* glsl */ `
uniform vec3 uBase;
uniform float uStrength;
varying vec2 vUv;
void main() {
  float d = length((vUv - 0.5) * vec2(1.0, 1.4));
  float g = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0);
  gl_FragColor = vec4(uBase * g * uStrength, 1.0);
}
`;
