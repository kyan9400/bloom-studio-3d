import {
  AdditiveBlending,
  BackSide,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
  HemisphereLight,
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
  type Texture,
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
  petalGeometry,
  plinthGeometry,
  polishGeometry,
  ribbonGeometry,
  splitRingGeometry,
  stemGeometry,
  swatchGeometry,
} from "./geometry";
import {
  filmFragment,
  filmVertex,
  floorFragment,
  petalFragment,
  petalVertex,
  plinthFragment,
  glassFragment,
  glassVertex,
  glowFragment,
  metalFragment,
  planeVertex,
  shadowFragment,
} from "./shaders";
import type { TierSettings } from "./quality";
import { loadStudioProps, type StudioProps } from "./props";

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
  uGrow: { value: number };
};

type Look = FinishUniforms;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Eased 0..1 for u inside [a, b]. */
const seg = (u: number, a: number, b: number) => ease(clamp01((u - a) / (b - a)));

const TWEEN_SECONDS = 0.75;
const INTRO_SECONDS = 2.2;

/*
  Camera chapters for the scroll story, one row per key: u, distance, look x, look y, orbit angle,
  elevation (radians), fov. Hero = low three-quarter on the bottle; uncap = close on the neck;
  paint = swing right over the stroke and the fan; bloom = pulled back over the whole set.
*/
const CAM_KEYS = [
  [0.0, 7.4, -0.26, 1.12, -0.2, 0.07, 30],
  [0.3, 6.9, -0.34, 2.0, 0.08, 0.15, 28],
  [0.66, 6.6, 0.2, 0.78, 0.55, 0.44, 28],
  [1.0, 8.6, 0.06, 1.0, 0.24, 0.3, 30],
] as const;
const CAM = new Float32Array(6);

