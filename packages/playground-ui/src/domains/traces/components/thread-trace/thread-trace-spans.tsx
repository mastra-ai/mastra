import { useTraceSpans } from '@mastra/react/hooks/traces';
import { Minimize2 } from 'lucide-react';
import { useMemo } from 'react';
import type { ComponentProps } from 'react';

import { useExpandedSpanIds } from '../../hooks/use-expanded-span-ids';
import { formatHierarchicalSpans } from '../format-hierarchical-spans';
import { TraceSpanTree } from '../trace-span-tree';
import { useThreadTrace } from './thread-trace-context';
import { useThreadTraceRow } from './thread-trace-row-context';
import { Button } from '@/ds/components/Button';
import { CollapsibleBox } from '@/ds/components/CollapsibleBox';
import type { CollapsibleBoxState } from '@/ds/components/CollapsibleBox';
import { cn } from '@/lib/utils';

/**
 * The span tree is clamped to the messages column while the row is collapsed. The budget is the
 * messages height minus the details header (when there is one), otherwise the right cell overshoots the left.
 */
function useSpansClamp() {
  const { isExpanded, setExpanded, messagesHeight, timelineHeight, detailsHeaderHeight } = useThreadTraceRow();
  const budget = messagesHeight !== null ? messagesHeight - (detailsHeaderHeight ?? 0) : null;
  const overflows = budget !== null && timelineHeight !== null && timelineHeight > budget;
  return { budget, overflows, isExpanded, setExpanded };
}

export interface ThreadTraceSpansProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Class name of the measured wrapper around the timeline. */
  timelineClassName?: string;
}

/**
 * The span tree of a row, clamped (and faded) to the messages column while the row is collapsed.
 * Clicking the fade or its Expand button expands it; a Collapse button sits under the expanded tree
 * (hidden while a span of the row is open). Clamping needs the measured height of `ThreadTrace.Messages`.
 */
export function ThreadTraceSpans({ className, timelineClassName, ...props }: ThreadTraceSpansProps) {
  const { selectSpan } = useThreadTrace();
  const { traceId, selectedSpanId, featuredSpanIds, revealSpanId, timelineRef, isActive } = useThreadTraceRow();
  const { budget, overflows, isExpanded, setExpanded } = useSpansClamp();

  // Passive: deduped with the (non-passive) fetch inside the consumer's messages slot and the side panel.
  const { data, isLoading } = useTraceSpans({ traceId: traceId, passive: true, queryOptions: { enabled: !!traceId } });
  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(data?.spans ?? []), [data]);
  const { expandedSpanIds, setExpandedSpanIds } = useExpandedSpanIds(hierarchicalSpans);

  // The clamp applies whenever the row is collapsed, not only once `overflows` is known: the
  // measurement lags a frame on mount, which would otherwise let the cell grow and snap back.
  // Overflow is already measured by the row, so the box's own measurement is ignored.
  const box: CollapsibleBoxState = {
    collapsedHeight: budget ?? 0,
    isExpanded: isExpanded || budget === null,
    isClipped: overflows,
    setClipped: () => {},
    setExpanded,
    toggleExpanded: () => setExpanded(!isExpanded),
  };

  return (
    <CollapsibleBox
      state={box}
      expandLabel="Expand"
      data-slot="thread-trace-spans"
      data-testid="trace-row-timeline"
      className={className}
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
      {isExpanded && overflows && !isActive && (
        <div className="flex justify-center pb-2">
          <Button size="sm" variant="ghost" icon={<Minimize2 />} onClick={() => setExpanded(false)}>
            Collapse
          </Button>
        </div>
      )}
    </CollapsibleBox>
  );
}
