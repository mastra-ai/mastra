import fs from 'node:fs';
import path from 'node:path';
const LOGOS = JSON.parse(fs.readFileSync(new URL('./logos.json', import.meta.url), 'utf8'));
type P = [number, number];
type W = [number, number, number];
const K = 0.884,
  H = 0.442,
  Z = 1.25;
let MIRROR = false;
const SCALE = 1.12;
const pr = ([x, y, z]: W): P => (MIRROR ? [(x - y) * K, (x + y) * H - z * Z] : [(y - x) * K, (x + y) * H - z * Z]);
const f = (n: number) => +n.toFixed(1);
type K = {
  t: number;
  fl?: number;
  fy?: number;
  fz?: number;
  p?: W;
  q?: [number, number];
  r?: number;
  o?: number;
  s?: number;
  sx?: number;
  sy?: number;
  d?: number;
  od?: number;
  e?: string;
};
const flipM = (deg: number) => {
  const th = (deg * Math.PI) / 180,
    c = Math.cos(th),
    s = Math.sin(th);
  const o = pr([0, 0, 0]),
    e1 = pr([1, 0, 0]),
    e2 = pr([0, 1, 0]),
    e3 = pr([0, c, s]);
  const B = [
      [e1[0] - o[0], e2[0] - o[0]],
      [e1[1] - o[1], e2[1] - o[1]],
    ],
    Bp = [
      [e1[0] - o[0], e3[0] - o[0]],
      [e1[1] - o[1], e3[1] - o[1]],
    ];
  const det = B[0][0] * B[1][1] - B[0][1] * B[1][0];
  const iv = [
    [B[1][1] / det, -B[0][1] / det],
    [-B[1][0] / det, B[0][0] / det],
  ];
  const m = (i: number, j: number) => Bp[i][0] * iv[0][j] + Bp[i][1] * iv[1][j];
  return `matrix(${+m(0, 0).toFixed(4)},${+m(1, 0).toFixed(4)},${+m(0, 1).toFixed(4)},${+m(1, 1).toFixed(4)},0,0)`;
};
const flipYM = (deg: number) => {
  const th = (deg * Math.PI) / 180,
    c = Math.cos(th),
    s = Math.sin(th);
  const o = pr([0, 0, 0]),
    e1 = pr([1, 0, 0]),
    e2 = pr([0, 1, 0]),
    e3 = pr([c, 0, s]);
  const B = [
      [e1[0] - o[0], e2[0] - o[0]],
      [e1[1] - o[1], e2[1] - o[1]],
    ],
    Bp = [
      [e3[0] - o[0], e2[0] - o[0]],
      [e3[1] - o[1], e2[1] - o[1]],
    ];
  const det = B[0][0] * B[1][1] - B[0][1] * B[1][0];
  const iv = [
    [B[1][1] / det, -B[0][1] / det],
    [-B[1][0] / det, B[0][0] / det],
  ];
  const m = (i: number, j: number) => Bp[i][0] * iv[0][j] + Bp[i][1] * iv[1][j];
  return `matrix(${+m(0, 0).toFixed(4)},${+m(1, 0).toFixed(4)},${+m(0, 1).toFixed(4)},${+m(1, 1).toFixed(4)},0,0)`;
};
const flipZM = (deg: number) => {
  const th = (deg * Math.PI) / 180,
    c = Math.cos(th),
    s = Math.sin(th);
  const o = pr([0, 0, 0]),
    e2 = pr([0, 1, 0]),
    e3 = pr([0, 0, 1]),
    e2r = pr([-s, c, 0]);
  const B = [
      [e2[0] - o[0], e3[0] - o[0]],
      [e2[1] - o[1], e3[1] - o[1]],
    ],
    Bp = [
      [e2r[0] - o[0], e3[0] - o[0]],
      [e2r[1] - o[1], e3[1] - o[1]],
    ];
  const det = B[0][0] * B[1][1] - B[0][1] * B[1][0];
  const iv = [
    [B[1][1] / det, -B[0][1] / det],
    [-B[1][0] / det, B[0][0] / det],
  ];
  const m = (i: number, j: number) => Bp[i][0] * iv[0][j] + Bp[i][1] * iv[1][j];
  return `matrix(${+m(0, 0).toFixed(4)},${+m(1, 0).toFixed(4)},${+m(0, 1).toFixed(4)},${+m(1, 1).toFixed(4)},0,0)`;
};
const OUT = 'cubic-bezier(.22,1,.36,1)',
  IN = 'cubic-bezier(.55,0,1,.45)',
  IO = 'cubic-bezier(.45,0,.55,1)',
  LIN = 'linear',
  STEP = 'steps(1,end)',
  ACC = 'cubic-bezier(.4,0,1,1)';
