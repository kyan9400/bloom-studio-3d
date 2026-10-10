import {
  Color,
  DoubleSide,
  FrontSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  TorusGeometry,
  type BufferGeometry,
  type Side,
} from "three";
import { FINISH_UNIFORMS, type Finish } from "@/lib/shades";
import { capGeometry, glassGeometry, polishGeometry, stemGeometry, swatchGeometry } from "./geometry";
import {
  filmFragment,
  filmVertex,
  glassFragment,
  glassVertex,
  shadowFragment,
  shadowVertex,
} from "./shaders";
import type { TierSettings } from "./quality";

/** Pointer state written by the drag handlers, read once per drawn frame. */
export type SpinInput = {
  target: number; // wanted rotation (radians)
  velocity: number; // inertia after release (radians / s)
  dragging: boolean;
};

type FilmUniforms = {
  uBase: { value: Color };
  uFilm: { value: number };
  uThickness: { value: number };
  uMetal: { value: number };
  uSparkle: { value: number };
  uTime: { value: number };
  uSwirlScale: { value: number };
  uSeedShade: { value: number };
};

function filmMaterial(swirl: number, seedShade: number, side: Side = DoubleSide) {
  const uniforms: FilmUniforms = {
    uBase: { value: new Color("#d9668f") },
    uFilm: { value: 0 },
    uThickness: { value: 400 },
    uMetal: { value: 0 },
    uSparkle: { value: 0 },
    uTime: { value: 0 },
    uSwirlScale: { value: swirl },
    uSeedShade: { value: seedShade },
  };
  const material = new ShaderMaterial({ vertexShader: filmVertex, fragmentShader: filmFragment, uniforms, side });
  return { material, uniforms };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const TWEEN_SECONDS = 0.75;

/** Let the browser handle input and paint between heavy steps (keeps each task short). */
export const yieldToMain = () =>
  new Promise<void>((resolve) => {
    const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
    if (s?.yield) s.yield().then(resolve, () => setTimeout(resolve, 0));
    else setTimeout(resolve, 0);
  });

type Geometries = {
  polish: BufferGeometry;
  cap: BufferGeometry;
  stem: BufferGeometry;
  glass: BufferGeometry;
  swatch: BufferGeometry;
};

/** Procedural geometry, one piece per task. */
async function buildGeometries(seg: number): Promise<Geometries> {
  const polish = polishGeometry(seg);
  await yieldToMain();
  const cap = capGeometry(seg);
  const stem = stemGeometry(seg);
  await yieldToMain();
  const glass = glassGeometry(seg);
  await yieldToMain();
  const swatch = swatchGeometry(seg >= 64 ? 22 : 14, seg >= 64 ? 36 : 22);
  await yieldToMain();
  return { polish, cap, stem, glass, swatch };
}

export class BloomScene {
  readonly root = new Group();
  private readonly spin = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: ShaderMaterial[] = [];

  private readonly polish: FilmUniforms;
  private readonly swatches: FilmUniforms;
  private readonly lacquers: FilmUniforms[];
  private readonly sparkleOn: boolean;
  private readonly swayOn: boolean;

  // tween state (reused objects, nothing allocated per frame)
  private readonly fromColor = new Color();
  private readonly toColor = new Color();
  private readonly nowColor = new Color();
  private from = { film: 0, thickness: 0, metal: 0, sparkle: 0 };
  private to = { film: 0, thickness: 0, metal: 0, sparkle: 0 };
  private tween = 1;

  private time = 0;
  private swayWeight = 0;
  private spinNow = 0;

  /** Build the scene in small steps so no single task blocks the main thread for long. */
  static async create(settings: TierSettings): Promise<BloomScene> {
    const geos = await buildGeometries(settings.segments);
    return new BloomScene(settings, geos);
  }

  private constructor(settings: TierSettings, geos: Geometries) {
    this.sparkleOn = settings.sparkle;
    this.swayOn = settings.sway;

    this.root.add(this.spin);
    this.spin.rotation.y = 0;

    // --- bottle -------------------------------------------------------------
    const bottle = new Group();
    bottle.position.set(-0.52, 0, 0);
    bottle.rotation.z = 0.02;
    this.spin.add(bottle);

    const polish = filmMaterial(2.1, 0);
    this.polish = polish.uniforms;
    const polishGeo = this.track(geos.polish);
    const polishMesh = new Mesh(polishGeo, polish.material);
    polishMesh.renderOrder = 1;
    bottle.add(polishMesh);

    const cap = filmMaterial(1, 0);
    cap.uniforms.uBase.value.set("#1d1220");
    cap.uniforms.uFilm.value = 0.12;
    cap.uniforms.uThickness.value = 300;
    const capGeo = this.track(geos.cap);
    bottle.add(new Mesh(capGeo, cap.material));
    const stemGeo = this.track(geos.stem);
    bottle.add(new Mesh(stemGeo, cap.material));

    const glass = new ShaderMaterial({
      vertexShader: glassVertex,
      fragmentShader: glassFragment,
      uniforms: { uTint: { value: new Color("#f3d7e2") } },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    const glassGeo = this.track(geos.glass);
    const glassMesh = new Mesh(glassGeo, glass);
    glassMesh.renderOrder = 3;
    bottle.add(glassMesh);

    // --- swatch fan (one instanced draw call) -------------------------------
    const count = settings.swatches;
    const swatch = filmMaterial(5.5, 1, FrontSide);
    this.swatches = swatch.uniforms;
    const swatchGeo = this.track(geos.swatch);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = count === 1 ? 0 : i / (count - 1);
    swatchGeo.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    const fan = new InstancedMesh(swatchGeo, swatch.material, count);
    const dummy = new Object3D();
    const offset = new Matrix4().makeTranslation(0, 0.14, 0);
    const instance = new Matrix4();
    const pivot = new Group();
    pivot.position.set(0.82, 0.16, 0.42);
    pivot.rotation.set(-0.08, -0.38, 0);
    for (let i = 0; i < count; i++) {
      const k = count === 1 ? 0.5 : i / (count - 1);
      dummy.rotation.set(0, 0, 0.55 - k * 1.45);
      dummy.position.set(0, 0, -0.035 * i);
      dummy.updateMatrix();
      // move the nail out from the pivot along its own long axis
      fan.setMatrixAt(i, instance.copy(dummy.matrix).multiply(offset));
    }
    fan.instanceMatrix.needsUpdate = true;
    fan.frustumCulled = false;
    pivot.add(fan);

    const ringGeo = this.track(new TorusGeometry(0.055, 0.016, 10, 28));
    const ring = new Mesh(ringGeo, cap.material);
    ring.position.set(0, 0, -0.035 * (count - 1) * 0.5);
    ring.rotation.y = Math.PI / 2;
    pivot.add(ring);
    this.spin.add(pivot);

    // --- soft contact shadow (code-made, no shadow maps) ---------------------
    const shadow = new ShaderMaterial({
      vertexShader: shadowVertex,
      fragmentShader: shadowFragment,
      uniforms: { uColor: { value: new Color("#3a1f35") } },
      transparent: true,
      depthWrite: false,
    });
    const shadowGeo = this.track(new PlaneGeometry(3.6, 2.4));
    const shadowMesh = new Mesh(shadowGeo, shadow);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0.05, 0.001, 0.1);
    shadowMesh.renderOrder = 0;
    this.root.add(shadowMesh);

    this.lacquers = [this.polish, this.swatches];
    this.materials.push(polish.material, cap.material, glass, swatch.material, shadow);
  }

  private track<T extends BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  /** Set a new pigment + finish. instant = cut (reduced motion / first paint). */
  setLook(hex: string, finish: Finish, instant: boolean) {
    const f = FINISH_UNIFORMS[finish];
    this.toColor.set(hex);
    this.to = { film: f.film, thickness: f.thickness, metal: f.metal, sparkle: this.sparkleOn ? f.sparkle : 0 };
    if (instant) {
      this.tween = 1;
      this.apply(this.toColor, this.to);
      return;
    }
    this.fromColor.copy(this.polish.uBase.value);
    this.from = {
      film: this.polish.uFilm.value,
      thickness: this.polish.uThickness.value,
      metal: this.polish.uMetal.value,
      sparkle: this.polish.uSparkle.value,
    };
    this.tween = 0;
  }

  private apply(color: Color, v: { film: number; thickness: number; metal: number; sparkle: number }) {
    for (const u of this.lacquers) {
      u.uBase.value.copy(color);
      u.uFilm.value = v.film;
      u.uThickness.value = v.thickness;
      u.uMetal.value = v.metal;
      u.uSparkle.value = v.sparkle;
    }
  }

  /**
   * Advance one drawn frame. Returns true while something is still moving, so the caller
   * keeps requesting frames; false = idle, the render loop stops.
   */
  update(dt: number, input: SpinInput, swayAllowed: boolean): boolean {
    let moving = false;

    // colour / finish tween
    if (this.tween < 1) {
      this.tween = Math.min(1, this.tween + dt / TWEEN_SECONDS);
      const t = ease(this.tween);
      this.nowColor.copy(this.fromColor).lerp(this.toColor, t);
      const a = this.from;
      const b = this.to;
      for (const u of this.lacquers) {
        u.uBase.value.copy(this.nowColor);
        u.uFilm.value = a.film + (b.film - a.film) * t;
        u.uThickness.value = a.thickness + (b.thickness - a.thickness) * t;
        u.uMetal.value = a.metal + (b.metal - a.metal) * t;
        u.uSparkle.value = a.sparkle + (b.sparkle - a.sparkle) * t;
      }
      moving = true;
    }

    // drag inertia
    if (!input.dragging && Math.abs(input.velocity) > 0.01) {
      input.target += input.velocity * dt;
      input.velocity *= Math.exp(-dt * 3.5);
      moving = true;
    }

    // idle sway: fades in/out instead of snapping
    const swayTarget = swayAllowed && this.swayOn && !input.dragging ? 1 : 0;
    if (Math.abs(this.swayWeight - swayTarget) > 0.001) {
      this.swayWeight += (swayTarget - this.swayWeight) * (1 - Math.exp(-dt * 2));
      moving = true;
    } else this.swayWeight = swayTarget;

    if (this.swayWeight > 0) {
      this.time += dt;
      this.polish.uTime.value = this.time;
      this.swatches.uTime.value = this.time;
      moving = true;
    }

    const sway = Math.sin(this.time * 0.45) * 0.28 * this.swayWeight;
    const goal = input.target + sway;
    const diff = goal - this.spinNow;
    if (Math.abs(diff) > 0.0004) {
      this.spinNow += diff * (1 - Math.exp(-dt * 9));
      moving = true;
    } else this.spinNow = goal;
    this.spin.rotation.y = this.spinNow;
    this.spin.rotation.x = Math.sin(this.time * 0.3) * 0.025 * this.swayWeight;

    return moving;
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
