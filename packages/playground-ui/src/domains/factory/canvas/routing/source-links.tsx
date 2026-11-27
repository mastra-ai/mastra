import { useLayoutEffect, useRef, useState } from 'react';
import { LINK_STROKE } from '../flow-links';
import { cn } from '@/utils/cn';

interface Point {
  x: number;
  y: number;
}

/** Leaves level and arrives level, bending across the gap between the columns, like a node editor's links. */
function curve(from: Point, to: Point) {
  const bend = (to.x - from.x) / 2;
  return `M${from.x} ${from.y}C${from.x + bend} ${from.y} ${to.x - bend} ${to.y} ${to.x} ${to.y}`;
}

const middle = (element: Element) => {
  const box = element.getBoundingClientRect();
  return box.top + box.height / 2;
};

/**
 * Links each source card to the first card of the order, title row to title row, with a port at either end. The
 * notices above the order push that card down by however tall they are, so the ends are measured, and measured again
 * whenever a column changes size: a notice growing in, the order loading. Drawn in the canvas's own units, so zoom
 * scales it with the cards. Mount it last in the positioned box holding both columns.
 */
export function SourceLinks() {
  const ref = useRef<SVGSVGElement>(null);
  const [ends, setEnds] = useState<{ sources: Point[]; order: Point }>();

  useLayoutEffect(() => {
    const svg = ref.current;
    const root = svg?.parentElement;
    if (!svg || !root) return;
    const measure = () => {
      const matrix = svg.getScreenCTM()?.inverse();
      const order = root.querySelector('[data-link-order]');
      const title = order?.querySelector('header');
      const card = title?.parentElement;
      if (!matrix || !order || !title || !card) return setEnds(undefined);
      const at = (x: number, y: number) => {
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        return { x: Math.round(point.x), y: Math.round(point.y) };
      };
      // Measured inside the first card, so a row lifted mid-drag doesn't move the end: the slot stays where it is.
      const titleDepth = at(0, middle(title)).y - at(0, card.getBoundingClientRect().top).y;
      const slot = order.getBoundingClientRect();
      const start = at(slot.left, slot.top);
      setEnds({
        order: { x: start.x, y: start.y + titleDepth },
        sources: [...root.querySelectorAll('[data-link-source]')].map(source =>
          at(source.getBoundingClientRect().right, middle(source.firstElementChild ?? source)),
        ),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const column of root.children) if (column !== svg) observer.observe(column);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      aria-hidden
      className={cn(LINK_STROKE, 'pointer-events-none absolute inset-0 size-full overflow-visible max-sm:hidden')}
    >
      {ends?.sources.map(source => (
        <path key={`${source.x},${source.y}`} d={curve(source, ends.order)} />
      ))}
      {/* Drawn as the ports on the cards: a 10px dot with a 1px rim. */}
      {ends &&
        [...ends.sources, ends.order].map(point => (
          <circle key={`${point.x},${point.y}`} cx={point.x} cy={point.y} r={4.5} className="fill-card" />
        ))}
    </svg>
  );
}