function hull(points: P[]): P[] {
  const s = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (inp: P[]) => {
    const r: P[] = [];
    for (const p of inp) {
      while (r.length > 1) {
        const a = r[r.length - 2],
          b = r[r.length - 1];
        if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 0) break;
        r.pop();
      }
      r.push(p);
    }
    return r.slice(0, -1);
  };
  return [...half(s), ...half([...s].reverse())];
}
function rounded(pts: P[], r = 2.2) {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i],
      a = pts[(i - 1 + n) % n],
      b = pts[(i + 1) % n];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1,
      db = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const ra = Math.min(r, da / 2.2) / da,
      rb = Math.min(r, db / 2.2) / db;
    const s = [p[0] + (a[0] - p[0]) * ra, p[1] + (a[1] - p[1]) * ra],
      e = [p[0] + (b[0] - p[0]) * rb, p[1] + (b[1] - p[1]) * rb];
    d += (i ? 'L' : 'M') + f(s[0]) + ',' + f(s[1]) + 'Q' + f(p[0]) + ',' + f(p[1]) + ' ' + f(e[0]) + ',' + f(e[1]);
  }
  return d + 'Z';
}
const poly = (pts: P[]) => 'M' + pts.map(p => f(p[0]) + ',' + f(p[1])).join('L') + 'Z';
const S = ' stroke-width="1" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"';
const STROKE = S;
const GM = 3.2;
class D {
  els: string[] = [];
  bb = [1e9, 1e9, -1e9, -1e9];
  css: string[] = [];
  fdur = 4.6;
  ground: P[][] = [];
  quiet = 0;
  foot(z: number, pts: W[]) {
    if (z <= 3.2 && !this.quiet) this.ground.push(pts.map(([x, y]) => pr([x, y, 0])));
  }
  cast(pts: W[]) {
    this.ground.push(pts.map(([x, y]) => pr([x, y, 0])));
  }
  disc(cx: number, cy: number, r: number): W[] {
    return Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a), 0] as W;
    });
  }
  track(ps: P[]) {
    for (const p of ps) {
      this.bb[0] = Math.min(this.bb[0], p[0]);
      this.bb[1] = Math.min(this.bb[1], p[1]);
      this.bb[2] = Math.max(this.bb[2], p[0]);
      this.bb[3] = Math.max(this.bb[3], p[1]);
    }
  }
  open(cls: string, shift?: W) {
    const s = shift ? pr(shift) : null;
    this.els.push(`<g class="${cls}"${s ? ` style="--shift:${f(s[0])}px ${f(s[1])}px"` : ''}>`);
  }
  close() {
    this.els.push('</g>');
  }
  box(x: number, y: number, z: number, w: number, d: number, h: number, o: { creases?: boolean; r?: number } = {}) {
    const t = z + h;
    {
      const m = GM;
      this.foot(z, [
        [x - m, y - m, 0],
        [x + w + m, y - m, 0],
        [x + w + m, y + d + m, 0],
        [x - m, y + d + m, 0],
      ]);
    }
    const v: W[] = [
      [x, y, z],
      [x + w, y, z],
      [x + w, y + d, z],
      [x, y + d, z],
      [x, y, t],
      [x + w, y, t],
      [x + w, y + d, t],
      [x, y + d, t],
    ];
    const sil = hull(v.map(pr));
    this.track(sil);
    this.els.push(`<path d="${rounded(sil, o.r)}" fill="var(--face)" stroke="var(--line)"${S}/>`);
    if (o.creases !== false) {
      const a = pr([x + 2, y + d, t]),
        c = pr([x + w, y + d, t]),
        b = pr([x + w, y + 2, t]),
        p1 = pr([x + w - 2, y + d, t]),
        p2 = pr([x + w, y + d - 2, t]);
      this.els.push(
        `<path d="M${f(a[0])},${f(a[1])}L${f(p1[0])},${f(p1[1])}Q${f(c[0])},${f(c[1])} ${f(p2[0])},${f(p2[1])}L${f(b[0])},${f(b[1])}" fill="none" stroke="var(--line)"${S}/>`,
      );
    }
  }
  to(face: 'y' | 'x' | 'top', k: number, u: number, v: number): W {
    return face === 'y' ? [u, k, v] : face === 'x' ? [k, u, v] : [u, v, k];
  }
  lines(face: 'y' | 'x' | 'top', k: number, segs: number[][], color = 'var(--detail)') {
    const d = segs
      .map(([u1, v1, u2, v2]) => {
        const a = pr(this.to(face, k, u1, v1)),
          b = pr(this.to(face, k, u2, v2));
        return `M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}`;
      })
      .join('');
    this.els.push(`<path d="${d}" fill="none" stroke="${color}"${S}/>`);
  }
  quad(
    face: 'y' | 'x' | 'top',
    k: number,
    u1: number,
    v1: number,
    u2: number,
    v2: number,
    o: { fill?: string; stroke?: boolean } = {},
  ) {
    const pts = [
      this.to(face, k, u1, v1),
      this.to(face, k, u2, v1),
      this.to(face, k, u2, v2),
      this.to(face, k, u1, v2),
    ].map(pr);
    this.els.push(
      `<path d="${rounded(pts, 1.6)}" fill="${o.fill ?? 'var(--hole)'}"${o.stroke === false ? ' stroke="none"' : ` stroke="var(--line)"${S}`}/>`,
    );
  }
  facePoly(pts: W[], fill = 'var(--face)') {
    this.els.push(`<path d="${poly(pts.map(pr))}" fill="${fill}" stroke="none"/>`);
  }
  outline(pts: W[]) {
    this.els.push(`<path d="${rounded(hull(pts.map(pr)))}" fill="none" stroke="var(--line)"${S}/>`);
  }
  link(a: W, b: W, packets: [number, string][], bend = 0.6) {
    const p = pr(a),
      q = pr(b);
    this.track([p, q]);
    const d = this.linkPath(a, b, bend);
    this.els.push(`<path d="${d}" fill="none" stroke="var(--line)" stroke-dasharray="3 4"${S}/>`);
    packets.forEach(([t, c], i) =>
      this.els.push(
        `<g class="packet" style="offset-path:path('${d}');--at:${Math.round(t * 100)}%;--delay:${f(-i * 1.2)}s"><circle r="2.6" fill="${c}"/></g>`,
      ),
    );
  }
  clip(id: string, pts: W[]) {
    this.els.push(`<clipPath id="${id}"><path d="${poly(hull(pts.map(pr)))}"/></clipPath><g clip-path="url(#${id})">`);
  }
  token(kind: string, at: W) {
    const sub = new D();
    sub.shape(kind, at);
    this.els.push(...sub.els);
  }
  shape(kind: string, at: W) {
    const [x, y, z] = at;
    if (kind === 'tile') this.box(x - 3.5, y - 3.5, z, 7, 7, 1.6, { creases: false });
    else if (kind === 'bar') this.box(x - 1.6, y - 1.6, z, 3.2, 3.2, 7, { creases: false });
    else {
      const c = pr(at),
        rx = 4.4,
        ry = 2.2,
        t = 2;
      const cx = f(c[0]),
        cy = f(c[1]);
      this.els.push(
        `<path d="M${f(c[0] - rx)},${cy}L${f(c[0] - rx)},${f(c[1] - t)}A${rx} ${ry} 0 0 1 ${f(c[0] + rx)},${f(c[1] - t)}L${f(c[0] + rx)},${cy}A${rx} ${ry} 0 0 1 ${f(c[0] - rx)},${cy}Z" fill="var(--face)" stroke="var(--line)"${S}/><ellipse cx="${cx}" cy="${f(c[1] - t)}" rx="${rx}" ry="${ry}" fill="none" stroke="var(--line)"${S}/>`,
      );
    }
  }
  chute(a: W, b: W, kind: string, n: number, bend = 0.55) {
    const p = pr(a),
      q = pr(b);
    this.track([p, q]);
    const c1: P = [p[0], p[1] + (q[1] - p[1]) * bend],
      c2: P = [q[0], q[1] - (q[1] - p[1]) * 0.6];
    const d = `M${f(p[0])},${f(p[1])}C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(q[0])},${f(q[1])}`;
    this.els.push(`<path d="${d}" fill="none" stroke="var(--line)" stroke-dasharray="3 4"${S}/>`);
    for (let i = 0; i < n; i++) {
      const sub = new D();
      sub.shape(kind, [0, 0, 0]);
      this.els.push(
        `<g class="packet acc" style="offset-path:path('${d}');--at:${Math.round(((i + 1) / (n + 1)) * 100)}%;--delay:${f((-i * 2.4) / n)}s"><g>${sub.els.join('')}</g></g>`,
      );
    }
  }
  cyl(cx: number, cy: number, z: number, r: number, h: number, o: { top?: boolean; fill?: string } = {}) {
    this.foot(z, this.disc(cx, cy, r + GM));
    const b = pr([cx, cy, z]),
      t = pr([cx, cy, z + h]),
      rx = f(r * Math.SQRT2 * K),
      ry = f(r * Math.SQRT2 * H);
    this.track([
      [b[0] - rx, b[1] + ry],
      [b[0] + rx, b[1] + ry],
      [t[0] - rx, t[1] - ry],
      [t[0] + rx, t[1] - ry],
    ]);
    this.els.push(
      `<path d="M${f(t[0] - rx)},${f(t[1])}A${rx} ${ry} 0 0 1 ${f(t[0] + rx)},${f(t[1])}L${f(b[0] + rx)},${f(b[1])}A${rx} ${ry} 0 0 1 ${f(b[0] - rx)},${f(b[1])}Z" fill="${o.fill ?? 'var(--face)'}" stroke="var(--line)"${S}/>`,
    );
    if (o.top !== false)
      this.els.push(
        `<ellipse cx="${f(t[0])}" cy="${f(t[1])}" rx="${rx}" ry="${ry}" fill="${o.fill ?? 'var(--face)'}" stroke="var(--line)"${S}/>`,
      );
  }
  cone(cx: number, cy: number, z: number, r0: number, r1: number, h: number, o: { top?: boolean; fill?: string } = {}) {
    this.foot(z, this.disc(cx, cy, r0 + GM));
    const b = pr([cx, cy, z]),
      t = pr([cx, cy, z + h]),
      k2 = Math.SQRT2,
      rx0 = f(r0 * k2 * K),
      ry0 = f(r0 * k2 * H),
      rx1 = f(r1 * k2 * K),
      ry1 = f(r1 * k2 * H);
    this.track([
      [b[0] - rx0, b[1] + ry0],
      [b[0] + rx0, b[1] + ry0],
      [t[0] - rx1, t[1] - ry1],
      [t[0] + rx1, t[1] - ry1],
    ]);
    this.els.push(
      `<path d="M${f(t[0] - rx1)},${f(t[1])}A${rx1} ${ry1} 0 0 1 ${f(t[0] + rx1)},${f(t[1])}L${f(b[0] + rx0)},${f(b[1])}A${rx0} ${ry0} 0 0 1 ${f(b[0] - rx0)},${f(b[1])}Z" fill="${o.fill ?? 'var(--face)'}" stroke="var(--line)"${S}/>`,
    );
    if (o.top !== false)
      this.els.push(
        `<ellipse cx="${f(t[0])}" cy="${f(t[1])}" rx="${rx1}" ry="${ry1}" fill="${o.fill ?? 'var(--face)'}" stroke="var(--line)"${S}/>`,
      );
  }
  mound(cx: number, cy: number, z: number, r: number, h: number) {
    const b = pr([cx, cy, z]),
      t = pr([cx, cy, z + h]),
      rx = r * Math.SQRT2 * K,
      ry = r * Math.SQRT2 * H,
      dy = b[1] - t[1];
    this.track([
      [b[0] - rx, b[1] + ry],
      [b[0] + rx, b[1] + ry],
      [t[0], t[1]],
    ]);
    const d = `M${f(b[0] - rx)},${f(b[1])}C${f(b[0] - rx * 0.55)},${f(b[1] - dy * 0.75)} ${f(t[0] - rx * 0.38)},${f(t[1])} ${f(t[0])},${f(t[1])}C${f(t[0] + rx * 0.38)},${f(t[1])} ${f(b[0] + rx * 0.55)},${f(b[1] - dy * 0.75)} ${f(b[0] + rx)},${f(b[1])}A${f(rx)} ${f(ry)} 0 0 1 ${f(b[0] - rx)},${f(b[1])}Z`;
    this.els.push(`<path d="${d}" fill="var(--face)" stroke="var(--line)"${S}/>`);
  }
  hc(x0: number, z0: number, y: number, r: number, n = 48): W[] {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [x0 + r * Math.cos(a), y, z0 + r * Math.sin(a)] as W;
    });
  }
  hcyl(x0: number, z0: number, y0: number, y1: number, r: number, r1 = r) {
    this.solid([...this.hc(x0, z0, y0, r), ...this.hc(x0, z0, y1, r1)]);
    const e = this.hc(x0, z0, y1, r1).map(pr);
    this.els.push(`<path d="${poly(e)}" fill="var(--face)" stroke="var(--line)"${S}/>`);
  }
  hseam(x0: number, z0: number, y: number, r: number, color = 'var(--detail)') {
    const a0 = Math.atan2(0.707, 1);
    const pts: W[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = a0 - Math.PI / 2 + (i / 24) * Math.PI;
      pts.push([x0 + r * Math.cos(a), y, z0 + r * Math.sin(a)]);
    }
    this.zig(pts, color);
  }
  ring(cx: number, cy: number, z: number, r: number, color = 'var(--detail)') {
    const c = pr([cx, cy, z]),
      rx = f(r * Math.SQRT2 * K),
      ry = f(r * Math.SQRT2 * H);
    this.els.push(
      `<path d="M${f(c[0] - rx)},${f(c[1])}A${rx} ${ry} 0 0 0 ${f(c[0] + rx)},${f(c[1])}" fill="none" stroke="${color}"${S}/>`,
    );
  }
  hole(cx: number, cy: number, z: number, r: number) {
    this.foot(z, this.disc(cx, cy, r + GM));
    const c = pr([cx, cy, z]);
    this.els.push(
      `<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(r * Math.SQRT2 * K)}" ry="${f(r * Math.SQRT2 * H)}" fill="var(--hole)" stroke="var(--line)"${S}/>`,
    );
  }
  circleClip(id: string, cx: number, cy: number, z: number, r: number, up = 120) {
    const pts: W[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z], [cx + r * Math.cos(a), cy + r * Math.sin(a), z + up]);
    }
    this.clip(id, pts);
  }
  cable(pts: W[]) {
    const p = pts.map(pr);
    let d = `M${f(p[0][0])},${f(p[0][1])}`;
    for (let i = 1; i + 2 < p.length + 1; i += 3)
      d += `C${f(p[i][0])},${f(p[i][1])} ${f(p[i + 1][0])},${f(p[i + 1][1])} ${f(p[i + 2][0])},${f(p[i + 2][1])}`;
    this.track(p);
    this.els.push(`<path d="${d}" fill="none" stroke="var(--line)"${S}/>`);
  }
  rays(c: W, r1: number, r2: number, n = 8, cls = 'rays acc') {
    const p = pr(c);
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      d += `M${f(p[0] + Math.cos(a) * r1)},${f(p[1] + Math.sin(a) * r1 * 0.8)}L${f(p[0] + Math.cos(a) * r2)},${f(p[1] + Math.sin(a) * r2 * 0.8)}`;
    }
    this.track([
      [p[0] - r2, p[1] - r2],
      [p[0] + r2, p[1] + r2],
    ]);
    this.els.push(`<g class="${cls}"><path d="${d}" fill="none" stroke="var(--line)"${S}/></g>`);
  }
  clipU(id: string, groups: W[][]) {
    this.els.push(
      `<clipPath id="${id}">${groups.map(g => `<path d="${poly(hull(g.map(pr)))}"/>`).join('')}</clipPath><g clip-path="url(#${id})">`,
    );
  }
  g(cls: string, vars: Record<string, string | W> = {}) {
    const st = Object.entries(vars)
      .map(([k, v]) => `--${k}:${Array.isArray(v) ? this.vec(v) : v}`)
      .join(';');
    this.els.push(`<g class="${cls}"${st ? ` style="${st}"` : ''}>`);
  }
  vec(w: W) {
    const a = pr([0, 0, 0]),
      b = pr(w);
    return `${f(b[0] - a[0])}px ${f(b[1] - a[1])}px`;
  }
  logo(name: string, k: number, u0: number, v0: number, size: number, fill = 'var(--logo)') {
    const L = LOGOS[name];
    const vb = +L.vb.split(' ')[2];
    const sc = size / vb;
    this.els.push(
      `<path d="${L.d}" fill="${fill}" transform="matrix(${+(K * sc).toFixed(5)},${+(H * sc).toFixed(5)},0,${+(Z * sc).toFixed(5)},${f(K * (u0 - k))},${f(H * (k + u0) - Z * v0)})"/>`,
    );
  }
  solid(pts: W[]) {
    const p = hull(pts.map(pr));
    this.track(p);
    this.els.push(`<path d="${rounded(p)}" fill="var(--face)" stroke="var(--line)"${S}/>`);
  }
  wad(at: W, r = 6) {
    const c = pr(at);
    const R = [1, 0.82, 0.97, 0.78, 1.05, 0.86, 0.95, 0.74, 1.02, 0.88, 0.92];
    const pts: P[] = R.map((k, i) => {
      const a = (i / R.length) * Math.PI * 2;
      return [c[0] + Math.cos(a) * r * k, c[1] + Math.sin(a) * r * k * 0.9];
    });
    this.track(pts);
    this.els.push(`<path d="${rounded(pts, 1.2)}" fill="var(--face)" stroke="var(--line)"${S}/>`);
    const cr = [
      [
        [-0.55, -0.35],
        [-0.1, 0.05],
        [0.35, -0.45],
      ],
      [
        [-0.2, 0.55],
        [0.05, 0.1],
        [0.6, 0.25],
      ],
      [
        [-0.65, 0.3],
        [-0.25, 0.2],
      ],
    ];
    this.els.push(
      `<path d="${cr.map(l => 'M' + l.map(([u, v]) => f(c[0] + u * r) + ',' + f(c[1] + v * r)).join('L')).join('')}" fill="none" stroke="var(--detail)"${S}/>`,
    );
  }
  fail(fn: () => void, cls = '') {
    this.els.push(`<g class="fail${cls ? ' ' + cls : ''}">`);
    this.quiet++;
    fn();
    this.quiet--;
    this.els.push('</g>');
  }
  ok(fn: () => void) {
    this.els.push('<g class="okonly">');
    this.quiet++;
    fn();
    this.quiet--;
    this.els.push('</g>');
  }
  zig(pts: W[], color = 'var(--line)') {
    const p = pts.map(pr);
    this.els.push(`<path d="M${p.map(q => f(q[0]) + ',' + f(q[1])).join('L')}" fill="none" stroke="${color}"${S}/>`);
  }
  sheet(pts: W[]) {
    const p = pts.map(pr);
    this.track(p);
    this.els.push(
      `<path d="M${p.map(q => f(q[0]) + ',' + f(q[1])).join('L')}Z" fill="var(--face)" stroke="var(--line)"${S}/>`,
    );
  }
  dot(at: W, r = 2.4) {
    const p = pr(at);
    this.els.push(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="var(--line)"/>`);
  }
  spark(at: W) {
    const p = pr(at);
    let dd = '';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * (0.05 + i * 0.15);
      dd += `M${f(p[0] + Math.cos(a) * 3)},${f(p[1] + Math.sin(a) * 3)}L${f(p[0] + Math.cos(a) * (7 + (i % 2) * 3))},${f(p[1] + Math.sin(a) * (7 + (i % 2) * 3))}`;
    }
    this.els.push(`<g class="acc blinkr"><path d="${dd}" fill="none" stroke="var(--line)"${S}/></g>`);
  }
  stream(travel: W, dur: number, delay = 0, ease = 'linear') {
    const a = pr([0, 0, 0]),
      b = pr(travel);
    this.els.push(
      `<g class="stream" style="--travel:${f(b[0] - a[0])}px ${f(b[1] - a[1])}px;--dur:${dur}s;--delay:${f(delay)}s;--ease:${ease}">`,
    );
  }
  fx(
    id: string,
    keys: K[],
    draw: () => void,
    o: { pivot?: W; cls?: string; style?: string; when?: 'ok' | 'err' | 'any'; dur?: number } = {},
  ) {
    const ks = [...keys].sort((a, b) => a.t - b.t);
    const m: K[] = [];
    for (const k of ks) {
      const l = m[m.length - 1];
      if (l && Math.abs(l.t - k.t) < 1e-6) Object.assign(l, k);
      else m.push({ ...k });
    }
    if (m[0].t !== 0) m.unshift({ ...m[0], t: 0 });
    const hasD = m.some(k => k.d !== undefined),
      hasOd = m.some(k => k.od !== undefined),
      hasFl = m.some(k => k.fl !== undefined),
      hasFy = m.some(k => k.fy !== undefined),
      hasFz = m.some(k => k.fz !== undefined);
    if (hasD && m[0].d === undefined) m[0].d = m.find(k => k.d !== undefined)?.d;
    if (hasOd && m[0].od === undefined) m[0].od = m.find(k => k.od !== undefined)?.od;
    let cur: any = { p: [0, 0, 0], q: [0, 0], r: 0, o: 1, sx: 1, sy: 1, fl: 0, fy: 0, fz: 0 };
    const full = m.map(k => {
      cur = { ...cur };
      if (k.p) cur.p = k.p;
      if (k.q) cur.q = k.q;
      if (k.r !== undefined) cur.r = k.r;
      if (k.o !== undefined) cur.o = k.o;
      if (k.s !== undefined) {
        cur.sx = k.s;
        cur.sy = k.s;
      }
      if (k.sx !== undefined) cur.sx = k.sx;
      if (k.sy !== undefined) cur.sy = k.sy;
      if (k.d !== undefined) cur.d = k.d;
      if (k.od !== undefined) cur.od = k.od;
      if (k.fl !== undefined) cur.fl = k.fl;
      if (k.fy !== undefined) cur.fy = k.fy;
      if (k.fz !== undefined) cur.fz = k.fz;
      return { ...cur, t: k.t, e: k.e ?? IO };
    });
    if (full[full.length - 1].t < 100) full.push({ ...full[0], t: 100 });
    const o0 = pr([0, 0, 0]);
    const tr = (k: any): [number, number] => {
      const q = pr(k.p);
      return [q[0] - o0[0] + k.q[0], q[1] - o0[1] + k.q[1]];
    };
    const decl = (k: any) => {
      const v = tr(k);
      return `translate:${f(v[0])}px ${f(v[1])}px;rotate:${f(k.r)}deg;scale:${+k.sx.toFixed(3)} ${+k.sy.toFixed(3)};opacity:${+k.o.toFixed(3)}${hasD ? `;stroke-dashoffset:${+k.d.toFixed(3)}` : ''}${hasOd ? `;offset-distance:${f(k.od)}%` : ''}${hasFl ? `;transform:${flipM(k.fl)}` : hasFy ? `;transform:${flipYM(k.fy)}` : hasFz ? `;transform:${flipZM(k.fz)}` : ''}`;
    };
    const cls = 'fx-' + id,
      pv = o.pivot ? pr(o.pivot) : o0;
    const okm = o.when === 'ok',
      any = o.when === 'any',
      sr = any ? '.card' : okm ? '.card:not([data-tone=error])' : '.card[data-tone=error]',
      sl = any
        ? '.card:is([data-live],[data-pending])'
        : okm
          ? '.card:not([data-tone=error]):is([data-live],[data-pending])'
          : '.card[data-tone=error][data-live]';
    this.css.push(
      `${sr} .${cls}{transform-origin:${f(pv[0])}px ${f(pv[1])}px;${decl(full[0])}}${sl} .${cls}{animation:${cls} ${o.dur ?? this.fdur}s infinite}@keyframes ${cls}{${full.map(k => `${+k.t.toFixed(2)}%{${decl(k)};animation-timing-function:${k.e}}`).join('')}}`,
    );
    const saved = this.bb;
    this.bb = [1e9, 1e9, -1e9, -1e9];
    this.els.push(`<g class="fx ${cls}${o.cls ? ' ' + o.cls : ''}"${o.style ? ` style="${o.style}"` : ''}>`);
    this.quiet++;
    draw();
    this.quiet--;
    this.els.push('</g>');
    const c = this.bb;
    this.bb = saved;
    if (c[0] < 1e8) {
      this.track([
        [c[0], c[1]],
        [c[2], c[3]],
      ]);
      for (const k of full) {
        const v = tr(k);
        if (o.style) continue;
        this.track([
          [c[0] + v[0], c[1] + v[1]],
          [c[2] + v[0], c[3] + v[1]],
        ]);
      }
    }
  }
  arc(t0: number, t1: number, a: W, b: W, h: number, r0 = 0, r1 = 0, n = 6): K[] {
    const ks: K[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      ks.push({
        t: t0 + (t1 - t0) * u,
        p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u + 4 * h * u * (1 - u)],
        r: r0 + (r1 - r0) * u,
        e: LIN,
      });
    }
    return ks;
  }
  drop(t0: number, t1: number, a: W, b: W, r0 = 0, r1 = 0): K[] {
    return this.arc(t0, t1, a, b, (a[2] - b[2]) / 4, r0, r1);
  }
  land(t: number, at: W, r = 0, amp = 1.6, dur = 5): K[] {
    return [
      { t, p: at, r, e: OUT },
      { t: t + dur * 0.45, p: [at[0], at[1], at[2] + amp], r, e: IN },
      { t: t + dur, p: at, r, e: OUT },
    ];
  }
  sfall(t0: number, t1: number, qF: [number, number], hop = 6, n = 5): K[] {
    const ks: K[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      ks.push({ t: t0 + (t1 - t0) * u, q: [qF[0] * u, qF[1] * u * u - 4 * hop * u * (1 - u)], e: LIN });
    }
    ks[n].e = OUT;
    ks.push({ t: t1 + 2, q: [qF[0], qF[1] - 2.5], e: IN }, { t: t1 + 4, q: qF });
    return ks;
  }
  linkCtl(a: W, b: W, bend: number) {
    const p = pr(a),
      q = pr(b);
    return [
      p,
      [p[0] + (q[0] - p[0]) * 0.1, p[1] + (q[1] - p[1]) * bend],
      [q[0] - (q[0] - p[0]) * bend, q[1] - (q[1] - p[1]) * 0.05],
      q,
    ] as P[];
  }
  linkPath(a: W, b: W, bend: number) {
    const [p, c1, c2, q] = this.linkCtl(a, b, bend);
    return `M${f(p[0])},${f(p[1])}C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(q[0])},${f(q[1])}`;
  }
  linkPoint(a: W, b: W, bend: number, frac: number): P {
    const c = this.linkCtl(a, b, bend);
    const at = (u: number): P =>
      [0, 1].map(
        i => (1 - u) ** 3 * c[0][i] + 3 * (1 - u) ** 2 * u * c[1][i] + 3 * (1 - u) * u * u * c[2][i] + u ** 3 * c[3][i],
      ) as P;
    const pts = Array.from({ length: 201 }, (_, i) => at(i / 200));
    const L = [0];
    for (let i = 1; i < pts.length; i++)
      L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const T = L[200] * frac;
    const i = L.findIndex(x => x >= T);
    return pts[Math.max(0, i)];
  }
  ink(face: 'y' | 'x' | 'top', k: number, segs: number[][]) {
    for (const [u1, v1, u2, v2] of segs) {
      const a = pr(this.to(face, k, u1, v1)),
        b = pr(this.to(face, k, u2, v2));
      this.els.push(
        `<path d="M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}" pathLength="1" stroke-dasharray="1" fill="none" stroke="var(--line)"${S}/>`,
      );
    }
  }
  inkPts(pts: W[]) {
    const p = pts.map(pr);
    this.els.push(
      `<path d="M${p.map(q => f(q[0]) + ',' + f(q[1])).join('L')}" pathLength="1" stroke-dasharray="1" fill="none" stroke="var(--line)"${S}/>`,
    );
  }
  puff(id: string, at: W, t0: number, drift: W = [2, -2, 16]) {
    [0, 1, 2].forEach(i => {
      const c: W = [at[0] + i * 1.6 - 1.6, at[1] - i, at[2] + i * 1.2];
      const tt = t0 + i * 3;
      this.fx(
        id + i,
        [
          { t: 0, o: 0, s: 0.5 },
          { t: tt, o: 0, s: 0.5, p: [0, 0, 0], e: OUT },
          {
            t: tt + 4,
            o: 0.9,
            s: 1,
            p: [drift[0] * 0.2, drift[1] * 0.2, drift[2] * 0.2],
            e: 'cubic-bezier(.2,.6,.4,1)',
          },
          { t: tt + 26, o: 0, s: 2, p: drift, e: STEP },
          { t: Math.min(99.5, tt + 27), o: 0, s: 0.5, p: [0, 0, 0] },
        ],
        () => {
          const q = pr(c);
          this.els.push(`<circle cx="${f(q[0])}" cy="${f(q[1])}" r="3" fill="none" stroke="var(--smoke)"${S}/>`);
        },
        { pivot: c },
      );
    });
  }
  burst(id: string, at: W, t0: number, big = 1) {
    const q = pr(at);
    let dd = '';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2,
        r2 = 7 + (i % 2) * 2.5;
      dd += `M${f(q[0] + Math.cos(a) * 3.5)},${f(q[1] + Math.sin(a) * 3)}L${f(q[0] + Math.cos(a) * r2)},${f(q[1] + Math.sin(a) * r2 * 0.85)}`;
    }
    this.fx(
      id,
      [
        { t: 0, o: 0, s: 0.4 },
        { t: t0, o: 0, s: 0.4, e: OUT },
        { t: t0 + 1.2, o: 1, s: 0.9 * big, e: 'cubic-bezier(.2,.7,.4,1)' },
        { t: t0 + 7, o: 0, s: 1.3 * big, e: STEP },
        { t: t0 + 7.5, o: 0, s: 0.4 },
      ],
      () => {
        this.els.push(`<g class="acc"><path d="${dd}" fill="none" stroke="var(--line)"${S}/></g>`);
      },
      { pivot: at },
    );
  }
  lampFx(id: string, tf: number, draw: () => void, pre: K[] = []) {
    this.fx(
      id,
      [
        { t: 0, o: 1 },
        { t: 10, o: 0, e: STEP },
        ...pre,
        { t: tf, o: 0, e: STEP },
        { t: tf + 0.1, o: 1, e: STEP },
        { t: tf + 3, o: 0.12, e: STEP },
        { t: tf + 6, o: 1, e: STEP },
        { t: tf + 9, o: 0.12, e: STEP },
        { t: tf + 12, o: 1 },
      ],
      () => {
        this.open('acc');
        draw();
        this.close();
      },
    );
  }
  flight(
    t0: number,
    t1: number,
    a: W,
    c: W,
    b: W,
    o: { fl0?: number; fl1?: number; o0?: number; oFull?: number; n?: number } = {},
  ): K[] {
    const n = o.n ?? 24,
      ks: K[] = [];
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
      sm = (x: number) => {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
      };
    for (let i = 0; i <= n; i++) {
      const s = i / n,
        u = ease(s);
      const p: W = [0, 1, 2].map(j => (1 - u) ** 2 * a[j] + 2 * (1 - u) * u * c[j] + u * u * b[j]) as W;
      ks.push({
        t: t0 + (t1 - t0) * s,
        p,
        fl: (o.fl0 ?? 0) + ((o.fl1 ?? 90) - (o.fl0 ?? 0)) * sm((u - 0.12) / 0.8),
        o: (o.o0 ?? 0) + (1 - (o.o0 ?? 0)) * sm(u / (o.oFull ?? 0.4)),
        e: LIN,
      });
    }
    return ks;
  }
  faceG(face: 'x' | 'y' | 'top', k: number, u0: number, v0: number) {
    const P = (u: number, v: number): W => (face === 'x' ? [k, u, v] : face === 'y' ? [u, k, v] : [u, v, k]);
    const o = pr(P(u0, v0)),
      eu = pr(P(u0 + 1, v0)),
      ev = pr(P(u0, face === 'top' ? v0 + 1 : v0 - 1));
    this.els.push(
      `<g transform="matrix(${+(eu[0] - o[0]).toFixed(4)},${+(eu[1] - o[1]).toFixed(4)},${+(ev[0] - o[0]).toFixed(4)},${+(ev[1] - o[1]).toFixed(4)},${f(o[0])},${f(o[1])})">`,
    );
  }
  rot(
    id: string,
    keys: { t: number; a: number; e?: string }[],
    draw: () => void,
    o: { when?: 'ok' | 'err'; dur?: number } = {},
  ) {
    const okm = o.when === 'ok',
      sr = okm ? '.card:not([data-tone=error])' : '.card[data-tone=error]',
      sl = okm ? '.card:not([data-tone=error]):is([data-live],[data-pending])' : '.card[data-tone=error][data-live]';
    const ks = [...keys].sort((a, b) => a.t - b.t);
    if (ks[0].t !== 0) ks.unshift({ ...ks[0], t: 0 });
    if (ks[ks.length - 1].t < 100) ks.push({ ...ks[0], t: 100 });
    const cls = 'fx-' + id;
    this.css.push(
      `.${cls}{transform-box:view-box;transform-origin:0px 0px}${sr} .${cls}{rotate:${ks[0].a}deg}${sl} .${cls}{animation:${cls} ${o.dur ?? this.fdur}s infinite}@keyframes ${cls}{${ks.map(k => `${+k.t.toFixed(2)}%{rotate:${k.a}deg;animation-timing-function:${k.e ?? IO}}`).join('')}}`,
    );
    this.els.push(`<g class="fx ${cls}">`);
    this.quiet++;
    draw();
    this.quiet--;
    this.els.push('</g>');
  }
  shadow() {
    if (!this.ground.length) return '';
    const SX = 6.5,
      SY = 2,
      PAD = 0.6;
    const hulls = this.ground.map(fp => hull(fp));
    const bbox = (h: P[]) => [
      Math.min(...h.map(p => p[0])),
      Math.min(...h.map(p => p[1])),
      Math.max(...h.map(p => p[0])),
      Math.max(...h.map(p => p[1])),
    ];
    const par = hulls.map((_, i) => i),
      root = (i: number): number => (par[i] === i ? i : (par[i] = root(par[i])));
    const bb = hulls.map(bbox);
    for (let a = 0; a < hulls.length; a++)
      for (let b = a + 1; b < hulls.length; b++) {
        const A = bb[a],
          B = bb[b];
        if (A[0] - 6 < B[2] && B[0] - 6 < A[2] && A[1] - 6 < B[3] && B[1] - 6 < A[3]) par[root(a)] = root(b);
      }
    const groups = new Map<number, P[]>();
    hulls.forEach((h, i) => {
      const r = root(i);
      groups.set(r, [...(groups.get(r) ?? []), ...h]);
    });
    const blob = (pts: P[]) => {
      const h = hull([...pts, ...pts.map(([x, y]) => [x + SX, y + SY] as P)]);
      const cx = h.reduce((a, p) => a + p[0], 0) / h.length,
        cy = h.reduce((a, p) => a + p[1], 0) / h.length;
      const out = h
        .flatMap((p, i) => {
          const q = h[(i + 1) % h.length];
          return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as P];
        })
        .map(([x, y]) => {
          const dx = x - cx,
            dy = y - cy,
            l = Math.hypot(dx, dy) || 1;
          return [x + (dx / l) * PAD, y + (dy / l) * PAD] as P;
        });
      const n = out.length;
      let d = `M${f(out[0][0])},${f(out[0][1])}`;
      for (let k = 0; k < n; k++) {
        const p0 = out[(k - 1 + n) % n],
          p1 = out[k],
          p2 = out[(k + 1) % n],
          p3 = out[(k + 2) % n];
        d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
      }
      this.track(out);
      const ox = cx - SX / 2,
        oy = cy - SY / 2;
      return { d: d + 'Z', poly: out, cx: ox, cy: oy, r: Math.max(...out.map(p => Math.hypot(p[0] - ox, p[1] - oy))) };
    };
    const blobs = [...groups.values()].map(blob);
    return `<defs><pattern id="gh" patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)"><line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" stroke-opacity=".42" stroke-width=".34"/></pattern>${blobs.map((b, k) => `<radialGradient id="gg${k}" gradientUnits="userSpaceOnUse" cx="${f(b.cx)}" cy="${f(b.cy)}" r="${f(b.r)}"><stop offset=".2" stop-color="#fff"/><stop offset=".9" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="gm${k}" maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800"><rect x="-400" y="-400" width="800" height="800" fill="url(#gg${k})"/></mask>`).join('')}</defs><g class="ground">${blobs.map((b, k) => `<path mask="url(#gm${k})" d="${b.d}" fill="url(#gh)"/>`).join('')}</g>`;
  }
  svg(maxW: number, maxH: number, name: string, pad = 10) {
    const sh = this.shadow();
    const [x0, y0, x1, y1] = this.bb;
    const w = x1 - x0 + pad * 2,
      h = y1 - y0 + pad * 2;
    const k = SCALE;
    return `<svg class="art" data-illustration="${name}" aria-hidden="true" width="${f(w * k)}" height="${f(h * k)}" viewBox="${f(x0 - pad)} ${f(y0 - pad)} ${f(w)} ${f(h)}">${this.css.length ? `<style>${this.css.join('')}</style>` : ''}${sh}${this.els.join('')}</svg>`;
  }
}
const PK = 'var(--packet)';
function dial(
  d: D,
  R: number,
  id: string | null,
  keys: { t: number; a: number; e?: string }[] | null,
  rest: number,
  o: { when?: 'ok' | 'err'; dur?: number } = {},
) {
  const pt = (a: number, r: number) => {
    const q = ((a - 90) * Math.PI) / 180;
    return `${f(Math.cos(q) * r)},${f(Math.sin(q) * r)}`;
  };
  d.els.push(`<circle r="${R}" fill="var(--face)" stroke="var(--line)"${S}/>`);
  let tk = '';
  for (let a = -135; a <= 135; a += 27) tk += `M${pt(a, R * 0.7)}L${pt(a, R * 0.84)}`;
  d.els.push(`<path d="${tk}" fill="none" stroke="var(--detail)"${S}/>`);
  d.open('acc');
  d.els.push(
    `<path d="M${pt(60, R * 0.84)}A${f(R * 0.84)} ${f(R * 0.84)} 0 0 1 ${pt(135, R * 0.84)}" fill="none" stroke="var(--line)"${S}/>`,
  );
  const ndl = () => d.els.push(`<path d="M0,${f(R * 0.18)}L0,${f(-R * 0.74)}" fill="none" stroke="var(--line)"${S}/>`);
  if (id && keys) d.rot(id, keys, ndl, o);
  else {
    d.els.push(`<g transform="rotate(${rest})">`);
    ndl();
    d.els.push('</g>');
  }
  d.close();
  d.els.push(`<circle r="${f(R * 0.13)}" fill="var(--line)"/>`);
}

function knowledge() {
  MIRROR = true;
  const d = new D();
  d.box(0, 0, 0, 56, 40, 64);
  d.quad('y', 40, 4, 36, 52, 58);
  d.quad('y', 40, 4, 6, 52, 28);
  d.lines('y', 40, [[22, 22, 34, 22]]);
  d.track([pr([4, 66, 36]), pr([52, 66, 36]), pr([4, 66, 58])]);
  const bay: W[] = [
    [4, 40, 36],
    [52, 40, 36],
    [52, 40, 58],
    [4, 40, 58],
    [4, 130, 36],
    [52, 130, 36],
    [52, 130, 58],
    [4, 130, 58],
  ];
  const drawer = () => {
    d.box(4, 12, 36.5, 48, 28, 21, { creases: false });
    d.quad('top', 57.5, 6, 14, 50, 38, { stroke: false });
    for (const y of [17, 22, 27, 32]) d.box(8, y, 50, 40, 1.2, 7, { creases: false });
    d.box(30, 22, 57, 8, 1.2, 1.5, { creases: false });
  };
  const front = () => {
    d.quad('y', 40, 4, 36.5, 52, 57.5, { fill: 'var(--face)' });
    d.lines('y', 40, [[22, 50, 34, 50]]);
  };
  const sheet = () => {
    d.box(-56, 2, 71.2, 22, 10, 0.6, { creases: false });
    d.lines('top', 71.8, [
      [-52, 4.5, -52, 9.5],
      [-48, 4.5, -48, 8],
    ]);
  };
  const piv: W = [-45, 2, 71.2];
  d.ok(() => {
    d.clip('kn-bay', bay);
    d.g('acc created hold', { shift: [0, 24, 0] });
    drawer();
    front();
    d.close();
    d.close();
    const q = (pts: W[]) => poly(pts.map(pr));
    d.els.push(
      `<mask id="kn-mask" maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800"><rect x="-400" y="-400" width="800" height="800" fill="white"/><path d="${q(
        [
          [4, 64, 36.5],
          [52, 64, 36.5],
          [52, 64, 57.5],
          [4, 64, 57.5],
        ],
      )}" fill="black"/><path d="${q([
        [52, 36, 36.5],
        [52, 64, 36.5],
        [52, 64, 57.5],
        [52, 36, 57.5],
      ])}" fill="black"/></mask><g mask="url(#kn-mask)">`,
    );
    const over: W = [71, 58, -9.5],
      into: W = [71, 58, -21.2];
    d.fx(
      'kn-sheet',
      [
        ...d.flight(0, 36, [0, 0, 0], [18, 14, 26], over),
        { t: 36, e: IN },
        { t: 44, p: into, fl: 90, o: 1, e: STEP },
        { t: 44.1, o: 0 },
        { t: 99.9, p: [0, 0, 0], fl: 0, o: 0, e: STEP },
      ],
      () => {
        d.open('acc');
        sheet();
        d.close();
      },
      { pivot: piv, when: 'ok', dur: 3 },
    );
    d.close();
  });
  d.fail(() => {
    d.clip('kn-bay2', bay);
    d.els.push(
      `<g style="translate:${d.vec([0, 10, 0])};rotate:-1.2deg;transform-box:view-box;transform-origin:${(() => {
        const q = pr([28, 40, 36.5]);
        return f(q[0]) + 'px ' + f(q[1]) + 'px';
      })()}">`,
    );
    d.open('acc');
    drawer();
    front();
    d.close();
    d.close();
    d.close();
    const hit: W = [71, 58, -9.5],
      fl: W = [76, 44, -70.9];
    const fall: K[] = Array.from({ length: 13 }, (_, i) => {
      const u = i / 12;
      return {
        t: 26 + (36 - 26) * u,
        p: [hit[0] + (fl[0] - hit[0]) * u, hit[1] + (fl[1] - hit[1]) * u, hit[2] + (fl[2] - hit[2]) * u * u] as W,
        fl: 90 - 90 * u,
        r: -10 * u,
        e: i < 12 ? LIN : OUT,
      };
    });
    d.fx(
      'kn-sheet2',
      [
        ...d.flight(0, 26, [0, 0, 0], [18, 14, 26], hit, { fl1: 90, n: 20 }).map(k => ({ ...k, r: 0 })),
        ...fall.slice(1),
        { t: 39.5, p: [fl[0], fl[1], fl[2] + 1.3], e: IN },
        { t: 42, p: fl, fl: 0, r: -10, o: 1, e: IO },
        { t: 62 },
        { t: 74, o: 0, e: STEP },
        { t: 99.9, p: [0, 0, 0], fl: 0, r: 0, o: 0, e: STEP },
      ],
      () => {
        d.open('acc');
        sheet();
        d.close();
      },
      { pivot: piv },
    );
    d.burst('kn-hit', [52, 52, 50], 25.5, 0.8);
  });
  MIRROR = false;
  return d.svg(300, 230, 'knowledge');
}
function workspaces() {
  MIRROR = true;
  const d = new D();
  d.box(4, 4, 0, 6, 40, 30, { creases: false });
  d.box(64, 4, 0, 28, 40, 30);
  d.lines('y', 44, [
    [67, 20, 89, 20],
    [73, 25, 83, 25],
    [73, 12, 83, 12],
  ]);
  d.box(0, 0, 30, 96, 48, 4);
  d.open('acc');
  d.box(14, 10, 34, 16, 10, 1.5, { creases: false });
  d.box(20, 13, 35.5, 4, 3, 4, { creases: false });
  d.box(4, 8, 39, 36, 4, 27);
  d.quad('y', 12, 7, 42, 37, 63);
  d.lines('y', 12, [
    [10, 48, 13, 46],
    [13, 46, 10, 44],
  ]);
  d.open('cursor');
  d.lines('y', 12, [[15, 44, 20, 44]]);
  d.close();
  const scr: W[] = [
    [8, 12, 50],
    [36, 12, 50],
    [36, 12, 61.5],
    [8, 12, 61.5],
  ];
  const rows = (n: number) =>
    d.lines(
      'y',
      12,
      Array.from({ length: n }, (_, k) => {
        const v = 34 + k * 4,
          len = [16, 10, 22, 13][k % 4];
        return [10, v, 10 + len, v];
      }),
    );
  d.ok(() => {
    d.clip('ws-screen', scr);
    d.stream([0, 0, 16], 3.2, 0, 'steps(4,end)');
    rows(8);
    d.close();
    d.close();
  });
  d.box(52, 20, 34, 32, 22, 2);
  d.box(52, 20, 36, 11, 5, 1.5, { creases: false });
  d.box(56, 26, 36, 32, 20, 2);
  d.lines('top', 38, [
    [60, 32, 80, 32],
    [60, 37, 74, 37],
  ]);
  d.close();
  d.fail(() => {
    d.clip('ws-screen2', scr);
    d.fx(
      'ws-lines',
      [
        { t: 0, p: [0, 0, 16], o: 1 },
        { t: 7, o: 0 },
        { t: 12, p: [0, 0, 0], o: 0, e: OUT },
        { t: 16, o: 1, e: STEP },
        { t: 22, e: STEP },
        { t: 26, p: [0, 0, 4], e: STEP },
        { t: 30, p: [0, 0, 8], e: STEP },
        { t: 34, p: [0, 0, 12], e: STEP },
        { t: 38, p: [0, 0, 16] },
      ],
      () => {
        d.open('acc');
        rows(10);
        d.close();
      },
    );
    d.fx(
      'ws-err',
      [
        { t: 0, o: 1, sx: 1 },
        { t: 6, o: 0 },
        { t: 38, o: 0, sx: 0.02, e: STEP },
        { t: 38.2, o: 1, e: OUT },
        { t: 42, sx: 1 },
      ],
      () => {
        d.open('acc');
        d.quad('y', 12, 10, 50.6, 30, 52.6, { fill: 'var(--line)', stroke: false });
        d.close();
      },
      { pivot: [10, 12, 51.6] },
    );
    d.fx(
      'ws-x',
      [
        { t: 0, d: 0, o: 1 },
        { t: 6, o: 0 },
        { t: 12, d: 1, e: STEP },
        { t: 14, o: 1 },
        { t: 44, d: 1, e: OUT },
        { t: 49, d: 0 },
      ],
      () => {
        d.open('acc');
        d.ink('y', 12, [
          [17, 53.5, 26, 60.5],
          [17, 60.5, 26, 53.5],
        ]);
        d.close();
      },
    );
    d.close();
    d.puff('ws-smoke', [78, 44, 24], 46, [-2, 4, 16]);
  });
  MIRROR = false;
  return d.svg(300, 230, 'workspaces');
}
function environments() {
  const d = new D();
  d.box(0, 0, 0, 40, 46, 66);
  d.lines('top', 66, [
    [30, 6, 30, 40],
    [24, 6, 24, 22],
  ]);
  d.lines('y', 46, [
    [6, 54, 30, 54],
    [6, 50, 20, 50],
  ]);
  for (const [v1, v2] of [
    [46, 58],
    [28, 40],
    [10, 22],
  ])
    d.quad('x', 40, 4, v1, 42, v2);
  d.lines('x', 40, [
    [8, 34, 20, 34],
    [8, 16, 16, 16],
  ]);
  const bay: W[] = [
    [40, 4, 46.5],
    [40, 42, 46.5],
    [40, 42, 57.5],
    [40, 4, 57.5],
    [90, 4, 46.5],
    [90, 42, 46.5],
    [90, 42, 57.5],
    [90, 4, 57.5],
  ];
  const dr = () => {
    d.box(15, 6, 47, 26, 34, 10);
    d.lines('x', 41, [[12, 52, 30, 52]]);
  };
  d.ok(() => {
    d.clip('env-bay', bay);
    d.g('acc created drawer', { shift: [16, 0, 0] });
    dr();
    d.close();
    d.close();
  });
  d.fail(() => {
    d.clipU('env-bay2', [
      bay,
      [
        [41, 4, 36],
        [41, 42, 36],
        [41, 4, 58],
        [41, 42, 58],
        [90, 4, 36],
        [90, 42, 36],
        [90, 4, 58],
        [90, 42, 58],
      ],
    ]);
    d.fx(
      'env-dr',
      [
        { t: 0, p: [8, 0, 0], r: -6 },
        { t: 12, p: [0, 0, 0], r: 0 },
        { t: 20, e: ACC },
        { t: 31, p: [9.2, 0, 0], e: OUT },
        { t: 33, p: [8.2, 0, 0], r: -1.5, e: IN },
        { t: 38, r: -7, e: OUT },
        { t: 41, r: -5.4 },
        { t: 44, r: -6 },
      ],
      () => {
        d.open('acc');
        dr();
        d.close();
      },
      { pivot: [40, 23, 47] },
    );
    d.close();
    d.burst('env-hit', [40, 23, 52], 31, 0.8);
    d.lampFx('env-lamp', 33, () => d.quad('x', 40, 33, 61, 38, 63.5, { fill: 'var(--line)', stroke: false }));
    d.puff('env-smoke', [40, 23, 58], 35, [4, -3, 15]);
  });
  return d.svg(220, 190, 'environments');
}
function upgrade() {
  MIRROR = true;
  const d = new D();
  d.box(0, 0, 0, 60, 44, 40);
  d.box(12, 10, 40, 36, 24, 1, { creases: false });
  d.facePoly([
    [12, 34, 40],
    [48, 34, 40],
    [58, 44, 58],
    [2, 44, 58],
  ]);
  d.facePoly([
    [48, 10, 40],
    [48, 34, 40],
    [58, 44, 58],
    [58, 0, 58],
  ]);
  d.outline([
    [12, 10, 40],
    [48, 10, 40],
    [48, 34, 40],
    [12, 34, 40],
    [2, 0, 58],
    [58, 0, 58],
    [58, 44, 58],
    [2, 44, 58],
  ]);
  d.quad('top', 58, 5, 3, 55, 41);
  d.lines(
    'top',
    58,
    [
      [2, 44, 58, 44],
      [58, 44, 58, 0],
    ],
    'var(--line)',
  );
  d.ok(() => {
    d.box(16, 12, 58, 24, 18, 1.2);
    d.box(20, 9, 59.2, 24, 18, 1.2);
    d.lines('top', 60.4, [
      [24, 13, 38, 13],
      [24, 18, 34, 18],
    ]);
  });
  d.box(-34, -26, 64, 20, 22, 1.5);
  d.box(-32, -28, 65.5, 20, 22, 1.5);
  d.lines('top', 67, [
    [-28, -23, -28, -10],
    [-23, -23, -23, -14],
  ]);
  d.link(
    [-20, -8, 64],
    [22, 20, 60],
    [
      [0.3, 'var(--muted)'],
      [0.65, 'var(--muted)'],
    ],
    0.25,
  );
  d.quad('y', 44, 6, 8, 54, 18);
  d.lines('x', 60, [
    [8, 30, 20, 30],
    [8, 24, 16, 24],
  ]);
  const bins: [number, string][] = [
    [-8, 'disc'],
    [22, 'tile'],
    [52, 'bar'],
  ];
  for (const [x, kind] of bins) {
    d.box(x, 58, 0, 16, 16, 8);
    d.quad('top', 8, x + 2, 60, x + 14, 72);
    const spots: W[] =
      kind === 'bar'
        ? [
            [x + 5, 63, 8],
            [x + 10, 63, 8],
            [x + 5, 68, 8],
            [x + 10, 68, 8],
          ]
        : [
            [x + 5, 63, 8.2],
            [x + 10, 64, 8.2],
            [x + 6, 68, 8.2],
          ];
    d.open('acc');
    for (const p of spots) d.token(kind, p);
    d.close();
  }
  bins.forEach(([x, kind], i) => d.chute([12 + i * 18, 44, 13], [x + 8, 66, 11], kind, 2));
  d.fail(() => {
    d.fx(
      'srt-sheet',
      [
        { t: 0, p: [0, 0, 0], o: 1 },
        { t: 22, e: OUT },
        { t: 26, p: [0, 0, 6] },
        ...d.arc(26, 36, [0, 0, 6], [52, 39, 2], 6).slice(1),
        { t: 36, e: IN },
        { t: 40, p: [52, 39, -6] },
        { t: 43, o: 0, sy: 0.4 },
        { t: 99, e: STEP },
        { t: 100, p: [0, 0, 0], o: 1, sy: 1 },
      ],
      () => {
        d.open('acc');
        d.box(-32, -28, 67, 20, 22, 1.2);
        d.close();
      },
      { pivot: [-22, -17, 67] },
    );
    d.fx(
      'srt-wad',
      [
        { t: 0, p: [0, 0, 0], r: 0, o: 1, s: 1 },
        { t: 3, p: [0, 0, 10], r: 40, e: OUT },
        ...d.arc(3, 12, [0, 0, 10], [40, 8, -49], 12, 40, 280).slice(1),
        { t: 12, o: 1, e: IN },
        { t: 13.5, p: [40, 8, -53], o: 0, e: STEP },
        { t: 40, p: [0, 0, -3], r: 0, s: 0.3, o: 0, e: STEP },
        { t: 40.2, o: 1, e: OUT },
        { t: 43, p: [0, 0, 0], s: 1.06 },
        { t: 45, s: 1 },
        { t: 55, e: IO },
        { t: 58, p: [0, 0, -1.6], r: -6 },
        { t: 61, p: [0, 0, 0], r: 0 },
        { t: 72, e: IO },
        { t: 75, p: [0, 0, -1.6], r: 6 },
        { t: 78, p: [0, 0, 0], r: 0 },
      ],
      () => {
        d.open('acc');
        d.wad([30, 22, 61], 7);
        d.close();
      },
      { pivot: [30, 22, 61] },
    );
    d.burst('srt-jam', [30, 22, 60], 41, 0.8);
    d.lampFx('srt-lamp', 41, () => d.quad('x', 60, 24, 31, 28, 34, { fill: 'var(--line)', stroke: false }));
  });
  d.cyl(70, 30, 0, 5, 11);
  d.hole(70, 30, 11, 4);
  MIRROR = false;
  return d.svg(300, 230, 'upgrade', 7);
}
function memory() {
  const d = new D();
  d.box(0, 0, 0, 16, 50, 42);
  d.lines('top', 42, [
    [3, 5, 3, 45],
    [7, 5, 7, 30],
  ]);
  const cols: [number, number][] = [
      [3, 15],
      [19, 31],
      [35, 47],
    ],
    rows: [number, number][] = [
      [4, 14],
      [17, 27],
      [30, 40],
    ];
  const st = [
    [2, 1, 3],
    [1, 0, 2],
    [3, 2, 1],
  ];
  rows.forEach(([z1, z2], ri) =>
    cols.forEach(([y1, y2], ci) => {
      d.quad('x', 16, y1, z1, y2, z2);
      const n = st[ri][ci],
        sg: number[][] = [];
      for (let k = 0; k < n; k++) sg.push([y1 + 1.5, z1 + 1.5 + k * 1.3, y2 - 1.5, z1 + 1.5 + k * 1.3]);
      if (sg.length) d.lines('x', 15.4, sg);
    }),
  );
  const slip = (y: number, z: number) => {
    d.box(2, y - 5, z, 12, 10, 0.6, { creases: false });
    d.lines('top', z + 0.6, [
      [5, y - 3, 11, y - 3],
      [5, y - 0.5, 9, y - 0.5],
    ]);
  };
  const prism = (y1: number, y2: number, z1: number, z2: number): W[] =>
    [16, 80].flatMap(x => [y1, y2].flatMap(y => [z1, z2].map(z => [x, y, z] as W)));
  d.ok(() => {
    (
      [
        [1, 0],
        [2, 2],
        [0, 1],
      ] as [number, number][]
    ).forEach(([ri, ci], i) => {
      const [z1, z2] = rows[ri],
        [y1, y2] = cols[ci],
        yc = (y1 + y2) / 2,
        zb = z1 + 1.2 + st[ri][ci] * 1.3,
        s0 = i * 31;
      const far: W = [52, -8, 18],
        ctrl: W = [40, 0, 20],
        ax: W = [24, 0, 0];
      d.fx(
        'mm-a' + i,
        [
          { t: 0, p: far, o: 0, fl: 0 },
          ...d.flight(s0, s0 + 22, far, ctrl, ax, { fl0: 0, fl1: 0, oFull: 0.55 }),
          { t: s0 + 22, e: STEP },
          { t: s0 + 22.1, o: 0 },
        ],
        () => {
          d.open('acc');
          slip(yc, zb);
          d.close();
        },
        { when: 'ok', dur: 4.4 },
      );
      d.clipU('mm-c' + i, [prism(y1, y2, z1, z2)]);
      d.fx(
        'mm-b' + i,
        [
          { t: 0, p: ax, o: 0 },
          { t: s0 + 22, e: STEP },
          { t: s0 + 22.1, o: 1, e: 'cubic-bezier(.3,0,.2,1)' },
          { t: s0 + 32, p: [0, 0, 0] },
          { t: s0 + 35, e: IO },
          { t: s0 + 40, o: 0 },
        ],
        () => {
          d.open('acc');
          slip(yc, zb);
          d.close();
        },
        { when: 'ok', dur: 4.4 },
      );
      d.close();
    });
  });
  d.fail(() => {
    const [y1, y2] = cols[1],
      [z1, z2] = rows[1],
      yc = 25;
    d.open('acc');
    d.quad('x', 16, y1, z1, y2, z2, { fill: 'none' });
    d.close();
    d.clipU('mm-j', [prism(y1, y2, z1, z2)]);
    d.open('acc');
    [
      [8.5, -5, 1],
      [7, -4.4, 1.9],
      [9.5, -5.4, 2.8],
      [6.5, -4.8, 3.7],
      [8, -5.2, 4.6],
    ].forEach(([x, dy, dz]) => d.box(x, yc + dy, z1 + dz, 12, 10, 0.6, { creases: false }));
    d.close();
    d.close();
    const far: W = [52, -8, 19],
      ctrl: W = [40, 0, 21],
      hit: W = [22, 0, 5.6],
      zb = z1 + 1.4;
    d.fx(
      'mm-f',
      [
        { t: 0, p: far, o: 0, fl: 0 },
        ...d.flight(0, 28, far, ctrl, hit, { fl0: 0, fl1: 0, oFull: 0.55 }),
        { t: 28, e: OUT },
        { t: 31, p: [27, 0, 6.6], r: 4 },
        ...d.drop(31, 40, [27, 0, 6.6], [35, 3, -zb], 4, -18).slice(1),
        ...d.land(40, [35, 3, -zb], -18, 1, 4),
        { t: 62, o: 1 },
        { t: 76, o: 0 },
        { t: 99.9, p: far, r: 0, o: 0, e: STEP },
      ],
      () => {
        d.open('acc');
        slip(yc, zb);
        d.close();
      },
      { pivot: [8, yc, zb] },
    );
    d.burst('mm-hit', [21, yc, z1 + 6], 28, 0.8);
  });
  return d.svg(300, 230, 'memory');
}
function apiKeys() {
  const d = new D();
  d.box(0, 0, 0, 16, 48, 56);
  d.quad('x', 16, 4, 4, 44, 52);
  for (const y of [8, 20, 32]) for (const z of [32, 12]) d.box(16, y + 3.5, z + 13, 2.5, 1, 1, { creases: false });
  for (const [y, z] of [
    [8, 32],
    [20, 32],
    [8, 12],
  ]) {
    d.box(16, y, z, 1.2, 8, 12, { creases: false });
    d.quad('x', 17.2, y + 3, z + 8.5, y + 5, z + 10.5);
  }
  const hk = () => {
    d.box(16, 32, 12, 1.2, 8, 12, { creases: false });
    d.quad('x', 17.2, 35, 20.5, 37, 22.5);
    d.lines('x', 17.2, [
      [34, 17, 38, 17],
      [34, 15, 37, 15],
    ]);
  };
  d.ok(() => {
    d.open('acc swing');
    hk();
    d.close();
  });
  d.fail(() => {
    const toHook: W = [-11.4, 2.5, 17.4];
    d.fx(
      'ak-flat',
      [
        { t: 0, p: [0, 0, 0], r: 0, o: 1 },
        { t: 4, p: [0, 0, 5], r: -10, e: OUT },
        ...d.arc(4, 11, [0, 0, 5], toHook, 6, -10, 0).slice(1),
        { t: 11, o: 1 },
        { t: 13, o: 0 },
        { t: 47.4, p: [0, 0, 1.6], r: 10, o: 0, e: STEP },
        { t: 47.5, o: 1, e: IN },
        ...d.land(49, [0, 0, 0], 0, 1, 4),
      ],
      () => {
        d.open('acc');
        d.box(22, 30, 0, 12, 7, 1.2, { creases: false });
        d.cyl(31, 33.5, 0, 3.5, 1.2);
        d.hole(31, 33.5, 1.2, 1);
        d.close();
      },
      { pivot: [28, 33.5, 0.6] },
    );
    d.fx(
      'ak-key',
      [
        { t: 0, o: 0, r: 0 },
        { t: 11, o: 0 },
        { t: 13, o: 1 },
        { t: 20, r: 0 },
        { t: 24, r: 8 },
        { t: 28, r: -10 },
        { t: 32, r: 12 },
        { t: 36, r: -14 },
        { t: 40, r: 16, e: OUT },
        { t: 41.5, p: [1.5, 0, 1.5], r: 18 },
        ...d.arc(41.5, 47.5, [1.5, 0, 1.5], [7, 0, -10.5], 2.5, 18, 55).slice(1),
        { t: 47.5, o: 1, e: STEP },
        { t: 47.6, o: 0 },
      ],
      () => {
        d.open('acc');
        hk();
        d.close();
      },
      { pivot: [16.6, 36, 24] },
    );
    d.puff('ak-dust', [28, 33.5, 0], 48, [3, 2, 8]);
  });
  return d.svg(300, 230, 'api-keys');
}
function connect() {
  const d = new D();
  d.fdur = 4.8;
  const X = 20,
    Wd = 50,
    Ht = 46,
    MK = 12,
    MZ = Ht - 6,
    SZ = 14,
    PW = 8,
    PH = 8,
    PL = 4,
    RX = 31,
    DUR = 4.8;
  const ACC: [string, string, number][] = [
    ['github', '#E6E6E6', 9.5],
    ['slack', '#36C5F0', 25],
    ['linear', '#8B93E8', 40.5],
  ];
  d.box(0, 0, 0, X, Wd, Ht, { r: 3 });
  d.lines('top', Ht, [[5, 6, 5, Wd - 6]]);
  d.logo('mastra', X, Wd / 2 - MK / 2, MZ, MK);
  for (const [, , y] of ACC) {
    d.quad('x', X, y - PW / 2 - 0.8, SZ - PH / 2 - 0.8, y + PW / 2 + 0.8, SZ + PH / 2 + 0.8, { fill: 'var(--face)' });
    d.quad('x', X, y - PW / 2, SZ - PH / 2, y + PW / 2, SZ + PH / 2, { fill: 'var(--hole)' });
  }
  const lamp = (y: number) =>
    d.quad('x', X, y - 1.4, SZ + PH / 2 + 3, y + 1.4, SZ + PH / 2 + 4.2, { fill: 'var(--line)', stroke: false });
  for (const [, , y] of ACC) lamp(y);
  const plug = (name: string, y: number, RX: number) => {
    d.box(RX, y - PW / 2, 0, PL, PW, PH, { creases: false, r: 2 });
    d.logo(name, RX + PL, y - 2.6, PH - 1.4, 5.2, 'var(--line)');
  };
  const SP = (i: number) => (i - 1) * 5;
  const seatOf = (i: number) => [X - 2 - RX, -SP(i), SZ - PH / 2] as W;
  const inKeys = (t0: number, seat: W): K[] => [
    { t: 0, p: [0, 0, 0] },
    { t: t0, e: 'cubic-bezier(.3,0,.4,1)' },
    { t: t0 + 6, p: [seat[0] + 2, 0, seat[2] + 0.6], e: IN },
    { t: t0 + 9, p: seat, e: OUT },
    { t: t0 + 10.5, p: [seat[0] + 0.5, 0, seat[2]] },
    { t: t0 + 12, p: seat },
  ];
  const outKeys = (t1: number, seat: W): K[] => [
    { t: t1, p: seat, e: 'cubic-bezier(.4,0,.2,1)' },
    { t: t1 + 5, p: [seat[0] + 4, 0, seat[2] + 0.4], e: IO },
    { t: t1 + 11, p: [0, 0, 0], e: OUT },
    { t: t1 + 12, p: [0, 0, 0.6], e: IN },
    { t: t1 + 13.5, p: [0, 0, 0] },
  ];
  const clipOut = (id: string) =>
    d.clip(id, [
      [X, -20, -6],
      [X, Wd + 20, -6],
      [X, -20, 60],
      [X, Wd + 20, 60],
      [X + 80, -20, -6],
      [X + 80, Wd + 20, -6],
      [X + 80, -20, 60],
      [X + 80, Wd + 20, 60],
    ]);
  const lit = (i: number, on: number, off: number, when: 'ok' | 'err') =>
    d.fx(
      'cn-l' + when + i,
      [
        { t: 0, o: 0 },
        { t: on, o: 0, e: STEP },
        { t: on + 0.3, o: 1 },
        { t: off, o: 1, e: IO },
        { t: off + 3, o: 0 },
      ],
      () => {
        d.els.push(`<g class="acc brand" style="--brand:${ACC[i][1]}">`);
        lamp(ACC[i][2]);
        d.close();
      },
      { when, dur: DUR },
    );
  d.ok(() => {
    clipOut('cn-c');
    ACC.forEach(([name, col, y], i) => {
      const t0 = 6 + i * 14;
      d.fx(
        'cn-p' + i,
        [...inKeys(t0, seatOf(i)), ...outKeys(78 + i * 2, seatOf(i)).slice(0)],
        () => {
          d.els.push(`<g class="acc brand" style="--brand:${col}">`);
          plug(name, y + SP(i), RX);
          d.close();
        },
        { when: 'ok', dur: DUR },
      );
    });
    d.close();
    ACC.forEach((_, i) => lit(i, 6 + i * 14 + 9, 78 + i * 2, 'ok'));
    d.fx(
      'cn-mark',
      [
        { t: 0, o: 0 },
        { t: 43, o: 0, e: OUT },
        { t: 47, o: 1 },
        { t: 76, o: 1, e: IO },
        { t: 80, o: 0 },
      ],
      () => {
        d.open('acc');
        d.logo('mastra', X + 0.05, Wd / 2 - MK / 2, MZ, MK, 'var(--line)');
        d.close();
      },
      { when: 'ok', dur: DUR },
    );
  });
  d.fail(() => {
    clipOut('cn-c2');
    ACC.forEach(([name, , y], i) => {
      const t0 = 6 + i * 14;
      if (i < 2) {
        d.fx(
          'cn-f' + i,
          [...inKeys(t0, seatOf(i)), ...outKeys(78 + i * 2, seatOf(i))],
          () => {
            d.open('acc');
            plug(name, y + SP(i), RX);
            d.close();
          },
          { dur: DUR },
        );
        return;
      }
      const land: W = [4, 4, 0];
      d.fx(
        'cn-f' + i,
        [
          ...inKeys(t0, seatOf(i)),
          { t: t0 + 13, p: seatOf(i), e: 'cubic-bezier(.2,.8,.3,1)' },
          { t: t0 + 15, p: [seatOf(i)[0] + 7, seatOf(i)[1] + 1, seatOf(i)[2] + 3], r: -14, e: LIN },
          ...d.drop(t0 + 15, t0 + 23, [seatOf(i)[0] + 7, seatOf(i)[1] + 1, seatOf(i)[2] + 3], land, -14, -24).slice(1),
          ...d.land(t0 + 23, land, -24, 1, 4),
          { t: 66, o: 1 },
          { t: 78, o: 0 },
          { t: 97, o: 0, p: [0, 0, 0], r: 0, e: STEP },
          { t: 98, o: 1 },
        ],
        () => {
          d.open('acc');
          plug(name, y + SP(i), RX);
          d.close();
        },
        { pivot: [RX + PL / 2, y + SP(i), PH / 2], dur: DUR },
      );
    });
    d.close();
    ACC.forEach((_, i) => {
      if (i < 2) lit(i, 6 + i * 14 + 9, 78 + i * 2, 'err');
    });
    d.burst('cn-hit', [X + 1, ACC[2][2], SZ], 6 + 28 + 13, 0.8);
    d.lampFx('cn-lamp', 6 + 28 + 13, () => lamp(ACC[2][2]));
  });
  return d.svg(300, 230, 'connect');
}
function databases() {
  const d = new D();
  d.cyl(18, 18, 0, 14, 10);
  d.ring(18, 18, 3, 14);
  d.cyl(18, 18, 10, 14, 10);
  d.ring(18, 18, 13, 14);
  d.cyl(18, 18, 20, 14, 10);
  d.hole(52, 32, 0, 15);
  const db = () => {
    d.cyl(52, 32, -22, 14, 10);
    d.ring(52, 32, -19, 14);
    d.cyl(52, 32, -12, 14, 10);
  };
  d.ok(() => {
    d.circleClip('db-hole', 52, 32, 0, 15);
    d.g('acc created drawer', { shift: [0, 0, 22] });
    db();
    d.close();
    d.close();
  });
  d.fail(() => {
    d.open('acc');
    d.hole(52, 32, 0, 15);
    d.close();
    d.circleClip('db-hole2', 52, 32, 0, 15);
    d.fx(
      'db-up',
      [
        { t: 0, p: [0, 0, 9], r: 5 },
        { t: 12, p: [0, 0, 0], r: 0 },
        { t: 20 },
        { t: 34, p: [0, 0, 16], e: OUT },
        { t: 36, p: [0, 0, 15], r: -2, e: IN },
        { t: 40, p: [0, 0, 9.5], r: 6, e: OUT },
        { t: 42.5, p: [0, 0, 10.6], r: 4.5 },
        { t: 45, p: [0, 0, 9], r: 5 },
      ],
      () => {
        d.open('acc');
        db();
        d.close();
      },
      { pivot: [52, 32, 0] },
    );
    d.close();
    d.puff('db-dust', [64, 40, 0], 40, [4, 3, 10]);
  });
  return d.svg(300, 230, 'databases');
}
function alerts() {
  const d = new D();
  const T = 3.4,
    X = T,
    Wd = 28;
  d.box(-7, -3, 0, 10.4, Wd + 6, 5, { creases: false, r: 3 });
  d.box(0, 0, 2, T, Wd, 50, { creases: false, r: 4 });
  d.quad('x', X, 1.6, 6, Wd - 1.6, 50.4, { fill: 'var(--hole)' });
  d.quad('x', X, 11.5, 48.2, 16.5, 49.4, { fill: 'var(--line)', stroke: false });
  d.dot([X, 19.4, 48.8], 0.75);
  d.quad('y', Wd, 0.6, 34, 2.6, 41, { fill: 'var(--face)' });
  d.box(X, -3, 0, 2.6, Wd + 6, 6.4, { creases: false, r: 2 });
  d.quad('x', X + 2.6, Wd / 2 - 2, 2.6, Wd / 2 + 2, 3.6, { fill: 'var(--line)', stroke: false });
  const banner = () => {
    d.quad('x', X + 0.2, 3.4, 38.4, Wd - 3.4, 45.2, { fill: 'var(--face)' });
    d.quad('x', X + 0.3, 4.8, 39.6, 8.6, 44, { fill: 'var(--hole)' });
    d.lines('x', X + 0.3, [
      [10.2, 42.8, 21.4, 42.8],
      [10.2, 40.6, 17.4, 40.6],
    ]);
  };
  const ping = (id: string, t0: number) => {
    const c = pr([X, Wd + 1, 51]);
    [0, 1].forEach(i => {
      const r = 6 + i * 4.5;
      const a0 = -1.25,
        a1 = 0.15;
      const pt = (a: number) => `${f(c[0] + Math.cos(a) * r)},${f(c[1] + Math.sin(a) * r)}`;
      d.fx(
        id + i,
        [
          { t: 0, o: 0, s: 0.7 },
          { t: t0 + i * 4, o: 0, s: 0.7, e: OUT },
          { t: t0 + i * 4 + 3, o: 1, s: 1, e: 'cubic-bezier(.2,.6,.4,1)' },
          { t: t0 + i * 4 + 16, o: 0, s: 1.25, e: STEP },
          { t: t0 + i * 4 + 17, o: 0, s: 0.7 },
        ],
        () => {
          d.track([
            [c[0] - r, c[1] - r],
            [c[0] + r, c[1] + r],
          ]);
          d.els.push(
            `<path class="acc" d="M${pt(a0)}A${r} ${r} 0 0 1 ${pt(a1)}" fill="none" stroke="var(--line)"${S}/>`,
          );
        },
        { pivot: [X, Wd + 1, 51], when: 'ok', dur: 3.6 },
      );
    });
  };
  d.ok(() => {
    d.clip('ph-screen', [
      [X, 1.8, 5],
      [X, Wd - 1.8, 5],
      [X, 1.8, 50],
      [X, Wd - 1.8, 50],
      [X + 0.6, 1.8, 5],
      [X + 0.6, Wd - 1.8, 5],
      [X + 0.6, 1.8, 50],
      [X + 0.6, Wd - 1.8, 50],
    ]);
    d.fx(
      'ph-banner',
      [
        { t: 0, p: [0, 0, 0], o: 1 },
        { t: 6, e: IN },
        { t: 16, p: [0, 0, 8], o: 0, e: STEP },
        { t: 24, p: [0, 0, 12], o: 0, e: OUT },
        { t: 30, p: [0, 0, 4], o: 1, e: OUT },
        { t: 40, p: [0, 0, -0.6], e: IO },
        { t: 46, p: [0, 0, 0] },
      ],
      () => {
        d.open('acc');
        banner();
        d.close();
      },
      { when: 'ok', dur: 3.6 },
    );
    d.close();
    ping('ph-ping', 34);
  });
  d.fail(() => {
    const rest: W = [10, 0, -40];
    d.fx(
      'ph-card',
      [
        { t: 0, p: rest, r: -20, o: 0 },
        { t: 4, p: [0, 0, 22], r: 0, o: 0, e: STEP },
        { t: 6, p: [0, 0, 20], o: 0.4, e: LIN },
        { t: 16, p: [0, 0, 9], o: 1, e: IN },
        { t: 24, p: [0, 0, 5.2], e: LIN },
        { t: 25.5, p: [2, 0, 6.4], r: -8, e: OUT },
        ...d.drop(27, 40, [3.4, 0, 6], rest, -8, -20).slice(1),
        ...d.land(40, rest, -20, 1.2, 4),
        { t: 60, o: 1 },
        { t: 74, o: 0 },
        { t: 100, o: 0 },
      ],
      () => {
        d.open('acc');
        banner();
        d.close();
      },
      { pivot: [X, Wd / 2, 42] },
    );
    d.burst('ph-hit', [X, Wd / 2, 50.5], 24, 0.7);
  });
  return d.svg(300, 230, 'alerts');
}
function filesystems() {
  const d = new D();
  const folder = (x: number, tab: number, h = 30) => {
    d.box(x, 3, 2, 0.6, 34, h, { creases: false, r: 1 });
    d.box(x, tab, 2 + h - 0.4, 0.6, 9, 3.4, { creases: false, r: 1.2 });
    d.lines('x', x + 0.6, [[tab + 2, h + 0.4, tab + 6, h + 0.4]]);
    d.box(x + 0.9, 3, 2, 0.6, 34, h - 3.5, { creases: false, r: 1 });
  };
  const page = () => {
    d.box(0, 0, 0, 0.6, 26, 24, { creases: false });
    d.lines('x', 0.6, [
      [3, 18, 20, 18],
      [3, 14, 16, 14],
      [3, 10, 18, 10],
    ]);
  };
  d.box(0, 0, 0, 24, 40, 2, { creases: false, r: 2 });
  d.box(0, 0, 0, 2.4, 40, 9, { creases: false, r: 1.2 });
  d.box(0, 0, 0, 24, 2.4, 9, { creases: false, r: 1.2 });
  folder(5, 24);
  d.ok(() => {
    d.fx(
      'fs-mid',
      [
        { t: 0, p: [0, 0, 0] },
        { t: 10, e: OUT },
        { t: 24, p: [0, 0, 10] },
        { t: 62, e: IO },
        { t: 78, p: [0, 0, 0] },
      ],
      () => {
        d.open('acc');
        folder(11, 5);
        d.close();
      },
      { when: 'ok', dur: 3.8 },
    );
    d.clip('fs-slot', [
      [11.4, 5, 36],
      [13, 5, 36],
      [11.4, 35, 36],
      [13, 35, 36],
      [11.4, 5, 90],
      [13, 5, 90],
      [11.4, 35, 90],
      [13, 35, 90],
    ]);
    d.fx(
      'fs-page',
      [
        { t: 0, p: [12, 7, 40], o: 0 },
        { t: 22, p: [12, 7, 48], o: 0, e: OUT },
        { t: 28, p: [12, 7, 44], o: 1, e: 'cubic-bezier(.3,0,.5,1)' },
        { t: 48, p: [12, 7, 12], e: OUT },
        { t: 62, e: IO },
        { t: 78, p: [12, 7, 2] },
        { t: 90, o: 1 },
        { t: 92, o: 0, e: STEP },
      ],
      () => {
        d.open('acc');
        page();
        d.close();
      },
      { when: 'ok', dur: 3.8 },
    );
    d.close();
  });
  folder(17, 14, 24);
  d.box(0, 37.6, 0, 24, 2.4, 9, { creases: false, r: 1.2 });
  d.box(21.6, 0, 0, 2.4, 40, 6, { creases: false, r: 1.2 });
  d.quad('x', 24, 14, 1.6, 26, 4.4, { fill: 'var(--face)' });
  d.lines('x', 24, [[16, 3, 24, 3]]);
  d.fail(() => {
    d.fx(
      'fs-mid2',
      [
        { t: 0, p: [0, 0, 0] },
        { t: 2, e: OUT },
        { t: 12, p: [0, 0, 10] },
        { t: 82, e: IO },
        { t: 96, p: [0, 0, 0] },
      ],
      () => {
        d.open('acc');
        folder(11, 5);
        d.close();
      },
    );
    const rest: W = [16, 46, -0.6];
    d.fx(
      'fs-page2',
      [
        { t: 0, p: rest, r: -30, o: 0 },
        { t: 6, p: [12, 7, 48], r: 0, o: 0, e: STEP },
        { t: 12, p: [12, 7, 44], o: 1, e: IN },
        { t: 24, p: [12.5, 7, 30], e: LIN },
        { t: 26, p: [14, 7, 31], r: 12, e: OUT },
        ...d.drop(27, 40, [14, 7, 31], rest, 12, -30).slice(1),
        ...d.land(40, rest, -30, 1, 4),
        { t: 60, o: 1 },
        { t: 74, o: 0 },
        { t: 100, o: 0 },
      ],
      () => {
        d.open('acc');
        page();
        d.close();
      },
      { pivot: [12, 20, 44] },
    );
    d.burst('fs-hit', [12.5, 10, 42], 24, 0.7);
  });
  return d.svg(300, 230, 'filesystems');
}
function sandboxes() {
  const d = new D();
  d.fdur = 4.4;
  const N = 72,
    P = 3.6,
    H8 = 9,
    S = 6;
  const KX = 46,
    KY = 20,
    TX = 22,
    TY = 44;
  const RB = 8.4,
    RT = 6.4,
    TH = 11;
  const rAt = (z: number) => RB + ((RT - RB) * z) / TH;
  d.box(0, 0, 0, N, P, H8, { creases: false });
  d.box(0, 0, 0, P, N, H8, { creases: false });
  d.box(-1, -1, H8, N + 2, P + 2.4, 1.2, { creases: false });
  d.box(-1, -1, H8, P + 2.4, N + 2, 1.2, { creases: false });
  d.quad('top', S, P, P, N - P, N - P, { fill: 'color-mix(in oklab, var(--detail) 22%, var(--hole))' });
  const clear = (x: number, y: number) =>
    [
      [46, 20, 12.5],
      [22, 44, 11],
      [56, 56, 11],
      [P + 4.4, 50.2, 7],
    ].every(([cx, cy, r]) => Math.hypot(x - cx, y - cy) > r);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const ripple = (pts: [number, number][]) => {
    const q = pts.map(([x, y]) => pr([x, y, S]));
    d.els.push(
      `<path d="M${f(q[0][0])},${f(q[0][1])}Q${f(q[1][0])},${f(q[1][1])} ${f(q[2][0])},${f(q[2][1])}" fill="none" stroke="var(--detail)"${STROKE}/>`,
    );
  };
  ripple([
    [6, 40],
    [12, 46],
    [9, 55],
  ]);
  ripple([
    [10, 36],
    [16, 43],
    [14, 54],
  ]);
  ripple([
    [30, 26],
    [35, 30],
    [33, 36],
  ]);
  ripple([
    [60, 28],
    [64, 35],
    [62, 43],
  ]);
  ripple([
    [56, 30],
    [59.5, 36],
    [58, 42],
  ]);
  for (let gx = 0; gx < 17; gx++)
    for (let gy = 0; gy < 17; gy++) {
      const x = P + 2 + ((gx + rnd()) * (N - 2 * P - 4)) / 17,
        y = P + 2 + ((gy + rnd()) * (N - 2 * P - 4)) / 17;
      if (!clear(x, y) || rnd() < 0.35) continue;
      const q = pr([x, y, S]),
        k = rnd();
      d.els.push(
        `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${k < 0.15 ? 0.8 : k < 0.5 ? 0.5 : 0.3}" fill="${k < 0.15 || rnd() < 0.45 ? 'var(--line)' : 'var(--detail)'}"/>`,
      );
    }
  for (const [x, y, r] of [
    [32, 52, 2.2],
    [62, 16, 1.8],
    [12, 30, 2],
    [46, 66, 1.6],
  ] as const) {
    const c = pr([x, y, S]);
    d.els.push(
      `<path d="M${f(c[0] - r * 1.4)},${f(c[1])}Q${f(c[0])},${f(c[1] - r * 1.3)} ${f(c[0] + r * 1.4)},${f(c[1])}" fill="none" stroke="var(--detail)"${STROKE}/>`,
    );
  }
  const merlons = (cx: number, cy: number, z: number, r: number) => {
    const pts = [0, 1, 2, 3]
      .map(i => {
        const a = (i / 4) * Math.PI * 2;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as [number, number];
      })
      .sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [x, y] of pts) d.box(x - 1.5, y - 1.5, z, 3, 3, 2.6, { creases: false, r: 0.5 });
  };
  const keep = () => {
    d.cone(KX, KY, S, 10, 8.6, 17);
    merlons(KX, KY, S + 17, 6.6);
    d.quad('y', KY + 9.4, KX - 1.8, S, KX + 1.8, S + 5.4);
  };
  const pole = () => d.box(KX - 0.4, KY - 0.4, S + 17, 0.8, 0.8, 21, { creases: false });
  const REST = 0;
  const flag = (dz = 0) => {
    d.box(KX - 0.3, KY + 0.4, S + 32 + dz, 0.6, 9, 6, { creases: false });
    d.logo('mastra', KX + 0.3, KY + 1.9, S + 37 + dz, 6, 'var(--line)');
  };
  const SX = P + 1.6,
    SY = 50.2;
  const shovel = () => {
    d.box(SX, SY - 3.2, S - 1.5, 0.8, 6.5, 8, { creases: false, r: 2 });
    d.box(SX + 0.1, SY - 0.6, S + 6.5, 0.6, 1.3, 12, { creases: false, r: 0.4 });
    d.box(SX - 0.1, SY - 2.2, S + 18.5, 1, 4.5, 1.6, { creases: false, r: 0.6 });
    d.mound(SX + 2.8, SY, S, 4.6, 3.2);
    for (const [dx, dy] of [
      [4.5, -3],
      [5.5, 2.5],
      [2, 4.2],
    ])
      d.dot([SX + dx, SY + dy, S + 0.5], 0.35);
  };
  const tower = () => d.cone(TX, TY, S, RB, RT, TH);
  const bucket = () => {
    d.cone(0, 0, 0, RB + 0.6, RB + 0.6, 1.3, { top: false });
    d.cone(0, 0, 1.3, RB + 0.2, RT + 0.2, TH + 0.6);
    d.ring(0, 0, TH - 2.4, rAt(TH - 2.4) + 0.2);
    const q = Math.SQRT1_2,
      rl = RB + 0.7,
      rb = RB + 2.6;
    for (const sg of [1, -1]) {
      d.box(sg * rl * q - 0.6, -sg * rl * q - 0.6, 1.4, 1.2, 1.2, 1.8, { creases: false, r: 0.4 });
      d.zig([
        [sg * rl * q, -sg * rl * q, 2.2],
        [sg * rb * q, -sg * rb * q, 0.3],
      ]);
    }
    d.ring(0, 0, 0.3, rb, 'var(--line)');
  };
  shovel();
  keep();
  pole();
  const ON: W = [TX, TY, S],
    OFF: W = [56, 56, S];
  const bucketKeys = (t1: number, t2: number): K[] => [
    { t: 0, p: ON },
    { t: 6, e: 'cubic-bezier(.3,0,.4,1)' },
    { t: 18, p: [ON[0], ON[1], ON[2] + 16] },
    ...d.arc(18, 32, [ON[0], ON[1], ON[2] + 16], OFF, 5).slice(1),
    ...d.land(32, OFF, 0, 0.8, 4),
    { t: t1, e: IO },
    ...d.arc(t1 + 2, t2, OFF, [ON[0], ON[1], ON[2] + 14], 6).slice(1),
    { t: t2 + 4, p: ON, e: IN },
  ];
  d.ok(() => {
    d.open('acc');
    tower();
    d.close();
    const FL = 9,
      Y0 = KY + 0.4,
      Z0 = S + 32,
      FH = 6,
      FX = KX,
      NP = 18;
    const amp = (u: number) => 0.6 * Math.pow(u, 1.2),
      off = (u: number, w: number) => {
        const ph = 2 * Math.PI * 1.2 * u;
        return amp(u) * (Math.sin(w - ph) + Math.sin(ph));
      };
    const P = (u: number, z: number, w: number) => pr([FX + off(u, w), Y0 + FL * u, z]);
    const shape = (w: number) => {
      const top = Array.from({ length: NP + 1 }, (_, k) => P(k / NP, Z0 + FH, w)),
        bot = Array.from({ length: NP + 1 }, (_, k) => P(1 - k / NP, Z0, w));
      return 'M' + [...top, ...bot].map(q => f(q[0]) + ',' + f(q[1])).join('L') + 'Z';
    };
    const NF = 48,
      fr = (n: number) => (2 * Math.PI * n) / NF;
    d.css.push(
      `.card:not([data-tone=error]):is([data-live],[data-pending]) .sb-cloth{animation:sb-cloth 1.9s linear infinite}@keyframes sb-cloth{${Array.from({ length: NF + 1 }, (_, n) => `${+((n / NF) * 100).toFixed(2)}%{d:path("${shape(fr(n))}")}`).join('')}}`,
    );
    d.open('acc');
    d.els.push(`<path class="sb-cloth" d="${shape(0)}" fill="var(--face)" stroke="var(--line)"${STROKE}/>`);
    const vx = -K,
      vy = H,
      u0 = 0.3,
      u1 = 0.8,
      c0 = (FX - Y0) / FL;
    const mframe = (w: number) => {
      const o0 = off(u0, w),
        o1 = off(u1, w),
        bb = (o1 - o0) / (u1 - u0),
        a = o0 - bb * u0,
        m = bb / (K * FL),
        k = a + bb * c0,
        A = 1 + vx * m;
      return `translate(${+(vx * k).toFixed(3)}px,${+(vy * k).toFixed(3)}px) skewY(${+((Math.atan2(vy * m, A) * 180) / Math.PI).toFixed(3)}deg) scaleX(${+A.toFixed(4)})`;
    };
    d.css.push(
      `.card .sb-mark{transform-origin:0px 0px}.card:not([data-tone=error]):is([data-live],[data-pending]) .sb-mark{animation:sb-mark 1.9s linear infinite}@keyframes sb-mark{${Array.from({ length: NF + 1 }, (_, n) => `${+((n / NF) * 100).toFixed(2)}%{transform:${mframe(fr(n))}}`).join('')}}`,
    );
    d.els.push('<g class="sb-mark">');
    d.logo('mastra', FX, KY + 1.9, S + 37, 6, 'var(--line)');
    d.close();
    d.close();
    d.fx('sb-bucket', bucketKeys(78, 92), bucket, { when: 'ok', dur: 4.4 });
  });
  d.fail(() => {
    flag(REST);
    d.fx(
      'sb-pile',
      [
        { t: 0, o: 0, sx: 0.7, sy: 0.2 },
        { t: 43, o: 0, sx: 0.7, sy: 0.2, e: OUT },
        { t: 46, o: 1, e: 'cubic-bezier(.3,.6,.4,1)' },
        { t: 56, sx: 1, sy: 1 },
        { t: 76, o: 1, e: IO },
        { t: 86, o: 0 },
        { t: 100, o: 0 },
      ],
      () => {
        d.open('acc');
        d.mound(TX, TY, S, RB + 2.2, 5);
        d.close();
      },
      { pivot: [TX, TY, S], dur: 4.4 },
    );
    d.fx(
      'sb-slump',
      [
        { t: 0, sx: 1, sy: 1, o: 1 },
        { t: 42, e: 'cubic-bezier(.6,0,.85,.45)' },
        { t: 49, sx: 1.08, sy: 0.45, o: 1, e: LIN },
        { t: 53, sx: 1.15, sy: 0.12, o: 0, e: STEP },
        { t: 99, o: 0, e: STEP },
        { t: 99.5, sx: 1, sy: 1, o: 1 },
      ],
      () => {
        d.open('acc');
        tower();
        d.inkPts([
          [TX + rAt(TH) * 0.7, TY + rAt(TH) * 0.7, S + TH],
          [TX + rAt(8) * 0.76, TY + rAt(8) * 0.62, S + 8],
          [TX + rAt(5) * 0.66, TY + rAt(5) * 0.76, S + 5],
          [TX + rAt(2) * 0.72, TY + rAt(2) * 0.68, S + 2],
        ]);
        d.close();
      },
      { pivot: [TX, TY, S], dur: 4.4 },
    );
    [
      [-6, 5, 0],
      [5, 6, 1],
      [7, -3, 2],
      [-2, -7, 3],
      [2, 8, 4],
    ].forEach(([ox, oy, i]) => {
      const a: W = [TX + ox * 0.6, TY + oy * 0.6, S + TH - 1],
        b: W = [TX + ox * 1.55, TY + oy * 1.55, S + 0.4];
      d.fx(
        'sb-grain' + i,
        [
          { t: 0, p: a, o: 0 },
          { t: 42 + i * 1.2, p: a, o: 0, e: STEP },
          { t: 42.5 + i * 1.2, o: 1, e: LIN },
          ...d
            .drop(42.5 + i * 1.2, 50 + i * 1.2, a, b)
            .slice(1)
            .map(k => ({ ...k, o: 1 })),
          { t: 62, o: 1 },
          { t: 74, o: 0 },
          { t: 100, o: 0 },
        ],
        () => {
          d.open('acc');
          d.wad([0, 0, 0], 1 + (i % 2) * 0.5);
          d.close();
        },
        { dur: 4.4 },
      );
    });
    d.puff('sb-dust', [TX + 4, TY + 2, S + 4], 46, [2, -2, 10]);
    d.fx('sb-bucket2', bucketKeys(84, 95), bucket, { dur: 4.4 });
  });
  d.box(N - P, 0, 0, P, N - P, H8, { creases: false, r: 0.6 });
  d.box(0, N - P, 0, N, P, H8, { creases: false, r: 0.6 });
  d.lines('x', N, [[P, H8 / 2, N - P, H8 / 2]], 'var(--line)');
  d.lines('y', N, [[0, H8 / 2, N, H8 / 2]], 'var(--line)');
  d.lines('x', N, [
    [40, 0, 40, H8 / 2],
    [22, H8 / 2, 22, H8],
  ]);
  d.lines('y', N, [
    [30, 0, 30, H8 / 2],
    [50, H8 / 2, 50, H8],
  ]);
  for (const [u, v] of [
    [38.6, H8 / 4],
    [41.4, H8 / 4],
    [20.6, H8 * 0.75],
    [23.4, H8 * 0.75],
  ])
    d.dot([N, u, v], 0.32);
  for (const [u, v] of [
    [28.6, H8 / 4],
    [31.4, H8 / 4],
    [48.6, H8 * 0.75],
    [51.4, H8 * 0.75],
  ])
    d.dot([u, N, v], 0.32);
  d.box(N - P - 1.4, -1, H8, P + 2.4, N - P + 0.4, 1.2, { creases: false, r: 0.6 });
  d.box(-1, N - P - 1.4, H8, N + 2, P + 2.4, 1.2, { creases: false, r: 0.6 });
  return d.svg(300, 230, 'sandboxes');
}
function vault() {
  const d = new D();
  d.fdur = 3.6;
  const X = 30,
    Wd = 30,
    Ht = 36,
    F = 2.5,
    Z1 = F + Ht;
  for (const [x, y] of [
    [2, 2],
    [X - 6, 2],
    [2, Wd - 6],
    [X - 6, Wd - 6],
  ])
    d.box(x, y, 0, 4, 4, F, { creases: false, r: 1 });
  d.box(0, 0, F, X, Wd, Ht, { r: 3 });
  d.lines('top', Z1, [[6, 6, X - 6, 6]]);
  for (const y of [3, 8.4, 13.8, 19.2, 24.6]) d.dot([X, y, F + 2], 0.42);
  for (const y of [3, 8.4, 13.8]) d.dot([X, y, Z1 - 2], 0.42);
  const DY = 11.5,
    DZ = F + 18,
    R = 9;
  d.faceG('x', X, DY, DZ);
  d.els.push(
    `<circle r="${R + 1.4}" fill="none" stroke="var(--detail)"${S}/><circle r="${R}" fill="var(--face)" stroke="var(--line)"${S}/><circle r="${R - 2.2}" fill="none" stroke="var(--detail)"${S}/>`,
  );
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    d.els.push(
      `<circle cx="${f(Math.cos(a) * (R - 1.1))}" cy="${f(Math.sin(a) * (R - 1.1))}" r=".45" fill="var(--line)"/>`,
    );
  }
  {
    let p = '';
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      p += `M${f(Math.cos(a) * 1.6)},${f(Math.sin(a) * 1.6)}L${f(Math.cos(a) * 5.4)},${f(Math.sin(a) * 5.4)}`;
    }
    d.els.push(
      `<circle r="5.4" fill="none" stroke="var(--line)"${S}/><path d="${p}" fill="none" stroke="var(--line)"${S}/><circle r="1.6" fill="var(--face)" stroke="var(--line)"${S}/>`,
    );
  }
  d.close();
  for (const z of [DZ - 8, DZ + 4]) d.cyl(X + 1, DY - R - 0.6, z, 1.2, 4);
  const PY = 24.6,
    PZ = F + 30.4,
    LR = 3.6;
  d.faceG('x', X + 0.05, PY, PZ);
  d.els.push(
    `<circle r="${f(LR + 1.6)}" fill="var(--face)" stroke="var(--line)"${S}/><circle r="${LR}" fill="var(--hole)" stroke="var(--line)"${S}/>`,
  );
  d.close();
  const iris = () => {
    d.faceG('x', X + 0.1, PY, PZ);
    d.els.push(
      `<circle r="${f(LR * 0.6)}" fill="none" stroke="var(--line)"${S}/><circle r="${f(LR * 0.24)}" fill="var(--line)"/><circle cx="${f(LR * 0.34)}" cy="${f(-LR * 0.34)}" r=".45" fill="var(--line)"/>`,
    );
    d.close();
  };
  d.open('acc');
  iris();
  d.close();
  const lens = (): W[] =>
    Array.from({ length: 32 }, (_, k) => {
      const a = (k / 32) * Math.PI * 2;
      return [X + 0.15, PY + LR * Math.cos(a), PZ + LR * Math.sin(a)] as W;
    });
  const scan = (id: string, when?: 'ok') => {
    d.clip(id + '-c', lens());
    d.fx(
      id,
      [
        { t: 0, p: [0, 0, 0], o: 0 },
        { t: 6, o: 0, e: STEP },
        { t: 8, o: 1, e: IO },
        { t: 22, p: [0, 0, -2 * LR], e: IO },
        { t: 36, p: [0, 0, 0] },
        { t: 38, o: 0, e: STEP },
        { t: 100, o: 0 },
      ],
      () => {
        d.open('acc');
        d.lines('x', X + 0.2, [[PY - LR, PZ + LR, PY + LR, PZ + LR]], 'var(--line)');
        d.close();
      },
      { ...(when ? { when } : {}), dur: 3.6 },
    );
    d.close();
  };
  const PORTS = [7, 15, 23],
    PZo = F + 7;
  for (const x of PORTS) {
    d.quad('y', Wd, x - 1.8, PZo - 1.8, x + 1.8, PZo + 1.8, { fill: 'var(--hole)' });
    d.lines('y', Wd, [[x - 2.6, PZo + 2.8, x + 2.6, PZo + 2.8]]);
  }
  const NODES: [number, number][] = [
    [-3, Wd + 30],
    [15, Wd + 36],
    [31, Wd + 27],
  ];
  const node = (i: number) => {
    const [nx, ny] = NODES[i];
    if (i === 1) {
      d.cyl(nx, ny, 0, 5.4, 5.2);
      d.ring(nx, ny, 2.6, 5.45);
      d.cyl(nx, ny, 5.2, 5.4, 5.2);
    } else {
      d.box(nx - 5, ny - 5, 0, 10, 10, 9, { r: 1.8 });
      d.lines('x', nx + 5, [
        [ny - 2.6, 6, ny + 2.6, 6],
        [ny - 2.6, 3.6, ny + 1.4, 3.6],
      ]);
    }
  };
  const top = (i: number): W => {
    const [nx, ny] = NODES[i];
    return [nx, ny - 1, i === 1 ? 10.4 : 9];
  };
  const shutter = () => {
    for (const x of PORTS) d.box(x - 2.4, Wd, PZo - 2.4, 4.8, 0.8, 4.8, { creases: false, r: 0.6 });
  };
  d.ok(() => {
    PORTS.forEach((x, i) =>
      d.link(
        [x, Wd + 0.5, PZo],
        top(i),
        [
          [0.15, PK],
          [0.55, PK],
        ],
        0.45,
      ),
    );
    scan('vt-scan', 'ok');
  });
  NODES.forEach((_, i) => node(i));
  d.fail(() => {
    PORTS.forEach((x, i) => d.link([x, Wd + 0.5, PZo], top(i), [], 0.45));
    scan('vt-scan2');
    d.clipU(
      'vt-slots',
      PORTS.map(
        x =>
          [
            [x - 2.6, Wd, PZo - 2.6],
            [x + 2.6, Wd, PZo - 2.6],
            [x - 2.6, Wd + 1, PZo - 2.6],
            [x + 2.6, Wd + 1, PZo - 2.6],
            [x - 2.6, Wd, PZo + 2.8],
            [x + 2.6, Wd, PZo + 2.8],
            [x - 2.6, Wd + 1, PZo + 2.8],
            [x + 2.6, Wd + 1, PZo + 2.8],
          ] as W[],
      ),
    );
    d.fx(
      'vt-shut',
      [
        { t: 0, p: [0, 0, 5.6] },
        { t: 34, e: 'cubic-bezier(.55,0,.9,.4)' },
        { t: 39, p: [0, 0, 0], e: OUT },
        { t: 41, p: [0, 0, 0.7], e: IN },
        { t: 43, p: [0, 0, 0] },
        { t: 84, e: IO },
        { t: 96, p: [0, 0, 5.6] },
      ],
      () => {
        d.open('acc');
        shutter();
        d.close();
      },
      { dur: 3.6 },
    );
    d.close();
    d.burst('vt-hit', [PORTS[1], Wd + 1, PZo + 2.6], 39, 0.8);
  });
  return d.svg(300, 230, 'vault');
}
function secrets() {
  const d = new D();
  d.fdur = 5.2;
  const X0 = 0,
    Z0 = 11,
    RR = 6.4,
    RC = 7.2,
    DW = 5.6,
    G = 0.35,
    ND = 5;
  const yS = 8,
    yE = yS + ND * DW + (ND - 1) * G;
  const A0 = Math.atan2(0.707, 1),
    DL = Math.PI / 4,
    NL = 8;
  const cradle = (y: number) => {
    d.box(-6, y - 1.6, 0, 12, 3.2, 3, { creases: false, r: 0.8 });
    d.box(-6, y - 1.6, 3, 2.4, 3.2, 5, { creases: false, r: 0.6 });
    d.box(3.6, y - 1.6, 3, 2.4, 3.2, 5, { creases: false, r: 0.6 });
  };
  d.cast([
    [X0 - RC, -5, 0],
    [X0 + RC, -5, 0],
    [X0 + RC, yE + 13, 0],
    [X0 - RC, yE + 13, 0],
  ]);
  cradle(14);
  const GL: Record<string, number[][]> = {
    T: [
      [0, 4, 3, 4],
      [1.5, 4, 1.5, 0],
    ],
    O: [[0.9, 0, 2.1, 0, 3, 1, 3, 3, 2.1, 4, 0.9, 4, 0, 3, 0, 1, 0.9, 0]],
    K: [
      [0, 0, 0, 4],
      [2.8, 4, 0, 1.6],
      [0.9, 2.4, 3, 0],
    ],
    E: [
      [3, 4, 0, 4, 0, 0, 3, 0],
      [0, 2, 2.3, 2],
    ],
    N: [[0, 0, 0, 4, 3, 0, 3, 4]],
    A: [
      [0, 0, 1.5, 4, 3, 0],
      [0.6, 1.5, 2.4, 1.5],
    ],
    V: [[0, 4, 1.5, 0, 3, 4]],
    X: [
      [0, 0, 3, 4],
      [0, 4, 3, 0],
    ],
    L: [[0, 4, 0, 0, 3, 0]],
    H: [
      [0, 0, 0, 4],
      [3, 0, 3, 4],
      [0, 2, 3, 2],
    ],
    I: [
      [1.5, 0, 1.5, 4],
      [0.6, 0, 2.4, 0],
      [0.6, 4, 2.4, 4],
    ],
    M: [[0, 0, 0, 4, 1.5, 1.6, 3, 4, 3, 0]],
    Z: [[0, 4, 3, 4, 0, 0, 3, 0]],
    F: [
      [3, 4, 0, 4, 0, 0],
      [0, 2, 2.2, 2],
    ],
    Y: [
      [0, 4, 1.5, 2, 3, 4],
      [1.5, 2, 1.5, 0],
    ],
  };
  const CODE = 'TOKEN',
    FILL = 'AVXLHIMZFY';
  const letters = (i: number) => [
    CODE[i],
    ...Array.from({ length: NL - 1 }, (_, k) => FILL[(i * 3 + k) % FILL.length]),
  ];
  const at = (yc: number, a: number, u: number, v: number): W => {
    const r = RR + 0.06,
      b = a + ((v - 2) * 0.8) / r;
    return [X0 + r * Math.cos(b), yc + (u - 1.5) * 0.78, Z0 + r * Math.sin(b)];
  };
  const glyph = (ch: string, yc: number, col: string) => {
    for (const pl of GL[ch]) {
      const pts: W[] = [];
      for (let q = 0; q < pl.length; q += 2) pts.push(at(yc, A0, pl[q], pl[q + 1]));
      d.zig(pts, col);
    }
  };
  const ez = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const roll = (way: [number, number][], t: number) => {
    for (let i = 1; i < way.length; i++) {
      if (t <= way[i][0]) {
        const [t0, a0] = way[i - 1],
          [t1, a1] = way[i];
        return a0 + (a1 - a0) * ez((t - t0) / (t1 - t0 || 1));
      }
    }
    return way[way.length - 1][1];
  };
  const OFF = [3, -2, 4, -3, 2];
  const okWay = (i: number): [number, number][] => [
    [0, OFF[i]],
    [6 + i * 6, OFF[i]],
    [16 + i * 6, 0],
    [84, 0],
    [96, OFF[i]],
  ];
  const failWay = (i: number): [number, number][] =>
    i === 2
      ? [
          [0, OFF[i]],
          [6 + i * 6, OFF[i]],
          [16 + i * 6, 1],
          [84, 1],
          [96, OFF[i]],
        ]
      : okWay(i);
  const dialLetters = (i: number, yc: number, way: [number, number][], id: string, when: 'ok' | 'err' | 'any') => {
    letters(i).forEach((ch, k) => {
      const keys: K[] = [];
      const c0 = at(yc, A0, 1.5, 2);
      for (let t = 0; t <= 100; t += 4) {
        const a = A0 + (k - roll(way, t)) * DL,
          c = at(yc, a, 1.5, 2),
          dd = Math.abs(((((a - A0) * 180) / Math.PI + 540) % 360) - 180);
        keys.push({
          t,
          p: [c[0] - c0[0], c[1] - c0[1], c[2] - c0[2]],
          sy: Math.max(0.05, Math.cos(Math.min(Math.PI / 2, (dd * Math.PI) / 180))),
          o: Math.max(0, Math.min(1, (52 - dd) / 14)),
          e: LIN,
        });
      }
      d.fx(
        `${id}${i}${k}`,
        keys,
        () => {
          if (k === 0) d.open('acc');
          glyph(ch, yc, 'var(--line)');
          if (k === 0) d.close();
        },
        { pivot: c0, when, dur: 5.2 },
      );
    });
  };
  const knurl = (y0: number, y1: number) => {
    for (let k = -5; k <= 5; k++) {
      const a = A0 + k * 0.24;
      d.zig(
        [
          [X0 + (RC + 0.03) * Math.cos(a), y0, Z0 + (RC + 0.03) * Math.sin(a)],
          [X0 + (RC + 0.03) * Math.cos(a), y1, Z0 + (RC + 0.03) * Math.sin(a)],
        ],
        'var(--detail)',
      );
    }
  };
  const finial = (y: number, dir: number) => {
    if (dir < 0) {
      d.solid([...d.hc(X0, Z0, y, RC - 1.6), ...d.hc(X0, Z0, y - 1.8, RC - 1.6)]);
      d.solid([...d.hc(X0, Z0, y - 1.8, 2.6), ...d.hc(X0, Z0, y - 4.2, 2.6)]);
    } else {
      d.hcyl(X0, Z0, y, y + 1.8, RC - 1.6);
      d.hcyl(X0, Z0, y + 1.8, y + 4.2, 2.6);
    }
  };
  finial(0, -1);
  d.hcyl(X0, Z0, 0, yS - 0.4, RC);
  d.hseam(X0, Z0, 2, RC + 0.02);
  d.hseam(X0, Z0, yS - 2, RC + 0.02);
  knurl(2.5, yS - 2.5);
  for (let i = 0; i < ND; i++) {
    const y0 = yS + i * (DW + G);
    d.hcyl(X0, Z0, y0, y0 + DW, RR);
  }
  const allLetters = () => {
    for (let i = 0; i < ND; i++) {
      const yc = yS + i * (DW + G) + DW / 2;
      if (i === 2) {
        d.ok(() => dialLetters(i, yc, okWay(i), 'cx-o', 'ok'));
        d.fail(() => dialLetters(i, yc, failWay(i), 'cx-f', 'err'));
      } else dialLetters(i, yc, okWay(i), 'cx-a', 'any');
    }
  };
  cradle(yE - 6);
  const capR = () => {
    d.hcyl(X0, Z0, yE + 0.4, yE + 8, RC);
    d.hseam(X0, Z0, yE + 2.4, RC + 0.02);
    d.hseam(X0, Z0, yE + 6, RC + 0.02);
    knurl(yE + 2.9, yE + 5.5);
    finial(yE + 8, 1);
  };
  d.ok(() => {
    d.fx(
      'cx-cap',
      [
        { t: 0, p: [0, 0, 0] },
        { t: 46, e: 'cubic-bezier(.3,0,.3,1)' },
        { t: 56, p: [0, 4.2, 0] },
        { t: 76, e: IO },
        { t: 86, p: [0, 0, 0] },
      ],
      () => {
        d.open('acc');
        capR();
        d.close();
      },
      { when: 'ok', dur: 5.2 },
    );
  });
  d.fail(() => {
    d.fx(
      'cx-cap2',
      [
        { t: 0, p: [0, 0, 0] },
        { t: 44, e: 'cubic-bezier(.5,0,.8,.4)' },
        { t: 48, p: [0, 1.3, 0], e: OUT },
        { t: 50, p: [0, 0.4, 0] },
        { t: 86, e: IO },
        { t: 94, p: [0, 0, 0] },
      ],
      () => {
        d.open('acc');
        capR();
        d.close();
      },
      { dur: 5.2 },
    );
    d.burst('cx-hit', [X0 + RC * 0.8, yE + 0.4, Z0 + RC * 0.6], 48, 0.7);
    const from: W = [X0 + 1, yE + 0.2, Z0 - RR],
      to: W = [X0 + 1, yE + 0.2, 0.3];
    d.fx(
      'cx-drip',
      [
        { t: 0, p: from, o: 0, s: 0.4 },
        { t: 52, o: 0, s: 0.4, e: STEP },
        { t: 54, o: 1, s: 1, e: IN },
        { t: 60, p: [from[0], from[1], from[2] - 1.4], e: 'cubic-bezier(.5,0,1,.6)' },
        { t: 66, p: to, s: 1, o: 1, e: STEP },
        { t: 66.5, o: 0 },
      ],
      () => {
        d.open('acc');
        const q = pr([0, 0, 0]);
        d.els.push(`<circle cx="${f(q[0])}" cy="${f(q[1])}" r="1" fill="var(--line)"/>`);
        d.close();
      },
      { dur: 5.2 },
    );
    d.fx(
      'cx-pool',
      [
        { t: 0, o: 0, s: 0.2 },
        { t: 66, o: 0, s: 0.2, e: STEP },
        { t: 66.5, o: 1, s: 0.4, e: OUT },
        { t: 74, s: 1 },
        { t: 84, o: 1, e: IO },
        { t: 94, o: 0 },
      ],
      () => {
        d.open('acc');
        const q = pr(to);
        d.els.push(
          `<ellipse cx="${f(q[0])}" cy="${f(q[1])}" rx="3.2" ry="1.4" fill="var(--hole)" stroke="var(--line)"${S}/>`,
        );
        d.close();
      },
      { pivot: to, dur: 5.2 },
    );
  });
  allLetters();
  return d.svg(300, 230, 'secrets');
}
function deploys() {
  const d = new D();
  d.box(0, 0, 0, 36, 40, 46);
  d.lines('top', 46, [
    [6, 8, 6, 32],
    [12, 8, 12, 22],
  ]);
  d.quad('x', 36, 10, 0, 30, 24);
  d.box(36, 12, 0, 52, 16, 4);
  d.clip('dp-belt', [
    [37, 13, 4],
    [87, 13, 4],
    [87, 27, 4],
    [37, 27, 4],
  ]);
  {
    const a = pr([0, 0, 0]),
      b = pr([7, 0, 0]);
    d.els.push(`<g class="belt" style="--step:${f(b[0] - a[0])}px ${f(b[1] - a[1])}px">`);
  }
  d.lines(
    'top',
    4,
    Array.from({ length: 10 }, (_, k) => {
      const x = 31 + k * 7;
      return [x, 12, x, 28];
    }),
  );
  d.close();
  d.close();
  const crate = () => {
    d.box(4, 13, 4, 14, 14, 13);
    d.lines('top', 17, [[11, 13, 11, 27]]);
    d.lines('x', 18, [[13, 10.5, 27, 10.5]]);
  };
  d.ok(() => {
    d.clip('dp-door', [
      [36, 10, 0],
      [36, 30, 0],
      [36, 10, 24],
      [36, 30, 24],
      [160, 10, 0],
      [160, 30, 0],
      [160, 10, 24],
      [160, 30, 24],
    ]);
    for (const delay of [0, -2.05]) {
      d.stream([82, 0, 0], 4.1, delay);
      d.open('acc');
      crate();
      d.close();
      d.close();
    }
    d.close();
  });
  d.box(84, 4, 0, 26, 32, 30);
  d.lines('top', 30, [
    [90, 10, 90, 30],
    [96, 10, 96, 24],
  ]);
  d.lines('x', 110, [
    [10, 22, 20, 22],
    [10, 18, 16, 18],
  ]);
  d.quad('x', 110, 24, 20, 30, 24, { fill: 'var(--line)' });
  d.fail(() => {
    d.clipU('dp-fall', [
      [
        [36, 10, 0],
        [36, 30, 0],
        [36, 10, 24],
        [36, 30, 24],
        [160, 10, 0],
        [160, 30, 0],
        [160, 10, 24],
        [160, 30, 24],
      ],
      [
        [40, 26, -2],
        [40, 48, -2],
        [40, 26, 34],
        [40, 48, 34],
        [100, 26, -2],
        [100, 48, -2],
        [100, 26, 34],
        [100, 48, 34],
      ],
    ]);
    const rest: W = [50, 17, -4];
    d.fx(
      'dp-box',
      [
        { t: 0, p: rest, r: 28, o: 1 },
        { t: 7, o: 0, e: STEP },
        { t: 8, p: [0, 0, 0], r: 0, o: 0 },
        { t: 20, e: 'cubic-bezier(.4,0,1,1)' },
        { t: 26, p: [14, 0, 0], e: LIN },
        { t: 30, p: [24, 0, 0], o: 1, e: 'cubic-bezier(0,0,.4,1)' },
        { t: 34, p: [30, 0, 0] },
        { t: 35.5, p: [31, 0, 1], r: -8, e: OUT },
        { t: 38, p: [30.5, 0, 0], r: -2, e: ACC },
        { t: 40, p: [44, 1, 3], r: 6, e: OUT },
        ...d.drop(40, 47, [44, 1, 3], rest, 6, 28).slice(1),
        ...d.land(47, rest, 28, 1.4, 4),
      ],
      () => {
        d.open('acc');
        crate();
        d.close();
      },
      { pivot: [11, 20, 4] },
    );
    d.close();
    d.burst('dp-snag', [36, 27, 10], 35.5, 0.7);
    d.lampFx('dp-lamp', 36, () => d.quad('x', 36, 31, 27, 35, 30, { fill: 'var(--line)', stroke: false }));
    d.puff('dp-dust', [61, 37, 0], 47, [4, 2, 9]);
  });
  return d.svg(300, 230, 'deploys');
}
function traces() {
  const d = new D();
  const H = 30,
    SIDE = 40,
    DROP = H + 12;
  const v = (w: W) => {
    const a = pr([0, 0, 0]),
      b = pr(w);
    return `${f(b[0] - a[0])}px ${f(b[1] - a[1])}px`;
  };
  d.box(0, 0, 0, 40, 36, 22);
  d.quad('top', 22, 13, 5, 19, 31);
  d.lines('x', 40, [
    [6, 14, 16, 14],
    [6, 10, 12, 10],
  ]);
  d.quad('x', 40, 22, 8, 30, 14);
  d.box(4, 42, 0, 24, 32, 22);
  d.quad('top', 22, 7, 45, 25, 71);
  const trayP: W[] = [
    [7, 45, 22],
    [7, 45, 140],
    [7, 71, 22],
    [7, 71, 140],
    [25, 45, 22],
    [25, 45, 140],
    [25, 71, 22],
    [25, 71, 140],
  ];
  const feedP: W[] = [
    [13, 4, 22],
    [13, 4, 140],
    [13, 74, 22],
    [13, 74, 140],
    [19, 4, 22],
    [19, 4, 140],
    [19, 74, 22],
    [19, 74, 140],
  ];
  d.clipU('tr-tray', [trayP]);
  d.box(10.4, 48, 6, 1.2, 20, 20, { creases: false });
  d.close();
  const pg = () => {
    d.box(15.4, 7, 22 - H, 1.2, 22, H, { creases: false });
    d.lines(
      'x',
      16.6,
      [0, 1, 2, 3, 4, 5].map(k => {
        const vv = 22 - H + 4 + k * 4.4,
          len = [16, 12, 14, 10][k % 4];
        return [10, vv, 10 + len, vv];
      }),
    );
  };
  d.ok(() => {
    d.clipU('tr-feed', [feedP, trayP]);
    d.els.push(
      `<g class="acc job" style="--up:${v([0, 0, H])};--over:${v([0, SIDE, H + 3])};--in:${v([0, SIDE, H + 3 - DROP])}">`,
    );
    pg();
    d.close();
    d.close();
  });
  d.clipU('tr-tray2', [trayP]);
  d.box(20.4, 48, 6, 1.2, 20, 18, { creases: false });
  d.lines('x', 21.6, [
    [51, 20, 63, 20],
    [51, 17, 59, 17],
  ]);
  d.close();
  d.fail(() => {
    {
      const hp = (pts: W[]) => poly(hull(pts.map(pr)));
      const box = (x1: number, x2: number, y1: number, y2: number, z1: number, z2: number) =>
        [x1, x2].flatMap(x => [y1, y2].flatMap(y => [z1, z2].map(z => [x, y, z] as W)));
      d.els.push(
        `<mask id="tr-m2" maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800"><rect x="-400" y="-400" width="800" height="800" fill="black"/><path d="${hp(box(13, 19, 5, 31, 22, 140))}" fill="white"/></mask><g mask="url(#tr-m2)">`,
      );
    }
    d.fx(
      'tr-grow',
      [
        { t: 0, o: 0 },
        { t: 18, p: [0, 0, 0], e: STEP },
        { t: 18.5, o: 1, e: LIN },
        { t: 36, p: [0, 0, 14], e: OUT },
        { t: 39, p: [0, 0, 15.5] },
        { t: 40, o: 1 },
        { t: 43, o: 0 },
      ],
      () => {
        d.open('acc');
        pg();
        d.close();
      },
    );
    d.close();
    d.fx(
      'tr-wad',
      [
        { t: 0, p: [0, 0, 0], r: 0, o: 1, s: 1 },
        { t: 3, p: [0, 0, 9], r: -30, e: OUT },
        ...d.arc(3, 12, [0, 0, 9], [22, 42, -17], 10, -30, -250).slice(1),
        { t: 12, e: IN },
        { t: 14, p: [22, 42, -28], e: STEP },
        { t: 14.5, o: 0 },
        { t: 40, p: [0, 0, -3], r: 0, s: 0.3, o: 0, e: STEP },
        { t: 40.2, o: 1, e: OUT },
        { t: 43, p: [0, 0, 0], s: 1.06 },
        { t: 45, s: 1 },
        { t: 60, e: IO },
        { t: 63, p: [0, 0, -1.2], r: -5 },
        { t: 66, p: [0, 0, 0], r: 0 },
      ],
      () => {
        d.open('acc');
        d.wad([16, 18, 26], 6);
        d.close();
      },
      { pivot: [16, 18, 26] },
    );
    d.lampFx('tr-lamp', 40, () => d.quad('x', 40, 22, 8, 30, 14, { fill: 'var(--line)', stroke: false }));
    d.puff('tr-smoke', [16, 18, 30], 42, [3, -2, 14]);
  });
  d.cyl(38, 60, 0, 5, 11);
  d.hole(38, 60, 11, 4);
  return d.svg(300, 230, 'traces');
}
function gateway() {
  const d = new D();
  for (const y of [-2, 16, 34]) {
    d.box(-38, y, 0, 14, 14, 10);
    d.lines('top', 10, [[-34, y + 4, -34, y + 10]]);
  }
  for (const y of [5, 41]) d.link([12, 22, 12], [-24, y, 5], [[0.5, PK]], 0.2);
  const A: W = [12, 22, 12],
    B: W = [-24, 23, 5];
  d.ok(() => d.link(A, B, [[0.5, PK]], 0.2));
  d.fail(() => {
    d.fx(
      'gw-link',
      [
        { t: 0, o: 0 },
        { t: 10, e: STEP },
        { t: 10.5, o: 1 },
        { t: 44, e: STEP },
        { t: 44.5, o: 0 },
      ],
      () => {
        d.open('acc');
        d.link(A, B, [], 0.2);
        d.close();
      },
    );
    d.fx(
      'gw-s1',
      [
        { t: 0, o: 1, r: 0 },
        { t: 9, r: -10 },
        { t: 10, e: STEP },
        { t: 10.5, o: 0 },
        { t: 44, r: -10, e: STEP },
        { t: 44.5, o: 1, r: 16, e: OUT },
        { t: 48, r: -7 },
        { t: 52, r: 3 },
        { t: 56, r: 0 },
      ],
      () => {
        d.open('acc');
        d.link(A, [-2, 22, 9], [], 0.2);
        d.close();
      },
      { pivot: A },
    );
    d.fx(
      'gw-s2',
      [
        { t: 0, o: 1, r: 0 },
        { t: 9, r: 10 },
        { t: 10, e: STEP },
        { t: 10.5, o: 0 },
        { t: 44, r: 10, e: STEP },
        { t: 44.5, o: 1, r: -16, e: OUT },
        { t: 48, r: 7 },
        { t: 52, r: -3 },
        { t: 56, r: 0 },
      ],
      () => {
        d.open('acc');
        d.link([-14, 23, 6], B, [], 0.2);
        d.close();
      },
      { pivot: B },
    );
    const lp = d.linkPath(A, B, 0.2),
      S = d.linkPoint(A, B, 0.2, 0.5),
      F = pr([-6, 22.6, 0.5]),
      qF: [number, number] = [F[0] - S[0], F[1] - S[1]];
    d.fx(
      'gw-pk',
      [
        { t: 0, o: 1, od: 50, q: qF },
        { t: 6, o: 0 },
        { t: 20, od: 0, q: [0, 0], e: STEP },
        { t: 20.5, o: 1, e: LIN },
        { t: 43, od: 46 },
        { t: 44.5, od: 50, e: LIN },
        ...d.sfall(44.5, 50, qF, 4),
      ],
      () => d.els.push('<circle r="2.6" fill="var(--packet)"/>'),
      { style: `offset-path:path('${lp}');offset-rotate:0deg` },
    );
    d.burst('gw-snap', [-6, 22.5, 8], 44, 1);
    d.puff('gw-smoke', [-6, 22.5, 9], 46, [2, -2, 13]);
  });
  d.box(4, 4, 0, 36, 36, 12);
  d.lines('x', 40, [[8, 6, 18, 6]]);
  for (const [y, on] of [
    [22, 1],
    [28, 1],
    [34, 0],
  ])
    d.quad('x', 40, y - 2, 8, y, 10, { fill: on ? 'var(--line)' : 'var(--hole)' });
  d.fail(() => d.lampFx('gw-lamp', 44, () => d.quad('x', 40, 32, 8, 34, 10, { fill: 'var(--line)', stroke: false })));
  d.open('acc');
  d.box(12, 12, 12, 20, 20, 3);
  d.lines('top', 15, [
    [18, 16, 18, 28],
    [24, 16, 24, 24],
  ]);
  d.close();
  d.link(
    [74, 22, 4],
    [40, 22, 6],
    [
      [0.35, PK],
      [0.7, PK],
    ],
    0.2,
  );
  return d.svg(300, 230, 'gateway');
}
function byok() {
  const d = new D();
  d.box(0, 0, 0, 30, 40, 30);
  d.quad('top', 30, 12, 6, 16, 34);
  d.quad('x', 30, 8, 8, 32, 18, { fill: 'var(--face)' });
  d.lines('x', 30, [[12, 13, 28, 13]]);
  d.quad('x', 30, 26, 22, 30, 25, { fill: 'var(--line)' });
  const card = () => {
    d.box(13.4, 8, 20, 1.2, 24, 30, { creases: false });
    d.quad('x', 14.6, 11, 38, 17, 44);
    d.lines('x', 14.6, [
      [20, 42, 29, 42],
      [20, 39, 26, 39],
    ]);
  };
  const slot: W[] = [
    [12, 7, 30],
    [16, 7, 30],
    [12, 33, 30],
    [16, 33, 30],
    [12, 7, 120],
    [16, 7, 120],
    [12, 33, 120],
    [16, 33, 120],
  ];
  const above: W[] = [
    [12, -6, 31.4],
    [16, -6, 31.4],
    [12, 46, 31.4],
    [16, 46, 31.4],
    [12, -6, 120],
    [16, -6, 120],
    [12, 46, 120],
    [16, 46, 120],
  ];
  d.ok(() => {
    d.clipU('bk-slot', [slot, above]);
    d.g('acc created drawer', { shift: [0, 0, -14] });
    card();
    d.close();
    d.close();
  });
  d.fail(() => {
    d.clipU('bk-slot2', [slot, above]);
    d.fx(
      'bk-card',
      [
        { t: 0, p: [0, 0, 6], r: -6 },
        { t: 5, p: [0, 0, 14], r: 0, e: OUT },
        { t: 18 },
        { t: 26, p: [0, 0, -14] },
        { t: 34, e: OUT },
        { t: 37, p: [0, 0, 9], r: -9, e: IN },
        { t: 40, p: [0, 0, 6], r: -6 },
      ],
      () => {
        d.open('acc');
        card();
        d.close();
      },
      { pivot: [14, 20, 30] },
    );
    d.close();
    d.lampFx('bk-lamp', 34, () => d.quad('x', 30, 26, 22, 30, 25, { fill: 'var(--line)', stroke: false }));
    d.fx(
      'bk-x',
      [
        { t: 0, d: 0, o: 1 },
        { t: 8, o: 0 },
        { t: 12, d: 1, e: STEP },
        { t: 14, o: 1 },
        { t: 35, d: 1, e: OUT },
        { t: 39, d: 0 },
      ],
      () => {
        d.open('acc');
        d.ink('x', 30, [
          [12, 10, 28, 16],
          [12, 16, 28, 10],
        ]);
        d.close();
      },
    );
  });
  return d.svg(300, 230, 'byok');
}
function projects() {
  const d = new D();
  d.box(0, 0, 0, 30, 40, 34);
  for (const [y1, y2] of [
    [5, 13],
    [16, 24],
    [27, 35],
  ])
    for (const [z1, z2] of [
      [6, 13],
      [18, 25],
    ])
      d.quad('x', 30, y1, z1, y2, z2);
  for (const [x, y] of [
    [1, 1],
    [27, 1],
    [1, 37],
    [27, 37],
  ])
    d.box(x, y, 34, 2, 2, 10, { creases: false });
  d.outline([
    [1, 1, 44],
    [29, 1, 44],
    [29, 39, 44],
    [1, 39, 44],
  ]);
  d.box(34, 12, 0, 12, 14, 58);
  d.box(35, 13, 58, 10, 12, 3, { creases: false });
  d.quad('x', 46, 15, 4, 23, 54);
  const win: W[] = [
    [46, 15, 4],
    [46, 23, 4],
    [46, 15, 54],
    [46, 23, 54],
  ];
  d.ok(() => {
    d.clipU('pj-win', [win]);
    d.g('acc tick', { dur: '1.6s', step: [0, 0, 12] });
    for (let z = -12; z <= 60; z += 12) {
      d.box(37, 16, z, 7, 6, 2, { creases: false });
    }
    d.close();
    d.close();
  });
  d.fail(() => {
    d.clipU('pj-win2', [win]);
    d.fx(
      'pj-cable',
      [
        { t: 0, sy: 0.12 },
        { t: 4, sy: 0.12 },
        { t: 12, sy: 1 },
        { t: 20, sy: 1 },
        { t: 38, sy: 0.216 },
        { t: 39, sy: 0.19, e: OUT },
        { t: 40.5, sy: 0.2 },
        { t: 42, sy: 0.2, e: OUT },
        { t: 43.5, sy: 0.06, e: IN },
        { t: 45, sy: 0.14, e: OUT },
        { t: 46.5, sy: 0.12 },
      ],
      () => {
        d.open('acc');
        d.zig([
          [40.5, 19, 57],
          [40.5, 19, 6],
        ]);
        d.close();
      },
      { pivot: [40.5, 19, 57] },
    );
    d.fx(
      'pj-car',
      [
        { t: 0, p: [0, 0, 0] },
        { t: 20 },
        { t: 38, p: [0, 0, 40] },
        { t: 39, p: [0, 0, 41.2], e: OUT },
        { t: 40.5, p: [0, 0, 40.4] },
        { t: 42, e: IN },
        { t: 47, p: [0, 0, 0], e: OUT },
        { t: 48.5, p: [0, 0, 3], e: IN },
        { t: 50, p: [0, 0, 0], e: OUT },
        { t: 51, p: [0, 0, 1], e: IN },
        { t: 52, p: [0, 0, 0] },
      ],
      () => {
        d.open('acc');
        d.box(37, 16, 4, 7, 6, 2, { creases: false });
        d.close();
      },
    );
    d.close();
    d.open('acc');
    d.box(2, 44, 0, 2, 2, 8, { creases: false });
    d.box(26, 44, 0, 2, 2, 8, { creases: false });
    d.box(0, 44, 7, 30, 1.2, 4, { creases: false });
    d.lines(
      'y',
      45.2,
      [0, 1, 2, 3, 4].map(k => [2 + k * 6, 7, 5 + k * 6, 11]),
    );
    d.close();
    d.lampFx('pj-beacon', 42, () => d.cyl(40, 19, 61, 2, 2.5));
    d.puff('pj-dust', [46, 19, 5], 47, [4, -2, 10]);
  });
  return d.svg(300, 230, 'projects');
}
function workers() {
  const d = new D();
  d.box(30, 9, 0, 46, 16, 4);
  d.box(0, 0, 0, 30, 34, 30);
  d.quad('x', 30, 9, 0, 25, 16);
  d.lines('top', 30, [[6, 6, 6, 28]]);
  const lamp = (i: number) =>
    d.quad('x', 30, 7 + i * 5.5, 22, 10.5 + i * 5.5, 25.5, { fill: 'var(--line)', stroke: false });
  d.ok(() => {
    for (let i = 0; i < 4; i++) {
      d.g('acc lamp4', { delay: `${f(-6.4 + i * 1.6)}s` });
      lamp(i);
      d.close();
    }
    d.clipU('wk-belt', [
      [
        [30, 9, 0],
        [30, 25, 0],
        [30, 9, 16],
        [30, 25, 16],
      ],
      [
        [30, 9, 0],
        [30, 25, 0],
        [30, 9, 20],
        [30, 25, 20],
        [76, 9, 0],
        [76, 25, 0],
        [76, 9, 20],
        [76, 25, 20],
      ],
    ]);
    d.g('acc tick', { dur: '1.6s', step: [13, 0, 0] });
    for (let x = -2; x <= 88; x += 13) d.box(x, 11, 4, 8, 10, 8);
    d.close();
    d.close();
  });
  d.fail(() => {
    d.open('acc');
    d.box(50.5, 11, 4, 8, 10, 8);
    d.box(63.5, 11, 4, 8, 10, 8);
    d.close();
    const rest: W = [14, 19, -4];
    d.fx(
      'wk-crate',
      [
        { t: 0, p: rest, r: 22 },
        ...d.arc(2, 12, rest, [0, 0, 0], 8, 22, 0),
        { t: 20 },
        { t: 24, p: [6, 0, 0] },
        { t: 28, e: OUT },
        { t: 32, p: [10, 0, 5], r: -12 },
        { t: 35, p: [12.5, 0, 8], r: -18 },
        { t: 38, r: -14 },
        { t: 41, r: -20, e: LIN },
        ...d.drop(41, 48, [12.5, 0, 8], rest, -20, 22).slice(1),
        ...d.land(48, rest, 22, 1.4, 4),
      ],
      () => {
        d.open('acc');
        d.box(37.5, 11, 4, 8, 10, 8);
        d.close();
      },
      { pivot: [41.5, 16, 4] },
    );
    for (let i = 0; i < 4; i++)
      d.fx(
        'wk-l' + i,
        [
          { t: 0, o: 1 },
          { t: 8, o: 0 },
          { t: 20 + i * 3, o: 0, e: STEP },
          { t: 20.1 + i * 3, o: 1, e: STEP },
          { t: 23 + i * 3, o: 1, e: STEP },
          { t: 23.1 + i * 3, o: 0 },
          { t: 42, o: 0, e: STEP },
          { t: 42.1, o: 1, e: STEP },
          { t: 44.5, o: 0.12, e: STEP },
          { t: 47, o: 1, e: STEP },
          { t: 49.5, o: 0.12, e: STEP },
          { t: 52, o: 1 },
        ],
        () => {
          d.open('acc');
          lamp(i);
          d.close();
        },
      );
    d.puff('wk-smoke', [30, 17, 16], 33, [-3, 0, 14]);
    d.puff('wk-dust', [55.5, 35, 0], 48, [3, 3, 8]);
  });
  d.box(74, 2, 0, 26, 30, 24);
  d.lines('x', 100, [
    [8, 16, 22, 16],
    [8, 12, 16, 12],
  ]);
  d.quad('x', 100, 22, 6, 28, 12);
  return d.svg(300, 230, 'workers');
}
function importers() {
  const d = new D();
  d.box(-28, 14, 0, 4, 4, 48, { creases: false });
  d.box(-34, 6, 48, 22, 22, 14);
  d.quad('x', -12, 10, 52, 24, 60);
  const A: W = [-12, 11, 53],
    B: W = [14, 11, 38],
    C: W = [14, 23, 38],
    D0: W = [-12, 23, 53];
  d.facePoly([A, B, C, D0]);
  d.outline([A, B, C, D0]);
  d.box(0, 0, 0, 40, 36, 38);
  d.lines('x', 40, [
    [3, 26, 33, 26],
    [3, 12, 33, 12],
    [14, 19, 22, 19],
    [14, 5, 22, 5],
  ]);
  d.quad('top', 38, 12, 10, 17, 26);
  const chuteP: W[] = [
    [-12, 11, 53],
    [-12, 23, 53],
    [-12, 11, 62],
    [-12, 23, 62],
    [14, 11, 38],
    [14, 23, 38],
    [14, 11, 47],
    [14, 23, 47],
  ];
  const L = 26,
    DZ = -15,
    sp = 0.34;
  const at = (t: number, y: number, dz = 0): W => [-12 + L * t, y, 53 + DZ * t + 1 + dz];
  const env = (t: number) => {
    const p = [at(t, 13), at(t + 0.2, 13), at(t + 0.2, 21), at(t, 21)];
    d.facePoly(p);
    d.outline(p);
    d.els.push(
      `<path d="M${pr(at(t, 13))
        .map(n => +n.toFixed(1))
        .join(',')}L${pr(at(t + 0.1, 17))
        .map(n => +n.toFixed(1))
        .join(',')}L${pr(at(t, 21))
        .map(n => +n.toFixed(1))
        .join(',')}" fill="none" stroke="var(--detail)" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
    );
  };
  d.ok(() => {
    d.clipU('im-chute', [chuteP]);
    d.g('acc tick', { dur: '1.5s', step: [L * sp, 0, DZ * sp] });
    for (let k = -2; k <= 3; k++) env(k * sp);
    d.close();
    d.close();
  });
  d.fail(() => {
    const al = (u: number): W => [L * u, 0, DZ * u];
    const pv = at(0.1, 17);
    d.clipU('im-chute2', [chuteP]);
    d.fx(
      'im-e1',
      [
        { t: 0, p: al(0.78), r: 12, e: IN },
        { t: 6, p: al(1.05), r: 0, e: STEP },
        { t: 18, p: al(-0.3) },
        { t: 34, p: al(0.78), e: OUT },
        { t: 36.5, r: 12 },
      ],
      () => {
        d.open('acc');
        env(0);
        d.close();
      },
      { pivot: pv },
    );
    d.fx(
      'im-e2',
      [
        { t: 0, p: al(0.52), r: -7, e: IN },
        { t: 9, p: al(1.05), r: 0, e: STEP },
        { t: 22, p: al(-0.3) },
        { t: 38, p: al(0.52), e: OUT },
        { t: 40, r: -7 },
      ],
      () => {
        d.open('acc');
        env(0);
        d.close();
      },
      { pivot: pv },
    );
    d.fx(
      'im-e3',
      [
        { t: 0, o: 0, p: al(-0.3) },
        { t: 26, o: 1 },
        { t: 40, p: al(0.3), e: STEP },
        { t: 40.1, o: 0 },
      ],
      () => {
        d.open('acc');
        env(0);
        d.close();
      },
      { pivot: pv },
    );
    d.close();
    const fl: W = [-10.6, 15, -52],
      bump: W = [7.8, -4, -1.5];
    d.fx(
      'im-e3b',
      [
        { t: 0, p: fl, r: 60, o: 1 },
        { t: 5, o: 0, s: 0.9 },
        { t: 40, p: al(0.3), r: 0, o: 0, s: 1, e: STEP },
        { t: 40.1, o: 1, e: OUT },
        { t: 42, p: bump, r: -10, e: LIN },
        ...d.drop(42, 49, bump, fl, -10, 60).slice(1),
        ...d.land(49, fl, 60, 1, 4),
      ],
      () => {
        d.open('acc');
        env(0);
        d.close();
      },
      { pivot: pv },
    );
    d.burst('im-jam', [14, 17, 40], 36, 0.8);
  });
  return d.svg(300, 230, 'importers');
}
function envVars() {
  const d = new D();
  d.box(0, 0, 0, 14, 42, 50);
  d.quad('x', 14, 3, 3, 39, 47, { fill: 'var(--face)' });
  const pos: [number, number][] = [];
  for (const z of [36, 24, 12]) for (const y of [7, 23]) pos.push([y, z]);
  const sw = ([y, z]: [number, number]) => d.box(14, y + 1, z + 1, 2.5, 3, 3, { creases: false });
  const lamp = ([y, z]: [number, number]) =>
    d.quad('x', 14, y + 8, z + 5, y + 10, z + 7, { fill: 'var(--line)', stroke: false });
  pos.forEach(([y, z]) => {
    d.quad('x', 14, y, z, y + 5, z + 8);
    d.lines('x', 14, [[y + 7, z + 1, y + 12, z + 1]]);
  });
  d.ok(() =>
    pos.forEach((pz, i) => {
      d.g('acc flip', { delay: `${f(i * 0.55)}s`, shift: [0, 0, 4] });
      sw(pz);
      d.close();
      d.g('acc lamp', { delay: `${f(i * 0.55)}s` });
      lamp(pz);
      d.close();
    }),
  );
  d.fail(() => {
    const up: W = [0, 0, 4];
    pos.slice(3).forEach(pz => sw(pz));
    d.fx(
      'ev-s0',
      [
        { t: 0, p: [0, 0, 0] },
        { t: 20, e: OUT },
        { t: 22, p: up },
        { t: 38, e: IN },
        { t: 40, p: [0, 0, 0] },
      ],
      () => sw(pos[0]),
    );
    d.fx(
      'ev-l0',
      [
        { t: 0, o: 0 },
        { t: 22, e: STEP },
        { t: 22.1, o: 1 },
        { t: 38, e: STEP },
        { t: 38.1, o: 0 },
      ],
      () => lamp(pos[0]),
    );
    d.fx(
      'ev-s1',
      [
        { t: 0, p: [0, 0, 0] },
        { t: 23, e: OUT },
        { t: 25, p: up },
        { t: 39.5, e: IN },
        { t: 41.5, p: [0, 0, 0] },
      ],
      () => sw(pos[1]),
    );
    d.fx(
      'ev-l1',
      [
        { t: 0, o: 0 },
        { t: 25, e: STEP },
        { t: 25.1, o: 1 },
        { t: 39.5, e: STEP },
        { t: 39.6, o: 0 },
      ],
      () => lamp(pos[1]),
    );
    d.fx(
      'ev-s2',
      [
        { t: 0, p: [0, 0, 0] },
        { t: 26, e: OUT },
        { t: 28, p: up },
        { t: 30, e: IN },
        { t: 31, p: [0, 0, 0], e: OUT },
        { t: 32.5, p: [0, 0, 1], e: IN },
        { t: 34, p: [0, 0, 0] },
      ],
      () => {
        d.open('acc');
        sw(pos[2]);
        d.close();
      },
    );
    d.fx(
      'ev-l2',
      [
        { t: 0, o: 1 },
        { t: 8, o: 0 },
        { t: 28, e: STEP },
        { t: 28.1, o: 1 },
        { t: 31, e: STEP },
        { t: 31.1, o: 0.12, e: STEP },
        { t: 33.5, o: 1, e: STEP },
        { t: 36, o: 0.12, e: STEP },
        { t: 38.5, o: 1 },
      ],
      () => {
        d.open('acc');
        lamp(pos[2]);
        d.close();
      },
    );
    d.burst('ev-trip', [16, 9.5, 27], 31, 0.8);
    d.puff('ev-smoke', [7, 21, 50], 33, [2, -2, 14]);
  });
  return d.svg(300, 230, 'env-vars');
}
function widgets() {
  const d = new D();
  d.box(4, 26, 0, 6, 6, 8, { creases: false });
  d.box(0, 0, 8, 8, 58, 42);
  const S0 = [
    [4, 28, 28, 46],
    [32, 54, 28, 46],
    [4, 28, 12, 26],
    [32, 54, 12, 26],
  ];
  S0.forEach(([y1, y2, z1, z2]) => d.quad('x', 8, y1, z1, y2, z2));
  d.lines('x', 8, [
    [7, 40, 22, 40],
    [7, 36, 16, 36],
    [35, 32, 41, 38],
    [41, 38, 45, 34],
    [45, 34, 51, 41],
    [7, 22, 25, 22],
    [7, 18, 19, 18],
    [7, 15, 22, 15],
  ]);
  const scr: W[] = [
    [8, 32, 12],
    [8, 54, 12],
    [8, 32, 26],
    [8, 54, 26],
  ];
  const bars: [number, number, string, number][] = [
    [35, 0, '1.8s', -6],
    [40, -0.5, '2.2s', -3],
    [45, -1.1, '1.6s', -7],
    [50, -0.3, '2.4s', -4],
  ];
  const bar = (y: number) => d.box(8, y, 4, 1, 3, 20, { creases: false });
  d.ok(() => {
    d.clipU('wd-scr', [scr]);
    bars.forEach(([y, del, dur, amt]) => {
      d.g('acc bob', { delay: `${del}s`, dur, shift: [0, 0, amt] });
      bar(y);
      d.close();
    });
    d.close();
  });
  d.fail(() => {
    d.clipU('wd-scr2', [scr]);
    bars.forEach(([y, , , amt], j) =>
      d.fx(
        'wd-b' + j,
        [
          { t: 0, p: [0, 0, -10] },
          { t: 9 + j * 1.2, e: OUT },
          { t: 14 + j * 1.2, p: [0, 0, 0] },
          { t: 20 },
          { t: 24 + j, p: [0, 0, amt] },
          { t: 29 + j, p: [0, 0, 0] },
          { t: 34 + j, p: [0, 0, amt * 0.7] },
          { t: 39, p: [0, 0, 0], e: IN },
          { t: 41 + j * 2, p: [0, 0, 0], e: IN },
          { t: 44 + j * 2, p: [0, 0, -10], e: OUT },
          { t: 45.5 + j * 2, p: [0, 0, -8.8], e: IN },
          { t: 47 + j * 2, p: [0, 0, -10] },
        ],
        () => {
          d.open('acc');
          bar(y);
          d.close();
        },
      ),
    );
    d.fx(
      'wd-flat',
      [
        { t: 0, d: 0, o: 1 },
        { t: 8, o: 0 },
        { t: 12, d: 1, e: STEP },
        { t: 14, o: 1 },
        { t: 49, d: 1, e: OUT },
        { t: 54, d: 0 },
      ],
      () => {
        d.open('acc');
        d.ink('x', 8, [[33, 14.5, 53, 14.5]]);
        d.close();
      },
    );
    d.close();
    d.lampFx('wd-lamp', 47, () => d.quad('x', 10, 28, 3, 30, 5, { fill: 'var(--line)', stroke: false }));
  });
  return d.svg(300, 230, 'widgets');
}
function destinations() {
  const d = new D();
  const arc = (x: number) =>
    Array.from({ length: 13 }, (_, i) => {
      const y = (i * 16) / 12;
      return [x, y, 46 + Math.sqrt(Math.max(0, 64 - (y - 8) ** 2))] as W;
    });
  d.box(10, 6, 0, 4, 4, 34, { creases: false });
  d.box(4, 2, 32, 22, 12, 2, { creases: false });
  d.solid([[0, 0, 34], [30, 0, 34], [0, 16, 34], [30, 16, 34], ...arc(0), ...arc(30)]);
  d.sheet([[30, 0, 34], [30, 16, 34], ...arc(30).reverse()]);
  d.lines('x', 30, [[2, 36, 14, 36]]);
  d.quad('x', 30, 4, 40, 12, 41.5);
  d.box(42, 20, 0, 12, 12, 16);
  d.box(43, 21, 16, 10, 8, 0.8, { creases: false });
  d.box(43.5, 21.5, 16.8, 10, 8, 0.8, { creases: false });
  const letter = () => {
    d.box(43, 21.5, 17.6, 10, 7, 0.8, { creases: false });
    d.lines('top', 18.4, [
      [43, 21.5, 47, 25],
      [47, 25, 43, 28.5],
    ]);
  };
  const flag = () => {
    d.box(6, 16, 39.5, 16, 1, 1.4, { creases: false });
    d.box(18, 16, 40.9, 4, 1, 5, { creases: false });
  };
  d.ok(() => {
    d.g('acc mbfly', { up: [0, 0, 30], over: [-12.5, -17, 26], mouth: [-12.5, -17, 22.6] });
    letter();
    d.close();
    d.clipU('mb-slot', [
      [
        [30, 4, 40],
        [80, 4, 40],
        [30, 12, 40],
        [80, 12, 40],
        [30, 4, 41.5],
        [80, 4, 41.5],
        [30, 12, 41.5],
        [80, 12, 41.5],
      ],
    ]);
    d.g('acc mbin', { push: [-11, 0, 0] });
    d.box(30.5, 4.5, 40.2, 10, 7, 0.8, { creases: false });
    d.close();
    d.close();
    const pv = pr([7, 16.5, 40.2]);
    d.els.push(`<g class="acc mbflag" style="transform-origin:${f(pv[0])}px ${f(pv[1])}px">`);
    flag();
    d.close();
  });
  d.fail(() => {
    const fl: W = [-22, -1, -17.6];
    d.fx(
      'mb-letter',
      [
        { t: 0, p: fl, r: 15 },
        ...d.arc(2, 13, fl, [0, 0, 0], 14, 15, 0),
        { t: 22, e: OUT },
        { t: 30, p: [0, 0, 30] },
        { t: 36, p: [-12.5, -17, 26] },
        { t: 38, p: [-12.5, -17, 22.6], e: OUT },
        { t: 39.5, p: [-10.5, -17, 23.4], r: -6, e: LIN },
        ...d.drop(39.5, 47, [-10.5, -17, 23.4], fl, -6, 15).slice(1),
        ...d.land(47, fl, 15, 1.2, 4),
      ],
      () => {
        d.open('acc');
        letter();
        d.close();
      },
      { pivot: [48, 25, 18] },
    );
    const FR = -60;
    d.fx(
      'mb-flag',
      [
        { t: 0, r: FR },
        { t: 11, r: 0, e: OUT },
        { t: 39.5, e: IN },
        { t: 43, r: FR * 1.15, e: OUT },
        { t: 46, r: FR * 0.85 },
        { t: 49, r: FR * 1.05 },
        { t: 52, r: FR },
      ],
      () => {
        d.open('acc');
        flag();
        d.close();
      },
      { pivot: [7, 16.5, 40.2] },
    );
    d.burst('mb-hit', [30, 8, 41], 38, 0.7);
  });
  d.cyl(7, 16.6, 40.2, 1.2, 1);
  return d.svg(300, 230, 'destinations');
}
function license() {
  const d = new D();
  d.box(0, 0, 0, 32, 40, 8);
  d.lines('x', 32, [
    [4, 4, 14, 4],
    [4, 2.4, 10, 2.4],
  ]);
  d.box(6, 44, 0, 18, 14, 6);
  d.quad('top', 6, 8, 46, 22, 56);
  const card = (x: number, y: number, z: number, seal: boolean | 'fx', sid = '') => {
    d.box(x, y, z, 12, 10, 0.6, { creases: false });
    d.lines('top', z + 0.6, [
      [x + 2, y + 2, x + 2, y + 6],
      [x + 4, y + 2, x + 4, y + 5],
    ]);
    const s = () => {
      d.cyl(x + 7.5, y + 6, z + 0.6, 2.1, 0.3);
    };
    if (seal === true) s();
    else if (seal === 'fx')
      d.fx(
        sid,
        [
          { t: 0, o: 0 },
          { t: 34, o: 0, e: STEP },
          { t: 34.1, o: 1 },
          { t: 99.9, o: 1, e: STEP },
        ],
        s,
        { when: 'ok', dur: 3.6 },
      );
  };
  d.ok(() => {
    d.open('acc');
    card(8, 46, 6, true);
    card(8.6, 46.4, 6.6, true);
    d.close();
  });
  d.fail(() => {
    card(8, 46, 6, true);
    card(8.6, 46.4, 6.6, true);
  });
  d.box(0, 14, 8, 8, 10, 38);
  const rod = () => {
    d.cyl(17, 19, 30, 1.5, 26);
    d.bb = [1e9, 1e9, -1e9, -1e9];
  };
  const head = () => {
    d.cyl(17, 19, 24, 5, 6);
    d.ring(17, 19, 27, 5);
  };
  const rodClip: W[] = [14, 20].flatMap(x => [16, 22].flatMap(y => [-20, 40].map(z => [x, y, z] as W)));
  const hk: K[] = [
    { t: 0, p: [0, 0, 0] },
    { t: 28, e: 'cubic-bezier(.55,0,1,.45)' },
    { t: 34, p: [0, 0, -15.4], e: OUT },
    { t: 35, p: [0, 0, -15] },
    { t: 40, e: 'cubic-bezier(.3,0,.2,1)' },
    { t: 52, p: [0, 0, 0] },
  ];
  d.ok(() => {
    d.fx(
      'lc-card',
      [
        { t: 0, p: [0, -13, 0], o: 0 },
        { t: 2, e: 'cubic-bezier(.3,0,.2,1)' },
        { t: 24, p: [0, 0, 0], o: 1 },
        { t: 54, e: IO },
        { t: 66, p: [-2, 30, 0], e: IN },
        { t: 71, p: [-2, 32, -0.8], e: OUT },
        { t: 80, o: 1 },
        { t: 92, o: 0 },
        { t: 99.9, p: [0, -13, 0], o: 0, e: STEP },
      ],
      () => {
        d.open('acc');
        card(11, 14, 8, 'fx', 'lc-seal');
        d.close();
      },
      { when: 'ok', dur: 3.6 },
    );
    d.clipU('lc-rc', [rodClip]);
    d.fx('lc-rod', hk, rod, { when: 'ok', dur: 3.6 });
    d.close();
    d.fx('lc-head', hk, head, { when: 'ok', dur: 3.6 });
  });
  d.fail(() => {
    d.fx(
      'lc-card2',
      [
        { t: 0, p: [0, -14, 0], o: 0 },
        { t: 2, e: 'cubic-bezier(.3,0,.2,1)' },
        { t: 22, p: [0, -10, 0], o: 1, e: OUT },
        { t: 25, p: [0, -12.5, 0] },
        { t: 30, e: IO },
        { t: 40, p: [13, -12.5, 0], e: LIN },
        ...d.drop(40, 47, [13, -12.5, 0], [22, -13, -8], 0, 22).slice(1),
        ...d.land(47, [22, -13, -8], 22, 1, 4),
        { t: 64, o: 1 },
        { t: 76, o: 0 },
        { t: 99.9, p: [0, -14, 0], r: 0, o: 0, e: STEP },
      ],
      () => {
        d.open('acc');
        card(11, 14, 8, false);
        d.close();
      },
      { pivot: [17, 19, 8] },
    );
    d.burst('lc-hit', [17, 14, 10], 22, 0.8);
    d.clipU('lc-rc2', [rodClip]);
    d.fx('lc-rod2', [{ t: 0, p: [0, 0, -15.4] }], rod);
    d.close();
    d.fx('lc-head2', [{ t: 0, p: [0, 0, -15.4] }], () => {
      d.open('acc');
      head();
      d.close();
    });
  });
  d.box(0, 15, 40, 24, 8, 5);
  return d.svg(300, 230, 'license');
}
function gate(d: D, x0: number, x1: number, y: number, id: string, fk: K[], inner?: () => void) {
  d.box(x0 - 7, y - 2, 0, 6, 5, 30);
  const cp: W[] = [
    [x0 - 1, y - 3, 0],
    [x1, y - 3, 0],
    [x0 - 1, y + 5, 0],
    [x1, y + 5, 0],
    [x0 - 1, y - 3, 32],
    [x1, y - 3, 32],
    [x0 - 1, y + 5, 32],
    [x1, y + 5, 32],
  ];
  const bars = () => {
    d.box(x0, y, 25, x1 - x0, 1.2, 2, { creases: false });
    d.box(x0, y, 2, x1 - x0, 1.2, 2, { creases: false });
    for (let x = x0 + 2; x < x1; x += 7) d.box(x, y, 0, 1.5, 1.2, 28, { creases: false });
  };
  d.ok(() => {
    d.clipU(id + '-g', [cp]);
    d.g('drawer', { shift: [-(x1 - x0), 0, 0] });
    bars();
    d.close();
    d.close();
  });
  d.fail(() => {
    d.clipU(id + '-g2', [cp]);
    d.fx(id + '-gate', fk, () => {
      bars();
      inner?.();
    });
    d.close();
  });
  d.box(x1, y - 2, 0, 4, 5, 30);
}
function logs() {
  const d = new D();
  const A: W = [15, 14, 6],
    B: W = [15, 50, 6],
    R = 11,
    PK = 8,
    Z0 = 6;
  d.box(0, 0, 0, 32, 64, Z0);
  d.lines('x', 32, [
    [4, 4, 14, 4],
    [4, 2.4, 10, 2.4],
  ]);
  const lampQ = () => d.quad('x', 32, 54, 2.2, 58, 3.8, { fill: 'var(--line)', stroke: false });
  const hub = (c: W, spin: () => void) => {
    d.cyl(c[0], c[1], Z0 + 5.4, 2, 1.4);
    d.faceG('top', Z0 + 6.8, c[0], c[1]);
    spin();
    d.close();
  };
  const spokes = () => {
    const L: string[] = [];
    for (let i = 0; i < 3; i++) {
      const q = (i * Math.PI * 2) / 3;
      L.push(`M${f(Math.cos(q) * 2.4)},${f(Math.sin(q) * 2.4)}L${f(Math.cos(q) * 9.4)},${f(Math.sin(q) * 9.4)}`);
    }
    for (let i = 0; i < 3; i++) {
      const q = (i * Math.PI * 2) / 3 + Math.PI / 3;
      d.els.push(
        `<circle cx="${f(Math.cos(q) * 6.2)}" cy="${f(Math.sin(q) * 6.2)}" r="2.3" fill="var(--hole)" stroke="var(--line)"${S}/>`,
      );
    }
    d.els.push(`<path d="${L.join('')}" fill="none" stroke="var(--detail)"${S}/>`);
  };
  const reel = (c: W, spin: () => void) => {
    d.cyl(c[0], c[1], Z0, R, 1);
    d.open('acc');
    d.cyl(c[0], c[1], Z0 + 1, PK, 4);
    d.ring(c[0], c[1], Z0 + 2.4, PK);
    d.ring(c[0], c[1], Z0 + 3.8, PK);
    d.close();
    d.cyl(c[0], c[1], Z0 + 5, R, 0.4);
    hub(c, spin);
  };
  const tapeP: W[] = [
    [23, 14, Z0 + 1.4],
    [23, 50, Z0 + 1.4],
    [23, 50, Z0 + 4.6],
    [23, 14, Z0 + 4.6],
  ];
  const ticks = (y0: number) =>
    d.lines(
      'x',
      23,
      Array.from({ length: 12 }, (_, k) => {
        const y = y0 + k * 6;
        return [y, Z0 + 2.2, y, Z0 + 3.8];
      }),
    );
  const tape = (moving: 'flow' | 'fx' | 'none') => {
    d.open('acc');
    d.facePoly(tapeP);
    d.outline(tapeP);
    d.clipU(moving + '-tp', [tapeP]);
    if (moving === 'flow') {
      d.g('belt', { step: [0, 6, 0] });
      ticks(8);
      d.close();
    } else if (moving === 'fx') {
      d.fx(
        'lg-tk',
        [
          { t: 0, p: [0, 0, 0] },
          { t: 10, e: LIN },
          { t: 41, p: [0, 24, 0], e: OUT },
          { t: 43, p: [0, 25, 0] },
          { t: 99, e: STEP },
          { t: 100, p: [0, 0, 0] },
        ],
        () => ticks(-16),
      );
    } else ticks(8);
    d.close();
    d.close();
  };
  const spinCss = (cls: string, dir: number, dur: number) =>
    d.css.push(
      `.${cls}{transform-box:view-box;transform-origin:0px 0px;animation:${cls} ${dur}s linear infinite;animation-play-state:paused}.card:is([data-flow],[data-pending]) .${cls}{animation-play-state:running}@keyframes ${cls}{to{rotate:${dir * 360}deg}}`,
    );
  d.ok(() => {
    spinCss('lg-sa', -1, 3.6);
    spinCss('lg-sb', -1, 2.4);
    reel(A, () => {
      d.els.push('<g class="reelspin lg-sa">');
      spokes();
      d.close();
    });
    tape('flow');
    d.cyl(24.4, 22, Z0, 1.4, 6);
    d.cyl(24.4, 42, Z0, 1.4, 6);
    d.box(25, 28, Z0, 6, 8, 7);
    d.quad('x', 31, 30, Z0 + 2, 34, Z0 + 5);
    reel(B, () => {
      d.els.push('<g class="reelspin lg-sb">');
      spokes();
      d.close();
    });
    lampQ();
  });
  d.fail(() => {
    reel(A, () =>
      d.rot(
        'lg-fa',
        [
          { t: 0, a: 0 },
          { t: 10, a: 0, e: 'cubic-bezier(.5,0,1,1)' },
          { t: 16, a: -60, e: LIN },
          { t: 41, a: -560, e: OUT },
          { t: 44, a: -600 },
          { t: 100, a: -600 },
        ],
        spokes,
      ),
    );
    d.fx(
      'lg-tape',
      [
        { t: 0, o: 0 },
        { t: 10, e: STEP },
        { t: 10.5, o: 1 },
        { t: 41, e: STEP },
        { t: 41.5, o: 0 },
      ],
      () => tape('fx'),
    );
    d.cyl(24.4, 22, Z0, 1.4, 6);
    d.cyl(24.4, 42, Z0, 1.4, 6);
    d.box(25, 28, Z0, 6, 8, 7);
    d.quad('x', 31, 30, Z0 + 2, 34, Z0 + 5);
    d.fx(
      'lg-e1',
      [
        { t: 0, o: 1, r: 0 },
        { t: 9, r: -30 },
        { t: 10, e: STEP },
        { t: 10.5, o: 0 },
        { t: 41, r: -30, e: STEP },
        { t: 41.5, o: 1, e: IN },
        { t: 44.5, r: 9, e: OUT },
        { t: 47.5, r: -4 },
        { t: 50.5, r: 0 },
      ],
      () => {
        d.open('acc');
        d.cable([
          [23, 20, Z0 + 3],
          [24.6, 24, Z0 + 3],
          [26.4, 27, Z0 + 1.4],
          [27, 29, Z0],
        ]);
        d.close();
      },
      { pivot: [23, 20, Z0 + 3] },
    );
    d.fx(
      'lg-e2',
      [
        { t: 0, o: 1, r: 0 },
        { t: 9, r: 30 },
        { t: 10, e: STEP },
        { t: 10.5, o: 0 },
        { t: 41, r: 30, e: STEP },
        { t: 41.5, o: 1, e: IN },
        { t: 44.5, r: -9, e: OUT },
        { t: 47.5, r: 4 },
        { t: 50.5, r: 0 },
      ],
      () => {
        d.open('acc');
        d.cable([
          [23, 44, Z0 + 3],
          [24.6, 41, Z0 + 3],
          [27, 39.5, Z0 + 1.4],
          [28, 37, Z0],
        ]);
        d.close();
      },
      { pivot: [23, 44, Z0 + 3] },
    );
    d.burst('lg-snap', [26, 32, Z0 + 5], 41, 1);
    reel(B, () =>
      d.rot(
        'lg-fb',
        [
          { t: 0, a: 0 },
          { t: 10, a: 0, e: 'cubic-bezier(.5,0,1,1)' },
          { t: 14, a: -60, e: LIN },
          { t: 41, a: -760, e: 'cubic-bezier(.2,.6,.3,1)' },
          { t: 60, a: -840 },
          { t: 100, a: -840 },
        ],
        spokes,
      ),
    );
    d.lampFx('lg-lamp', 41, lampQ);
  });
  return d.svg(300, 230, 'logs');
}
function gatewayThreads() {
  const d = new D();
  for (const y of [-2, 16, 34]) {
    d.box(-38, y, 0, 14, 14, 10);
    d.lines('top', 10, [[-34, y + 4, -34, y + 10]]);
  }
  const A: W = [12, 22, 12],
    B: W = [-24, 23, 5];
  d.link(A, [-24, 5, 5], [], 0.2);
  d.ok(() =>
    d.link(
      A,
      B,
      [
        [0.3, PK],
        [0.38, PK],
        [0.46, PK],
      ],
      0.2,
    ),
  );
  d.link(A, [-24, 41, 5], [], 0.2);
  d.fail(() => {
    d.fx(
      'gt-link',
      [
        { t: 0, o: 0 },
        { t: 8, e: STEP },
        { t: 8.5, o: 1 },
        { t: 42, e: STEP },
        { t: 42.5, o: 0 },
      ],
      () => {
        d.open('acc');
        d.link(A, B, [], 0.2);
        d.close();
      },
    );
    d.fx(
      'gt-s1',
      [
        { t: 0, o: 1, r: 0 },
        { t: 7, r: -10 },
        { t: 8, e: STEP },
        { t: 8.5, o: 0 },
        { t: 42, r: -10, e: STEP },
        { t: 42.5, o: 1, r: 14, e: OUT },
        { t: 46, r: -6 },
        { t: 50, r: 0 },
      ],
      () => {
        d.open('acc');
        d.link(A, [-2, 22, 9], [], 0.2);
        d.close();
      },
      { pivot: A },
    );
    d.fx(
      'gt-s2',
      [
        { t: 0, o: 1, r: 0 },
        { t: 7, r: 10 },
        { t: 8, e: STEP },
        { t: 8.5, o: 0 },
        { t: 42, r: 10, e: STEP },
        { t: 42.5, o: 1, r: -14, e: OUT },
        { t: 46, r: 6 },
        { t: 50, r: 0 },
      ],
      () => {
        d.open('acc');
        d.link([-12, 23, 6], B, [], 0.2);
        d.close();
      },
      { pivot: B },
    );
    const lp = d.linkPath(A, B, 0.2);
    (
      [
        [-14, 40, 0],
        [-10, 44, 0],
        [-18, 45, 0],
      ] as W[]
    ).forEach((fp, i) => {
      const od = 45 - i * 4,
        S = d.linkPoint(A, B, 0.2, od / 100),
        F = pr(fp),
        qF: [number, number] = [F[0] - S[0], F[1] - S[1]];
      d.fx(
        'gt-pk' + i,
        [
          { t: 0, o: 1, od, q: qF },
          { t: 6, o: 0 },
          { t: 20, od: 0, q: [0, 0], e: STEP },
          { t: 20.5, o: 1, e: LIN },
          { t: 41, od },
          { t: 42 + i * 0.6, e: LIN },
          ...d.sfall(42 + i * 0.6, 48 + i * 0.6, qF, 5 + i * 1.5),
        ],
        () => d.els.push('<circle r="2.6" fill="var(--packet)"/>'),
        { style: `offset-path:path('${lp}');offset-rotate:0deg` },
      );
    });
    d.burst('gt-snap', [-4, 22.5, 9], 42, 1);
  });
  d.box(4, 4, 0, 36, 36, 12);
  d.lines('x', 40, [[8, 6, 18, 6]]);
  for (const [y, on] of [
    [22, 1],
    [28, 1],
    [34, 0],
  ])
    d.quad('x', 40, y - 2, 8, y, 10, { fill: on ? 'var(--line)' : 'var(--hole)' });
  d.fail(() => d.lampFx('gt-lamp', 42, () => d.quad('x', 40, 32, 8, 34, 10, { fill: 'var(--line)', stroke: false })));
  d.open('acc');
  d.box(12, 12, 12, 20, 20, 3);
  d.lines('top', 15, [
    [18, 16, 18, 28],
    [24, 16, 24, 24],
  ]);
  d.close();
  d.link(
    [74, 22, 4],
    [40, 22, 6],
    [
      [0.3, PK],
      [0.38, PK],
      [0.46, PK],
    ],
    0.2,
  );
  return d.svg(300, 230, 'gateway-threads');
}
function cartridge(d: D, x: number, y: number, z: number, logo: string) {
  d.box(x, y, z, 5, 24, 26);
  d.lines('top', z + 26, [
    [x + 1.5, y + 4, x + 1.5, y + 20],
    [x + 3.5, y + 4, x + 3.5, y + 20],
  ]);
  d.quad('x', x + 5, y + 3, z + 5, y + 21, z + 21, { fill: 'var(--face)' });
  d.logo(logo, x + 5, y + 7, z + 18.5, 10, 'var(--line)');
}
function models() {
  const d = new D();
  const CARTS: [string, string][] = [
    ['claude', '#D97757'],
    ['gemini', '#3186FF'],
    ['openai', '#10A37F'],
    ['xai', '#E6E6E6'],
    ['mistral', '#FF7000'],
  ];
  const N = CARTS.length,
    CYCLE = 12.5,
    WIN = CYCLE / N,
    SLOT: W = [30, 25, 8];
  d.box(-44, 2, 0, 34, 46, 6);
  d.lines(
    'top',
    6,
    [0, 1, 2, 3, 4].map(i => [-42 + i * 6.5, 6, -42 + i * 6.5, 44]),
  );
  d.box(10, 6, 0, 42, 40, 14);
  d.lines('x', 52, [
    [10, 7, 18, 7],
    [10, 4, 15, 4],
  ]);
  const lamp = () => d.quad('x', 52, 32, 6, 36, 9, { fill: 'var(--line)', stroke: false });
  d.ok(() => {
    const seated = CARTS.map((_, ci) => {
      const t = (((1.2 - ci * WIN) % CYCLE) + CYCLE) % CYCLE;
      return (((((0.625 - t) % CYCLE) + CYCLE) % CYCLE) / CYCLE) * 100;
    });
    const stops: [number, string][] = [];
    seated.forEach((p, ci) => {
      stops.push([p, CARTS[ci][1]]);
      stops.push([(p + 10) % 100, '']);
    });
    stops.sort((x, y) => x[0] - y[0]);
    const atZero = stops.filter(x => x[0] <= 0.001).pop() ?? stops[stops.length - 1];
    const kf = [[0, atZero[1]] as [number, string], ...stops.filter(x => x[0] > 0.001), [100, '@']]
      .map(([p, c], i, arr) => {
        const col = c === '@' ? arr[0][1] : c;
        return `${+p.toFixed(2)}%{${col ? `fill:${col};opacity:1` : 'fill:var(--detail);opacity:1'};animation-timing-function:steps(1,end)}`;
      })
      .join('');
    d.css.push(`.mdlamp path{animation:mdlamp ${CYCLE}s infinite;fill:${CARTS[0][1]}}@keyframes mdlamp{${kf}}`);
    d.g('mdlamp');
    lamp();
    d.close();
  });
  d.quad('top', 14, 27, 12, 33, 38);
  const hullOf = (x1: number, x2: number, y1: number, y2: number, z1: number, z2: number) =>
    poly(hull([x1, x2].flatMap(x => [y1, y2].flatMap(y => [z1, z2].map(z => pr([x, y, z]))))));
  const mask = (id: string) =>
    d.els.push(
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800"><rect x="-400" y="-400" width="800" height="800" fill="white"/><path d="${hullOf(33, 52, 6, 46, 0, 14)}" fill="black"/><path d="${hullOf(10, 52, 37, 46, 0, 14)}" fill="black"/></mask><g mask="url(#${id})">`,
    );
  const order = [1, 2, 3, 4, 0];
  d.ok(() => {
    mask('md-mask');
    order.forEach((ci, slotIdx) => {
      const [logo, color] = CARTS[ci];
      const home: W = [-39.5 + slotIdx * 6.5, 25, 6];
      const p = pr(home),
        a = pr([home[0], 25, 52]),
        b = pr([30, 25, 52]),
        c = pr([30, 25, 30]),
        e = pr(SLOT);
      d.track([p, a, b, e, [p[0] - 14, p[1] - 40], [a[0] + 14, a[1] - 36]]);
      const path = `M${f(p[0])},${f(p[1])}C${f(a[0])},${f(a[1])} ${f(b[0])},${f(b[1])} ${f(c[0])},${f(c[1])}L${f(e[0])},${f(e[1])}`;
      const t = (((1.2 - ci * WIN) % CYCLE) + CYCLE) % CYCLE;
      const sub = new D();
      cartridge(sub, -2.5, -12, 0, logo);
      d.els.push(
        `<g class="acc cart" style="--cart:${color};offset-path:path('${path}');--at:${ci === 0 ? '100%' : '0%'};--delay:${f(-t)}s;--cycle:${CYCLE}s"><g>${sub.els.join('')}</g></g>`,
      );
    });
    d.close();
  });
  d.fail(() => {
    order.slice(0, 4).forEach((ci, s) => cartridge(d, -39.5 + s * 6.5 - 2.5, 13, 6, CARTS[ci][0]));
    mask('md-mask2');
    d.fx(
      'md-cart',
      [
        { t: 0, p: [0, 0, 7], r: -7 },
        { t: 4, p: [0, 0, 20], r: 0, e: OUT },
        { t: 8, p: [0, 0, 22], r: 14 },
        { t: 11, r: -4 },
        { t: 13, r: 10 },
        { t: 15.5, r: 0 },
        { t: 18 },
        { t: 26, p: [0, 0, 0], e: OUT },
        { t: 27.5, p: [0, 0, 1], e: IN },
        { t: 29, p: [0, 0, 0] },
        { t: 37, e: OUT },
        { t: 39, p: [0, 0, 10], r: -10, e: IN },
        { t: 41.5, p: [0, 0, 6.5], r: -6, e: OUT },
        { t: 43, p: [0, 0, 7], r: -7 },
      ],
      () => {
        d.open('acc');
        cartridge(d, 27.5, 13, 8, 'claude');
        d.close();
      },
      { pivot: [30, 25, 8] },
    );
    d.close();
    d.lampFx('md-lamp', 36, lamp);
  });
  return d.svg(300, 230, 'models');
}

const art = {
  knowledge: knowledge(),
  workspaces: workspaces(),
  filesystems: filesystems(),
  sandboxes: sandboxes(),
  vault: vault(),
  secrets: secrets(),
  environments: environments(),
  upgrade: upgrade(),
  memory: memory(),
  'api-keys': apiKeys(),
  connect: connect(),
  databases: databases(),
  alerts: alerts(),
  deploys: deploys(),
  traces: traces(),
  gateway: gateway(),
  byok: byok(),
  projects: projects(),
  workers: workers(),
  importers: importers(),
  'env-vars': envVars(),
  widgets: widgets(),
  destinations: destinations(),
  license: license(),
  logs: logs(),
  'gateway-threads': gatewayThreads(),
  models: models(),
};
const HUES: Record<string, string> = {
  knowledge: 'purple',
  workspaces: 'blue',
  filesystems: 'blue',
  sandboxes: 'yellow',
  vault: 'yellow',
  secrets: 'green',
  environments: 'green',
  upgrade: 'pink',
  memory: 'orange',
  'api-keys': 'yellow',
  connect: 'blue',
  databases: 'green',
  alerts: 'orange',
  deploys: 'purple',
  traces: 'pink',
  gateway: 'blue',
  byok: 'yellow',
  projects: 'orange',
  workers: 'yellow',
  importers: 'purple',
  'env-vars': 'green',
  widgets: 'blue',
  destinations: 'orange',
  license: 'yellow',
  logs: 'pink',
  'gateway-threads': 'blue',
  models: 'purple',
};
if (process.argv[2] === '--react') emitReact(process.argv[3]);
else {
  const tpl = fs.readFileSync(new URL('./page.html', import.meta.url), 'utf8');
  const REST: Record<string, number[]> = JSON.parse(
    fs.readFileSync(new URL('./restbox.json', import.meta.url), 'utf8'),
  );
  const framed = Object.fromEntries(
    Object.entries(art).map(([name, svg]) => {
      const rb = REST[name];
      if (!rb) return [name, svg];
      const P = 4,
        w = rb[2] - rb[0] + P * 2,
        h = rb[3] - rb[1] + P * 2,
        k = 150 / Math.sqrt(w * h);
      return [
        name,
        svg.replace(
          /width="[\d.]+" height="[\d.]+" viewBox="[^"]+"/,
          `width="${Math.round(w * k)}" height="${Math.round(h * k)}" viewBox="${f(rb[0] - P)} ${f(rb[1] - P)} ${f(w)} ${f(h)}"`,
        ),
      ];
    }),
  );
  const out = tpl.replace('/*ART*/', `const ART=${JSON.stringify(framed)};`);
  fs.mkdirSync(process.argv[2], { recursive: true });
  fs.writeFileSync(process.argv[2] + '/illustrations.html', out);
  console.log(Object.fromEntries(Object.entries(art).map(([k, v]) => [k, v.length])));
}
function emitReact(dir: string) {
  const restFile = new URL('./restbox.json', import.meta.url);
  const REST: Record<string, number[]> = fs.existsSync(restFile) ? JSON.parse(fs.readFileSync(restFile, 'utf8')) : {};
  const R = '[data-slot=empty-state-art]';
  const sel = (css: string) =>
    css
      .replaceAll(
        '.card:not([data-tone=error]):is([data-live],[data-pending])',
        `${R}:not([data-state=failed]):is([data-live],[data-state=working])`,
      )
      .replaceAll('.card:not([data-tone=error])', `${R}:not([data-state=failed])`)
      .replaceAll('.card[data-tone=error][data-live]', `${R}[data-state=failed][data-live]`)
      .replaceAll('.card[data-tone=error]', `${R}[data-state=failed]`)
      .replaceAll('.card:is([data-flow],[data-pending])', `${R}:is([data-flow],[data-state=working])`)
      .replaceAll('.card:is([data-live],[data-pending])', `${R}:is([data-live],[data-state=working])`)
      .replace(/\.card(?= )/g, R);
  const camel = (k: string) => (k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
  const attrName = (k: string) => (k === 'class' ? 'className' : camel(k));
  const ref = (v: string) => v.replace(/url\(#([\w-]+)\)/g, 'url(#${id}-$1)');
  const pascal = (n: string) =>
    n
      .split('-')
      .map(w => w[0].toUpperCase() + w.slice(1))
      .join('') + 'Scene';
  const out = path.join(dir, 'art');
  fs.mkdirSync(out, { recursive: true });
  const css: string[] = [];
  const entries: string[] = [];
  const imports: string[] = [];
  for (const [name, svg] of Object.entries(art)) {
    const m = svg.match(/^<svg[^>]*width="([\d.]+)" height="([\d.]+)" viewBox="([^"]+)">([\s\S]*)<\/svg>$/);
    if (!m) throw new Error(name);
    const rb = REST[name];
    if (rb) {
      const P = 4,
        w = rb[2] - rb[0] + P * 2,
        h = rb[3] - rb[1] + P * 2;
      m[3] = `${f(rb[0] - P)} ${f(rb[1] - P)} ${f(w)} ${f(h)}`;
      m[1] = String(f(w * SCALE));
      m[2] = String(f(h * SCALE));
    }
    let body = m[4];
    body = body.replace(/<style>([\s\S]*?)<\/style>/g, (_, c) => {
      css.push(sel(c));
      return '';
    });
    const jsx = body.replace(/<(\/?)([\w]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g, (_, close, tag, attrs, self) => {
      if (close) return `</${tag}>`;
      const parts: string[] = [];
      for (const a of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) {
        const k = a[1],
          v = a[2];
        if (k === 'style') {
          const o = Object.fromEntries(
            v
              .split(';')
              .filter(Boolean)
              .map(d => {
                const i = d.indexOf(':');
                return [camel(d.slice(0, i).trim()), d.slice(i + 1).trim()];
              }),
          );
          parts.push(`style={s(${JSON.stringify(o)})}`);
          continue;
        }
        if (k === 'id') {
          parts.push(`id={\`\${id}-${v}\`}`);
          continue;
        }
        if (/url\(#/.test(v)) {
          parts.push(`${attrName(k)}={\`${ref(v)}\`}`);
          continue;
        }
        parts.push(`${attrName(k)}=${JSON.stringify(v)}`);
      }
      return `<${tag}${parts.length ? ' ' + parts.join(' ') : ''}${self ? ' /' : ''}>`;
    });
    const usesId = /\$\{id\}/.test(jsx),
      usesS = /style=\{s\(/.test(jsx);
    const file = `${name}-scene.tsx`;
    fs.writeFileSync(
      path.join(out, file),
      `${usesS ? "import { s } from './scene-style';\n" : ''}import type { SceneProps } from './scene-style';\n\nexport function ${pascal(name)}(${usesId ? '{ id }: SceneProps' : '_props: SceneProps'}) {\n  return (\n    <>\n${jsx}\n    </>\n  );\n}\n`,
    );
    imports.push(`import { ${pascal(name)} } from './${name}-scene';`);
    entries.push(
      `  '${name}': { Scene: ${pascal(name)}, viewBox: '${m[3]}', width: ${m[1]}, height: ${m[2]}, hue: '${HUES[name]}' },`,
    );
  }
  const names = Object.keys(art);
  const sorted = [...imports, "import type { Scene } from './scene-style';"].sort((x, y) =>
    x.split("'")[1].localeCompare(y.split("'")[1]),
  );
  fs.writeFileSync(
    path.join(out, 'scenes.ts'),
    `${sorted.join('\n')}\n\nexport type EmptyStateArtName =\n${names.map(n => `  | '${n}'`).join('\n')};\n\nexport const sceneByName: Record<EmptyStateArtName, Scene> = {\n${entries.join('\n')}\n};\n`,
  );
  const runtime = fs.readFileSync(new URL('./runtime.css', import.meta.url), 'utf8');
  fs.writeFileSync(path.join(dir, 'empty-state-art.css'), runtime + '\n' + css.join('\n') + '\n');
  console.log(`wrote ${names.length} scenes to ${out}`);
}
