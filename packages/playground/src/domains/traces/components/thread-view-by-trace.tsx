import { Button } from '@mastra/playground-ui/components/Button';
import { ThreadRail } from '@mastra/playground-ui/components/ThreadRail';
import type { ThreadRailTurn } from '@mastra/playground-ui/components/ThreadRail';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatHierarchicalSpans } from '@mastra/playground-ui/domains/traces/components/format-hierarchical-spans';
import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import { TraceTimeline } from '@mastra/playground-ui/domains/traces/components/trace-timeline';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useTraceSpanNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-span-navigation';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { useTraces } from '@mastra/playground-ui/domains/traces/hooks/use-traces';
import { useMeasuredAutoHeight } from '@mastra/playground-ui/hooks/use-measured-auto-height';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { useExpandedSpanIds } from '@/domains/traces/hooks/use-expanded-span-ids';
import { useThreadRailTurns } from '@/domains/traces/hooks/use-thread-rail-turns';
import { useVisibleTraceRows } from '@/domains/traces/hooks/use-visible-trace-rows';

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

  const traceIds = useMemo(() => traces.map(trace => trace.traceId), [traces]);
  const railTurns = useThreadRailTurns(traceIds);
  const listRef = useRef<HTMLDivElement>(null);
  const { visibleTraceIds, currentTraceId } = useVisibleTraceRows(listRef, traceIds);
  const findRow = (traceId: string) => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-trace-id]') ?? [];
    for (const row of rows) {
      if (row.dataset.traceId === traceId) return row;
    }
    return undefined;
  };
  const jumpToTrace = useCallback((turn: ThreadRailTurn) => {
    findRow(turn.messageId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const [selected, setSelected] = useState<SelectedSpan | null>(null);
  // Spans behind the message the user asked to highlight; scoped to one trace since each row has its own tree.
  const [highlight, setHighlight] = useState<{ traceId: string; spanIds: string[] } | null>(null);
  // Rows whose timeline is shown in full rather than clamped to the messages column. Selecting a
  // span expands its row and it stays expanded until the reader collapses it with "Show less".
  const [expandedTraceIds, setExpandedTraceIds] = useState<ReadonlySet<string>>(() => new Set());

  const setTraceExpanded = (traceId: string, expanded: boolean) => {
    setExpandedTraceIds(current => {
      if (current.has(traceId) === expanded) return current;
      const next = new Set(current);
      if (expanded) next.add(traceId);
      else next.delete(traceId);
      return next;
    });
  };

  const selectSpan = (traceId: string, spanId: string | undefined) => {
    setSelected(spanId ? { traceId, spanId } : null);
    if (spanId) setTraceExpanded(traceId, true);
    // Closing the panel also ends the highlight, like clearing the URL param on the traces page.
    if (!spanId) setHighlight(null);
  };

  // "View full thread" on the traces page lands here with the originating trace; best effort on
  // the first loaded page, since older pages only stream in as the reader scrolls up.
  const [searchParams] = useSearchParams();
  const anchorTraceId = searchParams.get('traceId');
  const anchoredRef = useRef(false);
  useEffect(() => {
    if (anchoredRef.current || !anchorTraceId || !traceIds.includes(anchorTraceId)) return;
    const row = findRow(anchorTraceId);
    if (!row) return;
    anchoredRef.current = true;
    row.scrollIntoView({ block: 'start' });
    setTraceExpanded(anchorTraceId, true);
  }, [anchorTraceId, traceIds]);

  const highlightSpans = (traceId: string, spanIds: string[]) => {
    const lastSpanId = spanIds.at(-1);
    if (!lastSpanId) {
      setHighlight(null);
      return;
    }
    setHighlight({ traceId, spanIds });
    // Open the detail panel on the last highlighted span: the first is always the root, the
    // last is the deepest step behind the message. The timeline scrolls the selected row into view.
    selectSpan(traceId, lastSpanId);
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
      <div ref={listRef} className="min-h-0 overflow-y-auto" data-testid="thread-view-by-trace">
        <div className="relative min-h-full">
          {/* Same rail as the chat page: one stop per turn, pinned mid-height while the page scrolls. */}
          <div className="pointer-events-none absolute inset-y-0 left-4 z-20">
            <ThreadRail
              turns={railTurns}
              currentAnchorId={currentTraceId}
              visibleMessageIds={visibleTraceIds}
              onSelect={jumpToTrace}
              className="pointer-events-auto sticky top-1/2 -translate-y-1/2"
            />
          </div>
          {/* Pages load older traces, and the list reads oldest-first, so the sentinel sits at the top.
              Scroll anchoring keeps the viewport in place when a page is prepended. */}
          <div ref={setEndOfListElement} />
          {traces.map(trace => (
            <TraceThreadRow
              key={trace.traceId}
              traceId={trace.traceId}
              selectedSpanId={selected?.traceId === trace.traceId ? selected.spanId : undefined}
              featuredSpanIds={highlight?.traceId === trace.traceId ? highlight.spanIds : undefined}
              isCurrent={currentTraceId === trace.traceId}
              isExpanded={expandedTraceIds.has(trace.traceId)}
              onExpandedChange={expanded => setTraceExpanded(trace.traceId, expanded)}
              onSpanSelect={spanId => selectSpan(trace.traceId, spanId)}
              onHighlightSpans={spanIds => highlightSpans(trace.traceId, spanIds)}
            />
          ))}
        </div>
      </div>
      {selected && (
        // Keyed by trace only: the panel's queries already follow `spanId`, so prev/next keep the DOM.
        <ThreadSpanPanel
          key={selected.traceId}
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
  isCurrent: boolean;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSpanSelect: (spanId: string | undefined) => void;
  onHighlightSpans: (spanIds: string[]) => void;
}

function TraceThreadRow({
  traceId,
  selectedSpanId,
  featuredSpanIds,
  isCurrent,
  isExpanded,
  onExpandedChange,
  onSpanSelect,
  onHighlightSpans,
}: TraceThreadRowProps) {
  // Deduped with the fetch inside TraceThreadItemView (same query key).
  const { data, isLoading } = useTraceSpans(traceId);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(data?.spans ?? []), [data]);

  const { expandedSpanIds, setExpandedSpanIds } = useExpandedSpanIds(hierarchicalSpans);

  const [showFeedback, setShowFeedback] = useState(false);

  // The whole row is dimmed unless it is the first one in view, hovered, or its span is open in
  // the side panel, so the reader keeps track of which turn they are on without hovering.
  const isActive = selectedSpanId !== undefined;

  // A long trace is clamped to the real height of its messages column (not a nominal row height),
  // so the timeline never dwarfs the turn it belongs to. Both heights are measured because the
  // clamp only makes sense when the timeline actually overflows.
  const messages = useMeasuredAutoHeight<HTMLDivElement>();
  const timeline = useMeasuredAutoHeight<HTMLDivElement>();
  const overflows = messages.height !== null && timeline.height !== null && timeline.height > messages.height;
  const isClamped = overflows && !isExpanded;

  return (
    <div
      className={cn(
        'group grid grid-cols-[1fr_1fr] pr-4 pl-14 transition-opacity hover:opacity-100',
        isActive || isCurrent || showFeedback ? 'opacity-100' : 'opacity-50',
      )}
      data-trace-id={traceId}
      data-active={isActive || undefined}
    >
      {/* The messages column has no bottom border so consecutive turns read as one
          continuous conversation; the vertical border separates it from the trace. */}
      <div className="border-border1 relative min-h-[240px] min-w-0 border-r pr-4">
        {/* Sticky within the row, so a long trace on the right never scrolls its messages away. */}
        <div ref={messages.ref} className="sticky top-0 flex flex-col gap-2 py-4" data-testid="trace-row-messages">
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
          <div className="min-h-0">
            <TraceThreadItemView traceId={traceId} onHighlightSpans={onHighlightSpans} />
          </div>
          {showFeedback && (
            <div className="border-border1 bg-surface3 absolute top-12 left-0 z-20 w-80 overflow-y-auto rounded-lg border shadow-lg">
              <TraceFeedbackTab key={traceId} traceId={traceId} variant="embed" />
            </div>
          )}
        </div>
      </div>
      <div className="border-border1 min-w-0 border-b">
        <div
          className="relative overflow-hidden"
          style={isClamped ? { maxHeight: messages.height ?? undefined } : undefined}
          data-testid="trace-row-timeline"
        >
          <div ref={timeline.ref} className="py-4 pl-4">
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
          {overflows && isClamped && (
            <div className="from-surface1 via-surface1/80 absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-linear-to-t to-transparent pb-2">
              <Button variant="ghost" size="sm" onClick={() => onExpandedChange(true)}>
                Show more
              </Button>
            </div>
          )}
        </div>
        {/* Collapsing would hide the selected span, so the control waits until the panel closes. */}
        {overflows && !isClamped && !isActive && (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" onClick={() => onExpandedChange(false)}>
              Show less
            </Button>
          </div>
        )}
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
