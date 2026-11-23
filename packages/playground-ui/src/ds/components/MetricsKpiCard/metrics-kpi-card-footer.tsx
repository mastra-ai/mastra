import type { ReactNode } from 'react';
import { SkeletonText } from '@/ds/components/Skeleton';
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
  isLoading = false,
  className,
}: {
  detail: ReactNode;
  prevValue?: string;
  /** Skeletons in the detail's and prior value's line boxes, so the card keeps its height. */
  isLoading?: boolean;
  className?: string;
}) {
  const frame = cn('mt-1 flex items-center justify-between gap-2 border-t border-border pt-2', className);
  if (isLoading) {
    return (
      <div className={frame}>
        <SkeletonText className="w-24" />
        <SkeletonText className="w-14" />
      </div>
    );
  }
  if (detail == null || detail === false || detail === '') return null;
  return (
    <div className={frame}>
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
