import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { useTraceListNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-list-navigation';
import { useTraceOrBranchSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-or-branch-spans';
import { useTraces } from '@mastra/playground-ui/domains/traces/hooks/use-traces';
import { useMemo, useState } from 'react';

import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';

export interface ThreadTracesProps {
  threadId: string;
  /** Notified when a trace is opened/closed so the host container can adapt (e.g. hide its title). */
  onTraceOpenChange?: (open: boolean) => void;
  /** Notified when the span detail opens/closes so the host container can widen (like the traces page). */
  onSpanOpenChange?: (open: boolean) => void;
}

/** Traces scoped to a single memory thread, with the same trace → span drilldown as the traces page. */
export function ThreadTraces({ threadId, onTraceOpenChange, onSpanOpenChange }: ThreadTracesProps) {
  const filters = useMemo(() => ({ threadId }), [threadId]);
  const {
    data: tracesData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error,
  } = useTraces({ filters });
  const traces = tracesData?.spans ?? [];

  const [featuredTraceId, setFeaturedTraceId] = useState<string | null>(null);
  const [featuredSpanId, setFeaturedSpanId] = useState<string | undefined>(undefined);

  // Parent notifications happen in the event handlers (not effects) — "you don't need an effect".
  // Only notify on actual open/close transitions so the parent never sees spurious changes.
  const selectSpan = (spanId: string | undefined) => {
    if (Boolean(spanId) !== Boolean(featuredSpanId)) onSpanOpenChange?.(Boolean(spanId));
    setFeaturedSpanId(spanId);
  };

  // The list is only visible when no trace is open, so no span can be open here.
  const openTrace = (traceId: string) => {
    setFeaturedTraceId(traceId);
    onTraceOpenChange?.(true);
  };

  const closeTrace = () => {
    selectSpan(undefined);
    setFeaturedTraceId(null);
    onTraceOpenChange?.(false);
  };

  // Prev/next trace arrows in the panel header, navigating within the thread's list.
  // Trace navigation clears any open span (the new trace has its own span tree).
  const { handlePreviousTrace, handleNextTrace } = useTraceListNavigation(
    traces,
    featuredTraceId ?? undefined,
    null,
    traceId => {
      selectSpan(undefined);
      setFeaturedTraceId(traceId);
    },
  );

  const { spans: traceSpans, isLoading: isLoadingTraceSpans } = useTraceOrBranchSpans({
    traceId: featuredTraceId,
    anchorSpanId: null,
    listMode: 'traces',
  });
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <TracesErrorContent error={error} resource="traces" errorTitle="Failed to load traces" />
      </div>
    );
  }

  if (featuredTraceId) {
    return (
      <TraceSpanPanel
        key={featuredTraceId}
        // The aside Card already draws the border/rounding — flatten the nested panels
        // (the span slot wrapper draws its own `border-l` separator).
        className="h-full rounded-none border-0"
        spanPanelClassName="rounded-none border-0"
        traceId={featuredTraceId}
        spans={traceSpans}
        isLoadingSpans={isLoadingTraceSpans}
        selectedSpanId={featuredSpanId ?? null}
        onClose={closeTrace}
        onSpanSelect={selectSpan}
        onPrevious={handlePreviousTrace}
        onNext={handleNextTrace}
        traceHref={`/traces?traceId=${encodeURIComponent(featuredTraceId)}`}
        showPartialThread
      />
    );
  }

  // The default list skeleton is sized for the full-width traces page grid and
  // overflows the narrow aside — render a compact one-column skeleton instead.
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4" aria-hidden="true">
        {['80%', '60%', '90%', '70%', '65%'].map((width, idx) => (
          <div key={idx} className="bg-surface6 h-4 animate-pulse rounded-lg" style={{ width }} />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 p-1.5">
      <TracesListView
        traces={traces}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        onTraceClick={trace => openTrace(trace.traceId)}
      />
    </div>
  );
}
