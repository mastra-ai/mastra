import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';

interface ScoreDeltaProps {
  /** Difference between scores (B - A) */
  delta: number;
}

/**
 * Visual indicator for score difference between runs: a diagonal trend arrow
 * plus the absolute difference, both in the system positive/negative hue.
 */
export function ScoreDelta({ delta }: ScoreDeltaProps) {
  const tone = delta > 0 ? 'text-positive1' : delta < 0 ? 'text-negative1' : 'text-neutral3';

  return (
    <span className={cn('inline-flex min-w-20 items-center gap-1 font-mono text-sm', tone)}>
      <span className="inline-block w-3">{delta > 0 ? '+' : delta < 0 ? '-' : ''}</span>
      {Math.abs(delta).toFixed(2)}
      {delta > 0 ? (
        <ArrowUpRightIcon className="size-3.5" />
      ) : delta < 0 ? (
        <ArrowDownRightIcon className="size-3.5" />
      ) : null}
    </span>
  );
}
