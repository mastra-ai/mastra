import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';

interface ScoreDeltaProps {
  /** Difference between values (B - A) */
  delta: number;
  /** Formats the absolute difference. Defaults to two decimals, like scores. */
  format?: (absDelta: number) => string;
  /** False for metrics where going down is the improvement, e.g. durations or errors. */
  higherIsBetter?: boolean;
}

const formatScore = (value: number) => value.toFixed(2);

/**
 * Visual indicator for the difference between runs: the signed difference plus a diagonal
 * trend arrow, tinted positive or negative depending on whether it is an improvement.
 */
export function ScoreDelta({ delta, format = formatScore, higherIsBetter = true }: ScoreDeltaProps) {
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const tone =
    delta === 0 ? 'text-muted-foreground' : improved ? 'text-success-indicator' : 'text-destructive-foreground';
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';

  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', tone)}>
      {sign}
      {format(Math.abs(delta))}
      <span aria-hidden className="inline-flex size-3.5 shrink-0 [&>svg]:size-3.5">
        {delta > 0 ? <ArrowUpRightIcon /> : delta < 0 ? <ArrowDownRightIcon /> : null}
      </span>
    </span>
  );
}
