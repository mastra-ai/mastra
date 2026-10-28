import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';

interface ScoreDeltaProps {
  /** Difference between values (B - A) */
  delta: number;
  /** Formats the absolute difference. Defaults to two decimals, like scores. */
  format?: (absDelta: number) => string;
  /** False for metrics where going down is the improvement, e.g. durations or errors. */
  higherIsBetter?: boolean;
  /** Value the delta is measured against. When non-zero, the delta reads as a percentage of it. */
  baseline?: number;
}

const formatScore = (value: number) => value.toFixed(2);

/**
 * Visual indicator for the difference between runs: the signed difference plus a diagonal
 * trend arrow, tinted positive or negative depending on whether it is an improvement.
 * With a non-zero baseline it reads as a percentage, and the absolute difference moves to a tooltip.
 */
export function ScoreDelta({ delta, format = formatScore, higherIsBetter = true, baseline }: ScoreDeltaProps) {
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const tone =
    delta === 0 ? 'text-muted-foreground' : improved ? 'text-success-indicator' : 'text-destructive-foreground';
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  const absolute = `${sign}${format(Math.abs(delta))}`;
  const showPercent = baseline !== undefined && baseline !== 0 && Number.isFinite(baseline);

  const content = (
    <>
      {sign}
      {showPercent ? `${((Math.abs(delta) / Math.abs(baseline)) * 100).toFixed(1)}%` : format(Math.abs(delta))}
      <span aria-hidden className="inline-flex size-3.5 shrink-0 [&>svg]:size-3.5">
        {delta > 0 ? <ArrowUpRightIcon /> : delta < 0 ? <ArrowDownRightIcon /> : null}
      </span>
    </>
  );
  const className = cn('inline-flex items-center gap-1 tabular-nums', tone);

  if (!showPercent) return <span className={className}>{content}</span>;

  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className={className} />}>{content}</TooltipTrigger>
      <TooltipContent>{absolute}</TooltipContent>
    </Tooltip>
  );
}
