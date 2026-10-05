import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/**
 * Bottom row under a hairline: one line of context on the left (e.g. "1.3K server errors")
 * and the prior period's value on the right. Only worth its hairline when there is a detail
 * line; a card with just a prior value puts it in the value row (`MetricsKpiCard.Prev`).
 */
export function MetricsKpiCardFooter({
  detail,
  prevValue,
  className,
}: {
  detail: ReactNode;
  prevValue?: string;
  className?: string;
}) {
  if (detail == null || detail === false || detail === '') return null;
  return (
    <div className={cn('mt-2 flex items-center justify-between gap-2 border-t border-border pt-3', className)}>
      <Txt as="span" variant="body-sm" tone="muted" className="min-w-0 truncate">
        {detail}
      </Txt>
      {prevValue && (
        <Txt as="span" variant="body-sm" tone="muted" className="shrink-0 tabular-nums">
          vs {prevValue}
        </Txt>
      )}
    </div>
  );
}
