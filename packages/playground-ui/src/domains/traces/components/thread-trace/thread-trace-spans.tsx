import { Maximize2, Minimize2 } from 'lucide-react';
import { useMemo } from 'react';
import type { ComponentProps } from 'react';

import { useExpandedSpanIds } from '../../hooks/use-expanded-span-ids';
import { useTraceSpans } from '../../hooks/use-trace-spans';
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
 * messages height minus the details header, otherwise the right cell overshoots the left.
 */
function useSpansClamp() {
  const { isExpanded, setExpanded, messagesHeight, timelineHeight, detailsHeaderHeight } = useThreadTraceRow();
  const budget = messagesHeight !== null && detailsHeaderHeight !== null ? messagesHeight - detailsHeaderHeight : null;
  const overflows = budget !== null && timelineHeight !== null && timelineHeight > budget;
  return { budget, overflows, isExpanded, setExpanded };
}

export interface ThreadTraceSpansProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Class name of the measured wrapper around the timeline. */
  timelineClassName?: string;
}

/**
 * The span tree of a row, clamped (and faded) to the messages column while the row is collapsed;
 * `ThreadTrace.SpansToggle` expands it. Clamping needs the measured heights from
 * `ThreadTrace.Messages` and `ThreadTrace.DetailsHeader`; without them the timeline is shown in full.
 */
export function ThreadTraceSpans({ className, timelineClassName, ...props }: ThreadTraceSpansProps) {
  const { selectSpan } = useThreadTrace();
  const { traceId, selectedSpanId, featuredSpanIds, revealSpanId, timelineRef } = useThreadTraceRow();
  const { budget, overflows, isExpanded, setExpanded } = useSpansClamp();

  // Passive: deduped with the (non-passive) fetch inside the consumer's messages slot and the side panel.
  const { data, isLoading } = useTraceSpans(traceId, { passive: true });
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
    </CollapsibleBox>
  );
}

export type ThreadTraceSpansToggleProps = Omit<ComponentProps<typeof Button>, 'onClick' | 'children'>;

/**
 * Expand / Collapse control for `ThreadTrace.Spans`, meant for the details header (e.g. inside
 * `ThreadTrace.DetailsActions`). Only shown when the span tree overflows; collapsing would hide the
 * selected span, so Collapse waits until the span panel closes.
 */
export function ThreadTraceSpansToggle(props: ThreadTraceSpansToggleProps) {
  const { isActive } = useThreadTraceRow();
  const { overflows, isExpanded, setExpanded } = useSpansClamp();
  if (!overflows || (isExpanded && isActive)) return null;

  return (
    <Button
      size="sm"
      variant="ghost"
      icon={isExpanded ? <Minimize2 /> : <Maximize2 />}
      onClick={() => setExpanded(!isExpanded)}
      {...props}
    >
      {isExpanded ? 'Collapse' : 'Expand'}
    </Button>
  );
}
