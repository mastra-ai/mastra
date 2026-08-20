const CENTER = 20;
/** Short ticks near the rim: the ring reads at a glance, the hollow keeps it light. */
const INNER = 12.2;
const OUTER = 15.8;

/** Half the gap between two ticks, so a denser ring thins its own strokes instead of closing up. */
function strokeWidth(ticks: number): number {
  return ((2 * Math.PI * INNER) / ticks) * 0.45;
}

/**
 * A share as a ring of ticks, filling clockwise from twelve o'clock — counted
 * rather than measured. Size and lit colour come from `className`.
 */
export function Dial({ share, ticks = 20, className }: { share: number; ticks?: number; className: string }) {
  // a share that rounds to nothing still earned a tick; an empty one earns none
  const lit = share <= 0 ? 0 : Math.min(ticks, Math.max(1, Math.round(share * ticks)));

  return (
    <svg viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`} aria-hidden="true" className={`shrink-0 ${className}`}>
      {Array.from({ length: ticks }, (_, index) => {
        const angle = ((index / ticks) * 360 - 90) * (Math.PI / 180);
        const at = (radius: number) => [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius];
        const [x1, y1] = at(INNER);
        const [x2, y2] = at(OUTER);
        return (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeWidth={strokeWidth(ticks)}
            strokeLinecap="round"
            className={index < lit ? 'stroke-current' : 'stroke-surface6'}
          />
        );
      })}
    </svg>
  );
}
