type V3 = readonly [number, number, number];
type V2 = readonly [number, number];
type M3 = readonly [V3, V3, V3];

export type RigName = 'radar' | 'hourglass' | 'padlock' | 'turnstile';
export type RigMode = 'working' | 'failed';

type Rig<S> = {
  rest: S;
  periods: Record<RigMode, number>;
  draw: (state: S) => string;
  working: (time: number) => S;
  failed: (time: number) => S;
  settle: (from: S, progress: number, elapsed: number) => S;
};

const K = 0.884;
const H = 0.442;
const Z = 1.25;
const ATTR = ' stroke-width="1" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"';
const SETTLE_SECONDS = 0.7;

const f = (n: number) => +n.toFixed(1);

function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error(`no item at ${index}`);
  return value;
}

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = (x: number) => {
  const c = clamp(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
const VIEW = norm([1, 1, (2 * H) / Z]);
const pr = (p: V3): V2 => [(p[1] - p[0]) * K, (p[0] + p[1]) * H - p[2] * Z];
const depth = (p: V3) => dot(p, VIEW);
const age = (value: number, elapsed: number) => (value >= 0 ? value + elapsed : value);

function rotAxis(axis: V3, degrees: number): M3 {
  const [x, y, z] = norm(axis);
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}
const mul = (m: M3, v: V3): V3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const mul3 = (a: M3, b: M3): M3 => {
  const row = (r: V3): V3 => [
    r[0] * b[0][0] + r[1] * b[1][0] + r[2] * b[2][0],
    r[0] * b[0][1] + r[1] * b[1][1] + r[2] * b[2][1],
    r[0] * b[0][2] + r[1] * b[1][2] + r[2] * b[2][2],
  ];
  return [row(a[0]), row(a[1]), row(a[2])];
};
const around = (m: M3, o: V3, p: V3) => add(o, mul(m, sub(p, o)));

function hull(points: readonly V2[]): V2[] {
  const sorted = points.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (list: readonly V2[]) => {
    const r: V2[] = [];
    for (const p of list) {
      while (r.length > 1) {
        const a = at(r, r.length - 2);
        const b = at(r, r.length - 1);
        if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 0) break;
        r.pop();
      }
      r.push(p);
    }
    return r.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

function roundedPath(pts: readonly V2[], radius = 1.6) {
  const n = pts.length;
  if (n < 3) return '';
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = at(pts, i);
    const a = at(pts, (i - 1 + n) % n);
    const b = at(pts, (i + 1) % n);
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
    const db = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const ra = Math.min(radius, da / 2.2) / da;
    const rb = Math.min(radius, db / 2.2) / db;
    const s = [p[0] + (a[0] - p[0]) * ra, p[1] + (a[1] - p[1]) * ra] as const;
    const e = [p[0] + (b[0] - p[0]) * rb, p[1] + (b[1] - p[1]) * rb] as const;
    d += `${i ? 'L' : 'M'}${f(s[0])},${f(s[1])}Q${f(p[0])},${f(p[1])} ${f(e[0])},${f(e[1])}`;
  }
  return `${d}Z`;
}

const poly = (pts: readonly V2[], close = true) =>
  `M${pts.map(p => `${f(p[0])},${f(p[1])}`).join('L')}${close ? 'Z' : ''}`;

const circle3 = (c: V3, a: V3, b: V3, r: number, n = 48): V3[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return add(add(c, a, r * Math.cos(t)), b, r * Math.sin(t));
  });

function basis(n: V3): [V3, V3] {
  const ref: V3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const a = norm(cross(n, ref));
  return [a, norm(cross(n, a))];
}

class Paint {
  private items: [number, string][] = [];
  put(z: number, svg: string) {
    this.items.push([z, svg]);
  }
  out() {
    return this.items
      .toSorted((a, b) => a[0] - b[0])
      .map(item => item[1])
      .join('');
  }
}

const group = (cls: string, body: string, style = '') =>
  `<g${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}>${body}</g>`;
const fade = (o: number) => (o < 1 ? `opacity:${f(o)}` : '');
const solidSvg = (pts: readonly V3[], fill = 'var(--face)') =>
  `<path d="${roundedPath(hull(pts.map(pr)))}" fill="${fill}" stroke="var(--line)"${ATTR}/>`;
const loopSvg = (pts: readonly V3[], fill = 'none', stroke = 'var(--line)') =>
  `<path d="${poly(pts.map(pr))}" fill="${fill}" stroke="${stroke}"${ATTR}/>`;
const lineSvg = (pts: readonly V3[], stroke = 'var(--line)') =>
  `<path d="${poly(pts.map(pr), false)}" fill="none" stroke="${stroke}"${ATTR}/>`;
const flatSvg = (pts: readonly V3[], fill = 'var(--face)', stroke = 'var(--line)') =>
  `<path d="${roundedPath(pts.map(pr), 0.5)}" fill="${fill}" stroke="${stroke}"${ATTR}/>`;

function cylinder(a: V3, b: V3, r: number, options: { cap?: boolean } = {}) {
  const n = norm(sub(b, a));
  const [u, w] = basis(n);
  const ca = circle3(a, u, w, r, 40);
  const cb = circle3(b, u, w, r, 40);
  const cap = dot(n, VIEW) >= 0 ? cb : ca;
  let svg = solidSvg([...ca, ...cb]);
  if (options.cap !== false) svg += loopSvg(cap, 'var(--face)');
  return svg;
}

function frustum(a: V3, b: V3, ra: number, rb: number, fill = 'var(--face)') {
  const n = norm(sub(b, a));
  const [u, w] = basis(n);
  return solidSvg([...circle3(a, u, w, ra, 40), ...circle3(b, u, w, rb, 40)], fill);
}

function tubeSvg(pts: readonly V3[], r: number) {
  const d = poly(pts.map(pr), false);
  const ends = 'stroke-linecap="round" stroke-linejoin="round"';
  return `<g class="acc"><path d="${d}" fill="none" stroke="var(--line)" stroke-width="${f(r * 2 + 0.9)}" ${ends}/><path d="${d}" fill="none" stroke="var(--face)" stroke-width="${f(r * 2 - 0.5)}" ${ends}/></g>`;
}

function burstSvg(c: V3, time: number, size = 1) {
  if (time < 0 || time > 0.42) return '';
  const k = smooth(0, 0.06, time) * (1 - smooth(0.2, 0.42, time));
  const s = 0.9 + 0.6 * smooth(0, 0.42, time);
  const q = pr(c);
  let d = '';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const r1 = 3.4 * s * size;
    const r2 = (7 + (i % 2) * 2.6) * s * size;
    d += `M${f(q[0] + Math.cos(a) * r1)},${f(q[1] + Math.sin(a) * r1 * 0.85)}L${f(q[0] + Math.cos(a) * r2)},${f(q[1] + Math.sin(a) * r2 * 0.85)}`;
  }
  return group('acc', `<path d="${d}" fill="none" stroke="var(--line)"${ATTR}/>`, `opacity:${f(k)}`);
}

