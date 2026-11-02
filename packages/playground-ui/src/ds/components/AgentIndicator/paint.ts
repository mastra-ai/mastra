import { BALLS, BODY, KIT, LINES, range, RAYS, TAU, TRAIL } from './shapes';
import type { Frame } from './shapes';

export interface Ball {
  cx: string;
  cy: string;
  r: string;
}

/** A segment with no width keeps its last `d`, so the live painter skips rewriting it. */
export interface Stroke {
  width: string;
  d?: string;
}

export interface FrameParts {
  body: string;
  balls: Ball[];
  cuts: Stroke[];
  inks: Stroke[];
  trailCuts: Stroke[];
  trailInks: Stroke[];
}

const xy = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;

function outline(cx: number, cy: number, radii: number[]) {
  const points = radii.map((r, i): [number, number] => [
    cx + r * Math.cos((TAU * i) / RAYS),
    cy + r * Math.sin((TAU * i) / RAYS),
  ]);
  const mid = ([ax, ay]: [number, number], [bx, by]: [number, number] = [ax, ay]) => xy((ax + bx) / 2, (ay + by) / 2);
  const curves = points.map((p, i) => `Q${xy(...p)} ${mid(p, points[(i + 1) % RAYS])}`).join('');
  const [first = [cx, cy]] = points;
  return `M${mid(first, points.at(-1))}${curves}Z`;
}

function segment(x1: number, y1: number, x2: number, y2: number, width: number): Stroke {
  const strokeWidth = Math.max(0, width).toFixed(3);
  if (Number(strokeWidth) === 0) return { width: strokeWidth };
  return {
    width: strokeWidth,
    d: `M${x1.toFixed(3)} ${y1.toFixed(3)}L${(x2 + 0.001).toFixed(3)} ${y2.toFixed(3)}`,
  };
}

const HOLE_AT = 2 + RAYS;
const LINES_AT = BODY + 3 * BALLS;

export function frameParts(f: Frame): FrameParts {
  const at = (i: number) => f[i] ?? 0;
  const hole = f.slice(HOLE_AT + 2, HOLE_AT + 2 + RAYS);
  const holePath = hole.some(r => r > 0.05) ? outline(at(HOLE_AT), at(HOLE_AT + 1), hole) : '';
  const line = (k: number) => segment(at(k), at(k + 1), at(k + 2), at(k + 3), at(k + 4));
  const trail = (k: number, widthAt: number) => segment(at(k), at(k + 1), at(k + 4), at(k + 5), at(k + widthAt));

  return {
    body: outline(at(0), at(1), f.slice(2, HOLE_AT)) + holePath,
    balls: range(BALLS).map(i => {
      const k = BODY + 3 * i;
      return { cx: at(k).toFixed(2), cy: at(k + 1).toFixed(2), r: Math.max(0, at(k + 2)).toFixed(2) };
    }),
    cuts: range(LINES).map(i => line(LINES_AT + 5 * i)),
    inks: range(LINES).map(i => line(LINES_AT + 5 * (LINES + i))),
    trailCuts: range(TRAIL - 1).map(i => trail(KIT + 4 * i, 3)),
    trailInks: range(TRAIL - 1).map(i => trail(KIT + 4 * i, 2)),
  };
}

const attribute = (element: Element, name: string, value: string) => {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};

function stroke(path: SVGPathElement, { width, d }: Stroke) {
  attribute(path, 'stroke-width', width);
  if (d) attribute(path, 'd', d);
}

export function painter(svg: SVGSVGElement) {
  const parts = <T extends Element>(name: string) => [...svg.querySelectorAll<T>(`[data-part="${name}"]`)];
  const [body] = parts<SVGPathElement>('body');
  if (!body) throw new Error('AgentIndicator is missing its body path');
  const balls = parts<SVGCircleElement>('ball');
  const strokes = {
    cuts: parts<SVGPathElement>('cut'),
    inks: parts<SVGPathElement>('ink'),
    trailCuts: parts<SVGPathElement>('trail-cut'),
    trailInks: parts<SVGPathElement>('trail-ink'),
  };

  return (f: Frame) => {
    const drawn = frameParts(f);
    attribute(body, 'd', drawn.body);
    balls.forEach((ball, i) => {
      const { cx = '0', cy = '0', r = '0' } = drawn.balls[i] ?? {};
      attribute(ball, 'cx', cx);
      attribute(ball, 'cy', cy);
      attribute(ball, 'r', r);
    });
    for (const name of ['cuts', 'inks', 'trailCuts', 'trailInks'] as const) {
      strokes[name].forEach((path, i) => {
        const part = drawn[name][i];
        if (part) stroke(path, part);
      });
    }
  };
}
