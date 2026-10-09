"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SHADE, type Finish } from "./shades";

/** The shade chosen in the Shade Lab. Shared by the 3D scene, the poster and the booking flow. */
export type StudioState = {
  shadeId: string; // a SHADES id or "custom"
  name: string;
  hex: string;
  finish: Finish;
};

let state: StudioState = {
  shadeId: DEFAULT_SHADE.id,
  name: DEFAULT_SHADE.name,
  hex: DEFAULT_SHADE.hex,
  finish: "aurora",
};

const listeners = new Set<() => void>();

export const studioStore = {
  get: () => state,
  set(patch: Partial<StudioState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const initial = state;

export function useStudio() {
  return useSyncExternalStore(studioStore.subscribe, studioStore.get, () => initial);
}
