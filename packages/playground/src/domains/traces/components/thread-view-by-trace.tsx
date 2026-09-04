import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatHierarchicalSpans } from '@mastra/playground-ui/domains/traces/components/format-hierarchical-spans';
import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import { TraceTimeline } from '@mastra/playground-ui/domains/traces/components/trace-timeline';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { getAllSpanIds } from '@mastra/playground-ui/domains/traces/hooks/get-all-span-ids';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useTraceSpanNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-span-navigation';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { useTraces } from '@mastra/playground-ui/domains/traces/hooks/use-traces';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';

export interface ThreadViewByTraceProps {
  threadId: string;
}

interface SelectedSpan {
  traceId: string;
  spanId: string;
}

/**
 * A memory thread rendered as its traces: one row per agent turn (oldest first), with the
 * reconstructed messages on the left and the span tree on the right. Clicking a span opens
 * its detail panel on the side so the conversation stays readable.
 */
export function ThreadViewByTrace({ threadId }: ThreadViewByTraceProps) {
  const filters = useMemo(() => ({ threadId }), [threadId]);
  const { data: tracesData, isLoading, setEndOfListElement, error } = useTraces({ filters });

  // The list comes back newest-first; a conversation reads oldest-first.
  const traces = useMemo(() => [...(tracesData?.spans ?? [])].reverse(), [tracesData]);

  const [selected, setSelected] = useState<SelectedSpan | null>(null);
  // Spans behind the message the user asked to highlight; scoped to one trace since each row has its own tree.
  const [highlight, setHighlight] = useState<{ traceId: string; spanIds: string[] } | null>(null);

  const selectSpan = (traceId: string, spanId: string | undefined) => {
    setSelected(spanId ? { traceId, spanId } : null);
    // Closing the panel also ends the highlight, like clearing the URL param on the traces page.
    if (!spanId) setHighlight(null);
  };

  const highlightSpans = (traceId: string, spanIds: string[]) => {
    const lastSpanId = spanIds.at(-1);
    if (!lastSpanId) {
      setHighlight(null);
      return;
    }
    setHighlight({ traceId, spanIds });
    // Open the detail panel on the last highlighted span: the first is always the root, the
    // last is the deepest step behind the message. The timeline scrolls the selected row into view.
    setSelected({ traceId, spanId: lastSpanId });
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <TracesErrorContent error={error} resource="traces" errorTitle="Failed to load traces" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4" aria-hidden="true">
        {['80%', '60%', '90%', '70%', '65%'].map((width, idx) => (
          <div key={idx} className="bg-surface6 h-4 animate-pulse rounded-lg" style={{ width }} />
        ))}
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Txt variant="ui-md" className="text-neutral3">
          No traces found for this thread.
        </Txt>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid h-full min-h-0',
        selected ? 'grid-cols-[minmax(0,1fr)_minmax(0,40%)]' : 'grid-cols-[minmax(0,1fr)]',
      )}
    >
      <div className="min-h-0 overflow-y-auto" data-testid="thread-view-by-trace">
        {traces.map(trace => (
          <TraceThreadRow
            key={trace.traceId}
            traceId={trace.traceId}
            selectedSpanId={selected?.traceId === trace.traceId ? selected.spanId : undefined}
            featuredSpanIds={highlight?.traceId === trace.traceId ? highlight.spanIds : undefined}
            onSpanSelect={spanId => selectSpan(trace.traceId, spanId)}
            onHighlightSpans={spanIds => highlightSpans(trace.traceId, spanIds)}
          />
        ))}
        <div ref={setEndOfListElement} />
      </div>
      {selected && (
        <ThreadSpanPanel
          key={`${selected.traceId}:${selected.spanId}`}
          traceId={selected.traceId}
          spanId={selected.spanId}
          onSpanSelect={spanId => selectSpan(selected.traceId, spanId)}
        />
      )}
    </div>
  );
}

