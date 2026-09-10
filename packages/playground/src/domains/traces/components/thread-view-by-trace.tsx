import type { LightSpanRecord } from '@mastra/core/storage';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
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
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLinkIcon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { NeedsReviewDot } from '@/domains/traces/components/needs-review-dot';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { useExpandedSpanIds } from '@/domains/traces/hooks/use-expanded-span-ids';
import { useThreadRailTurns } from '@/domains/traces/hooks/use-thread-rail-turns';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';
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

  return <LoadedThreadViewByTrace traces={traces} setEndOfListElement={setEndOfListElement} />;
}

interface LoadedThreadViewByTraceProps {
  traces: LightSpanRecord[];
  setEndOfListElement: (node: HTMLDivElement | null) => void;
}

/** Mounts once the first page is in, so state seeded from `traces` at mount only sees that page. */
function LoadedThreadViewByTrace({ traces, setEndOfListElement }: LoadedThreadViewByTraceProps) {
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
  // "View full thread" on the traces page lands here with the originating trace: that row starts
  // expanded and scrolls into view when it mounts (see `scrollIntoViewOnMount`). Best effort on the
  // first page only: resolved once at mount, so a row that arrives on a later page is left alone.
  const [searchParams] = useSearchParams();
  const [anchorTraceId] = useState(() => {
    const requested = searchParams.get('traceId');
    return requested && traces.some(trace => trace.traceId === requested) ? requested : null;
  });
  // Rows whose timeline is shown in full rather than clamped to the messages column. Selecting a
  // span expands its row and it stays expanded until the reader collapses it with "Show less".
  const [expandedTraceIds, setExpandedTraceIds] = useState<ReadonlySet<string>>(
    () => new Set(anchorTraceId ? [anchorTraceId] : []),
  );

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

  // Only fades the other spans in the timeline; opening a span's detail panel stays a separate,
  // deliberate click so highlighting does not hijack the side panel.
  const highlightSpans = (traceId: string, spanIds: string[]) => {
    if (spanIds.length === 0) {
      setHighlight(null);
      return;
    }
    setHighlight({ traceId, spanIds });
    setTraceExpanded(traceId, true);
  };

  return (
    <div
      className={cn(
        'grid h-full min-h-0',
        selected ? 'grid-cols-[minmax(0,1fr)_minmax(0,40%)]' : 'grid-cols-[minmax(0,1fr)]',
      )}
    >
      <div ref={listRef} className="min-h-0 overflow-y-auto" data-testid="thread-view-by-trace">
        <div className="relative min-h-full py-4">
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
          {traces.map((trace, index) => (
            <TraceThreadRow
              key={trace.traceId}
              traceId={trace.traceId}
              isFirst={index === 0}
              isLast={index === traces.length - 1}
              selectedSpanId={selected?.traceId === trace.traceId ? selected.spanId : undefined}
              featuredSpanIds={highlight?.traceId === trace.traceId ? highlight.spanIds : undefined}
              isCurrent={currentTraceId === trace.traceId}
              isExpanded={expandedTraceIds.has(trace.traceId)}
              isAnchor={anchorTraceId === trace.traceId}
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

type TraceRowTab = 'spans' | 'feedback';

interface TraceThreadRowProps {
  traceId: string;
  selectedSpanId?: string;
  featuredSpanIds?: string[];
  isCurrent: boolean;
  isExpanded: boolean;
  /** The oldest trace; its timeline column gets the rounded top edge of the list. */
  isFirst: boolean;
  /** The newest trace; its timeline column gets the rounded bottom edge. Can be the same row as `isFirst`. */
  isLast: boolean;
  /** The row the reader came from via "View full thread"; scrolled into view once it mounts. */
  isAnchor: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSpanSelect: (spanId: string | undefined) => void;
  onHighlightSpans: (spanIds: string[]) => void;
}

// Module-level so the callback ref keeps its identity and React only invokes it on mount/unmount.
const scrollIntoViewOnMount = (row: HTMLDivElement | null) => {
  row?.scrollIntoView({ block: 'start' });
};

function TraceThreadRow({
  traceId,
  selectedSpanId,
  featuredSpanIds,
  isCurrent,
  isExpanded,
  isFirst,
  isLast,
  isAnchor,
  onExpandedChange,
  onSpanSelect,
  onHighlightSpans,
}: TraceThreadRowProps) {
  // Deduped with the fetch inside TraceThreadItemView (same query key).
  const { data, isLoading } = useTraceSpans(traceId, { passive: true });

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(data?.spans ?? []), [data]);

  const { expandedSpanIds, setExpandedSpanIds } = useExpandedSpanIds(hierarchicalSpans);

  // First page only, for the tab badge; the Feedback tab body owns its own pagination and
  // shares this query through the React Query cache.
  const { data: feedbackData } = useTraceFeedback({ traceId });

  // The whole row is dimmed unless it is the first one in view, hovered, or its span is open in
  // the side panel, so the reader keeps track of which turn they are on without hovering.
  const isActive = selectedSpanId !== undefined;

  // A long trace is clamped to the real height of its messages column (not a nominal row height),
  // so the timeline never dwarfs the turn it belongs to. Both heights are measured because the
  // clamp only makes sense when the timeline actually overflows.
  const messages = useMeasuredAutoHeight<HTMLDivElement>();
  const timeline = useMeasuredAutoHeight<HTMLDivElement>();
  const tabsHeader = useMeasuredAutoHeight<HTMLDivElement>();
  // The tab header sits above the timeline, so the timeline budget is what's left of the
  // messages height once the header is taken out — otherwise the right cell overshoots the left.
  const timelineBudget =
    messages.height !== null && tabsHeader.height !== null ? messages.height - tabsHeader.height : null;
  const overflows = timelineBudget !== null && timeline.height !== null && timeline.height > timelineBudget;
  const isClamped = overflows && !isExpanded;

  return (
    <div
      className={cn(
        'group grid grid-cols-[1fr_1fr] pr-4 pl-14 transition-opacity hover:opacity-100',
        isActive || isCurrent ? 'opacity-100' : 'opacity-50',
      )}
      data-trace-id={traceId}
      data-active={isActive || undefined}
      ref={isAnchor ? scrollIntoViewOnMount : undefined}
    >
      {/* The messages column has no borders so consecutive turns read as one continuous
          conversation; the timeline column carries the divider and the bottom border. */}
      <div className="relative min-h-[240px] min-w-0 pr-4">
        {/* Sticky within the row, so a long trace on the right never scrolls its messages away. */}
        <div ref={messages.ref} className="sticky top-0 py-4" data-testid="trace-row-messages">
          <TraceThreadItemView traceId={traceId} onHighlightSpans={onHighlightSpans} />
        </div>
      </div>
      <Tabs<TraceRowTab>
        defaultTab="spans"
        className={cn(
          'border-border1 min-w-0 overflow-hidden border-b border-l',
          // While collapsed the messages column alone sets the row height: `h-0` keeps this
          // cell out of the grid's row sizing (so measurement rounding can't nudge the row by
          // a pixel between tabs) and `min-h-full` stretches it back to the row afterwards.
          !isExpanded && 'h-0 min-h-full',
          isFirst && 'rounded-tl-xl border-t',
          isLast && 'rounded-bl-xl',
        )}
      >
        {/* Same header/tab layout as the traces page so both surfaces read identically. */}
        <div ref={tabsHeader.ref}>
          {/* Explicit border: the measuring wrapper makes the header the "last" child. */}
          <DataPanel.Header className="border-border1 min-h-0 border-b py-1.5">
            <TabList variant="pill-ghost" className="px-0">
              <Tab value="spans">Spans</Tab>
              <Tab value="feedback">
                Feedback
                <NeedsReviewDot feedback={feedbackData?.feedback} />
              </Tab>
            </TabList>
            <Button
              as={Link}
              to={`/traces?traceId=${encodeURIComponent(traceId)}`}
              variant="ghost"
              size="sm"
              className="shrink-0"
            >
              <ExternalLinkIcon />
              Go to trace
            </Button>
          </DataPanel.Header>
        </div>
        <TabContent value="spans" className="min-h-0 py-0">
          {/* The clamp is applied whenever the row is collapsed, not only once `overflows` is known:
              the timeline remounts on every tab switch and its measurement lags a frame, which
              would otherwise let the cell grow and snap back. A short timeline ignores it anyway. */}
          <div
            className="relative overflow-hidden"
            style={!isExpanded && timelineBudget !== null ? { maxHeight: timelineBudget } : undefined}
            data-testid="trace-row-timeline"
          >
            <div ref={timeline.ref} className="pt-2 pb-4 pl-4">
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
        </TabContent>
        <TabContent value="feedback" className="min-h-0 px-4 pt-2 pb-4">
          <TraceFeedbackTab key={traceId} traceId={traceId} variant="thread" />
        </TabContent>
      </Tabs>
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
