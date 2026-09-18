import type { ComponentProps } from 'react';

import { useThreadTraceRow } from './thread-trace-row-context';
import { DataPanel } from '@/ds/components/DataPanel';
import { cn } from '@/lib/utils';

export type ThreadTraceDetailsProps = ComponentProps<'div'>;

/** The bordered details column of a row: a `ThreadTrace.DetailsHeader` above `ThreadTrace.Spans`. */
export function ThreadTraceDetails({ className, children, ...props }: ThreadTraceDetailsProps) {
  const { isExpanded, isFirst } = useThreadTraceRow();
  return (
    <div
      data-slot="thread-trace-details"
      className={cn(
        'min-w-0 overflow-hidden border-x border-b border-border1 group-last:rounded-b-xl',
        // While collapsed the messages column alone sets the row height: `h-0` keeps this
        // cell out of the grid's row sizing (so measurement rounding can't nudge the row by
        // a pixel) and `min-h-full` stretches it back to the row afterwards.
        !isExpanded && 'h-0 min-h-full',
        isFirst && 'rounded-t-xl border-t',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type ThreadTraceDetailsHeaderProps = ComponentProps<'div'>;

/**
 * The header row above the span tree; children are typically a `ThreadTrace.DetailsActions`.
 * Measured: its height is taken out of the span tree budget so the details cell never
 * overshoots the messages column.
 */
export function ThreadTraceDetailsHeader({ className, children, ...props }: ThreadTraceDetailsHeaderProps) {
  const { detailsHeaderRef } = useThreadTraceRow();
  return (
    <div ref={detailsHeaderRef} data-slot="thread-trace-details-header" className={className} {...props}>
      {/* Sole child of the measured wrapper, so the header's own `not-last:border-b` never applies. */}
      <DataPanel.Header className="border-border1 border-b">{children}</DataPanel.Header>
    </div>
  );
}

export type ThreadTraceDetailsActionsProps = ComponentProps<'div'>;

/** Trailing controls of the header (e.g. a "Go to trace" link), pushed to the right. */
export function ThreadTraceDetailsActions({ className, ...props }: ThreadTraceDetailsActionsProps) {
  return (
    <div
      data-slot="thread-trace-details-actions"
      className={cn('ml-auto flex shrink-0 items-center', className)}
      {...props}
    />
  );
}
