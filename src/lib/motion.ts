"use client";

import { useSyncExternalStore } from "react";

/*
  Motion preference.
  prefers-reduced-motion is respected by default, but many Windows users switch animations off for
  speed rather than comfort, so the visitor can turn full motion back on. The choice is remembered
  in localStorage; ?motion=full / ?motion=reduced in the URL overrides it.
  The same rule runs as a tiny inline script in <head> (see MOTION_BOOT_SCRIPT) so the CSS class is
  set before first paint.
*/

import { MOTION_KEY } from "./motion-boot";

type Snapshot = { reduced: boolean; system: boolean; chosen: boolean };

let snapshot: Snapshot | null = null;
const serverSnapshot: Snapshot = { reduced: true, system: false, chosen: false };
const listeners = new Set<() => void>();

function readChoice(): string | null {
  const q = new URLSearchParams(window.location.search).get("motion");
  if (q === "full" || q === "reduced") return q;
  try {
    return window.localStorage.getItem(MOTION_KEY);
  } catch {
    return null;
  }
}

function compute(): Snapshot {
  const system = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const choice = readChoice();
  const reduced = choice === "full" ? false : choice === "reduced" ? true : system;
  return { reduced, system, chosen: choice === "full" || choice === "reduced" };
}

function get(): Snapshot {
  if (!snapshot) snapshot = compute();
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onChange = () => {
    snapshot = compute();
    document.documentElement.classList.toggle("reduce-motion", snapshot.reduced);
    listeners.forEach((l) => l());
  };
  mq.addEventListener("change", onChange);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", onChange);
  };
}

export function setFullMotion(full: boolean) {
  const value = full ? "full" : "reduced";
  let saved = false;
  try {
    window.localStorage.setItem(MOTION_KEY, value);
    saved = true;
  } catch {
    saved = false;
  }
  // Keep the URL in step: drop ?motion when storage works, otherwise carry the choice in the URL.
  try {
    const url = new URL(window.location.href);
    if (saved) url.searchParams.delete("motion");
    else url.searchParams.set("motion", value);
    window.history.replaceState(window.history.state, "", url);
  } catch {
    /* ignore */
  }
  snapshot = { ...get(), reduced: !full, chosen: true };
  document.documentElement.classList.toggle("reduce-motion", !full);
  listeners.forEach((l) => l());
}

export function useMotion() {
  return useSyncExternalStore(subscribe, get, () => serverSnapshot);
}
