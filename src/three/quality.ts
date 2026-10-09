/*
  Quality tiers — decided BEFORE the Canvas is created.
  A throwaway WebGL context tells us (a) whether 3D works at all and (b) which GPU this is.
  Software renderers -> low. Integrated / mobile GPUs and touch devices -> at most medium.
  ?quality=low|medium|high overrides everything.
*/

export type Tier = "low" | "medium" | "high";

export type TierSettings = {
  dprCap: number;
  segments: number;
  swatches: number;
  sparkle: boolean;
  sway: boolean;
  antialias: boolean;
};

export const TIERS: Record<Tier, TierSettings> = {
  high: { dprCap: 2, segments: 96, swatches: 7, sparkle: true, sway: true, antialias: true },
  medium: { dprCap: 1.5, segments: 64, swatches: 6, sparkle: false, sway: true, antialias: true },
  low: { dprCap: 1, segments: 40, swatches: 5, sparkle: false, sway: false, antialias: false },
};

function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const name = String(gl.getParameter(gl.RENDERER) || "");
  if (!/^webkit/i.test(name)) return name;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || name) : name;
}

export type Probe = { ok: boolean; tier: Tier; gpu: string };

export function probeQuality(): Probe {
  const forced = new URLSearchParams(window.location.search).get("quality");
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try {
    const canvas = document.createElement("canvas");
    gl =
      canvas.getContext("webgl2", { powerPreference: "high-performance" }) ||
      canvas.getContext("webgl", { powerPreference: "high-performance" });
  } catch {
    gl = null;
  }
  if (!gl) return { ok: false, tier: "low", gpu: "" };

  const gpu = gpuName(gl);
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  if (forced === "low" || forced === "medium" || forced === "high") return { ok: true, tier: forced, gpu };

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const touch = window.matchMedia("(pointer: coarse)").matches;

  let tier: Tier = "high";
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) tier = "low";
  else if (nav.connection?.saveData || cores <= 2 || memory <= 2) tier = "low";
  else if (/intel|uhd|iris|mali|adreno|powervr|apple gpu|radeon\(tm\) graphics|radeon graphics|vega/i.test(gpu)) tier = "medium";
  else if (touch || cores <= 4) tier = "medium";

  return { ok: true, tier, gpu };
}
