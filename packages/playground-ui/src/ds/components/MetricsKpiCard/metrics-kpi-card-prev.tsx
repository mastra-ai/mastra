import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/**
 * The prior period's value, pushed to the end of the value row. Use it when the card has
 * no detail line; with one, pass `prevValue` to `MetricsKpiCard.Footer` instead.
 */
export function MetricsKpiCardPrev({ value, className }: { value: string; className?: string }) {
  return (
    <Txt
      as="span"
      variant="body-sm"
      tone="muted"
      title={`vs ${value}`}
      // The value row keeps its children from shrinking; the prior value is the one part that
      // may give way in a narrow card, truncating with the full text in the title.
      className={cn('ml-auto min-w-0 shrink! truncate tabular-nums', className)}
    >
      vs {value}
    </Txt>
  );
}
