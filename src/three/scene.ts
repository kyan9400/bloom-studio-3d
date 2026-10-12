import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector4,
  type BufferGeometry,
  type Side,
} from "three";
import { FINISH_UNIFORMS, type Finish, type FinishUniforms } from "@/lib/shades";
import {
  GLASS_WALL,
  SWATCH_HOLE_Y,
  SWATCH_L,
  bristleGeometry,
  capGeometry,
  collarGeometry,
  glassGeometry,
  polishGeometry,
  splitRingGeometry,
  stemGeometry,
  swatchGeometry,
} from "./geometry";
import {
  filmFragment,
  filmVertex,
  glassFragment,
  glassVertex,
  glowFragment,
  metalFragment,
  planeVertex,
  shadowFragment,
} from "./shaders";
import type { TierSettings } from "./quality";

/** Pointer + scroll state written by the page, read once per drawn frame. */
export type SpinInput = {
  target: number; // wanted rotation (radians)
  velocity: number; // inertia after release (radians / s)
  dragging: boolean;
  scroll: number; // "Uncap & paint" progress target, 0..1
};

export type UpdateFlags = { sway: boolean; reduced: boolean };

/** Uniforms every lit material shares (one object, so one write updates them all). */
type EnvUniforms = { uLights: { value: Vector2 }; uSweep: { value: number } };

type FilmUniforms = EnvUniforms & {
  uBase: { value: Color };
  uBare: { value: Color };
  uFilm: { value: number };
  uThickness: { value: number };
  uMetal: { value: number };
  uSparkle: { value: number };
  uRough: { value: number };
  uTime: { value: number };
  uSwirlScale: { value: number };
  uSeedShade: { value: number };
  uPaint: { value: number };
};

type Look = FinishUniforms;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Eased 0..1 for u inside [a, b]. */
const seg = (u: number, a: number, b: number) => ease(clamp01((u - a) / (b - a)));

const TWEEN_SECONDS = 0.75;
const TAN_31 = Math.tan((31 / 2) * (Math.PI / 180));

// swatch fan on its split ring
const RING_R = 0.15;
const STACK_DZ = 0.04;
const FAN_CENTER = -0.175;
const PIVOT = { x: 0.82, y: RING_R * 2 + 0.01, z: 0.42 };
const BOTTLE_X = -0.52;
const SHADOW_POS = { x: 0.05, z: 0.1 };

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
  bristles: BufferGeometry;
  collar: BufferGeometry;
  glass: BufferGeometry;
  swatch: BufferGeometry;
  ring: BufferGeometry;
};

/** Procedural geometry, a piece or two per task. */
async function buildGeometries(t: TierSettings): Promise<Geometries> {
  const seg = t.segments;
  const pts = t.profilePoints;
  const polish = polishGeometry(seg, pts);
  await yieldToMain();
  const glass = glassGeometry(seg, pts);
  await yieldToMain();
  const cap = capGeometry(seg, pts);
  const stem = stemGeometry(seg);
  const bristles = bristleGeometry(seg);
  const collar = collarGeometry(seg);
  await yieldToMain();
  const swatch = swatchGeometry(seg >= 64 ? 40 : 28, seg >= 64 ? 48 : 30);
  const ring = splitRingGeometry(RING_R);
  await yieldToMain();
  return { polish, cap, stem, bristles, collar, glass, swatch, ring };
}

export class BloomScene {
  readonly root = new Group();
  private readonly spin = new Group();
  private readonly capGroup = new Group();
  private readonly pivot = new Group();
  private readonly fan: InstancedMesh;
  private readonly drop: Mesh;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: ShaderMaterial[] = [];
  private readonly env: EnvUniforms = { uLights: { value: new Vector2(0, 0) }, uSweep: { value: 0 } };

