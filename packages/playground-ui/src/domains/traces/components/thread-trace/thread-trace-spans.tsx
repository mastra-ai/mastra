import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo } from 'react';
import type { ComponentProps } from 'react';

import { useExpandedSpanIds } from '../../hooks/use-expanded-span-ids';
import { useTraceSpans } from '../../hooks/use-trace-spans';
import { formatHierarchicalSpans } from '../format-hierarchical-spans';
import { TraceSpanTree } from '../trace-span-tree';
import { useThreadTrace } from './thread-trace-context';
import { useThreadTraceRow } from './thread-trace-row-context';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export interface ThreadTraceSpansProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Class name of the measured wrapper around the timeline. */
  timelineClassName?: string;
}

/**
 * The span tree of a row, clamped to the messages column while the row is collapsed with a
 * "Show more" control (and "Show less" once expanded, hidden while a span of the row is open).
 * Clamping needs the measured heights from `ThreadTrace.Messages` and `ThreadTrace.DetailsHeader`;
 * without them the timeline is shown in full.
 */
export function ThreadTraceSpans({ className, timelineClassName, ...props }: ThreadTraceSpansProps) {
  const { selectSpan } = useThreadTrace();
  const {
    traceId,
    isActive,
    isExpanded,
    selectedSpanId,
    featuredSpanIds,
    revealSpanId,
    setExpanded,
    timelineRef,
    messagesHeight,
    timelineHeight,
    detailsHeaderHeight,
  } = useThreadTraceRow();

  // Passive: deduped with the (non-passive) fetch inside the consumer's messages slot and the side panel.
  const { data, isLoading } = useTraceSpans(traceId, { passive: true });
  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(data?.spans ?? []), [data]);
  const { expandedSpanIds, setExpandedSpanIds } = useExpandedSpanIds(hierarchicalSpans);

  // The tab header sits above the timeline, so the timeline budget is what's left of the
  // messages height once the header is taken out — otherwise the right cell overshoots the left.
  const timelineBudget =
    messagesHeight !== null && detailsHeaderHeight !== null ? messagesHeight - detailsHeaderHeight : null;
  const overflows = timelineBudget !== null && timelineHeight !== null && timelineHeight > timelineBudget;
  const isClamped = overflows && !isExpanded;

  return (
    <>
      {/* The clamp is applied whenever the row is collapsed, not only once `overflows` is known:
          the measurement lags a frame on mount, which would otherwise let the cell grow and
          snap back. A short timeline ignores it anyway. */}
      <div
        data-slot="thread-trace-spans"
        className={cn('relative overflow-hidden', className)}
        style={!isExpanded && timelineBudget !== null ? { maxHeight: timelineBudget } : undefined}
        data-testid="trace-row-timeline"
        {...props}
      >
        <div ref={timelineRef} className={cn('px-4 pt-2 pb-4', timelineClassName)}>
          <TraceSpanTree
            hierarchicalSpans={hierarchicalSpans}
            selectedSpanId={selectedSpanId}
            featuredSpanIds={featuredSpanIds}
            revealSpanId={revealSpanId}
            onSpanClick={id => selectSpan(traceId, selectedSpanId === id ? undefined : id)}
            expandedSpanIds={expandedSpanIds}
            setExpandedSpanIds={setExpandedSpanIds}
            isLoading={isLoading}
          />
        </div>
        {overflows && isClamped && (
          <div className="from-surface1 via-surface1/80 absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-linear-to-t to-transparent pb-2">
            <Button icon={<ChevronDown />} variant="ghost" size="sm" onClick={() => setExpanded(true)}>
              Show more
            </Button>
          </div>
        )}
      </div>
      {/* Collapsing would hide the selected span, so the control waits until the panel closes. */}
      {overflows && !isClamped && !isActive && (
        <div className="flex justify-center py-2">
          <Button icon={<ChevronUp />} variant="ghost" size="sm" onClick={() => setExpanded(false)}>
            Show less
          </Button>
        </div>
      )}
    </>
  );
}
