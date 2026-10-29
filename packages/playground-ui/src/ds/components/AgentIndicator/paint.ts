import { BALLS, BODY, KIT, LINES, RAYS, TAU } from './shapes';
import type { Frame } from './shapes';

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

const attribute = (element: Element, name: string, value: string) => {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};

function stroke(path: SVGPathElement, x1: number, y1: number, x2: number, y2: number, width: number) {
  const strokeWidth = Math.max(0, width).toFixed(3);
  attribute(path, 'stroke-width', strokeWidth);
  if (Number(strokeWidth) === 0) return;
  attribute(path, 'd', `M${x1.toFixed(3)} ${y1.toFixed(3)}L${(x2 + 0.001).toFixed(3)} ${y2.toFixed(3)}`);
}

export function painter(svg: SVGSVGElement) {
  const parts = <T extends Element>(name: string) => [...svg.querySelectorAll<T>(`[data-part="${name}"]`)];
  const [body] = parts<SVGPathElement>('body');
  if (!body) throw new Error('AgentIndicator is missing its body path');
  const balls = parts<SVGCircleElement>('ball');
  const cuts = parts<SVGPathElement>('cut');
  const inks = parts<SVGPathElement>('ink');
  const trailCuts = parts<SVGPathElement>('trail-cut');
  const trailInks = parts<SVGPathElement>('trail-ink');
  const holeAt = 2 + RAYS;
  const linesAt = BODY + 3 * BALLS;

  return (f: Frame) => {
    const at = (i: number) => f[i] ?? 0;
    const hole = f.slice(holeAt + 2, holeAt + 2 + RAYS);
    const holePath = hole.some(r => r > 0.05) ? outline(at(holeAt), at(holeAt + 1), hole) : '';
    attribute(body, 'd', outline(at(0), at(1), f.slice(2, holeAt)) + holePath);
    balls.forEach((ball, i) => {
      const k = BODY + 3 * i;
      attribute(ball, 'cx', at(k).toFixed(2));
      attribute(ball, 'cy', at(k + 1).toFixed(2));
      attribute(ball, 'r', Math.max(0, at(k + 2)).toFixed(2));
    });
    cuts.forEach((path, i) => {
      const k = linesAt + 5 * i;
      stroke(path, at(k), at(k + 1), at(k + 2), at(k + 3), at(k + 4));
    });
    inks.forEach((path, i) => {
      const k = linesAt + 5 * (LINES + i);
      stroke(path, at(k), at(k + 1), at(k + 2), at(k + 3), at(k + 4));
    });
    trailInks.forEach((path, i) => {
      const k = KIT + 4 * i;
      stroke(path, at(k), at(k + 1), at(k + 4), at(k + 5), at(k + 2));
    });
    trailCuts.forEach((path, i) => {
      const k = KIT + 4 * i;
      stroke(path, at(k), at(k + 1), at(k + 4), at(k + 5), at(k + 3));
    });
  };
}
