export type Point = [number, number];
export type Frame = number[];
export type Inside = (p: Point) => boolean;
export type Segment = [number, number, number, number, number];
export type TrailPoint = [number, number, number, number];
type Ball = [number, number, number];

export const TAU = Math.PI * 2;
export const RAYS = 64;
export const BALLS = 2;
export const LINES = 2;
export const TRAIL = 64;
export const BODY = 2 * RAYS + 4;
export const KIT = BODY + 3 * BALLS + 10 * LINES;
export const FRAME = KIT + 4 * TRAIL;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const range = (n: number) => Array.from({ length: n }, (_, i) => i);
export const lerpFrame = (a: Frame, b: Frame, w: number): Frame => a.map((v, i) => v + ((b[i] ?? v) - v) * w);

export function sstep(a: number, b: number, x: number) {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
}

export function glide(u: number, r = 0.2) {
  const x = clamp01(u);
  const v = 1 / (1 - r);
  if (x < r) return (v * x * x) / (2 * r);
  if (x > 1 - r) return 1 - (v * (1 - x) ** 2) / (2 * r);
  return v * (x - r / 2);
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const at = (t: number) => ((ax * t + bx) * t + cx) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24 && Math.abs(at(t) - x) >= 1e-5; i++) {
      if (at(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

function segDist([px, py]: Point, [ax, ay]: Point, [bx, by]: Point) {
  const vx = bx - ax;
  const vy = by - ay;
  const k = clamp01(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy));
  return Math.hypot(px - ax - vx * k, py - ay - vy * k);
}

export const inCirc =
  (cx: number, cy: number, r: number): Inside =>
  ([x, y]) =>
    (x - cx) ** 2 + (y - cy) ** 2 < r * r;

export const inCap =
  (a: Point, b: Point, r: number): Inside =>
  p =>
    segDist(p, a, b) < r;

export const inShape =
  (poly: Point[]): Inside =>
  ([x, y]) => {
    let inside = false;
    let previous = poly.at(-1);
    for (const point of poly) {
      if (!previous) break;
      const [xi, yi] = point;
      const [xj, yj] = previous;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      previous = point;
    }
    return inside;
  };

export const inRoundRect =
  (cx: number, cy: number, hx: number, hy: number, r: number): Inside =>
  ([x, y]) =>
    Math.hypot(Math.max(0, Math.abs(x - cx) - hx + r), Math.max(0, Math.abs(y - cy) - hy + r)) < r;

export const inOval =
  (cx: number, cy: number, rx: number, ry: number, b = 0, n = 11): Inside =>
  ([x, y]) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < (1 + b * Math.cos(n * Math.atan2(y - cy, x - cx))) ** 2;

export const anyOf =
  (...shapes: Inside[]): Inside =>
  p =>
    shapes.some(inside => inside(p));

export const nothing: Inside = () => false;

export const placed =
  (inside: Inside, a: number, [tx, ty]: Point = [0, 0]): Inside =>
  ([x, y]) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = x - tx;
    const dy = y - ty;
    return inside([dx * c + dy * s, -dx * s + dy * c]);
  };

export const around = ([cx, cy]: Point, a: number, r: number): Point => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

export const dot = (p: Point, d: number): TrailPoint[] => [
  [...p, d, 0],
  [...p, 0, 0],
];

function radial(inside: Inside, [cx, cy]: Point): number[] {
  const r = range(RAYS).map(i => {
    const a = (TAU * i) / RAYS;
    const at = (d: number) => inside([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
    let d = 0;
    while (d < 12 && at(d)) d += 0.3;
    let lo = Math.max(0, d - 0.3);
    let hi = d;
    for (let k = 0; k < 6; k++) {
      const m = (lo + hi) / 2;
      if (at(m)) lo = m;
      else hi = m;
    }
    return lo;
  });
  const ring = (i: number) => r[(i + RAYS) % RAYS] ?? 0;
  return range(RAYS).map(i => (ring(i - 1) + 2 * ring(i) + ring(i + 1)) / 4);
}

const NO_HOLE = range(RAYS).map(() => 0);

export interface KitParts {
  hole?: Inside;
  holeCenter?: Point;
  balls?: Ball[];
  cuts?: Segment[];
  inks?: Segment[];
}

export function kit(
  outer: Inside,
  c: Point,
  { hole, holeCenter = c, balls = [], cuts = [], inks = [] }: KitParts = {},
) {
  return [
    ...c,
    ...radial(outer, c),
    ...holeCenter,
    ...(hole ? radial(hole, holeCenter) : NO_HOLE),
    ...range(BALLS).flatMap(i => balls[i] ?? [...c, 0]),
    ...range(LINES).flatMap(i => cuts[i] ?? [...c, ...c, 0]),
    ...range(LINES).flatMap(i => inks[i] ?? [...c, ...c, 0]),
  ];
}

export function withTrail(kitFrame: Frame, points: TrailPoint[] = []): Frame {
  const [x = 0, y = 0] = points.at(-1) ?? kitFrame;
  return [...kitFrame, ...range(TRAIL).flatMap(i => points[i] ?? [x, y, 0, 0])];
}
