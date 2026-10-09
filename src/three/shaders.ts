/*
  Thin-film lacquer shader.
  A pigment layer under a clear coat whose reflection is tinted by thin-film interference:
  the optical path difference 2·n·d·cosθt is evaluated for three wavelengths (R/G/B), so the
  coat's colour shifts with viewing angle and with the film thickness d. d itself is modulated
  by 3D value noise ("swirl"), which is what makes the aurora finish flow as the bottle turns.
  The studio environment (two soft boxes, a top light and a warm floor bounce) is procedural,
  so nothing is downloaded.
*/

const ENV = /* glsl */ `
vec3 studioEnv(vec3 r) {
  float y = r.y;
  vec3 col = mix(vec3(0.20, 0.12, 0.16), vec3(0.95, 0.88, 0.86), smoothstep(-0.35, 0.9, y) * 0.6);
  // tall soft box, camera-left
  vec3 d1 = normalize(vec3(-0.85, 0.25, 0.55));
  float b1 = smoothstep(0.80, 0.96, dot(r, d1));
  b1 *= (1.0 - smoothstep(0.3, 0.75, abs(r.y - 0.25)));
  // smaller warm box, camera-right
  vec3 d2 = normalize(vec3(0.95, 0.15, 0.25));
  float b2 = smoothstep(0.88, 0.98, dot(r, d2));
  // top light
  float top = smoothstep(0.86, 0.99, y);
  col += vec3(1.0, 0.98, 0.97) * b1 * 2.6;
  col += vec3(1.0, 0.82, 0.80) * b2 * 1.5;
  col += vec3(1.0) * top * 1.4;
  // warm floor bounce
  col += vec3(0.35, 0.16, 0.18) * (1.0 - smoothstep(-0.6, 0.0, y));
  return col;
}
`;

const NOISE = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}
`;

export const filmVertex = /* glsl */ `
#ifdef USE_INSTANCING
attribute float aSeed;
#endif
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosO;
varying float vSeed;

void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  vSeed = 0.0;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
    vSeed = aSeed;
  #endif
  vec4 world = modelMatrix * p;
  vPosW = world.xyz;
  vPosO = position;
  vNormalW = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const filmFragment = /* glsl */ `
uniform vec3 uBase;
uniform float uFilm;
uniform float uThickness;
uniform float uMetal;
uniform float uSparkle;
uniform float uTime;
uniform float uSwirlScale;
uniform float uSeedShade;

varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosO;
varying float vSeed;

${NOISE}
${ENV}

vec3 thinFilm(float cosI, float d) {
  const float n = 1.42;
  float sinT2 = (1.0 - cosI * cosI) / (n * n);
  float cosT = sqrt(max(0.0, 1.0 - sinT2));
  float opd = 2.0 * n * d * cosT;
  vec3 phase = 6.28318530718 * opd / vec3(650.0, 532.0, 450.0);
  return 0.5 + 0.5 * cos(phase);
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  if (dot(N, V) < 0.0) N = -N;
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);

  // per-swatch tone: seed 0..1 runs from a lighter tint to a deeper shade of the pigment
  vec3 base = uBase * mix(1.35, 0.62, vSeed * uSeedShade);
  base = min(base, vec3(1.0));

  // film thickness: swirled by noise, offset per swatch
  float sw = vnoise(vPosO * uSwirlScale + vec3(0.0, uTime * 0.07, uTime * 0.03));
  sw = mix(sw, vnoise(vPosO * uSwirlScale * 2.3 - uTime * 0.05), 0.35);
  float d = uThickness * (0.55 + 0.9 * sw) + vSeed * 160.0;
  vec3 film = thinFilm(NdV, d);
  vec3 filmCol = mix(vec3(1.0), film * 1.7, uFilm);

  // pigment, lit by a key light and soft ambient
  vec3 L = normalize(vec3(-0.55, 0.85, 0.6));
  float wrap = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);
  vec3 diffuse = base * (0.32 + 0.78 * wrap) * (1.0 - uMetal * 0.85);

  // clear coat / metal reflection
  float F = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
  float reflAmt = mix(F + uFilm * 0.18, 0.9, uMetal);
  vec3 specTint = mix(vec3(1.0), base * 1.25 + 0.05, uMetal);
  vec3 env = studioEnv(R);
  vec3 col = diffuse + env * specTint * filmCol * reflAmt;

  // a gentle film glow on grazing angles even where the env is dark
  col += film * uFilm * 0.14 * pow(1.0 - NdV, 1.5);

  // key light highlight
  vec3 H = normalize(L + V);
  col += filmCol * pow(max(dot(N, H), 0.0), 120.0) * 1.2;

  // micro flakes (high tier only: uSparkle stays 0 otherwise)
  if (uSparkle > 0.001) {
    vec3 cell = floor(vPosO * 140.0);
    float h = hash13(cell);
    vec3 fd = normalize(vec3(hash13(cell + 1.7), hash13(cell + 4.1), hash13(cell + 7.3)) * 2.0 - 1.0);
    float glint = pow(max(dot(normalize(N + fd * 0.6), H), 0.0), 220.0) * step(0.55, h);
    col += mix(vec3(1.0), film, 0.7) * glint * uSparkle * 3.0;
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const glassVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const glassFragment = /* glsl */ `
uniform vec3 uTint;
varying vec3 vNormalW;
varying vec3 vPosW;
${ENV}
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  if (dot(N, V) < 0.0) N = -N;
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.03 + 0.97 * pow(1.0 - NdV, 4.0);
  vec3 env = studioEnv(reflect(-V, N));
  float rim = (1.0 - smoothstep(0.0, 0.35, NdV));
  vec3 col = env * (0.18 + F) + uTint * rim * 0.35;
  float alpha = clamp(0.05 + F * 0.85 + rim * 0.25 + max(env.r - 1.2, 0.0) * 0.4, 0.0, 0.92);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const shadowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const shadowFragment = /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.0, 1.6);
  float a = (1.0 - smoothstep(0.0, 0.5, length(p))) * 0.38;
  a += (1.0 - smoothstep(0.0, 0.18, length((vUv - 0.5) * vec2(1.4, 2.4)))) * 0.22;
  gl_FragColor = vec4(uColor, a);
}
`;
