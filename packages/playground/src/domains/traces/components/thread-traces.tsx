import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useTraceOrBranchSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-or-branch-spans';
import { useTraceSpanNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-span-navigation';
import { useTraces } from '@mastra/playground-ui/domains/traces/hooks/use-traces';
import { useMemo, useState } from 'react';

import { TraceDataPanel } from '@/domains/traces/components/trace-data-panel';
import { Link } from '@/lib/link';

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

  const { spans: traceSpans, isLoading: isLoadingTraceSpans } = useTraceOrBranchSpans({
    traceId: featuredTraceId,
    anchorSpanId: null,
    listMode: 'traces',
  });
  const { data: spanDetailData, isLoading: isLoadingSpanDetail } = useSpanDetail(
    featuredTraceId ?? '',
    featuredSpanId ?? '',
  );
  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(traceSpans, featuredSpanId ?? null, selectSpan);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <TracesErrorContent error={error} resource="traces" errorTitle="Failed to load traces" />
      </div>
    );
  }

  if (featuredTraceId) {
    return (
      <TraceDataPanel
        key={featuredTraceId}
        // The aside Card already draws the border/rounding — flatten the nested panel.
        className="h-full rounded-none border-0"
        traceId={featuredTraceId}
        spans={traceSpans}
        isLoading={isLoadingTraceSpans}
        onClose={closeTrace}
        onSpanSelect={selectSpan}
        initialSpanId={featuredSpanId ?? null}
        placement="traces-list"
        LinkComponent={Link}
        traceHref={`/traces?traceId=${encodeURIComponent(featuredTraceId)}`}
        spanPanelSlot={
          featuredSpanId ? (
            <SpanDataPanelView
              // The slot wrapper already draws a `border-l` separator — flatten the nested panel.
              className="rounded-none border-0"
              traceId={featuredTraceId}
              spanId={featuredSpanId}
              span={spanDetailData?.span}
              isLoading={isLoadingSpanDetail}
              onClose={() => selectSpan(undefined)}
              onPrevious={handlePreviousSpan}
              onNext={handleNextSpan}
            />
          ) : null
        }
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
