import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';

import { useExpandedSpanIds } from '../../hooks/use-expanded-span-ids';
import { useTraceSpans } from '../../hooks/use-trace-spans';
import { formatHierarchicalSpans } from '../format-hierarchical-spans';
import { TraceSpanTree } from '../trace-span-tree';
import { useThreadTrace } from './thread-trace-context';
import { cn } from '@/lib/utils';

export interface ThreadTraceSpansProps extends Omit<ComponentProps<'div'>, 'children'> {
  traceId: string;
}

/**
 * The span tree of a turn, shown in full inside the trace column. Clicking a span opens it in the
 * span column; spans highlighted from the conversation are featured and scrolled into view.
 */
export function ThreadTraceSpans({ traceId, className, ...props }: ThreadTraceSpansProps) {
  const { selected, highlight, selectSpan } = useThreadTrace();
  const selectedSpanId = selected?.traceId === traceId ? selected.spanId : undefined;
  const featuredSpanIds = highlight?.traceId === traceId ? highlight.spanIds : undefined;

  const { data, isLoading } = useTraceSpans(traceId);
  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(data?.spans ?? []), [data]);
  const { expandedSpanIds, setExpandedSpanIds } = useExpandedSpanIds(hierarchicalSpans);

  // The trace column mounts collapsed and widens over the root's grid transition; scrolling a row
  // into view before that lands on a position measured against a zero-width column. Hold the
  // reveal until the column has opened (timeout covers environments without transitions).
  const containerRef = useRef<HTMLDivElement>(null);
  const [isColumnOpen, setIsColumnOpen] = useState(false);
  useEffect(() => {
    const grid = containerRef.current?.closest('[data-slot="thread-trace"]');
    const open = () => setIsColumnOpen(true);
    const onTransitionEnd = (event: Event) => {
      if (event.target === grid) open();
    };
    const timeout = window.setTimeout(open, 400);
    grid?.addEventListener('transitionend', onTransitionEnd);
    return () => {
      window.clearTimeout(timeout);
      grid?.removeEventListener('transitionend', onTransitionEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-slot="thread-trace-spans"
      className={cn('min-h-0 flex-1 overflow-auto px-4 pt-2 pb-4', className)}
      data-testid="thread-trace-spans"
      {...props}
    >
      <TraceSpanTree
        hierarchicalSpans={hierarchicalSpans}
        selectedSpanId={selectedSpanId}
        featuredSpanIds={featuredSpanIds}
        revealSpanId={isColumnOpen ? featuredSpanIds?.at(-1) : undefined}
        onSpanClick={id => selectSpan(traceId, selectedSpanId === id ? undefined : id)}
        expandedSpanIds={expandedSpanIds}
        setExpandedSpanIds={setExpandedSpanIds}
        isLoading={isLoading}
      />
    </div>
  );
}
