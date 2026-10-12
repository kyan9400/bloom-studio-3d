/*
  Quality tiers — decided BEFORE the Canvas is created.
  A throwaway WebGL context tells us (a) whether 3D works at all, (b) whether it is a software
  rasteriser and (c) which GPU this is. This module never imports three.js, so the probe is cheap.
  Software renderers -> no 3D at all (the designed poster stays), or the low tier when ?quality= forces it on.
  Integrated / mobile GPUs and touch devices -> at most medium.
  ?quality=low|medium|high overrides everything.
*/

export type Tier = "low" | "medium" | "high";

export type TierSettings = {
  dprCap: number;
  segments: number; // lathe segments around the axis
  profilePoints: number; // arc-length samples per lathe profile (per ~1.6 units of length)
  swatches: number;
  sparkle: boolean;
  sway: boolean;
  antialias: boolean;
  capRibs: boolean; // analytic grip ribs on the cap
  label: boolean; // frosted label band on the glass
  floorGlow: boolean; // additive "light through coloured glass" glow
  refraction: boolean; // env-refraction term in the glass shader
  petals: number; // floating petals around the set (one instanced draw)
  swirl2: boolean; // second liquid ribbon
  ribbonAlong: number; // ribbon samples along the curve
};

export const TIERS: Record<Tier, TierSettings> = {
  high: {
    dprCap: 2,
    segments: 96,
    profilePoints: 96,
    swatches: 7,
    sparkle: true,
    sway: true,
    antialias: true,
    capRibs: true,
    label: true,
    floorGlow: true,
    refraction: true,
    petals: 34,
    swirl2: true,
    ribbonAlong: 220,
  },
  medium: {
    dprCap: 1.5,
    segments: 64,
    profilePoints: 72,
    swatches: 6,
    sparkle: false,
    sway: true,
    antialias: true,
    capRibs: true,
    label: true,
    floorGlow: false,
    refraction: true,
    petals: 22,
    swirl2: true,
    ribbonAlong: 150,
  },
  low: {
    dprCap: 1,
    segments: 48,
    profilePoints: 48,
    swatches: 5,
    sparkle: false,
    sway: false,
    antialias: false,
    capRibs: false,
    label: true,
    floorGlow: false,
    refraction: false,
    petals: 12,
    swirl2: false,
    ribbonAlong: 90,
  },
};

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;

/** ?quality=low|medium|high from the URL, or null. */
export function forcedTier(): Tier | null {
  const forced = new URLSearchParams(window.location.search).get("quality");
  return forced === "low" || forced === "medium" || forced === "high" ? forced : null;
}

function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const unmasked = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "") : "";
  return unmasked || String(gl.getParameter(gl.RENDERER) || "");
}

function tinyContext(caveat: boolean): WebGLRenderingContext | WebGL2RenderingContext | null {
  // a canvas hands out only one context, so every attempt gets a fresh 1x1 canvas
  const attrs: WebGLContextAttributes = {
    failIfMajorPerformanceCaveat: caveat,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  };
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const gl2 = canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null;
    if (gl2) return gl2;
    const fallback = document.createElement("canvas");
    fallback.width = fallback.height = 1;
    return fallback.getContext("webgl", attrs) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
}

/**
 * ok: WebGL works at all. software: a CPU rasteriser (SwiftShader, llvmpipe, Basic Render...) or a browser
 * that only hands out a context with a major performance caveat. forced: ?quality= is set.
 */
export type Probe = { ok: boolean; software: boolean; forced: boolean; tier: Tier; gpu: string };

export function probeQuality(): Probe {
  const forced = forcedTier();
  let gl = tinyContext(true);
  let caveat = false;
  if (!gl) {
    gl = tinyContext(false);
    caveat = !!gl;
  }
  if (!gl) return { ok: false, software: false, forced: !!forced, tier: "low", gpu: "" };

  const gpu = gpuName(gl);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  const software = caveat || SOFTWARE.test(gpu);

  if (forced) return { ok: true, software, forced: true, tier: forced, gpu };

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const touch = window.matchMedia("(pointer: coarse)").matches;

  let tier: Tier = "high";
  if (software) tier = "low";
  else if (nav.connection?.saveData || cores <= 2 || memory <= 2) tier = "low";
  else if (/intel|uhd|iris|mali|adreno|powervr|apple gpu|radeon\(tm\) graphics|radeon graphics|vega/i.test(gpu)) tier = "medium";
  else if (touch || cores <= 4) tier = "medium";

  return { ok: true, software, forced: false, tier, gpu };
}
