import { cn } from '@/lib/utils';

interface ScoreDeltaProps {
  /** Difference between scores (B - A) */
  delta: number;
}

/**
 * Visual indicator for score difference between runs.
 * Shows arrow direction and delta value in neutral color.
 */
export function ScoreDelta({ delta }: ScoreDeltaProps) {
  const arrow = delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '\u2013';

  return (
    <span className={cn('font-mono text-sm', 'text-neutral4')}>
      {arrow} {delta > 0 ? '+' : ''}
      {delta.toFixed(2)}
    </span>
  );
}
