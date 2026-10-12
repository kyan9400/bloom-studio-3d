"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Poster from "./Poster";
import MotionToggle from "./MotionToggle";
import { useMotion } from "@/lib/motion";
import { nudgeSpin, setMoment, useStudio } from "@/lib/studio-store";
import { FINISHES, SHADES } from "@/lib/shades";
import { probeQuality, type Tier } from "@/three/quality";

// three.js + R3F live in their own chunk. It is requested only after window "load" + an idle callback,
// never during hydration, and never at all on software renderers (unless ?quality= forces it).
const BloomCanvas = dynamic(() => import("@/three/BloomCanvas"), { ssr: false });

type Phase = "poster" | "loading" | "ready" | "failed";
type Mode = "none" | "scroll" | "play";

const PLAY_SECONDS = 2.2;
const UNCAP_AT = 0.12;
const WIDE = "(min-width: 960px)";

const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const isWide = () => window.matchMedia(WIDE).matches;
// false during hydration (server snapshot), true after: the moment waits for the real motion + width values
const noSubscribe = () => () => {};

export default function Stage() {
  const { reduced } = useMotion();
  const studio = useStudio();
  const [phase, setPhase] = useState<Phase>("poster");
  const [tier, setTier] = useState<Tier>("medium");
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const mode: Mode = reduced ? "none" : wide ? "scroll" : "play";
  const [uncap, setUncap] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<(() => void) | null>(null);

  // shade-tinted backdrop: the previous tint stays below while the new one fades in (opacity only)
  const [tint, setTint] = useState({ prev: studio.hex, cur: studio.hex });
  if (tint.cur !== studio.hex) setTint({ prev: tint.cur, cur: studio.hex });

  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const probe = probeQuality();
      // no WebGL, or a CPU rasteriser that would spend seconds compiling shaders: keep the poster
      if (!probe.ok || (probe.software && !probe.forced)) {
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
      if (w.requestIdleCallback) idleHandle = w.requestIdleCallback(() => start(), { timeout: 2500 });
      else timeoutHandle = window.setTimeout(() => start(), 600);
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

  /*
    "Uncap & paint" progress. Desktop: the hero's scrolled fraction (one passive listener, one rAF).
    Phones and touch: plays once over 2.2 s when the stage is 60% in view. Reduced motion: final pose.
    The poster follows through data-uncap, so visitors without 3D still see the moment.
  */
  useEffect(() => {
    // the hydration pass still sees the server values (reduced, narrow); acting on them would
    // flash the poster cap open and shut on every load
    if (!hydrated) return;
    const hero = document.getElementById("lab");
    const stage = stageRef.current;
    if (!hero || !stage) return;
    // null: the first write always syncs the poster state
    let open: boolean | null = null;
    const write = (u: number) => {
      setMoment(u);
      if (u > UNCAP_AT !== open) {
        open = u > UNCAP_AT;
        setUncap(open);
      }
    };
    if (reduced) {
      write(1);
      return;
    }

    const scrollMode = () => {
      let raf = 0;
      const read = () => {
        raf = 0;
        const r = hero.getBoundingClientRect();
        const range = r.height - window.innerHeight;
        write(range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0);
      };
      const onScroll = () => {
        if (!raf) raf = requestAnimationFrame(read);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      read();
      return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        cancelAnimationFrame(raf);
      };
    };

    const playMode = () => {
      let raf = 0;
      const play = () => {
        cancelAnimationFrame(raf);
        const t0 = performance.now();
        const tick = (now: number) => {
          const u = Math.min(1, (now - t0) / (PLAY_SECONDS * 1000));
          write(u);
          if (u < 1) raf = requestAnimationFrame(tick);
        };
        write(0);
        raf = requestAnimationFrame(tick);
      };
      replayRef.current = play;
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          play();
        },
        { threshold: 0.6 },
      );
      io.observe(stage);
      return () => {
        io.disconnect();
        cancelAnimationFrame(raf);
        replayRef.current = null;
      };
    };

    write(0);
    return wide ? scrollMode() : playMode();
  }, [reduced, wide, hydrated]);

  const onReady = useCallback(() => setPhase("ready"), []);
  const onFail = useCallback(() => setPhase("failed"), []);

  const finish = FINISHES.find((f) => f.id === studio.finish)?.label ?? "";
  const label = `A glass polish bottle and a fan of nail swatches in ${studio.name}, ${finish.toLowerCase()} finish.`;
  const index = SHADES.findIndex((s) => s.id === studio.shadeId);
  const number = index < 0 ? "N° —" : `N° ${String(index + 1).padStart(2, "0")}`;
  const name = studio.name.charAt(0).toUpperCase() + studio.name.slice(1);

  return (
    <div className="stage-plate" style={{ "--shade": studio.hex } as React.CSSProperties}>
      <div ref={stageRef} className="stage" data-phase={phase} data-uncap={uncap || undefined}>
        <span className="stage-tint" style={{ "--tint": tint.prev } as React.CSSProperties} aria-hidden="true" />
        <span
          key={tint.cur}
          className="stage-tint"
          data-fade={tint.prev !== tint.cur || undefined}
          style={{ "--tint": tint.cur } as React.CSSProperties}
          aria-hidden="true"
        />
        <div className="stage-view" role="img" aria-label={label}>
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
        <p className="stage-over stage-over-name">{name}</p>
        <p className="stage-over stage-over-spec">Finish · {finish}</p>
        <p className="stage-over stage-over-num">{number}</p>
      </div>
      <div className="stage-meta">
        <p className="stage-hint">Drag the bottle, or use the arrows, to turn it.</p>
        <div className="stage-actions">
          <div className="stage-turn" hidden={phase !== "ready"}>
            <button type="button" className="turn-btn" aria-label="Turn left" onClick={() => nudgeSpin(-0.6)}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="turn-btn" aria-label="Turn right" onClick={() => nudgeSpin(0.6)}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className="replay-btn"
            hidden={mode !== "play"}
            onClick={() => replayRef.current?.()}
          >
            Replay
          </button>
          <MotionToggle variant="hint" />
        </div>
      </div>
    </div>
  );
}
