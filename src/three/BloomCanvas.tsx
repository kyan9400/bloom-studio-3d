"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { NeutralToneMapping, PerspectiveCamera } from "three";
import { studioStore } from "@/lib/studio-store";
import { AdaptiveDpr } from "./adaptive-dpr";
import { BloomScene, type SpinInput } from "./scene";
import { TIERS, type Tier } from "./quality";

type Props = {
  tier: Tier;
  reduced: boolean;
  onReady: () => void;
  onFail: () => void;
};

type Flags = { visible: boolean; reduced: boolean };

/**
 * Runs only on drawn frames. Keeps asking for the next frame while the scene says it is moving.
 * Frame times feed the adaptive DPR only inside an unbroken chain of animation frames, so the
 * idle gaps of render-on-demand never count as slow frames.
 */
function Driver({
  scene,
  input,
  flags,
  cap,
}: {
  scene: BloomScene;
  input: RefObject<SpinInput>;
  flags: RefObject<Flags>;
  cap: number;
}) {
  const setDpr = useThree((s) => s.setDpr);
  const [adaptive] = useState(() => new AdaptiveDpr(cap, setDpr));
  const chained = useRef(false);
  useFrame((state, delta) => {
    const f = flags.current;
    const moving = scene.update(Math.min(delta, 1 / 20), input.current, f.visible && !f.reduced);
    if (chained.current) adaptive.frame(delta * 1000, performance.now());
    chained.current = moving && f.visible;
    if (chained.current) state.invalidate();
  });
  return null;
}

/** Compile every shader behind the veil, then reveal. */
function Warmup({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let alive = true;
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (!alive) return;
        invalidate();
        requestAnimationFrame(() => alive && onReady());
      });
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, invalidate, onReady]);
  return null;
}

/** Narrow (portrait) stages pull the camera back so the bottle and fan always fit. */
function Framing() {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = width / Math.max(1, height);
    const pull = 1 / Math.min(1, aspect / 0.95);
    camera.position.set(0.12, 1.5, 5.7 * pull);
    camera.lookAt(0.12, 1.12, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, width, height, invalidate]);
  return null;
}

function Content({
  scene,
  input,
  flags,
  cap,
  onReady,
}: {
  scene: BloomScene;
  input: RefObject<SpinInput>;
  flags: RefObject<Flags>;
  cap: number;
  onReady: () => void;
}) {
  return (
    <>
      <primitive object={scene.root} />
      <Driver scene={scene} input={input} flags={flags} cap={cap} />
      <Framing />
      <Warmup onReady={onReady} />
    </>
  );
}

export default function BloomCanvas({ tier, reduced, onReady, onFail }: Props) {
  const settings = TIERS[tier];
  const [scene] = useState(() => new BloomScene(settings));
  // tier cap; the adaptive controller inside the canvas moves below it when frames get slow
  const [cap] = useState(() => Math.min(window.devicePixelRatio || 1, settings.dprCap));
  const wrapRef = useRef<HTMLDivElement>(null);
  const input = useRef<SpinInput>({ target: 0, velocity: 0, dragging: false });
  const flags = useRef<Flags>({ visible: true, reduced });
  const invalidateRef = useRef<(() => void) | null>(null);

  // motion preference changes without remounting
  useEffect(() => {
    flags.current.reduced = reduced;
    invalidateRef.current?.();
  }, [reduced]);

  // shade + finish from the Shade Lab
  useEffect(() => {
    const s = studioStore.get();
    scene.setLook(s.hex, s.finish, true);
    let last = s;
    const unsubscribe = studioStore.subscribe(() => {
      const next = studioStore.get();
      if (next.hex === last.hex && next.finish === last.finish) return;
      last = next;
      scene.setLook(next.hex, next.finish, flags.current.reduced);
      invalidateRef.current?.();
    });
    return () => {
      unsubscribe();
    };
  }, [scene]);

  // pause when off-screen or in a hidden tab
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let onScreen = true;
    const sync = () => {
      const visible = onScreen && document.visibilityState === "visible";
      const wasVisible = flags.current.visible;
      flags.current.visible = visible;
      if (visible && !wasVisible) invalidateRef.current?.();
    };
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => () => scene.dispose(), [scene]);

  // drag to turn (horizontal only; vertical swipes keep scrolling the page)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let lastX = 0;
    let lastT = 0;
    let pointerId = -1;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointerId = e.pointerId;
      lastX = e.clientX;
      lastT = e.timeStamp;
      input.current.dragging = true;
      input.current.velocity = 0;
      el.setPointerCapture(e.pointerId);
      invalidateRef.current?.();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || !input.current.dragging) return;
      const dx = e.clientX - lastX;
      const dt = Math.max(1, e.timeStamp - lastT) / 1000;
      const step = (dx / Math.max(240, el.clientWidth)) * Math.PI * 1.6;
      input.current.target += step;
      input.current.velocity = input.current.velocity * 0.6 + (step / dt) * 0.4;
      lastX = e.clientX;
      lastT = e.timeStamp;
      invalidateRef.current?.();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = -1;
      input.current.dragging = false;
      if (e.timeStamp - lastT > 80) input.current.velocity = 0;
      input.current.velocity = Math.max(-6, Math.min(6, input.current.velocity));
      invalidateRef.current?.();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div ref={wrapRef} className="stage-canvas">
      <Canvas
        frameloop="demand"
        dpr={cap}
        camera={{ fov: 31, near: 0.1, far: 40, position: [0.12, 1.5, 5.7] }}
        gl={{ antialias: settings.antialias, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl, invalidate }) => {
          gl.toneMapping = NeutralToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.setClearColor(0x000000, 0);
          invalidateRef.current = () => invalidate();
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
              onFail();
            },
            { once: true },
          );
          invalidate();
        }}
      >
        <Content scene={scene} input={input} flags={flags} cap={cap} onReady={onReady} />
      </Canvas>
    </div>
  );
}
