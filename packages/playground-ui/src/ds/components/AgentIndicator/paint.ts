import { BALLS, BODY, KIT, LINES, range, RAYS, RINGS, TAU, TRAIL } from './shapes';
import type { Frame, Point } from './shapes';

export interface Ball {
  cx: string;
  cy: string;
  r: string;
}

export interface Ring extends Ball {
  width: string;
}

/** A segment with no width keeps its last `d`, so the live painter skips rewriting it. */
export interface Stroke {
  width: string;
  d?: string;
}

export interface FrameParts {
  body: string;
  balls: Ball[];
  rings: Ring[];
  cuts: Stroke[];
  inks: Stroke[];
  trailCuts: Stroke[];
  trailInks: Stroke[];
}

const xy = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;

function outline(cx: number, cy: number, radii: number[]) {
  const points = radii.map(
    (radius, i): Point => [cx + radius * Math.cos((TAU * i) / RAYS), cy + radius * Math.sin((TAU * i) / RAYS)],
  );
  const mid = ([ax, ay]: [number, number], [bx, by]: [number, number] = [ax, ay]) => xy((ax + bx) / 2, (ay + by) / 2);
  const curves = points.map((p, i) => `Q${xy(...p)} ${mid(p, points[(i + 1) % RAYS])}`).join('');
  const [first = [cx, cy]] = points;
  return `M${mid(first, points.at(-1))}${curves}Z`;
}

function segment(x1: number, y1: number, x2: number, y2: number, width: number): Stroke {
  if (width <= 0) return { width: '0.000' };
  const strokeWidth = width.toFixed(3);
  if (Number(strokeWidth) === 0) return { width: strokeWidth };
  return {
    width: strokeWidth,
    d: `M${x1.toFixed(3)} ${y1.toFixed(3)}L${(x2 + 0.001).toFixed(3)} ${y2.toFixed(3)}`,
  };
}

const HOLE_AT = 2 + RAYS;
const LINES_AT = BODY + 3 * BALLS;
const RINGS_AT = LINES_AT + 10 * LINES;

type Outline = (cx: number, cy: number, radii: number[]) => string;

function describeFrame(f: Frame, bodyOutline: Outline, holeOutline: Outline): FrameParts {
  const at = (i: number) => f[i] ?? 0;
  const hole = f.slice(HOLE_AT + 2, HOLE_AT + 2 + RAYS);
  const holePath = hole.some(r => r > 0.05) ? holeOutline(at(HOLE_AT), at(HOLE_AT + 1), hole) : '';
  const line = (k: number) => segment(at(k), at(k + 1), at(k + 2), at(k + 3), at(k + 4));
  const trail = (k: number, widthAt: number) => segment(at(k), at(k + 1), at(k + 4), at(k + 5), at(k + widthAt));

  return {
    body: bodyOutline(at(0), at(1), f.slice(2, HOLE_AT)) + holePath,
    balls: range(BALLS).map(i => {
      const k = BODY + 3 * i;
      return { cx: at(k).toFixed(2), cy: at(k + 1).toFixed(2), r: Math.max(0, at(k + 2)).toFixed(2) };
    }),
    rings: range(RINGS).map(i => {
      const k = RINGS_AT + 4 * i;
      return {
        cx: at(k).toFixed(2),
        cy: at(k + 1).toFixed(2),
        r: Math.max(0, at(k + 2)).toFixed(2),
        width: Math.max(0, at(k + 3)).toFixed(3),
      };
    }),
    cuts: range(LINES).map(i => line(LINES_AT + 5 * i)),
    inks: range(LINES).map(i => line(LINES_AT + 5 * (LINES + i))),
    trailCuts: range(TRAIL - 1).map(i => trail(KIT + 4 * i, 3)),
    trailInks: range(TRAIL - 1).map(i => trail(KIT + 4 * i, 2)),
  };
}

export function frameParts(frame: Frame): FrameParts {
  return describeFrame(frame, outline, outline);
}

function cachedOutline(): Outline {
  let previousX: number | undefined;
  let previousY: number | undefined;
  let previousRadii: number[] = [];
  let path = '';
  return (cx, cy, radii) => {
    const unchanged = cx === previousX && cy === previousY && radii.every((radius, i) => radius === previousRadii[i]);
    if (unchanged) return path;
    previousX = cx;
    previousY = cy;
    previousRadii = radii;
    path = outline(cx, cy, radii);
    return path;
  };
}

function attributeWriter(element: Element, name: string) {
  let previous: string | undefined;
  return (value: string) => {
    if (value === previous) return;
    element.setAttribute(name, value);
    previous = value;
  };
}

function strokePainter(path: SVGPathElement) {
  const width = attributeWriter(path, 'stroke-width');
  const drawing = attributeWriter(path, 'd');
  return (stroke: Stroke) => {
    width(stroke.width);
    if (stroke.d) drawing(stroke.d);
  };
}

function circlePainter(circle: SVGCircleElement) {
  const x = attributeWriter(circle, 'cx');
  const y = attributeWriter(circle, 'cy');
  const radius = attributeWriter(circle, 'r');
  return ({ cx, cy, r }: Ball) => {
    x(cx);
    y(cy);
    radius(r);
  };
}

function ringPainter(circle: SVGCircleElement) {
  const paintCircle = circlePainter(circle);
  const width = attributeWriter(circle, 'stroke-width');
  return (ring: Ring) => {
    paintCircle(ring);
    width(ring.width);
  };
}

export function painter(svg: SVGSVGElement) {
  const parts = <T extends Element>(name: string) => [...svg.querySelectorAll<T>(`[data-part="${name}"]`)];
  const [body] = parts<SVGPathElement>('body');
  if (!body) throw new Error('AgentIndicator is missing its body path');
  const paintBody = attributeWriter(body, 'd');
  const bodyOutline = cachedOutline();
  const holeOutline = cachedOutline();
  const balls = parts<SVGCircleElement>('ball').map(circlePainter);
  const rings = parts<SVGCircleElement>('ring').map(ringPainter);
  const strokes = {
    cuts: parts<SVGPathElement>('cut').map(strokePainter),
    inks: parts<SVGPathElement>('ink').map(strokePainter),
    trailCuts: parts<SVGPathElement>('trail-cut').map(strokePainter),
    trailInks: parts<SVGPathElement>('trail-ink').map(strokePainter),
  };

  return (frame: Frame) => {
    const drawn = describeFrame(frame, bodyOutline, holeOutline);
    paintBody(drawn.body);
    drawn.balls.forEach((ball, i) => balls[i]?.(ball));
    drawn.rings.forEach((ring, i) => rings[i]?.(ring));
    for (const name of ['cuts', 'inks', 'trailCuts', 'trailInks'] as const) {
      drawn[name].forEach((stroke, i) => strokes[name][i]?.(stroke));
    }
  };
}
