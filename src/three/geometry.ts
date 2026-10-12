import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, LatheGeometry, TorusGeometry, Vector2, Vector3 } from "three";

/*
  Everything here is procedural: filleted spline profiles turned on a lathe for the bottle, polish,
  cap, collar and brush, and one closed parametric surface for the almond nail swatch. No model files.
*/

const v = (x: number, y: number) => new Vector2(x, y);

/** A control point: x, y and an optional fillet radius for the corner at this point. */
type Ctrl = [number, number, number?];

/**
 * Smooth lathe profile: every corner gets a fillet (min 0.012), then a centripetal Catmull-Rom spline
 * runs through the result and is resampled evenly by arc length. `density` = samples per 1.6 units.
 */
export function profile(ctrl: Ctrl[], density: number): Vector2[] {
  const pts: Vector3[] = [];
  for (let i = 0; i < ctrl.length; i++) {
    const [x, y, r = 0] = ctrl[i];
    const p = new Vector3(x, y, 0);
    if (i === 0 || i === ctrl.length - 1) {
      pts.push(p);
      continue;
    }
    const a = new Vector3(ctrl[i - 1][0], ctrl[i - 1][1], 0);
    const b = new Vector3(ctrl[i + 1][0], ctrl[i + 1][1], 0);
    const toA = a.clone().sub(p);
    const toB = b.clone().sub(p);
    const d = Math.min(Math.max(r, 0.012), toA.length() * 0.45, toB.length() * 0.45);
    const pa = p.clone().addScaledVector(toA.normalize(), d);
    const pb = p.clone().addScaledVector(toB.normalize(), d);
    // midpoint of the quadratic fillet pa -> p -> pb
    const mid = pa.clone().multiplyScalar(0.25).addScaledVector(p, 0.5).addScaledVector(pb, 0.25);
    pts.push(pa, mid, pb);
  }
  const curve = new CatmullRomCurve3(pts, false, "centripetal");
  const n = Math.max(12, Math.ceil((curve.getLength() / 1.6) * density));
  return curve.getSpacedPoints(n).map((p) => v(p.x, p.y));
}

/** Offset a profile towards the inside of the solid (opposite to the lathe's outward normal). */
function offsetIn(pts: Vector2[], d: number): Vector2[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // LatheGeometry's outward normal for a segment is (dy, -dx)
    return v(Math.max(0, p.x - (dy / len) * d), p.y + (dx / len) * d);
  });
}