function puffSvg(c: V3, time: number, drift: V3 = [2, -2, 14]) {
  let s = '';
  for (let i = 0; i < 3; i++) {
    const a = time - i * 0.1;
    if (a < 0 || a > 1.1) continue;
    const k = smooth(0, 0.12, a) * (1 - smooth(0.3, 1.1, a));
    const q = pr(add([c[0] + i * 1.4 - 1.4, c[1] - i, c[2] + i], drift, easeOut(a / 1.1)));
    s += `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(2.4 + 2.6 * a)}" fill="none" stroke="var(--smoke)" opacity="${f(k * 0.9)}"${ATTR}/>`;
  }
  return s;
}

const GRAVITY = -60;
const flight = (v: V3, t: number): V3 => [v[0] * t, v[1] * t, v[2] * t + 0.5 * GRAVITY * t * t];
const landTime = (z0: number, vz: number) => (vz + Math.sqrt(vz * vz - 2 * GRAVITY * z0)) / -GRAVITY;

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

type RadarState = { az: number; el: number; pings: number[]; spark: number; snap: number; smoke: number };

const radar: Rig<RadarState> = (() => {
  const C = [12, 12] as const;
  const HUB = 17.6;
  const PIV: V3 = [12, 12, 27.4];
  const R = 9.6;
  const DEPTH = 3;
  const EL = 30;
  const rest: RadarState = { az: 0, el: EL, pings: [], spark: -1, snap: -1, smoke: -1 };
  function draw(s: RadarState) {
    const p = new Paint();
    const az = (s.az * Math.PI) / 180;
    const fwd: V3 = [Math.cos(az), Math.sin(az), 0];
    const side: V3 = [-Math.sin(az), Math.cos(az), 0];
    const e = (s.el * Math.PI) / 180;
    const n = norm([fwd[0] * Math.cos(e), fwd[1] * Math.cos(e), Math.sin(e)]);
    const up = norm(cross(side, n));
    const hubTop: V3 = [C[0], C[1], HUB + 1.8];
    p.put(-1e3, group('', cylinder([C[0], C[1], HUB], hubTop, 3.4)));
    const rim = add(PIV, n, 1.4);
    const vertex = add(rim, n, -DEPTH);
    const rimPts = circle3(rim, side, up, R, 56);
    const backPts = circle3(add(rim, n, -DEPTH * 0.82), side, up, R * 0.42, 28);
    for (const k of [-1, 1]) {
      const top = add(PIV, side, k * (R + 1.3));
      const foot = add(hubTop, side, k * 2.4);
      const arm = [
        ...circle3(foot, fwd, up, 0.9, 12).map((q): V3 => [q[0], q[1], foot[2]]),
        ...circle3(top, n, up, 0.9, 12),
      ];
      p.put(depth(top), group('acc', solidSvg(arm) + cylinder(add(top, side, -k * 0.6), add(top, side, k * 0.9), 1.5)));
    }
    p.put(depth(hubTop) - 50, group('acc', cylinder(add(hubTop, side, -2.8), add(hubTop, side, 2.8), 1.1)));
    let shell = solidSvg([...rimPts, ...backPts]);
    if (dot(n, VIEW) > 0) {
      shell += loopSvg(rimPts, 'var(--face)');
      for (const [r, dd] of [
        [R * 0.78, 0.55],
        [R * 0.52, 0.8],
        [R * 0.26, 0.95],
      ] as const)
        shell += loopSvg(
          circle3(add(rim, n, -DEPTH * (1 - (r / R) ** 2) * dd), side, up, r, 40),
          'none',
          'var(--detail)',
        );
      shell += loopSvg(circle3(add(vertex, n, 0.1), side, up, 1.4, 20), 'var(--hole)');
    } else {
      shell += loopSvg(circle3(add(rim, n, -DEPTH * 0.55), side, up, R * 0.72, 40), 'none', 'var(--detail)');
      shell += cylinder(add(vertex, n, 0.2), add(vertex, n, -2.2), 2.2);
    }
    p.put(depth(add(rim, n, -DEPTH * 0.5)), group('acc', shell));
    const feedAt = add(rim, n, 8.2);
    let feed = '';
    for (const a of [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6])
      feed += lineSvg([add(add(rim, side, R * 0.94 * Math.cos(a)), up, R * 0.94 * Math.sin(a)), feedAt]);
    feed += frustum(add(feedAt, n, 0.4), add(feedAt, n, -2.6), 1.7, 0.9);
    feed += cylinder(add(feedAt, n, 0.4), add(feedAt, n, 1.6), 1.7);
    p.put(depth(add(rim, n, 4)), group('acc', feed));
    for (const ping of s.pings) {
      if (ping < 0 || ping > 1) continue;
      const k = smooth(0, 0.1, ping) * (1 - smooth(0.3, 0.8, ping));
      const c = add(feedAt, n, 2 + 9 * easeOut(ping));
      const r = 2 + 4.5 * easeOut(ping);
      p.put(depth(c) + 100, group('acc', loopSvg(circle3(c, side, up, r, 40)), `opacity:${f(k)}`));
    }
    p.put(
      1e4,
      burstSvg([C[0], C[1], HUB + 2], s.spark, 0.6) +
        burstSvg(PIV, s.snap, 0.9) +
        puffSvg([C[0], C[1] + 2, HUB + 2], s.smoke),
    );
    return p.out();
  }
  const WORK = 2.8;
  function working(t: number): RadarState {
    const u = (t % WORK) / WORK;
    return { ...rest, az: 360 * u, pings: [0, 0.5].map(o => (((u - o + 1) % 1) * WORK) / 1.6) };
  }
  function grindAngle(t: number) {
    if (t < 1.2) return 300 * easeInOut(t / 1.2) * (t / 1.2);
    if (t >= 2.4) return 360;
    const u = (t - 1.2) / 1.2;
    return 300 + 60 * u + 7 * Math.sin((t - 1.2) * 38) * (1 - u);
  }
  function slumpAngle(a: number) {
    const drop = -38;
    if (a < 0.28) return lerp(EL, drop, (a / 0.28) ** 2);
    if (a >= 1.8) return drop;
    return drop + 9 * Math.exp(-(a - 0.28) * 5) * Math.sin((a - 0.28) * 18);
  }
  function slumpElevation(t: number) {
    if (t <= 2.4) return EL;
    return lerp(slumpAngle(t - 2.4), EL, easeInOut((t - 4.4) / 0.9));
  }
  function failed(t: number): RadarState {
    return {
      ...rest,
      az: grindAngle(t) % 360,
      el: slumpElevation(t),
      spark: t > 1.2 && t < 2.4 ? (t - 1.2) % 0.3 : -1,
      snap: t - 2.4,
      smoke: t - 2.5,
    };
  }
  function settle(from: RadarState, k: number, elapsed: number): RadarState {
    return {
      az: lerp(from.az, from.az > 180 ? 360 : 0, k) % 360,
      el: lerp(from.el, EL, k),
      pings: from.pings.map(ping => ping + elapsed / 1.6),
      spark: age(from.spark, elapsed),
      snap: age(from.snap, elapsed),
      smoke: age(from.smoke, elapsed),
    };
  }
  return { rest, periods: { working: WORK, failed: 5.6 }, draw, working, failed, settle };
})();

