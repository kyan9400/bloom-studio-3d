"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Poster from "./Poster";
import { useMotion } from "@/lib/motion";
import { useStudio } from "@/lib/studio-store";
import { FINISHES } from "@/lib/shades";
import type { Tier } from "@/three/quality";

// three.js + R3F live in their own chunk, loaded only on the client after the page is idle
const BloomCanvas = dynamic(() => import("@/three/BloomCanvas"), { ssr: false });

type Phase = "poster" | "loading" | "ready" | "failed";

export default function Stage() {
  const { reduced } = useMotion();
  const studio = useStudio();
  const [phase, setPhase] = useState<Phase>("poster");
  const [tier, setTier] = useState<Tier>("medium");

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      const { probeQuality } = await import("@/three/quality");
      if (cancelled) return;
      const probe = probeQuality();
      if (!probe.ok) {
        setPhase("failed");
        return;
      }
      setTier(probe.tier);
      setPhase("loading");
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    // idle callbacks and timeouts have separate id spaces, so remember which one we used
    let idleHandle = 0;
    let timeoutHandle = 0;
    const schedule = () => {
      if (w.requestIdleCallback) idleHandle = w.requestIdleCallback(() => void start(), { timeout: 2500 });
      else timeoutHandle = window.setTimeout(() => void start(), 600);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idleHandle && w.cancelIdleCallback) w.cancelIdleCallback(idleHandle);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    };
  }, []);

  const onReady = useCallback(() => setPhase("ready"), []);
  const onFail = useCallback(() => setPhase("failed"), []);

  const finish = FINISHES.find((f) => f.id === studio.finish)?.label ?? "";
  const label = `A glass polish bottle and a fan of nail swatches in ${studio.name}, ${finish.toLowerCase()} finish.`;

  return (
    <div
      className="stage"
      data-phase={phase}
      role="img"
      aria-label={label}
      style={{ "--shade": studio.hex } as React.CSSProperties}
    >
      <div className="stage-poster">
        <Poster />
      </div>
      {(phase === "loading" || phase === "ready") && (
        <BloomCanvas tier={tier} reduced={reduced} onReady={onReady} onFail={onFail} />
      )}
      <p className="stage-veil" aria-hidden="true">
        <span className="stage-veil-dot" /> Mixing pigments…
      </p>
    </div>
  );
}