// liquid lacquer: a big swirl behind the bottle, a second loop on the right, and the brush stroke on the plinth
const SWIRL: [number, number, number][] = [
  [-1.5, 0.04, 0.62],
  [-1.72, 0.72, -0.12],
  [-1.32, 1.58, -0.88],
  [-0.3, 2.32, -1.12],
  [0.78, 2.52, -0.72],
  [1.42, 2.08, -0.05],
  [1.22, 1.52, 0.5],
  [0.62, 1.42, 0.82],
];
const SWIRL2: [number, number, number][] = [
  [0.35, 0.04, -1.05],
  [1.3, 0.42, -1.0],
  [1.9, 0.98, -0.38],
  [1.85, 1.42, 0.42],
  [1.45, 1.22, 0.95],
];
const STROKE: [number, number, number][] = [
  [-1.02, 0.013, 0.98],
  [-0.48, 0.013, 1.24],
  [0.2, 0.013, 1.1],
  [0.84, 0.013, 1.16],
  [1.24, 0.013, 0.86],
];

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
  plinth: BufferGeometry;
  swirl: BufferGeometry;
  swirl2: BufferGeometry | null;
  stroke: BufferGeometry;
  petal: BufferGeometry;
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
  const plinth = plinthGeometry(seg);
  const around = seg >= 64 ? 14 : 10;
  const swirl = ribbonGeometry(SWIRL, { width: 0.34, thick: 0.05, twist: 1.3, along: t.ribbonAlong, around });
  const swirl2 = t.swirl2
    ? ribbonGeometry(SWIRL2, { width: 0.2, thick: 0.035, twist: -1.1, along: Math.round(t.ribbonAlong * 0.6), around })
    : null;
  const stroke = ribbonGeometry(STROKE, {
    width: 0.24,
    thick: 0.024,
    twist: 0,
    along: Math.round(t.ribbonAlong * 0.6),
    around,
    start: 0.05,
    end: 0.35,
  });
  const petal = petalGeometry();
  await yieldToMain();
  return { polish, cap, stem, bristles, collar, glass, swatch, ring, plinth, swirl, swirl2, stroke, petal };
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
  private readonly ribbons: FilmUniforms[] = [];
  private readonly stroke: FilmUniforms;
  private petals: InstancedMesh | null = null;
  private readonly petalData: Float32Array;
  private readonly petalUniforms: { uBloom: { value: number } };
  private bloom = 0;
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

  // the scanned studio props (null if they failed to load: the set simply goes without them) and their lights
  private readonly props: StudioProps | null;
  private readonly hemi = new HemisphereLight("#fff4f2", "#c99aa6", 0);
  private readonly sun = new DirectionalLight("#fff1ea", 0);
  // the backdrop's middle tone before the shade tint (see .stage-tint in globals.css)
  private readonly backdrop = new Color("#f3e0da");

  /** Build the scene in small steps so no single task blocks the main thread for long. */
  static async create(settings: TierSettings): Promise<BloomScene> {
    // the props download and decode while the procedural geometry is built
    const [geos, props] = await Promise.all([buildGeometries(settings), loadStudioProps().catch(() => null)]);
    return new BloomScene(settings, geos, props);
  }

  /** Textures to upload before the reveal (so the first visible frame does not wait on them). */
  get textures(): Texture[] {
    return this.props ? this.props.textures : [];
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
      uGrow: { value: 1 },
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

  private constructor(settings: TierSettings, geos: Geometries, props: StudioProps | null) {
    this.props = props;
    this.sparkleOn = settings.sparkle;
    this.swayOn = settings.sway;
    this.count = settings.swatches;
    Object.values(geos).forEach((g) => g && this.geometries.push(g));

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

    // --- studio set: glazed plinth + its soft shadow on the floor ---------------
    const plinthMat = new ShaderMaterial({
      vertexShader: glassVertex,
      fragmentShader: plinthFragment,
      uniforms: { ...this.env, uBase: this.polish.uBase, uClay: { value: new Color("#f4dfd8") } },
    });
    this.materials.push(plinthMat);
    const plinth = new Mesh(geos.plinth, plinthMat);
    plinth.renderOrder = -1;
    this.root.add(plinth);
    const floorMat = new ShaderMaterial({
      vertexShader: planeVertex,
      fragmentShader: floorFragment,
      uniforms: { uColor: { value: new Color("#5a2f45") } },
      transparent: true,
      depthWrite: false,
    });
    this.materials.push(floorMat);
    const floor = new Mesh(this.track(new PlaneGeometry(6.4, 6.4)), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.779;
    floor.renderOrder = -2;
    this.root.add(floor);

    // --- liquid lacquer ribbons (same pigment as the bottle) -----------------
    const ribbonMesh = (geo: BufferGeometry, swirl: number) => {
      const r = this.filmMaterial(swirl, 0.6, DoubleSide, { RIBBON: "" });
      this.ribbons.push(r.uniforms);
      const m = new Mesh(geo, r.material);
      m.frustumCulled = false;
      this.spin.add(m);
      return r.uniforms;
    };
    ribbonMesh(geos.swirl, 1.6);
    if (geos.swirl2) ribbonMesh(geos.swirl2, 2.2);
    this.stroke = ribbonMesh(geos.stroke, 3.0);
    this.stroke.uGrow.value = 0;

    // --- floating petals (one instanced draw) --------------------------------
    const pc = settings.petals;
    this.petalUniforms = { uBloom: { value: 0 } };
    this.petalData = new Float32Array(pc * 10);
    if (pc > 0) {
      const petalMat = new ShaderMaterial({
        vertexShader: petalVertex,
        fragmentShader: petalFragment,
        uniforms: {
          ...this.env,
          uBase: this.polish.uBase,
          uBlush: { value: new Color("#f6c9d3") },
          uBloom: this.petalUniforms.uBloom,
        },
        side: DoubleSide,
      });
      this.materials.push(petalMat);
      let seed = 7;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      const seeds = new Float32Array(pc);
      for (let i = 0; i < pc; i++) {
        const o = i * 10;
        // golden-angle spread around the set, kept out of the bottle's front window
        let a = i * 2.39996 + rnd() * 0.4;
        if (Math.cos(a) > 0.55 && Math.abs(Math.sin(a)) < 0.6) a += (Math.sin(a) < 0 ? -1 : 1) * 0.9;
        const rad = 1.9 + rnd() * 1.1;
        this.petalData[o] = Math.sin(a) * rad;
        this.petalData[o + 1] = -0.1 + rnd() * 3.3;
        this.petalData[o + 2] = Math.cos(a) * rad * 0.8 - 0.2;
        this.petalData[o + 3] = rnd() * Math.PI * 2; // rot x
        this.petalData[o + 4] = rnd() * Math.PI * 2; // rot y
        this.petalData[o + 5] = rnd() * Math.PI * 2; // rot z
        this.petalData[o + 6] = 0.25 + rnd() * 0.5; // speed
        this.petalData[o + 7] = rnd() * Math.PI * 2; // phase
        this.petalData[o + 8] = 0.85 + rnd() * 0.75; // scale
        this.petalData[o + 9] = rnd(); // bloom delay
        seeds[i] = rnd();
      }
      geos.petal.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
      const petals = new InstancedMesh(geos.petal, petalMat, pc);
      petals.frustumCulled = false;
      this.petals = petals;
      this.root.add(petals);
      this.layoutPetals();
    }

    // --- the studio behind the plinth: scanned plant and vase, lit only by these two soft lights
    // (every other material is a custom shader with its own studio lighting, so they ignore them)
    if (props) {
      this.sun.position.set(-3, 5, 4);
      this.root.add(this.hemi, this.sun, props.group);
    }

    this.lacquers = [this.polish, this.swatches, ...this.ribbons];
    this.pose(0);
  }

  /** The props' haze follows the shade, like the CSS backdrop behind the canvas (about 18% of the pigment). */
  private syncHaze() {
    this.props?.haze.copy(this.backdrop).lerp(this.polish.uBase.value, 0.18);
  }

  /** The props' lights follow the studio's "lights on" ramp (key box, warm box). */
  private setPropLights(key: number, warm: number) {
    this.hemi.intensity = 2.1 * key;
    this.sun.intensity = 2.3 * warm;
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

  /** Petals drift on their own slow orbits; the scroll "bloom" opens them outward and up. */
  private layoutPetals() {
    const petals = this.petals;
    if (!petals) return;
    const d = this.petalData;
    const t = this.time;
    for (let i = 0; i < petals.count; i++) {
      const o = i * 10;
      const eb = ease(clamp01(this.bloom * 1.5 - d[o + 9] * 0.5));
      const sp = d[o + 6];
      const ph = d[o + 7];
      const spread = 1 + eb * 0.32;
      this.dummy.position.set(
        d[o] * spread + Math.sin(t * sp * 0.6 + ph) * 0.06,
        d[o + 1] + Math.sin(t * sp + ph) * 0.09 + eb * 0.35,
        d[o + 2] * spread + Math.cos(t * sp * 0.5 + ph) * 0.06,
      );
      this.dummy.rotation.set(d[o + 3] + t * sp * 0.35, d[o + 4] + t * sp * 0.25 + eb * 1.4, d[o + 5]);
      this.dummy.scale.setScalar(d[o + 8] * (1 + eb * 0.25));
      this.dummy.updateMatrix();
      petals.setMatrixAt(i, this.dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
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

    // 0.32 - 0.66: the brush lays a stroke of lacquer across the plinth
    this.stroke.uGrow.value = seg(u, 0.32, 0.66);
    // 0.55 - 1: the colours bloom: petals open outward and take the pigment
    this.bloom = seg(u, 0.55, 1);
    this.petalUniforms.uBloom.value = this.bloom;
    this.layoutPetals();

    this.camT = u;
    this.camDirty = true;
    this.posed = u;
  }

  /** Portrait stages pull the camera back so everything fits. */
  setPull(pull: number) {
    this.pull = pull;
    this.camDirty = true;
  }

  /** Camera for the current pose: eased between the chapter keys (no allocations). */
  applyCamera(camera: PerspectiveCamera, force = false) {
    if (!this.camDirty && !force) return;
    this.camDirty = false;
    const u = this.camT;
    let k = 0;
    while (k < CAM_KEYS.length - 2 && u > CAM_KEYS[k + 1][0]) k++;
    const a = CAM_KEYS[k];
    const b = CAM_KEYS[k + 1];
    const t = ease(clamp01((u - a[0]) / (b[0] - a[0])));
    for (let i = 0; i < 6; i++) CAM[i] = a[i + 1] + (b[i + 1] - a[i + 1]) * t;
    const dist = CAM[0] * this.pull;
    const lookX = CAM[1];
    const lookY = CAM[2];
    const ang = CAM[3];
    const elev = CAM[4];
    camera.fov = CAM[5];
    const flat = Math.cos(elev) * dist;
    camera.position.set(lookX + Math.sin(ang) * flat, lookY + Math.sin(elev) * dist, Math.cos(ang) * flat);
    camera.lookAt(lookX, lookY, 0);
    camera.updateProjectionMatrix();
  }

  /** Start the "lights on" ramp (key box first, warm box 0.2 s later). */
  startLights(instant: boolean) {
    this.lightsStarted = true;
    if (instant) {
      this.lightsT = Infinity;
      this.env.uLights.value.set(1, 1);
      this.setPropLights(1, 1);
      this.setIntro(1);
    } else {
      this.lightsT = -0.25;
      this.setIntro(0);
    }
  }

  /** The floating ribbons pour in once, as the lights come up. */
  private setIntro(v: number) {
    for (const r of this.ribbons) if (r !== this.stroke) r.uGrow.value = v;
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
    this.syncHaze();
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
      this.syncHaze();
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
      this.setPropLights(key, warm);
      this.setIntro(ease(clamp01((this.lightsT - 0.15) / INTRO_SECONDS)));
      if (warm >= 1 && this.lightsT > INTRO_SECONDS + 0.15) this.lightsT = Infinity;
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
      for (const r of this.ribbons) r.uTime.value = this.time;
      this.layoutPetals();
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
    this.props?.dispose();
  }
}