type HourglassState = {
  rot: number;
  top: number;
  bot: number;
  stream: number;
  crack: number;
  shatter: number;
  spill: number;
  refill: number;
  fade: number;
  flip: number;
};

type Shard = { pts: V3[]; cen: V3; v: V3; spin: V3; w: number; delay: number };
type Grain = { a: number; sp: number; up: number; delay: number; h: number; r: number };

const hourglass: Rig<HourglassState> = (() => {
  const C = [14, 14] as const;
  const MID: V3 = [14, 14, 18];
  const NECK = 18;
  const RB = 9;
  const RN = 1.3;
  const AXIS: V3 = [1, -1, 0];
  const POUR: V3 = [-2, 12, 2];
  const BREAK: V3 = [C[0] - 1.5, C[1] + 4.8, 25];
  const rest: HourglassState = {
    rot: 0,
    top: 1,
    bot: 0,
    stream: 0,
    crack: 0,
    shatter: -1,
    spill: -1,
    refill: 1,
    fade: 1,
    flip: 0,
  };
  const shards: Shard[] = (() => {
    const out: Shard[] = [];
    const rnd = seeded(11);
    const rings = [32.6, 28.4, 24, 20.6, 18.6];
    const rAt = (z: number) => lerp(RN, RB, (z - NECK) / (32.6 - NECK));
    for (let i = 0; i < rings.length - 1; i++) {
      const n = 7 - i;
      const off = rnd() * 0.6;
      for (let j = 0; j < n; j++) {
        const a0 = ((j + off) / n) * Math.PI * 2;
        const a1 = ((j + 1 + off) / n) * Math.PI * 2;
        const z0 = at(rings, i);
        const z1 = at(rings, i + 1);
        const P = (a: number, z: number): V3 => [C[0] + rAt(z) * Math.cos(a), C[1] + rAt(z) * Math.sin(a), z];
        const am = (a0 + a1) / 2 + (rnd() - 0.5) * 0.3;
        const pts = [P(a0, z0), P(am, z0 - (rnd() - 0.5) * 0.8), P(a1, z0), P(a1, z1), P(a0, z1)];
        const cen = pts.reduce<V3>((s, p) => add(s, p, 1 / pts.length), [0, 0, 0]);
        const dir = norm([Math.cos(am), Math.sin(am), 0]);
        if (dot(dir, VIEW) < 0.05) continue;
        const sp = 5 + rnd() * 5;
        out.push({
          pts,
          cen,
          v: [dir[0] * sp, dir[1] * sp, 3 + rnd() * 6],
          spin: norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]),
          w: 260 + rnd() * 380,
          delay: rnd() * 0.05,
        });
        rnd();
      }
    }
    return out;
  })();
  const grains: Grain[] = (() => {
    const rnd = seeded(5);
    return Array.from({ length: 18 }, () => ({
      a: (rnd() - 0.5) * 0.45 + 1.74,
      sp: 9 + rnd() * 5,
      up: 1 + rnd() * 3,
      delay: rnd() * 1.1,
      h: 24.5 + rnd(),
      r: 0.25 + rnd() * 0.25,
    }));
  })();
  const landAt = add([BREAK[0], BREAK[1], 0], [POUR[0] * landTime(25, POUR[2]), POUR[1] * landTime(25, POUR[2]), 0]);
  function draw(s: HourglassState) {
    const p = new Paint();
    const R = rotAxis(AXIS, s.rot);
    const T = (q: V3) => around(R, MID, q);
    const ex = mul(R, [1, 0, 0]);
    const ey = mul(R, [0, 1, 0]);
    const plate = (z0: number, dir: number) => {
      const a = T([C[0], C[1], z0]);
      const b = T([C[0], C[1], z0 + dir * 2.6]);
      const c = T([C[0], C[1], z0 + dir * 3.4]);
      return cylinder(a, b, 12) + cylinder(b, c, 10.4);
    };
    const facing = dot(norm(mul(R, [0, 0, 1])), VIEW);
    p.put(depth(MID) + (facing < 0 ? 80 : -80), group('', plate(0, 1)));
    p.put(depth(MID) + (facing > 0 ? 80 : -80), group('', plate(36, -1)));
    for (const k of [1, -1]) {
      const a = T([C[0] + k * 9.6, C[1] - k * 9.6, 3.4]);
      const b = T([C[0] + k * 9.6, C[1] - k * 9.6, 32.6]);
      p.put(depth(T([C[0] + k * 9.6, C[1] - k * 9.6, NECK])), group('', cylinder(a, b, 1.1, { cap: false })));
    }
    const bulb = (zBase: number, sign: number, show = 1) => {
      if (show <= 0) return '';
      return group('', frustum(T([C[0], C[1], zBase]), T([C[0], C[1], NECK - sign * 0.9]), RB, RN, 'none'), fade(show));
    };
    const cone = (z0: number, z1: number, r1: number) =>
      frustum(T([C[0], C[1], z0]), T([C[0], C[1], z1]), RN * 0.7, r1) +
      loopSvg(circle3(T([C[0], C[1], z1]), ex, ey, r1, 40), 'var(--face)');
    let glass = '';
    if (s.top > 0.02) {
      const zS = NECK + 1 + 8.6 * Math.sqrt(s.top);
      glass += group('acc', cone(NECK + 0.6, zS, lerp(RN, RB, (zS - NECK) / (32.6 - NECK)) - 0.4));
    }
    if (s.flip > 0) {
      const zS = NECK - 1 - 8.6;
      glass += group(
        'acc',
        cone(NECK - 0.6, zS, lerp(RN, RB, (NECK - zS) / (NECK - 3.4)) - 0.4),
        `opacity:${f(s.flip)}`,
      );
    }
    if (s.bot > 0.02 && s.flip < 1) {
      const h = 8.6 * Math.sqrt(s.bot);
      const pts: V3[] = [];
      for (let i = 0; i <= 10; i++) {
        const k = i / 10;
        const r = (RB - 1.2) * (1 - k * k * 0.92) * Math.min(1, 0.55 + s.bot);
        pts.push(...circle3(T([C[0], C[1], 3.6 + h * k]), ex, ey, Math.max(r, 0.3), 24));
      }
      glass += group(
        'acc',
        solidSvg(pts) + loopSvg(circle3(T([C[0], C[1], 3.6]), ex, ey, RB - 1.2, 40), 'none', 'var(--detail)'),
        s.flip > 0 ? `opacity:${f(1 - s.flip)}` : '',
      );
    }
    if (s.stream > 0) {
      const a = T([C[0], C[1], NECK + 0.2]);
      const b = T([C[0], C[1], 3.6 + 8.6 * Math.sqrt(Math.max(s.bot, 0.02))]);
      glass += group('acc', lineSvg([a, b]), `opacity:${f(s.stream)}`);
    }
    glass += bulb(3.4, -1);
    if (s.shatter < 0) glass += bulb(32.6, 1, s.refill);
    glass += group('', cylinder(T([C[0], C[1], NECK - 1]), T([C[0], C[1], NECK + 1]), 1.7));
    if (s.crack > 0) {
      const pts: V3[] = [
        [C[0] - 2.6, C[1] + 6.8, 29.6],
        [C[0] - 2, C[1] + 5.9, 27.6],
        [C[0] - 1.5, C[1] + 4.8, 25.6],
        [C[0] - 0.6, C[1] + 4.2, 23.8],
        [C[0] - 0.4, C[1] + 3.1, 22.2],
      ];
      const n = Math.max(2, Math.round(pts.length * s.crack));
      const branch: V3[] = [
        [C[0] - 1.5, C[1] + 4.8, 25.6],
        [C[0] + 1, C[1] + 5.2, 26.6],
        [C[0] + 2, C[1] + 6, 28],
      ];
      glass += group('acc', lineSvg(pts.slice(0, n).map(T)) + (s.crack > 0.6 ? lineSvg(branch.map(T)) : ''));
    }
    p.put(depth(MID), glass);
    if (s.shatter >= 0) {
      for (const shard of shards) {
        const t = Math.max(0, s.shatter - shard.delay);
        const tl = landTime(shard.cen[2], shard.v[2]);
        let pos: V3;
        let turn: number;
        if (t < tl) {
          pos = add(shard.cen, flight(shard.v, t));
          turn = shard.w * t;
        } else {
          const land = add(shard.cen, flight(shard.v, tl));
          const slide = 1 - Math.exp(-(t - tl) * 6);
          pos = [land[0] + shard.v[0] * 0.12 * slide, land[1] + shard.v[1] * 0.12 * slide, 0.3];
          turn = shard.w * tl;
        }
        const spin = rotAxis(shard.spin, turn);
        let pts = shard.pts.map(q => add(pos, mul(spin, sub(q, shard.cen))));
        if (t >= tl) {
          const flat = 1 - Math.exp(-(t - tl) * 14);
          pts = pts.map((q): V3 => [q[0], q[1], Math.max(0.2, lerp(q[2], 0.3 + (q[2] - pos[2]) * 0.08, flat))]);
        }
        p.put(depth(pos) + 40 * smooth(0, 0.25, t), group('acc', loopSvg(pts, 'var(--face)'), fade(s.fade)));
      }
    }
    if (s.spill >= 0) {
      const flow = smooth(0, 0.15, s.spill) * (1 - smooth(1.6, 2.2, s.spill));
      if (flow > 0.02) {
        const tl = landTime(BREAK[2], POUR[2]);
        const head = Math.min(tl, s.spill * 1.6);
        const tail = Math.max(0, s.spill - 1.6) * 1.6;
        const left: V2[] = [];
        const right: V2[] = [];
        for (let i = 0; i <= 16; i++) {
          const q = pr(add(BREAK, flight(POUR, lerp(Math.min(tail, head), head, i / 16))));
          const w = (0.25 + 0.35 * (i / 16)) * flow;
          left.push([q[0] - w, q[1]]);
          right.push([q[0] + w, q[1]]);
        }
        p.put(
          1e3,
          group(
            'acc',
            `<path d="${poly([...left, ...right.reverse()])}" fill="var(--line)" stroke="none"/>`,
            fade(s.fade),
          ),
        );
      }
      let landed = 0;
      for (const grain of grains) {
        const t = s.spill - grain.delay;
        if (t < 0) continue;
        const v: V3 = [Math.cos(grain.a) * grain.sp, Math.sin(grain.a) * grain.sp, grain.up];
        const o: V3 = [BREAK[0], BREAK[1], grain.h];
        if (t < landTime(o[2], v[2])) {
          const q = pr(add(o, flight(v, t)));
          p.put(
            1e3,
            group(
              'acc',
              `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(grain.r + 0.25)}" fill="var(--line)"/>`,
              fade(s.fade),
            ),
          );
        } else landed++;
      }
      const amount = clamp(smooth(0.2, 2.2, s.spill) * 0.85 + (landed / grains.length) * 0.15);
      if (amount > 0) {
        const r = 1.5 + 5 * Math.sqrt(amount);
        const h = 0.5 + 3 * amount;
        const pts: V3[] = [];
        for (let i = 0; i <= 8; i++) {
          const k = i / 8;
          pts.push(...circle3([landAt[0], landAt[1], h * k], [1, 0, 0], [0, 1, 0], Math.max(0.2, r * (1 - k * k)), 24));
        }
        p.put(depth(landAt) + 150, group('acc', solidSvg(pts), fade(s.fade)));
      }
    }
    p.put(
      1e4,
      burstSvg([BREAK[0], BREAK[1], 26], s.shatter + 0.0001, 1.1) +
        (s.spill >= 0 ? puffSvg(add(landAt, [0, 0, 1]), s.spill - 0.4, [2, -1, 9]) : ''),
    );
    return p.out();
  }
  const WORK = 5.2;
  function working(t: number): HourglassState {
    const u = t % WORK;
    if (u < 3.6) {
      const k = clamp((u - 0.2) / 3.2);
      return { ...rest, top: 1 - k, bot: k, stream: smooth(0.1, 0.3, u) * (1 - smooth(3.3, 3.5, u)) };
    }
    const k = easeInOut((u - 3.7) / 1.3);
    return { ...rest, top: 0, bot: 1, rot: 180 * k, flip: smooth(0.45, 1, k) };
  }
  function failed(t: number): HourglassState {
    const drain = clamp((t - 0.2) / 3) * 0.35;
    const s: HourglassState = {
      ...rest,
      top: 1 - drain,
      bot: drain,
      stream: smooth(0.1, 0.3, t) * (1 - smooth(0.7, 0.9, t)),
      crack: smooth(1.1, 1.6, t),
      fade: 1 - smooth(4.4, 5, t),
    };
    if (t > 1.7) {
      s.shatter = t - 1.7;
      s.crack = 0;
      s.top = Math.max(0, s.top - smooth(1.7, 2.8, t));
      s.spill = t - 1.75;
    }
    if (t > 5) {
      s.shatter = -1;
      s.spill = -1;
      s.top = smooth(5.1, 5.7, t);
      s.bot = 0;
      s.refill = smooth(5, 5.6, t);
    }
    return s;
  }
  function settle(from: HourglassState, k: number, elapsed: number): HourglassState {
    const broken = from.shatter >= 0;
    return {
      rot: lerp(from.rot, 0, k),
      top: lerp(from.top, 1, k),
      bot: lerp(from.bot, 0, k),
      stream: lerp(from.stream, 0, k),
      crack: lerp(from.crack, 0, k),
      shatter: k < 1 ? age(from.shatter, elapsed) : -1,
      spill: k < 1 ? age(from.spill, elapsed) : -1,
      refill: broken ? k : lerp(from.refill, 1, k),
      fade: from.fade * (1 - k),
      flip: lerp(from.flip, 0, k),
    };
  }
  return { rest, periods: { working: WORK, failed: 5.9 }, draw, working, failed, settle };
})();

