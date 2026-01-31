import { cn } from '@/lib/utils';

interface ScoreDeltaProps {
  /** Difference between scores (B - A) */
  delta: number;
  /** Whether this delta indicates regression */
  regressed: boolean;
}

/**
 * Visual indicator for score difference between runs.
 * Shows arrow direction and color-coded delta value.
 */
export function ScoreDelta({ delta, regressed }: ScoreDeltaProps) {
  // Color based on regression status and delta direction
  const color = regressed
    ? 'text-red-500'
    : delta > 0
      ? 'text-green-500'
      : delta < 0
        ? 'text-amber-500'
        : 'text-neutral4';

  // Arrow based on delta direction
  const arrow = delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '\u2013';

  return (
    <span className={cn('font-mono text-sm', color)}>
      {arrow} {Math.abs(delta).toFixed(2)}
    </span>
  );
}
