import { TrendingDown, TrendingUp } from 'lucide-react';

/** Which direction is an improvement — completions up, lead time down. */
type Better = 'higher' | 'lower';

/**
 * How to read the gap. A rate compared relatively lies: 30% → 33% coverage is
 * "+10%", which sounds like a rally. Rates move in points.
 */
type Scale = 'relative' | 'points';

function tone(delta: number, better: Better): string {
  if (delta === 0) return 'text-icon3 bg-surface4';
  const improved = better === 'higher' ? delta > 0 : delta < 0;
  return improved ? 'text-positive1 bg-positive1/10' : 'text-negative1 bg-negative1/10';
}

/**
 * Change against the same span before the window. A relative change renders
 * nothing without a baseline to divide by: a percentage of zero reads as
 * infinite growth.
 */
export function PeriodChange({
  current,
  previous,
  better,
  scale = 'relative',
}: {
  current: number;
  previous: number;
  better: Better;
  scale?: Scale;
}) {
  if (scale === 'relative' && previous === 0) return null;

  const delta =
    scale === 'points' ? Math.round(current - previous) : Math.round(((current - previous) / previous) * 100);
  const magnitude = scale === 'points' ? `${Math.abs(delta)} pts` : `${Math.abs(delta)}%`;
  const description = `${magnitude} ${delta >= 0 ? 'up' : 'down'} on the previous period`;
  const Trend = delta >= 0 ? TrendingUp : TrendingDown;

  return (
    <span
      title={description}
      aria-label={description}
      className={`text-ui-xs inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 leading-4 font-medium tabular-nums ${tone(delta, better)}`}
    >
      {delta === 0 ? null : <Trend aria-hidden="true" className="size-3" />}
      {magnitude}
    </span>
  );
}