type Key = { pos: V3; roll: number; yaw?: number; pitch?: number; o: number; inserted: boolean };
type PadlockState = { lift: number; swing: number; key?: Key; spark: number; click: number };

const padlock: Rig<PadlockState> = (() => {
  const T = 11;
  const CY = 15;
  const HT = 24;
  const SX = 5.5;
  const SR = 8.4;
  const KZ = 11;
  const ZC = HT + 8;
  const rest: PadlockState = { lift: 0, swing: 0, spark: -1, click: -1 };
  const shackle = (lift: number) => {
    const pts: V3[] = [[SX, CY - SR, HT - 5 + lift]];
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI - (i / 24) * Math.PI;
      pts.push([SX, CY + SR * Math.cos(a), ZC + lift + SR * Math.sin(a)]);
    }
    pts.push([SX, CY + SR, HT - 14 + lift]);
    return pts;
  };
  const cutBelow = (pts: readonly V3[], z: number) => {
    const out: V3[] = [];
    const cross = (q: V3, p: V3): V3 => {
      const k = (z - q[2]) / (p[2] - q[2]);
      return [lerp(q[0], p[0], k), lerp(q[1], p[1], k), z];
    };
    pts.forEach((p, i) => {
      const q = i > 0 ? at(pts, i - 1) : undefined;
      if (p[2] >= z) {
        if (q && q[2] < z) out.push(cross(q, p));
        out.push(p);
      } else if (q && q[2] >= z) out.push(cross(q, p));
    });
    return out;
  };
  function keySvg(k: Key) {
    const R = mul3(rotAxis([0, 0, 1], k.yaw ?? 0), mul3(rotAxis([0, 1, 0], k.pitch ?? 0), rotAxis([1, 0, 0], k.roll)));
    const place = (q: V3) => add(k.pos, mul(R, q));
    const near = dot(mul(R, [0, 1, 0]), VIEW) >= 0 ? 1 : -1;
    const side = (sign: number) => (q: V2) => place([q[0], sign * 0.45, q[1]]);
    const slab = (profile: readonly V2[]) => {
      const front = profile.map(side(near));
      return solidSvg([...front, ...profile.map(side(-near))]) + flatSvg(front);
    };
    const x0 = k.inserted ? 0 : Math.max(-6.4, T - k.pos[0]);
    const blade: V2[] = [
      [x0, -1.1],
      [8.4, -1.1],
      [8.4, 1.1],
    ];
    if (x0 < -0.2) {
      const teeth = (
        [
          [-0.4, 1.1],
          [-0.9, 2.2],
          [-2, 2.2],
          [-2.5, 1.5],
          [-3.3, 1.5],
          [-3.8, 2.4],
          [-4.9, 2.4],
          [-5.4, 1.6],
          [-6.4, 1.6],
        ] as const
      ).filter(q => q[0] >= x0 - 0.01);
      blade.push(...teeth);
      const last = teeth[teeth.length - 1];
      if (last && last[0] > x0 + 0.01) blade.push([x0, last[1]]);
    } else blade.push([x0, 1.1]);
    const ring = (r: number, cx = 11.6, n = 40) =>
      Array.from({ length: n }, (_, i): V2 => {
        const a = (i / n) * Math.PI * 2;
        return [cx + r * Math.cos(a), r * Math.sin(a)];
      });
    let svg = slab(blade);
    svg += lineSvg(
      [
        [Math.max(x0, 0.6), 0.1],
        [7.6, 0.1],
      ].map(q => place([at(q, 0), near * 1.02 * 0.45, at(q, 1)])),
      'var(--detail)',
    );
    svg += slab([
      [7.8, -1.6],
      [8.9, -1.6],
      [8.9, 1.6],
      [7.8, 1.6],
    ]);
    svg += slab(ring(3.9));
    svg += flatSvg(ring(2.9).map(side(near * 1.02)), 'none', 'var(--detail)');
    svg += flatSvg(ring(1.3, 12.8, 24).map(side(near * 1.04)), 'var(--hole)');
    return svg;
  }
  function draw(s: PadlockState) {
    const R = rotAxis([0, 0, 1], s.swing);
    const pivot: V3 = [SX, CY + SR, 0];
    const pts = cutBelow(
      shackle(s.lift).map(q => around(R, pivot, q)),
      HT,
    );
    let out = pts.length > 1 ? tubeSvg(pts, 1.7) : '';
    if (s.key) out += group('acc', keySvg(s.key), fade(s.key.o));
    out += burstSvg([T, CY, KZ + 3], s.spark, 0.8);
    if (s.click >= 0 && s.click < 0.4) {
      const q = pr([SX, CY - SR - 2, HT + 3]);
      const k = smooth(0, 0.05, s.click) * (1 - smooth(0.15, 0.4, s.click));
      let d = '';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * (0.15 + i * 0.17);
        const r = 6 + (i % 2) * 2;
        d += `M${f(q[0] + Math.cos(a) * 3)},${f(q[1] + Math.sin(a) * 3)}L${f(q[0] + Math.cos(a) * r)},${f(q[1] + Math.sin(a) * r)}`;
      }
      out += group('acc', `<path d="${d}" fill="none" stroke="var(--line)"${ATTR}/>`, `opacity:${f(k)}`);
    }
    return out;
  }
  const seat: V3 = [T, CY, KZ];
  const far: V3 = [T + 26, CY + 6, KZ + 10];
  const mid: V3 = [T + 12, CY + 2, KZ + 9];
  function approach(t: number): Key {
    const k = easeOut((t - 0.1) / 1);
    const a = 1 - k;
    const pos = add(add(scale(far, a * a), mid, 2 * a * k), seat, k * k);
    return { pos, roll: 0, yaw: 24 * a, o: smooth(0, 0.35, k), inserted: k > 0.98 };
  }
  function shackleRaise(t: number) {
    if (t < 1.62) return 0;
    if (t < 1.75) return easeOut((t - 1.62) / 0.13);
    if (t < 3.9) return 1;
    return 1 - easeInOut((t - 3.9) / 0.3);
  }
  function shackleLift(t: number) {
    const springing = t >= 1.62 && t < 2.1;
    const pop = springing ? Math.exp(-(t - 1.62) * 9) * Math.sin((t - 1.62) * 26) * 1.4 : 0;
    return 8 * shackleRaise(t) + pop;
  }
  function turningKey(t: number): Key {
    if (t < 1.1) return approach(t);
    if (t < 4.6) {
      const roll = -90 * easeInOut((t - 1.25) / 0.4) * (1 - easeInOut((t - 3.9) / 0.35));
      return { pos: seat, roll, o: 1, inserted: true };
    }
    const k = easeInOut((t - 4.6) / 0.6);
    return {
      pos: add(seat, [1, 0.25, 0.4], 18 * k * k),
      roll: 0,
      yaw: 10 * k,
      o: 1 - smooth(0.4, 1, k),
      inserted: k < 0.05,
    };
  }
  function working(t: number): PadlockState {
    return {
      ...rest,
      key: turningKey(t),
      click: t - 1.62,
      lift: shackleLift(t),
      swing: -105 * easeInOut((t - 2.1) / 0.6) * (1 - easeInOut((t - 3.2) / 0.55)),
    };
  }
  function jammedKey(t: number): Key {
    if (t < 1.1) return approach(t);
    if (t < 2.3) {
      const a = t - 1.25;
      const roll = a < 0 ? 0 : -16 * Math.abs(Math.sin(a * 7.5)) * (1 - smooth(0.9, 1.05, a));
      return { pos: seat, roll, o: 1, inserted: true };
    }
    const a = t - 2.3;
    const v: V3 = [13, 4, 8];
    const tl = (v[2] + Math.sqrt(v[2] * v[2] - 2 * GRAVITY * (KZ - 1))) / -GRAVITY;
    if (a < tl) {
      return {
        pos: add(add(seat, [7 * smooth(0, 0.12, a), 0, 0]), flight(v, a)),
        roll: 90 * smooth(0.2, 1, a / tl),
        pitch: 360 * easeInOut(clamp((a / tl - 0.3) / 0.7)),
        o: 1,
        inserted: false,
      };
    }
    const b = a - tl;
    const land = add(add(seat, [7, 0, 0]), flight(v, tl));
    const slide = 1 - Math.exp(-b * 6);
    return {
      pos: [
        land[0] + 1.6 * slide,
        land[1] + 0.5 * slide,
        land[2] + Math.abs(Math.sin(b * 16)) * Math.exp(-b * 9) * 1.2,
      ],
      roll: 90,
      pitch: 360,
      o: 1 - smooth(1.1, 1.6, b),
      inserted: false,
    };
  }
  function rattle(t: number) {
    const a = t - 1.25;
    if (t < 1.1 || t >= 2.3 || a <= 0) return 0;
    return 0.6 * Math.abs(Math.sin(a * 15)) * (1 - smooth(0.6, 1.05, a));
  }
  function failed(t: number): PadlockState {
    return { ...rest, key: jammedKey(t), lift: rattle(t), spark: t - 2.22 };
  }
  function settle(from: PadlockState, k: number, elapsed: number): PadlockState {
    return {
      lift: lerp(from.lift, 0, k),
      swing: lerp(from.swing, 0, k),
      key: from.key && k < 1 ? { ...from.key, o: from.key.o * (1 - k) } : undefined,
      spark: age(from.spark, elapsed),
      click: age(from.click, elapsed),
    };
  }
  return { rest, periods: { working: 5.4, failed: 4.8 }, draw, working, failed, settle };
})();

