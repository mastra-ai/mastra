import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/**
 * Bottom row under a hairline: one line of context on the left (e.g. "1.3K server errors")
 * and the prior period's value on the right. The change badge in the value row reads
 * against this value, so the badge itself carries no "vs prior period" caption.
 */
export function MetricsKpiCardFooter({
  detail,
  prevValue,
  className,
}: {
  detail?: ReactNode;
  prevValue?: string;
  className?: string;
}) {
  if (!detail && !prevValue) return null;
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
