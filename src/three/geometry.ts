import { BufferGeometry, Float32BufferAttribute, LatheGeometry, Vector2 } from "three";

/*
  Everything here is procedural: lathe profiles for the bottle, polish and cap, and a
  parametric "lens" surface for the almond nail swatch. No model files.
*/

const v = (x: number, y: number) => new Vector2(x, y);

/** Quarter-circle corner, from angle a0 to a1 around (cx, cy). */
function arc(out: Vector2[], cx: number, cy: number, r: number, a0: number, a1: number, steps: number) {
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push(v(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
}

/** Quadratic bezier from p0 via c to p1 (p0 excluded). */
function quad(out: Vector2[], p0: Vector2, c: Vector2, p1: Vector2, steps: number) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    out.push(v(it * it * p0.x + 2 * it * t * c.x + t * t * p1.x, it * it * p0.y + 2 * it * t * c.y + t * t * p1.y));
  }
}

export function glassGeometry(segments: number) {
  const p: Vector2[] = [v(0, 0)];
  arc(p, 0.54, 0.08, 0.08, -Math.PI / 2, 0, 6);
  p.push(v(0.62, 0.98));
  quad(p, v(0.62, 0.98), v(0.63, 1.34), v(0.25, 1.4), 14);
  p.push(v(0.24, 1.46), v(0.24, 1.6), v(0.215, 1.63));
  return new LatheGeometry(p, segments);
}

export function polishGeometry(segments: number) {
  const p: Vector2[] = [v(0, 0.13)];
  arc(p, 0.5, 0.19, 0.06, -Math.PI / 2, 0, 5);
  p.push(v(0.56, 0.98));
  quad(p, v(0.56, 0.98), v(0.565, 1.1), v(0.44, 1.14), 6);
  p.push(v(0.2, 1.16), v(0, 1.16));
  return new LatheGeometry(p, segments);
}

export function capGeometry(segments: number) {
  const p: Vector2[] = [v(0, 1.55), v(0.255, 1.55)];
  arc(p, 0.255, 1.58, 0.03, -Math.PI / 2, 0, 3);
  p.push(v(0.285, 1.7));
  quad(p, v(0.285, 1.7), v(0.255, 2.05), v(0.27, 2.42), 10);
  arc(p, 0.22, 2.44, 0.05, 0, Math.PI / 2, 5);
  p.push(v(0, 2.49));
  return new LatheGeometry(p, segments);
}

/** Brush stem: visible through the neck of the glass between polish and cap. */
export function stemGeometry(segments: number) {
  const p: Vector2[] = [v(0, 0.9), v(0.04, 0.92), v(0.036, 1.56), v(0, 1.56)];
  return new LatheGeometry(p, Math.max(12, segments / 4));
}

/**
 * Almond nail swatch as a closed lens-shaped solid: top and bottom surfaces meet at the rim,
 * with a C-curve across the width and a slight lift towards the tip.
 */
export function swatchGeometry(uSteps: number, vSteps: number) {
  const W = 0.34;
  const L = 0.62;
  const T = 0.028;
  const positions: number[] = [];
  const indices: number[] = [];

  const halfWidth = (s: number) => {
    if (s < 0.42) return (W / 2) * (0.9 + 0.1 * Math.sin((s / 0.42) * (Math.PI / 2)));
    const k = (s - 0.42) / 0.58;
    return (W / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(k, 2.1)));
  };

  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? 1 : -1;
    for (let j = 0; j <= vSteps; j++) {
      const s = j / vSteps;
      const hw = halfWidth(s);
      for (let i = 0; i <= uSteps; i++) {
        const u = (i / uSteps) * 2 - 1;
        const x = u * hw;
        // rounded cuticle end
        const y = s * L - 0.035 * (1 - u * u) * Math.pow(1 - s, 6);
        const close = Math.sqrt(Math.min(1, s / 0.035)) * Math.sqrt(Math.max(0, 1 - u * u));
        const t = T * close * (1 - 0.35 * s);
        const curve = -2.2 * x * x + 0.05 * s * s;
        positions.push(x, y, curve + sign * t);
      }
    }
  }

  const row = uSteps + 1;
  const sideCount = row * (vSteps + 1);
  for (let side = 0; side < 2; side++) {
    const off = side * sideCount;
    for (let j = 0; j < vSteps; j++) {
      for (let i = 0; i < uSteps; i++) {
        const a = off + j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        if (side === 0) indices.push(a, b, d, a, d, c);
        else indices.push(a, d, b, a, c, d);
      }
    }
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
