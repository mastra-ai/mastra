import { useSpanDetail, useTraceSpans } from '@mastra/react/hooks/traces';
import { useMemo, useState } from 'react';
import { useStudioTraceNavigation } from '../hooks/use-studio-trace-navigation';
import { useThreadTraceSpans } from '../hooks/use-thread-trace-spans';
import type { FeedbackOptions } from './feedback-options';
import { LiveSpanInput, LiveSpanOutput, LiveTurnMessages } from './live-parts';
import { TraceScoresTab } from '@/domains/scores/components/trace-scores-tab';
import { ThreadTrace } from '@/domains/traces/components/thread-trace';
import type { ThreadTraceSelectedSpan } from '@/domains/traces/components/thread-trace';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { getTraceRootSpan } from '@/domains/traces/components/trace-thread-context';
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
 * Studio's thread view: a `ThreadTrace` composition fed through the Mastra client. Loads the thread's
 * traces page by page (latest first), each turn's spans, and the record of the span the reader opens;
 * a host with its own transport composes `ThreadTrace` the same way with its own data.
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

  if (error) return <ThreadTrace.Error error={error} />;
  // Placeholder rows belong to the previous thread: they never reach the view.
  if (isLoading || isPlaceholderData) return <ThreadTrace.Loading withFeedback={withFeedback} />;

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
      withFeedback={withFeedback}
      feedbackOptions={feedbackOptions}
      onOpenScore={onOpenScore}
    />
  );
}

interface LoadedThreadProps extends Pick<
  ThreadViewByTraceProps,
  'onSelectedSpanChange' | 'withFeedback' | 'feedbackOptions' | 'onOpenScore'
> {
  /** The thread's turns loaded so far, oldest first. */
  traceIds: string[];
  onLoadOlder: () => void;
}

/** A thread whose list has loaded: loads each turn's spans and the record of the span the reader opens. */
function LoadedThread({
  traceIds,
  onLoadOlder,
  onSelectedSpanChange,
  withFeedback,
  feedbackOptions,
  onOpenScore,
}: LoadedThreadProps) {
  const turns = useThreadTraceSpans(traceIds);
  // The first page is shown only once its turns' spans have settled too, so the rows mount complete
  // instead of each one loading on its own. Older pages are prepended later and keep their per-row loading.
  const [firstPage] = useState(() => new Set(traceIds));
  const isReady = turns.every(turn => !firstPage.has(turn.traceId) || !turn.isLoading);

  const [selectedSpan, setSelectedSpan] = useState<ThreadTraceSelectedSpan | null>(null);
  const spanDetail = useSpanDetail({
    traceId: selectedSpan?.traceId,
    spanId: selectedSpan?.spanId,
    queryOptions: { enabled: !!selectedSpan },
  });
  // The rows read their spans passively; this active observer keeps the selected trace fresh on focus/reconnect.
  useTraceSpans({ traceId: selectedSpan?.traceId, queryOptions: { enabled: !!selectedSpan } });
  // Studio opens each turn's trace, tools and delegated agents through its router.
  const navigation = useStudioTraceNavigation();

  if (!isReady) return <ThreadTrace.Loading withFeedback={withFeedback} />;
  if (turns.length === 0) return <ThreadTrace.Empty />;

  return (
    <ThreadTrace
      data-testid="thread-view-by-trace"
      navigation={navigation}
      traceIds={traceIds}
      selectedSpan={selectedSpan}
      onSelectedSpanChange={selected => {
        setSelectedSpan(selected);
        onSelectedSpanChange?.(selected);
      }}
      onLoadOlder={onLoadOlder}
      spanDetail={
        <ThreadTrace.SpanDetail
          span={spanDetail.data?.span}
          isLoading={spanDetail.isLoading}
          // Each tab loads what it draws when it opens: the tool registry, the turn's spans, the live tool cards.
          input={<LiveSpanInput />}
          output={<LiveSpanOutput />}
        />
      }
    >
      {turns.map((turn, index) => {
        const rootSpanId = getTraceRootSpan(turn.spans)?.spanId;
        return (
          <ThreadTrace.Row
            key={turn.traceId}
            traceId={turn.traceId}
            label={`Turn ${index + 1}`}
            link={<ThreadTrace.TraceLink />}
            messages={<LiveTurnMessages spans={turn.spans} isLoading={turn.isLoading} error={turn.error} />}
            feedback={
              withFeedback && (
                <TraceFeedbackTab
                  key={turn.traceId}
                  traceId={turn.traceId}
                  variant="thread"
                  feedbackOptions={feedbackOptions}
                />
              )
            }
            scores={
              rootSpanId && (
                <TraceScoresTab
                  key={turn.traceId}
                  traceId={turn.traceId}
                  spanId={rootSpanId}
                  onScoreSelect={scoreId => onOpenScore(turn.traceId, scoreId)}
                />
              )
            }
            spans={<ThreadTrace.Spans spans={turn.spans} isLoading={turn.isLoading} />}
          />
        );
      })}
    </ThreadTrace>
  );
}

export type { FeedbackOptions } from './feedback-options';
