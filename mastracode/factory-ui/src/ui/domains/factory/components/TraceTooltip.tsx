import type { ReactNode } from 'react';

export interface Point {
  x: number;
  y: number;
}

/** Where the pointer is inside the element that owns the tooltip. */
export function pointIn(event: { clientX: number; clientY: number; currentTarget: Element }): Point {
  const box = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

/**
 * A panel that rides the cursor. It flips to the other side near the right edge
 * rather than being clipped, and never takes the pointer events under it.
 */
export function TraceTooltip({ at, hostWidth, children }: { at: Point; hostWidth: number; children: ReactNode }) {
  const flipped = at.x > hostWidth - 260;
  return (
    <div
      role="presentation"
      className="border-border1 bg-surface3 text-ui-xs pointer-events-none absolute top-0 left-0 z-10 flex max-w-[38ch] flex-col gap-1 rounded-lg border px-3 py-2 shadow-lg transition-transform duration-75 ease-out motion-reduce:transition-none"
      style={{
        transform: `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(${flipped ? 'calc(-100% - 16px)' : '16px'}, -50%)`,
      }}
    >
      {children}
    </div>
  );
}

/** A stage's colour, sized to sit on a text baseline. */
export function Swatch({ fill }: { fill: string }) {
  return (
    <svg width={10} height={10} aria-hidden="true" className="shrink-0">
      <rect x={0} y={3} width={10} height={4} rx={2} className={fill} />
    </svg>
  );
}
