import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/**
 * The prior period's value, pushed to the end of the value row. Use it when the card has
 * no detail line; with one, pass `prevValue` to `MetricsKpiCard.Footer` instead.
 */
export function MetricsKpiCardPrev({ value, className }: { value: string; className?: string }) {
  return (
    <Txt as="span" variant="body-sm" tone="muted" className={cn('ml-auto shrink-0 tabular-nums', className)}>
      vs {value}
    </Txt>
  );
}