interface TraceThreadRowProps {
  traceId: string;
  selectedSpanId?: string;
  featuredSpanIds?: string[];
  onSpanSelect: (spanId: string | undefined) => void;
  onHighlightSpans: (spanIds: string[]) => void;
}

function TraceThreadRow({
  traceId,
  selectedSpanId,
  featuredSpanIds,
  onSpanSelect,
  onHighlightSpans,
}: TraceThreadRowProps) {
  // Deduped with the fetch inside TraceThreadItemView (same query key).
  const { data, isLoading } = useTraceSpans(traceId);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(data?.spans ?? []), [data]);

  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);
  useEffect(() => {
    if (hierarchicalSpans.length > 0) {
      setExpandedSpanIds(getAllSpanIds(hierarchicalSpans));
    }
  }, [hierarchicalSpans]);

  const [showFeedback, setShowFeedback] = useState(false);

  // The whole row is dimmed until hovered, or while its span is open in the side panel, so the
  // reader keeps track of which turn the details belong to without hovering.
  const isActive = selectedSpanId !== undefined;

  return (
    <div
      className={cn(
        'group grid grid-cols-[1fr_1fr] px-4 transition-opacity hover:opacity-100',
        isActive || showFeedback ? 'opacity-100' : 'opacity-50',
      )}
      data-trace-id={traceId}
      data-active={isActive || undefined}
    >
      {/* The messages column has no bottom border so consecutive turns read as one
          continuous conversation; the vertical border separates it from the trace. */}
      <div className="border-border1 relative flex min-h-[240px] min-w-0 flex-col gap-2 border-r py-4 pr-4">
        <div
          className={cn(
            'z-30 flex items-center gap-1 transition-opacity',
            showFeedback ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <Button
            size="icon-sm"
            variant="ghost"
            tooltip="Feedback"
            aria-label="Toggle feedback"
            onClick={() => setShowFeedback(v => !v)}
          >
            <MessageSquare />
          </Button>
          <Button
            as={Link}
            to={`/traces?traceId=${encodeURIComponent(traceId)}`}
            variant="ghost"
            size="icon-sm"
            tooltip="Go to trace"
            aria-label="Go to trace"
          >
            <TraceIcon />
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <TraceThreadItemView traceId={traceId} onHighlightSpans={onHighlightSpans} />
        </div>
        {showFeedback && (
          <div className="border-border1 bg-surface3 absolute top-8 left-0 z-20 max-h-[calc(100%-2rem)] w-80 overflow-y-auto rounded-lg border shadow-lg">
            <TraceFeedbackTab key={traceId} traceId={traceId} variant="embed" />
          </div>
        )}
      </div>
      <div className="border-border1 min-w-0 border-b">
        <div className="py-4 pl-4">
          <TraceTimeline
            hierarchicalSpans={hierarchicalSpans}
            selectedSpanId={selectedSpanId}
            featuredSpanIds={featuredSpanIds}
            onSpanClick={id => onSpanSelect(selectedSpanId === id ? undefined : id)}
            expandedSpanIds={expandedSpanIds}
            setExpandedSpanIds={setExpandedSpanIds}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

interface ThreadSpanPanelProps {
  traceId: string;
  spanId: string;
  onSpanSelect: (spanId: string | undefined) => void;
}

function ThreadSpanPanel({ traceId, spanId, onSpanSelect }: ThreadSpanPanelProps) {
  const { data: spanDetailData, isLoading } = useSpanDetail(traceId, spanId);
  const { data: traceData } = useTraceSpans(traceId);
  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(traceData?.spans, spanId, onSpanSelect);

  return (
    <SpanDataPanelView
      className="border-border1 h-full rounded-none border-0 border-l"
      traceId={traceId}
      spanId={spanId}
      span={spanDetailData?.span}
      isLoading={isLoading}
      onClose={() => onSpanSelect(undefined)}
      onPrevious={handlePreviousSpan}
      onNext={handleNextSpan}
    />
  );
}