type Card = { pos: V3; R: M3; o: number };
type TurnstileState = { th: number; lamp: number; card?: Card; hit: number };

const turnstile: Rig<TurnstileState> = (() => {
  const HUB: V3 = [6, 14, 20];
  const AX = norm([0, 1, -1]);
  const U1: V3 = [1, 0, 0];
  const U2 = norm(cross(AX, U1));
  const ARM = 15;
  const FACE = add(HUB, AX, 2.2);
  const rest: TurnstileState = { th: 0, lamp: 0, hit: -1 };
  const arms = (th: number) =>
    [0, 1, 2].map(i => {
      const t = ((-90 + th + i * 120) * Math.PI) / 180;
      return norm(add(scale(AX, 0.707), add(scale(U1, Math.cos(t)), U2, Math.sin(t)), 0.707));
    });
  function cardSvg(card: Card) {
    const w = 7.4;
    const h = 10;
    const ax = mul(card.R, [1, 0, 0]);
    const ay = mul(card.R, [0, 1, 0]);
    const an = mul(card.R, [0, 0, 1]);
    const near = dot(an, VIEW) >= 0 ? 1 : -1;
    const P = (u: number, v: number, side: number) => add(add(add(card.pos, ax, u), ay, v), an, side * 0.3);
    const quad = (side: number) => [
      P(-w / 2, -h / 2, side),
      P(w / 2, -h / 2, side),
      P(w / 2, h / 2, side),
      P(-w / 2, h / 2, side),
    ];
    const F = (u: number, v: number) => P(u, v, near * 1.05);
    const rect = (u0: number, v0: number, u1: number, v1: number, fill: string, stroke = 'var(--line)') =>
      `<path d="${roundedPath([F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1)].map(pr), 0.6)}" fill="${fill}" stroke="${stroke}"${ATTR}/>`;
    let svg = solidSvg([...quad(1), ...quad(-1)]) + flatSvg(quad(near));
    svg += rect(-1.2, h / 2 - 1.6, 1.2, h / 2 - 0.9, 'var(--hole)');
    svg += rect(-w / 2 + 1, -0.6, -w / 2 + 4.2, h / 2 - 2.6, 'var(--hole)');
    svg += lineSvg(
      [F(-w / 2 + 1.7, -0.2), F(-w / 2 + 1.9, 0.8), F(-w / 2 + 3.3, 0.8), F(-w / 2 + 3.5, -0.2)],
      'var(--detail)',
    );
    svg += loopSvg(
      circle3(F(-w / 2 + 2.6, 1.8), sub(F(1, 0), F(0, 0)), sub(F(0, 1), F(0, 0)), 0.75, 16),
      'none',
      'var(--detail)',
    );
    for (const [v, len] of [
      [h / 2 - 3.2, 3.2],
      [h / 2 - 4.6, 2.4],
      [0.4, 3],
    ] as const)
      svg += lineSvg([F(-w / 2 + 5, v), F(-w / 2 + 5 + len, v)], 'var(--detail)');
    svg += rect(-w / 2 + 1, -h / 2 + 0.9, w / 2 - 1, -h / 2 + 1.9, 'none', 'var(--detail)');
    return svg;
  }
  function draw(s: TurnstileState) {
    const p = new Paint();
    const [b1, b2] = basis(AX);
    const boss: V3 = [HUB[0], 15, HUB[2] + 0.6];
    let head = cylinder([HUB[0], 14, HUB[2] + 0.6], boss, 3.9);
    head += loopSvg(circle3(add(boss, [0, 0.02, 0]), [1, 0, 0], [0, 0, 1], 3.1, 40), 'none', 'var(--detail)');
    head += frustum(add(HUB, AX, 0.6), FACE, 3.4, 3.1);
    head += loopSvg(circle3(FACE, b1, b2, 3.1, 40), 'var(--face)');
    head += loopSvg(circle3(add(FACE, AX, 0.05), b1, b2, 2.3, 32), 'none', 'var(--detail)');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const q = pr(add(add(add(FACE, AX, 0.08), b1, 2.7 * Math.cos(a)), b2, 2.7 * Math.sin(a)));
      head += `<circle cx="${f(q[0])}" cy="${f(q[1])}" r=".35" fill="var(--line)"/>`;
    }
    p.put(depth(add(HUB, AX, 0.88)), group('', head));
    const cap = add(FACE, AX, 0.9);
    p.put(
      depth(cap) + 0.2,
      group('acc', frustum(FACE, cap, 1.7, 1.2) + loopSvg(circle3(cap, b1, b2, 1.2, 24), 'var(--face)')),
    );
    for (const d of arms(s.th)) {
      const root = add(add(FACE, AX, -0.9), d, 1.4);
      const a = add(root, d, 1.4);
      const b = add(root, d, ARM);
      let arm = frustum(root, a, 1.45, 0.95) + cylinder(a, add(b, d, -0.6), 0.85, { cap: false });
      arm += frustum(add(b, d, -0.6), add(b, d, 0.2), 0.85, 0.55);
      arm += lineSvg([add(root, d, 5.6), add(root, d, 5.7)], 'var(--detail)');
      const [c1, c2] = basis(d);
      const grip = circle3(add(root, d, ARM - 2.2), c1, c2, 0.87, 24).filter((_, i) => i > 5 && i < 19);
      arm += lineSvg(grip, 'var(--detail)');
      p.put(depth(add(root, d, ARM * 0.5)) + (dot(d, VIEW) > 0 ? 0.5 : -0.5), group('acc', arm));
    }
    let out = p.out();
    if (s.lamp > 0) {
      const lamp: V3[] = [
        [2.4, 10.4, 27.85],
        [9.6, 10.4, 27.85],
        [9.6, 12.2, 27.85],
        [2.4, 12.2, 27.85],
      ];
      out += group('acc', flatSvg(lamp, 'var(--line)'), `opacity:${f(s.lamp)}`);
    }
    if (s.card) out += group('acc', cardSvg(s.card), fade(s.card.o));
    out += burstSvg(add(FACE, [0, 1, 0], 2), s.hit, 0.8);
    return out;
  }
  const tap: V3 = [6, 6.5, 30.2];
  const far: V3 = [20, 2, 40];
  const mid: V3 = [12, 4, 38];
  const flat = (yaw = 0, roll = 0) => mul3(rotAxis([0, 0, 1], yaw), rotAxis([1, 0, 0], roll));
  function approach(t: number): Card {
    const k = easeOut((t - 0.1) / 0.85);
    const a = 1 - k;
    return {
      pos: add(add(scale(far, a * a), mid, 2 * a * k), tap, k * k),
      R: flat(-30 * a, 25 * a),
      o: smooth(0, 0.3, k),
    };
  }
  const dip = (t: number) => Math.sin(clamp((t - 1) / 0.25) * Math.PI) * 1.4;
  function acceptedCard(t: number): Card | undefined {
    if (t < 1) return approach(t);
    if (t < 1.25) return { pos: add(tap, [0, 0, -dip(t)]), R: flat(), o: 1 };
    if (t >= 2) return undefined;
    const k = easeInOut((t - 1.25) / 0.75);
    return { pos: add(tap, [10, -3, 8], k), R: flat(-20 * k, 20 * k), o: 1 - smooth(0.3, 1, k) };
  }
  function working(t: number): TurnstileState {
    const card = acceptedCard(t);
    const a = Math.max(0, t - 1.3);
    const zeta = 0.72;
    const omega = 8;
    const damped = omega * Math.sqrt(1 - zeta * zeta);
    const th =
      120 *
      (1 -
        Math.exp(-zeta * omega * a) *
          (Math.cos(damped * a) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(damped * a)));
    return { ...rest, card, th, lamp: t > 1.12 ? 1 - smooth(3, 3.3, t) : 0 };
  }
  function deniedLamp(t: number) {
    if (t <= 1.12 || t >= 2.6) return 0;
    return Math.floor((t - 1.12) / 0.18) % 2 === 0 ? 1 : 0.15;
  }
  function jolt(a: number) {
    if (a < 0) return 0;
    if (a < 0.14) return 11 * easeOut(a / 0.14);
    return 11 * Math.exp(-(a - 0.14) * 7) * Math.cos((a - 0.14) * 24);
  }
  function rejectedCard(t: number): Card {
    if (t < 1) return approach(t);
    if (t < 1.5) return { pos: add(tap, [0, 0, t < 1.25 ? -dip(t) : 0]), R: flat(), o: 1 };
    const a = t - 1.5;
    const v: V3 = [14, 6, 6];
    const tl = landTime(tap[2] - 0.4, v[2]);
    if (a < tl) return { pos: add(tap, flight(v, a)), R: flat((-40 * a) / tl, (160 * a) / tl), o: 1 };
    const b = a - tl;
    const land = add(tap, flight(v, tl));
    return {
      pos: [land[0] + 1.2 * (1 - Math.exp(-b * 7)), land[1], 0.4 + Math.abs(Math.sin(b * 14)) * Math.exp(-b * 9)],
      R: flat(-40, 180),
      o: 1 - smooth(1, 1.5, b),
    };
  }
  function failed(t: number): TurnstileState {
    return { card: rejectedCard(t), lamp: deniedLamp(t), th: jolt(t - 1.3), hit: t - 1.44 };
  }
  function settle(from: TurnstileState, k: number, elapsed: number): TurnstileState {
    return {
      th: lerp(from.th, Math.round(from.th / 120) * 120, k),
      lamp: lerp(from.lamp, 0, k),
      card: from.card && k < 1 ? { ...from.card, o: from.card.o * (1 - k) } : undefined,
      hit: age(from.hit, elapsed),
    };
  }
  return { rest, periods: { working: 3.6, failed: 4.2 }, draw, working, failed, settle };
})();

