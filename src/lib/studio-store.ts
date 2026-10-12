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

/* Two tiny channels from the page to the 3D canvas (no React re-render): turn nudges and scroll progress. */
type Sink = (value: number) => void;
let spinSink: Sink | null = null;
let momentSink: Sink | null = null;
let momentNow = 0;

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
  /** The live canvas registers here for the keyboard "Turn left / right" buttons. */
  spin(sink: Sink | null) {
    spinSink = sink;
  },
  /** The live canvas registers here for the "Uncap & paint" progress (it gets the current value at once). */
  moment(sink: Sink | null) {
    momentSink = sink;
    sink?.(momentNow);
  },
};

/** Turn the bottle by a step (radians). No-op until the 3D is live. */
export function nudgeSpin(step: number) {
  spinSink?.(step);
}

/** Scroll moment progress, 0..1. */
export function setMoment(u: number) {
  momentNow = u;
  momentSink?.(u);
}

const initial = state;

export function useStudio() {
  return useSyncExternalStore(studioStore.subscribe, studioStore.get, () => initial);
}
