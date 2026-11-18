import { useTools } from '@mastra/react/hooks/tools';
import { useSpanDetail, useTraceSpans } from '@mastra/react/hooks/traces';
import { useMemo, useState } from 'react';
import { useThreadTraceSpans } from '../hooks/use-thread-trace-spans';
import type { FeedbackOptions } from './feedback-options';
import { TraceScoresTab } from '@/domains/scores/components/trace-scores-tab';
import type { ThreadTraceSelectedSpan } from '@/domains/traces/components/thread-trace';
import { ThreadViewByTraceView } from '@/domains/traces/components/thread-view-by-trace-view';
import type { ThreadViewByTraceViewProps } from '@/domains/traces/components/thread-view-by-trace-view';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { useTracesListSource } from '@/domains/traces/hooks/use-traces-list-source';
import type { UseTracesListSourceArgs } from '@/domains/traces/hooks/use-traces-list-source';

// `queryTraces` requires a time range; start at the epoch so it covers the whole thread, like the legacy endpoint.
const THREAD_WINDOW_FROM = new Date(0).toISOString();

export interface ThreadViewByTraceProps {
  threadId: string;
  /** Lists the thread through the trace-query API; `false` falls back to `listTracesLight`. */
  withQueryTrace: boolean;
  /** Shows the per-trace Feedback tab and fetches its feedback. */
  withFeedback: boolean;
  feedbackOptions?: FeedbackOptions;
  /** Fires when a span detail opens or closes (`null`). */
  onSelectedSpanChange?: (selected: ThreadTraceSelectedSpan | null) => void;
  /** Opens a score from a trace's Scores tab; the app owns routing. */
  onOpenScore: (traceId: string, scoreId: string) => void;
  /** Turns loaded per page: the latest ones on open, then older ones as the reader scrolls up. */
  pageSize?: number;
}

/**
 * Studio's thread view: {@link ThreadViewByTraceView} fed through the Mastra client. Loads the thread's
 * traces page by page (latest first), each turn's spans, and the record of the span the reader opens;
 * the view itself never fetches.
 */
export function ThreadViewByTrace({
  threadId,
  withQueryTrace,
  withFeedback,
  feedbackOptions,
  onSelectedSpanChange,
  onOpenScore,
  pageSize = 3,
}: ThreadViewByTraceProps) {
  const legacyFilters = useMemo<UseTracesListSourceArgs['legacyFilters']>(() => ({ threadId }), [threadId]);
  const { rows, isLoading, isPlaceholderData, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useTracesListSource({
      autoRefetch: false,
      withQueryTrace,
      legacyFilters,
      limit: pageSize,
      query: now => ({
        timeRange: {
          from: THREAD_WINDOW_FROM,
          to: now.toISOString(),
        },
        where: { op: 'eq', left: { path: 'threadId' }, right: { literal: threadId } },
        orderBy: [{ field: 'startedAt', direction: 'desc' }],
      }),
    });

  const feedbackSlot: ThreadViewByTraceViewProps['feedbackSlot'] = withFeedback
    ? ({ traceId }) => (
        <TraceFeedbackTab key={traceId} traceId={traceId} variant="thread" feedbackOptions={feedbackOptions} />
      )
    : undefined;
  const scoresSlot: ThreadViewByTraceViewProps['scoresSlot'] = ({ traceId, rootSpanId }) => (
    <TraceScoresTab
      key={traceId}
      traceId={traceId}
      spanId={rootSpanId}
      onScoreSelect={scoreId => onOpenScore(traceId, scoreId)}
    />
  );

  // Placeholder rows belong to the previous thread: they never reach the view.
  if (error || isLoading || isPlaceholderData) {
    return (
      <ThreadViewByTraceView traces={[]} isLoading={!error} error={error ?? undefined} feedbackSlot={feedbackSlot} />
    );
  }

  return (
    <LoadedThread
      // A span opened in one thread means nothing in the next one.
      key={threadId}
      // Pages come newest first; the conversation reads oldest first.
      traceIds={rows.map(trace => trace.traceId).reverse()}
      onLoadOlder={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onSelectedSpanChange={onSelectedSpanChange}
      feedbackSlot={feedbackSlot}
      scoresSlot={scoresSlot}
    />
  );
}

interface LoadedThreadProps extends Pick<
  ThreadViewByTraceViewProps,
  'onLoadOlder' | 'onSelectedSpanChange' | 'feedbackSlot' | 'scoresSlot'
> {
  /** The thread's turns loaded so far, oldest first. */
  traceIds: string[];
}

/** A thread whose list has loaded: loads each turn's spans and the record of the span the reader opens. */
function LoadedThread({ traceIds, onLoadOlder, onSelectedSpanChange, feedbackSlot, scoresSlot }: LoadedThreadProps) {
  const traces = useThreadTraceSpans(traceIds);
  // The first page is shown only once its turns' spans have settled too, so the rows mount complete
  // instead of each one loading on its own. Older pages are prepended later and keep their per-row loading.
  const [firstPage] = useState(() => new Set(traceIds));
  const isReady = traces.every(trace => !firstPage.has(trace.traceId) || !trace.isLoading);

  const [selectedSpan, setSelectedSpan] = useState<ThreadTraceSelectedSpan | null>(null);
  const spanDetail = useSpanDetail({
    traceId: selectedSpan?.traceId,
    spanId: selectedSpan?.spanId,
    queryOptions: { enabled: !!selectedSpan },
  });
  // The rows read their spans passively; this active observer keeps the selected trace fresh on focus/reconnect.
  useTraceSpans({ traceId: selectedSpan?.traceId, queryOptions: { enabled: !!selectedSpan } });
  // Tools only matter to an open span: its Input tab links the tools it offered to their pages.
  const { data: registeredTools } = useTools({ queryOptions: { enabled: !!selectedSpan } });

  return (
    <ThreadViewByTraceView
      traces={traces}
      isLoading={!isReady}
      onLoadOlder={onLoadOlder}
      selectedSpan={selectedSpan}
      onSelectedSpanChange={selected => {
        setSelectedSpan(selected);
        onSelectedSpanChange?.(selected);
      }}
      selectedSpanDetail={spanDetail.data?.span}
      isLoadingSelectedSpanDetail={spanDetail.isLoading}
      registeredTools={registeredTools}
      feedbackSlot={feedbackSlot}
      scoresSlot={scoresSlot}
    />
  );
}

export type { FeedbackOptions } from './feedback-options';