type Player = {
  frame: (mode: RigMode | undefined, dt: number) => string | undefined;
};

function player<S>(rig: Rig<S>): Player {
  let state = rig.rest;
  let mode: RigMode | undefined;
  let time = 0;
  let leaving: { from: S; elapsed: number } | undefined;
  return {
    frame(next, dt) {
      if (next !== mode) {
        if (next) {
          time = 0;
          leaving = undefined;
        } else if (mode) leaving = { from: state, elapsed: 0 };
        mode = next;
      }
      if (mode) {
        time = (time + dt) % rig.periods[mode];
        state = rig[mode](time);
      } else if (leaving) {
        leaving.elapsed += dt;
        const k = easeOut(leaving.elapsed / SETTLE_SECONDS);
        state = k < 1 ? rig.settle(leaving.from, k, leaving.elapsed) : rig.rest;
        if (k >= 1) leaving = undefined;
      } else return undefined;
      return rig.draw(state);
    },
  };
}

const rigs = { radar, hourglass, padlock, turnstile } as const;

const isRigName = (name: string | undefined): name is RigName => name !== undefined && name in rigs;

export function restFrame(name: RigName) {
  switch (name) {
    case 'radar':
      return radar.draw(radar.rest);
    case 'hourglass':
      return hourglass.draw(hourglass.rest);
    case 'padlock':
      return padlock.draw(padlock.rest);
    case 'turnstile':
      return turnstile.draw(turnstile.rest);
  }
}

