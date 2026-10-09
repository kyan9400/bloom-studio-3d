export type Finish = "glass" | "aurora" | "chrome";

export type Shade = {
  id: string;
  name: string;
  hex: string;
};

export const SHADES: Shade[] = [
  { id: "peony", name: "Peony Glaze", hex: "#d9668f" },
  { id: "fig", name: "Fig Velvet", hex: "#6e2a4f" },
  { id: "matcha", name: "Matcha Milk", hex: "#a9c29a" },
  { id: "saffron", name: "Saffron Silk", hex: "#e3a33b" },
  { id: "tidepool", name: "Tidepool", hex: "#2f7a8a" },
  { id: "lilac", name: "Lilac Hour", hex: "#b79bd8" },
  { id: "bare", name: "Bare Petal", hex: "#e8b9a8" },
  { id: "midnight", name: "Midnight Plum", hex: "#2e1838" },
];

export const FINISHES: { id: Finish; label: string; note: string }[] = [
  { id: "glass", label: "Glass", note: "High-shine, true to colour" },
  { id: "aurora", label: "Aurora", note: "Shifts hue as you move" },
  { id: "chrome", label: "Chrome", note: "Mirror metal, tinted" },
];

/** Shader settings for each finish. film = thin-film strength, thickness in nm. */
export const FINISH_UNIFORMS: Record<Finish, { film: number; thickness: number; metal: number; sparkle: number }> = {
  glass: { film: 0.22, thickness: 360, metal: 0, sparkle: 0 },
  aurora: { film: 1, thickness: 540, metal: 0.18, sparkle: 1 },
  chrome: { film: 0.5, thickness: 300, metal: 1, sparkle: 0.35 },
};

export const DEFAULT_SHADE = SHADES[0];
