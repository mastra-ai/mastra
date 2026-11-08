import { cloneElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';

/** Gap between the hovered point and the tooltip. */
const OFFSET = 10;
/** Room kept between the tooltip and the window's edge. */
const EDGE = 8;

/** `value` within `[min, max]`; `min` wins when the range is empty. */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

/**
 * Places a chart tooltip next to the hovered point, flipping only at the window's edges. Rendered
 * in a portal on `document.body`, so a clipping or stacking ancestor (a short chart above a list)
 * cannot cut it off. Measured and moved in a layout effect, before the browser paints, by writing
 * the transform to the DOM: a flip costs no extra render and never shows a frame on the wrong side.
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
  // Stays in the chart, to find it: Recharts' coordinate is relative to the chart.
  const anchor = useRef<HTMLSpanElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const active = contentProps.active === true;
  // On touch, Recharts keeps the tooltip active after the finger lifts (there's no mouseleave), and
  // the portal is fixed to the window, so it would float over the page as it scrolls. Hide it on any
  // scroll or on a press outside its chart; touching or hovering the chart brings it back.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!active) {
      setDismissed(false);
      return;
    }
    const chart = anchor.current?.closest('.recharts-wrapper');
    const dismiss = () => setDismissed(true);
    const show = () => setDismissed(false);
    const onPointerDown = (event: PointerEvent) => {
      if (chart?.contains(event.target as Node)) show();
      else dismiss();
    };
    window.addEventListener('scroll', dismiss, { capture: true, passive: true });
    document.addEventListener('pointerdown', onPointerDown, true);
    chart?.addEventListener('pointermove', show);
    return () => {
      window.removeEventListener('scroll', dismiss, { capture: true });
      document.removeEventListener('pointerdown', onPointerDown, true);
      chart?.removeEventListener('pointermove', show);
    };
  }, [active]);
  useLayoutEffect(() => {
    const el = ref.current;
    const chart = anchor.current?.closest('.recharts-wrapper');
    if (!el || !chart || !coordinate) return;
    // Grow only while the pointer moves across the chart, so the readout doesn't jump in width from
    // point to point ("8 AM" vs "12 PM", "10" vs "1,240"). The portal unmounts on leave, which resets it.
    el.style.minWidth = `${el.offsetWidth}px`;
    const box = chart.getBoundingClientRect();
    const pointX = box.left + coordinate.x;
    const pointY = box.top + coordinate.y;
    const flipX = pointX + OFFSET + el.offsetWidth > window.innerWidth - EDGE;
    const flipY = pointY + OFFSET + el.offsetHeight > window.innerHeight - EDGE;
    const x = flipX ? pointX - OFFSET - el.offsetWidth : pointX + OFFSET;
    const y = flipY ? pointY - OFFSET - el.offsetHeight : pointY + OFFSET;
    // Neither side fits (a narrow window): keep it inside the window, left and top edges first.
    const left = clamp(x, EDGE, window.innerWidth - EDGE - el.offsetWidth);
    const top = clamp(y, EDGE, window.innerHeight - EDGE - el.offsetHeight);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  });
  return (
    <>
      <span ref={anchor} hidden />
      {active &&
        !dismissed &&
        createPortal(
          <div ref={ref} data-slot="chart-tooltip-portal" className="pointer-events-none fixed top-0 left-0 z-50">
            {cloneElement(children, { ...contentProps, coordinate })}
          </div>,
          document.body,
        )}
    </>
  );
}