export function rigFrame(name: RigName, mode: RigMode, time: number) {
  switch (name) {
    case 'radar':
      return radar.draw(radar[mode](time));
    case 'hourglass':
      return hourglass.draw(hourglass[mode](time));
    case 'padlock':
      return padlock.draw(padlock[mode](time));
    case 'turnstile':
      return turnstile.draw(turnstile[mode](time));
  }
}

export function rigPeriod(name: RigName, mode: RigMode) {
  return rigs[name].periods[mode];
}

function playerFor(name: RigName): Player {
  switch (name) {
    case 'radar':
      return player(radar);
    case 'hourglass':
      return player(hourglass);
    case 'padlock':
      return player(padlock);
    case 'turnstile':
      return player(turnstile);
  }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function modeOf(art: HTMLElement): RigMode | undefined {
  if (reducedMotion()) return undefined;
  const failed = art.dataset.state === 'failed';
  const live = art.hasAttribute('data-live') || art.dataset.state === 'working';
  if (!live) return undefined;
  return failed ? 'failed' : 'working';
}

export function playRigs(art: HTMLElement) {
  const parts = [...art.querySelectorAll<SVGGElement>('g[data-rig]')].flatMap(element => {
    const name = element.dataset.rig;
    return isRigName(name) ? [{ element, play: playerFor(name), drawn: element.innerHTML }] : [];
  });
  if (parts.length === 0) return () => {};
  let frame = 0;
  let last = 0;
  const tick = (now: number) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const mode = modeOf(art);
    let moving = false;
    for (const part of parts) {
      const svg = part.play.frame(mode, dt);
      if (svg === undefined) continue;
      moving = true;
      if (svg !== part.drawn) {
        part.element.innerHTML = svg;
        part.drawn = svg;
      }
    }
    frame = moving ? requestAnimationFrame(tick) : 0;
    if (!moving) last = 0;
  };
  const wake = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const observer = new MutationObserver(wake);
  observer.observe(art, { attributes: true, attributeFilter: ['data-live', 'data-state'] });
  wake();
  return () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
}
