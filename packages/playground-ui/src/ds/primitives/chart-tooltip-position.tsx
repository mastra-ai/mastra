import { cloneElement, useLayoutEffect, useRef } from 'react';
import type { ReactElement } from 'react';

/** Gap between the hovered point and the tooltip. */
const OFFSET = 10;
/** Room kept between the tooltip and the window's edge. */
const EDGE = 8;

/** `value` within `[min, max]`; `min` wins when the range is empty. */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

/**
 * Places a chart tooltip next to the hovered point, free to leave the chart, flipping only at the
 * window's edges. Measured and moved in a layout effect, before the browser paints, by writing the
 * transform to the DOM: a flip costs no extra render and never shows a frame on the wrong side.
 *
 * Wrap the `content` of a `<Tooltip {...CHART_TOOLTIP_PROPS}>` (see `chart-axes`); Recharts' props
 * pass through.
 */
export function ChartTooltipPosition({
  coordinate,
  children,
  ...contentProps
}: {
  coordinate?: { x: number; y: number };
  children: ReactElement<Record<string, unknown>>;
  [prop: string]: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const chart = el?.closest('.recharts-wrapper');
    if (!el || !chart || !coordinate) return;
    const box = chart.getBoundingClientRect();
    const right = coordinate.x + OFFSET;
    const below = coordinate.y + OFFSET;
    const flipX = box.left + right + el.offsetWidth > window.innerWidth - EDGE;
    const flipY = box.top + below + el.offsetHeight > window.innerHeight - EDGE;
    const x = flipX ? coordinate.x - OFFSET - el.offsetWidth : right;
    const y = flipY ? coordinate.y - OFFSET - el.offsetHeight : below;
    // Neither side fits (a narrow window): keep it inside the window, left and top edges first.
    const left = clamp(x, EDGE - box.left, window.innerWidth - EDGE - box.left - el.offsetWidth);
    const top = clamp(y, EDGE - box.top, window.innerHeight - EDGE - box.top - el.offsetHeight);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  });
  return <div ref={ref}>{cloneElement(children, { ...contentProps, coordinate })}</div>;
}