function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, steps: number, skipEnds = false) {
  const out: Vector2[] = [];
  for (let i = skipEnds ? 1 : 0; i <= (skipEnds ? steps - 1 : steps); i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push(v(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return out;
}

function linePts(a: Vector2, b: Vector2, steps: number) {
  const out: Vector2[] = [];
  for (let i = 1; i <= steps; i++) out.push(a.clone().lerp(b, i / steps));
  return out;
}

export const GLASS_WALL = 0.035;
const FLOOR_Y = 0.13;
const POLISH_GAP = 0.004;
const POLISH_LEVEL = 1.06;

/** The outer glass skin: punt dome on the axis, rounded foot, straight wall, shoulder, neck. */
function outerGlass(density: number) {
  return profile(
    [
      [0, 0.024],
      [0.1, 0.023],
      [0.38, 0.006, 0.06],
      [0.62, 0, 0.09],
      [0.62, 0.22],
      [0.62, 0.98, 0.0],
      [0.628, 1.33, 0.26],
      [0.245, 1.405, 0.035],
      [0.24, 1.47],
      [0.24, 1.6],
    ],
    density,
  );
}

/** The inner glass skin, bottom-up: thick floor at y 0.13, wall 0.035 inside the outer skin. */
function innerGlass(outer: Vector2[]) {
  const wall = offsetIn(
    outer.filter((p) => p.y >= 0.2),
    GLASS_WALL,
  );
  const x0 = wall[0].x;
  const rc = 0.06;
  // floor from the axis out to a rounded corner, then up the wall
  const floor = [v(0, FLOOR_Y), ...linePts(v(0, FLOOR_Y), v(x0 - rc, FLOOR_Y), 8)];
  const corner = arcPts(x0 - rc, FLOOR_Y + rc, rc, -Math.PI / 2, 0, 8, true);
  return [...floor, ...corner, v(x0, FLOOR_Y + rc), ...wall];
}

/** Closed glass solid: outer skin up, lip roll over the top, inner skin down to the thick floor. */
export function glassGeometry(segments: number, density: number) {
  const outer = outerGlass(density);
  const inner = innerGlass(outer);
  const top = outer[outer.length - 1];
  const innerTop = inner[inner.length - 1];
  const r = (top.x - innerTop.x) / 2;
  const lip = arcPts(top.x - r, top.y, r, 0, Math.PI, 8, true);
  const pts = [...outer, ...lip, ...inner.slice().reverse()];
  return new LatheGeometry(pts, segments);
}

/** Polish: 0.004 inside the inner glass skin (real clearance), with a soft meniscus on top. */
export function polishGeometry(segments: number, density: number) {
  const inner = innerGlass(outerGlass(density));
  const body = offsetIn(inner, POLISH_GAP).filter((p) => p.y <= POLISH_LEVEL);
  body[0].x = 0;
  const last = body[body.length - 1];
  const meniscus: Vector2[] = [];
  const c = v(last.x - 0.02, POLISH_LEVEL + 0.035);
  const end = v(last.x - 0.11, POLISH_LEVEL + 0.04);
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const it = 1 - t;
    meniscus.push(
      v(it * it * last.x + 2 * it * t * c.x + t * t * end.x, it * it * last.y + 2 * it * t * c.y + t * t * end.y),
    );
  }
  const surface = linePts(end, v(0, end.y), 10);
  return new LatheGeometry([...body, ...meniscus, ...surface], segments);
}

/** Cap with a slight waist and a rounded crown; both poles end flat on the axis. */
export function capGeometry(segments: number, density: number) {
  const pts = profile(
    [
      [0, 1.55],
      [0.12, 1.55],
      [0.285, 1.55, 0.03],
      [0.285, 1.74],
      [0.262, 2.06],
      [0.274, 2.49, 0.07],
      [0.12, 2.49],
      [0, 2.49],
    ],
    density,
  );
  return new LatheGeometry(pts, segments);
}

/** Brushed-metal collar ring around the neck, just under the cap (closed, rounded section).
    Its top stops 0.005 below the cap base (y 1.55), so the two never intersect. */
export function collarGeometry(segments: number) {
  const pts = profile(
    [
      [0.248, 1.52],
      [0.248, 1.495, 0.006],
      [0.268, 1.495, 0.004],
      [0.268, 1.545, 0.004],
      [0.248, 1.545, 0.006],
      [0.248, 1.52],
    ],
    600,
  );
  return new LatheGeometry(pts, segments);
}

/** Brush stem, from the cap down to the bristles. */
export function stemGeometry(segments: number) {
  const pts = profile(
    [
      [0, 0.97],
      [0.03, 0.97],
      [0.04, 0.99, 0.012],
      [0.036, 1.55],
      [0, 1.55],
    ],
    120,
  );
  return new LatheGeometry(pts, Math.max(16, segments / 3));
}

/** Tapered bristle bundle: a teardrop with a slightly flattened tip. */
export function bristleGeometry(segments: number) {
  const pts = profile(
    [
      [0, 0.72],
      [0.03, 0.722],
      [0.058, 0.76, 0.03],
      [0.068, 0.84],
      [0.05, 0.96],
      [0.03, 1.0],
      [0, 1.0],
    ],
    140,
  );
  return new LatheGeometry(pts, Math.max(16, segments / 2));
}

/** Two coils of a split key ring, 0.02 apart, in the XZ plane (axis Y). */
export function splitRingGeometry(radius: number) {
  const parts = [0.01, -0.01].map((y, i) => {
    const t = new TorusGeometry(radius, 0.0085, 10, 56, Math.PI * 2 * 0.985);
    t.rotateX(Math.PI / 2);
    t.rotateY(i * 0.9);
    t.translate(0, y, 0);
    return t;
  });
  const g = new BufferGeometry();
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const p of parts) {
    pos.push(...(p.attributes.position.array as Float32Array));
    nor.push(...(p.attributes.normal.array as Float32Array));
    const index = p.index!.array;
    for (let i = 0; i < index.length; i++) idx.push(index[i] + base);
    base += p.attributes.position.count;
    p.dispose();
  }
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/* ---------------------------------------------------------------- swatch */

export const SWATCH_L = 0.62;
/** Hole for the ring, near the cuticle end (geometry space). */
export const SWATCH_HOLE_Y = 0.075;

const W = 0.34;
const T = 0.015; // half thickness at the cuticle
const EXP = 2.6; // superellipse exponent across the width
const Y0 = -0.035;
const Y_LEN = SWATCH_L - Y0;

/** 0..1 shape factor along the nail: rounded cuticle, straight sides, almond tip. */
function widthShape(s: number) {
  const s0 = 0.12;
  if (s < s0) return Math.sqrt(Math.max(0, 1 - Math.pow((s0 - s) / s0, 2))) * 0.94;
  if (s < 0.45) return 0.94 + 0.06 * Math.sin(((s - s0) / (0.45 - s0)) * (Math.PI / 2));
  const k = (s - 0.45) / 0.55;
  return Math.sqrt(Math.max(0, 1 - Math.pow(k, 2.1)));
}

const spow = (c: number, e: number) => Math.sign(c) * Math.pow(Math.abs(c), e);

function swatchPoint(s: number, a: number, out: Vector3) {
  const shape = widthShape(s);
  const hw = (W / 2) * shape;
  // half thickness: never below 0.004 away from the poles, so the rim is a rounded bead, not a knife edge
  const ht = Math.max(0.004 * Math.sqrt(shape), T * (1 - 0.4 * s) * Math.sqrt(shape));
  const x = hw * spow(Math.cos(a), 2 / EXP);
  const zOff = ht * spow(Math.sin(a), 2 / EXP);
  const y = Y0 + s * Y_LEN;
  // gentle C-curve: deeper curves make neighbouring swatches cut into each other as the fan opens
  const curve = -1.0 * x * x + 0.05 * s * s;
  return out.set(x, y, curve + zOff);
}

/**
 * Almond nail swatch as one closed parametric surface: a superellipse section across the width,
 * swept along the length, with normals from the parametric derivatives (no seams, no creases).
 */
export function swatchGeometry(around: number, along: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const p = new Vector3();
  const ps0 = new Vector3();
  const ps1 = new Vector3();
  const pa0 = new Vector3();
  const pa1 = new Vector3();
  const ds = new Vector3();
  const da = new Vector3();
  const e = 1e-4;

  for (let j = 0; j <= along; j++) {
    // denser sampling near both rounded ends
    const t = j / along;
    const s = 0.5 - 0.5 * Math.cos(Math.PI * t);
    const sn = Math.min(1 - 2e-3, Math.max(2e-3, s));
    for (let i = 0; i <= around; i++) {
      const a = (i / around) * Math.PI * 2;
      swatchPoint(s, a, p);
      positions.push(p.x, p.y, p.z);
      swatchPoint(sn + e, a, ps1);
      swatchPoint(sn - e, a, ps0);
      swatchPoint(sn, a + e, pa1);
      swatchPoint(sn, a - e, pa0);
      ds.subVectors(ps1, ps0);
      da.subVectors(pa1, pa0);
      const n = ds.cross(da).normalize();
      // the poles: fall back to the length axis
      if (!Number.isFinite(n.x) || n.lengthSq() < 0.5) n.set(0, j === 0 ? -1 : 1, 0);
      normals.push(n.x, n.y, n.z);
    }
  }
  const row = around + 1;
  for (let j = 0; j < along; j++) {
    for (let i = 0; i < around; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, d, a, d, b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  g.setIndex(indices);
  return g;
}

/* ---------------------------------------------------------------- studio set */

/** Two-step round plinth (top face at y 0), soft rounded edges. */
export function plinthGeometry(segments: number) {
  const pts = profile(
    [
      [1.94, -0.78],
      [1.94, -0.42, 0.05],
      [1.62, -0.42, 0.03],
      [1.62, 0, 0.06],
      [0, 0],
    ],
    90,
  );
  return new LatheGeometry(pts, segments);
}

/**
 * A ribbon of liquid lacquer swept along a spline: an elliptical section (width x thickness) carried by a
 * parallel-transport frame, twisted along the way and tapered at both ends. aCenter + aT let the vertex shader
 * "grow" the ribbon from its start (the section collapses onto the centre line past the growth front).
 */
export function ribbonGeometry(
  ctrl: [number, number, number][],
  o: { width: number; thick: number; twist: number; along: number; around: number; start?: number; end?: number },
) {
  const curve = new CatmullRomCurve3(
    ctrl.map(([x, y, z]) => new Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const n = o.along;
  const around = o.around;
  const startTaper = o.start ?? 0.12;
  const endTaper = o.end ?? 0.18;
  const pts = curve.getSpacedPoints(n);
  const tangents = pts.map((_, i) => curve.getTangentAt(i / n).normalize());
  // initial normal: world up projected off the first tangent
  let N = new Vector3(0, 1, 0);
  N.addScaledVector(tangents[0], -N.dot(tangents[0]));
  if (N.lengthSq() < 1e-4) N.set(1, 0, 0);
  N.normalize();
  const positions: number[] = [];
  const normals: number[] = [];
  const centers: number[] = [];
  const ts: number[] = [];
  const indices: number[] = [];
  const B = new Vector3();
  const axisA = new Vector3();
  const axisB = new Vector3();
  const p = new Vector3();
  const nn = new Vector3();
  for (let i = 0; i <= n; i++) {
    const T = tangents[i];
    if (i > 0) {
      // parallel transport: remove the tangent component, renormalise
      N.addScaledVector(T, -N.dot(T)).normalize();
    }
    B.crossVectors(T, N).normalize();
    const t = i / n;
    const tw = o.twist * t * Math.PI * 2;
    axisA.copy(B).multiplyScalar(Math.cos(tw)).addScaledVector(N, Math.sin(tw));
    axisB.copy(N).multiplyScalar(Math.cos(tw)).addScaledVector(B, -Math.sin(tw));
    const taper = Math.min(1, Math.sqrt(Math.min(1, t / startTaper)), Math.sqrt(Math.min(1, (1 - t) / endTaper)));
    const w = Math.max(0.002, (o.width / 2) * taper);
    const th = Math.max(0.002, (o.thick / 2) * Math.max(0.35, taper));
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      p.copy(pts[i]).addScaledVector(axisA, c * w).addScaledVector(axisB, s * th);
      nn.copy(axisA).multiplyScalar(c / w).addScaledVector(axisB, s / th).normalize();
      positions.push(p.x, p.y, p.z);
      normals.push(nn.x, nn.y, nn.z);
      centers.push(pts[i].x, pts[i].y, pts[i].z);
      ts.push(t);
    }
  }
  const row = around + 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  g.setAttribute("aCenter", new Float32BufferAttribute(centers, 3));
  g.setAttribute("aT", new Float32BufferAttribute(ts, 1));
  g.setIndex(indices);
  return g;
}

/** One cupped petal (about 0.22 long), base at the origin, pointing +y. */
export function petalGeometry() {
  const cols = 6;
  const rows = 8;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const L = 0.22;
  const W = 0.15;
  const f = (u: number, s: number, out: Vector3) => {
    // u -1..1 across, s 0..1 along
    const width = (W / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.92 + 0.08)), 0.7) * (0.55 + 0.45 * s);
    const x = u * width;
    const y = s * L;
    const z = 0.05 * u * u + 0.035 * Math.sin(Math.PI * s) - 0.03 * s * s;
    return out.set(x, y, z);
  };
  const p = new Vector3();
  const pu = new Vector3();
  const ps = new Vector3();
  for (let r = 0; r <= rows; r++) {
    const s = r / rows;
    for (let c = 0; c <= cols; c++) {
      const u = (c / cols) * 2 - 1;
      f(u, s, p);
      f(Math.min(1, u + 0.01), s, pu).sub(f(Math.max(-1, u - 0.01), s, ps));
      const du = pu.clone();
      f(u, Math.min(1, s + 0.01), pu).sub(f(u, Math.max(0, s - 0.01), ps));
      const n = du.cross(pu).normalize();
      if (!Number.isFinite(n.x)) n.set(0, 0, 1);
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      uvs.push(c / cols, s);
    }
  }
  const row = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * row + c;
      indices.push(a, a + 1, a + row + 1, a, a + row + 1, a + row);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}