  private readonly polish: FilmUniforms;
  private readonly swatches: FilmUniforms;
  private readonly lacquers: FilmUniforms[];
  private readonly shadow: { uBottle: { value: Vector4 }; uFan: { value: Vector4 }; uSpread: { value: number } };
  private readonly sparkleOn: boolean;
  private readonly swayOn: boolean;
  private readonly count: number;

  // tween state (reused objects, nothing allocated per frame)
  private readonly fromColor = new Color();
  private readonly toColor = new Color();
  private readonly nowColor = new Color();
  private from: Look = { film: 0, thickness: 0, metal: 0, sparkle: 0, rough: 0.1 };
  private to: Look = { film: 0, thickness: 0, metal: 0, sparkle: 0, rough: 0.1 };
  private tween = 1;
  private sweep = 1;

  private time = 0;
  private swayWeight = 0;
  private spinNow = 0;

  // lights-on intro: < 0 waiting, then seconds since start; Infinity = done
  private lightsT = -1;
  private lightsStarted = false;

  // scroll moment: critically damped follower of input.scroll
  private u = 0;
  private uVel = 0;
  private posed = -1;
  private camT = 0;
  private camDirty = true;
  private pull = 1;
  private readonly dummy = new Object3D();
  private readonly holeOffset = new Matrix4().makeTranslation(0, -SWATCH_HOLE_Y, 0);
  private readonly instance = new Matrix4();

  /** Build the scene in small steps so no single task blocks the main thread for long. */
  static async create(settings: TierSettings): Promise<BloomScene> {
    const geos = await buildGeometries(settings);
    return new BloomScene(settings, geos);
  }

  private filmMaterial(swirl: number, seedShade: number, side: Side, defines: Record<string, string> = {}) {
    const uniforms: FilmUniforms = {
      ...this.env,
      uBase: { value: new Color("#d9668f") },
      uBare: { value: new Color("#f3e6e0") },
      uFilm: { value: 0 },
      uThickness: { value: 400 },
      uMetal: { value: 0 },
      uSparkle: { value: 0 },
      uRough: { value: 0.1 },
      uTime: { value: 0 },
      uSwirlScale: { value: swirl },
      uSeedShade: { value: seedShade },
      uPaint: { value: 0 },
    };
    const material = new ShaderMaterial({
      vertexShader: filmVertex,
      fragmentShader: filmFragment,
      uniforms,
      side,
      defines,
    });
    this.materials.push(material);
    return { material, uniforms };
  }

  private constructor(settings: TierSettings, geos: Geometries) {
    this.sparkleOn = settings.sparkle;
    this.swayOn = settings.sway;
    this.count = settings.swatches;
    Object.values(geos).forEach((g) => this.geometries.push(g));

    this.root.add(this.spin);

    // --- bottle -------------------------------------------------------------
    const bottle = new Group();
    bottle.position.set(BOTTLE_X, 0, 0);
    bottle.rotation.z = 0.02;
    this.spin.add(bottle);

    const polish = this.filmMaterial(2.1, 0, FrontSide);
    this.polish = polish.uniforms;
    const polishMesh = new Mesh(geos.polish, polish.material);
    polishMesh.renderOrder = 1;
    bottle.add(polishMesh);

    // glass: one closed solid drawn twice, back faces first, so transparent sorting is stable
    const glassUniforms = {
      ...this.env,
      uTint: { value: new Color("#f3d7e2") },
      uBase: this.polish.uBase,
      uInk: { value: new Color("#2a1b2d") },
    };
    const glassDefines: Record<string, string> = { WALL: String(GLASS_WALL) };
    if (settings.refraction) glassDefines.REFRACT = "";
    if (settings.label) glassDefines.LABEL = "";
    const glassMat = (side: Side) =>
      new ShaderMaterial({
        vertexShader: glassVertex,
        fragmentShader: glassFragment,
        uniforms: glassUniforms,
        defines: glassDefines,
        transparent: true,
        depthWrite: false,
        side,
      });
    const glassBack = glassMat(BackSide);
    const glassFront = glassMat(FrontSide);
    this.materials.push(glassBack, glassFront);
    const back = new Mesh(geos.glass, glassBack);
    back.renderOrder = 2;
    const front = new Mesh(geos.glass, glassFront);
    front.renderOrder = 3;
    bottle.add(back, front);

    // brushed metal: neck collar + the swatch ring
    const metal = new ShaderMaterial({
      vertexShader: filmVertex,
      fragmentShader: metalFragment,
      uniforms: { ...this.env, uMetalCol: { value: new Color("#d9c3a5") } },
    });
    this.materials.push(metal);
    bottle.add(new Mesh(geos.collar, metal));

    // cap + brush, one group so the scroll moment can lift them out together
    const cap = this.filmMaterial(1, 0, FrontSide, settings.capRibs ? { CAP_RIBS: "" } : {});
    cap.uniforms.uBase.value.set("#1d1220");
    cap.uniforms.uFilm.value = 0.12;
    cap.uniforms.uThickness.value = 300;
    cap.uniforms.uRough.value = 0.14;
    const stem = this.filmMaterial(1, 0, FrontSide);
    stem.uniforms.uBase.value.set("#1d1220");
    stem.uniforms.uRough.value = 0.2;
    this.capGroup.position.set(0, 1.55, 0);
    this.capGroup.rotation.order = "ZYX";
    const capMesh = new Mesh(geos.cap, cap.material);
    const stemMesh = new Mesh(geos.stem, stem.material);
    const bristleMesh = new Mesh(geos.bristles, polish.material);
    const dropGeo = this.track(new SphereGeometry(0.028, 16, 12));
    this.drop = new Mesh(dropGeo, polish.material);
    this.drop.position.y = 0.69;
    this.drop.scale.setScalar(0.0001);
    for (const m of [capMesh, stemMesh, bristleMesh, this.drop]) {
      m.position.y -= 1.55;
      this.capGroup.add(m);
    }
    bottle.add(this.capGroup);

    // --- swatch fan on a split ring (one instanced draw call) -----------------
    const count = settings.swatches;
    const swatch = this.filmMaterial(5.5, 1, DoubleSide, {
      SWATCH: "",
      HOLE_Y: String(SWATCH_HOLE_Y),
      NAIL_LEN: String(SWATCH_L + 0.035),
    });
    this.swatches = swatch.uniforms;
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = count === 1 ? 0 : i / (count - 1);
    geos.swatch.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    this.fan = new InstancedMesh(geos.swatch, swatch.material, count);
    this.fan.frustumCulled = false;
    this.pivot.position.set(PIVOT.x, PIVOT.y, PIVOT.z);
    this.pivot.rotation.set(-0.08, -0.38, 0);
    this.pivot.add(this.fan);
    const ring = new Mesh(geos.ring, metal);
    ring.rotation.z = Math.PI / 2;
    ring.position.set(0, -RING_R, this.stackCenter());
    this.pivot.add(ring);
    this.spin.add(this.pivot);

    // --- contact shadow + AO (code-made, no shadow maps), turns with the objects
    const shadowUniforms = {
      uColor: { value: new Color("#3a1f35") },
      uBottle: { value: new Vector4(BOTTLE_X - SHADOW_POS.x, SHADOW_POS.z, 1, 1) },
      uFan: { value: new Vector4(PIVOT.x - SHADOW_POS.x, -(PIVOT.z - SHADOW_POS.z), 1, 1) },
      uSpread: { value: 1 },
    };
    this.shadow = shadowUniforms;
    const shadow = new ShaderMaterial({
      vertexShader: planeVertex,
      fragmentShader: shadowFragment,
      uniforms: shadowUniforms,
      transparent: true,
      depthWrite: false,
    });
    this.materials.push(shadow);
    const shadowMesh = new Mesh(this.track(new PlaneGeometry(3.6, 2.4)), shadow);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(SHADOW_POS.x, 0.001, SHADOW_POS.z);
    shadowMesh.renderOrder = 0;
    this.spin.add(shadowMesh);

    // high tier: coloured light pooling under the bottle
    if (settings.floorGlow) {
      const glow = new ShaderMaterial({
        vertexShader: planeVertex,
        fragmentShader: glowFragment,
        uniforms: { uBase: this.polish.uBase, uStrength: { value: 0.18 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      this.materials.push(glow);
      const glowMesh = new Mesh(this.track(new PlaneGeometry(1.9, 1.9)), glow);
      glowMesh.rotation.x = -Math.PI / 2;
      glowMesh.position.set(0.12, 0.002, 0.05);
      glowMesh.renderOrder = 1;
      bottle.add(glowMesh);
    }

    this.lacquers = [this.polish, this.swatches];
    this.pose(0);
  }

  private track<T extends BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private stackCenter() {
    return (-STACK_DZ * (this.count - 1)) / 2;
  }

  /** Lay the swatches out on the ring: each hole sits on the ring's arc, fanned around it. */
  private layoutFan(spread: number) {
    const zc = this.stackCenter();
    for (let i = 0; i < this.count; i++) {
      const k = this.count === 1 ? 0.5 : i / (this.count - 1);
      const z = -STACK_DZ * i;
      const dz = z - zc;
      const y = -RING_R + Math.sqrt(Math.max(0, RING_R * RING_R - dz * dz));
      this.dummy.position.set(0, y, z);
      this.dummy.rotation.set(0, 0, FAN_CENTER + (0.5 - k) * spread);
      this.dummy.updateMatrix();
      this.fan.setMatrixAt(i, this.instance.copy(this.dummy.matrix).multiply(this.holeOffset));
    }
    this.fan.instanceMatrix.needsUpdate = true;
  }

  /** Apply the "Uncap & paint" pose for progress u (no allocations). */
  private pose(u: number) {
    // 0 - 0.35: quarter twist, lift clear of the neck, then tilt the brush toward the fan
    const lift = seg(u, 0, 0.22);
    const tilt = seg(u, 0.2, 0.35);
    this.capGroup.position.set(tilt * 0.3, 1.55 + lift * 0.98 - tilt * 0.25, 0);
    this.capGroup.rotation.set(0, lift * (Math.PI / 2), tilt * 0.7);
    const drop = seg(u, 0.22, 0.38);
    this.drop.scale.set(drop, drop * 1.3, drop);
    this.drop.visible = drop > 0.001;

    // 0.25 - 0.6: the fan opens from a tight stack and lifts
    const fan = seg(u, 0.25, 0.6);
    this.layoutFan(0.25 + fan * 1.2);
    this.pivot.position.y = PIVOT.y + fan * 0.12;

    // 0.4 - 1: each nail paints itself, cuticle to tip
    this.swatches.uPaint.value = clamp01((u - 0.4) / 0.6) * 1.55;

    // shadows follow: the fan's AO softens as it lifts, the wide pool widens with the spread
    this.shadow.uFan.value.z = 1 - fan * 0.55;
    this.shadow.uFan.value.w = 1 + fan * 0.6;
    this.shadow.uSpread.value = 1 + fan * 0.12;
    this.shadow.uBottle.value.z = 1 - lift * 0.08;

    this.camT = seg(u, 0, 0.5);
    this.camDirty = true;
    this.posed = u;
  }

  /** Portrait stages pull the camera back so everything fits. */
  setPull(pull: number) {
    this.pull = pull;
    this.camDirty = true;
  }

  /** Camera for the current pose: a 6° arc and a subtle dolly zoom (fov 31 -> 27). */
  applyCamera(camera: PerspectiveCamera, force = false) {
    if (!this.camDirty && !force) return;
    this.camDirty = false;
    const c = this.camT;
    const fov = 31 - 4 * c;
    const dist = 5.7 * this.pull * (TAN_31 / Math.tan((fov / 2) * (Math.PI / 180))) * (1 + 0.12 * c);
    const lookY = 1.12 + 0.42 * c;
    const ang = c * 0.105;
    camera.fov = fov;
    camera.position.set(0.12 + Math.sin(ang) * dist * 0.9978, lookY + dist * 0.0665, Math.cos(ang) * dist * 0.9978);
    camera.lookAt(0.12, lookY, 0);
    camera.updateProjectionMatrix();
  }

  /** Start the "lights on" ramp (key box first, warm box 0.2 s later). */
  startLights(instant: boolean) {
    this.lightsStarted = true;
    if (instant) {
      this.lightsT = Infinity;
      this.env.uLights.value.set(1, 1);
    } else this.lightsT = -0.25;
  }

  /** Set a new pigment + finish. instant = cut (reduced motion / first paint). */
  setLook(hex: string, finish: Finish, instant: boolean) {
    const f = FINISH_UNIFORMS[finish];
    this.toColor.set(hex);
    this.to = { ...f, sparkle: this.sparkleOn ? f.sparkle : 0 };
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
      rough: this.polish.uRough.value,
    };
    this.tween = 0;
    this.sweep = 0;
  }

  private apply(color: Color, v: Look) {
    for (const u of this.lacquers) {
      u.uBase.value.copy(color);
      u.uFilm.value = v.film;
      u.uThickness.value = v.thickness;
      u.uMetal.value = v.metal;
      u.uSparkle.value = v.sparkle;
      u.uRough.value = v.rough;
    }
  }

  /**
   * Advance one drawn frame. Returns true while something is still moving, so the caller
   * keeps requesting frames; false = idle, the render loop stops.
   */
  update(dt: number, input: SpinInput, flags: UpdateFlags): boolean {
    let moving = false;

    // colour / finish tween + light sweep
    if (this.tween < 1) {
      this.tween = flags.reduced ? 1 : Math.min(1, this.tween + dt / TWEEN_SECONDS);
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
        u.uRough.value = a.rough + (b.rough - a.rough) * t;
      }
      moving = true;
    }
    if (this.sweep < 1) {
      this.sweep = flags.reduced ? 1 : Math.min(1, this.sweep + dt / TWEEN_SECONDS);
      this.env.uSweep.value = this.sweep;
      moving = true;
    }

    // lights on
    if (this.lightsStarted && this.lightsT !== Infinity) {
      this.lightsT = flags.reduced ? 2 : this.lightsT + dt;
      const key = ease(clamp01(this.lightsT / 0.9));
      const warm = ease(clamp01((this.lightsT - 0.2) / 0.9));
      this.env.uLights.value.set(key, warm);
      if (warm >= 1) this.lightsT = Infinity;
      moving = true;
    }

    // scroll moment: critically damped (k = 10), snaps under reduced motion
    const target = input.scroll;
    if (flags.reduced) {
      this.u = target;
      this.uVel = 0;
    } else if (Math.abs(target - this.u) > 1e-4 || Math.abs(this.uVel) > 1e-4) {
      const k = 10;
      this.uVel += (k * k * (target - this.u) - 2 * k * this.uVel) * dt;
      this.u += this.uVel * dt;
      if (Math.abs(target - this.u) > 1e-3) moving = true;
      else if (Math.abs(this.uVel) < 1e-3) {
        this.u = target;
        this.uVel = 0;
      } else moving = true;
    }
    if (Math.abs(this.u - this.posed) > 1e-6) this.pose(this.u);

    // drag inertia
    if (!input.dragging && Math.abs(input.velocity) > 0.01) {
      input.target += input.velocity * dt;
      input.velocity *= Math.exp(-dt * 3.5);
      moving = true;
    }

    // idle sway: fades in/out instead of snapping
    const swayTarget = flags.sway && this.swayOn && !input.dragging ? 1 : 0;
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
