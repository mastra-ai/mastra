import { useMastraClient } from '@mastra/react';
import { traceSpansQueryOptions, useTraceSpans } from '@mastra/react/hooks/traces';
import { useQueries } from '@tanstack/react-query';
import { ExternalLinkIcon, MessageSquareReplyIcon, MessageSquareTextIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TraceScoresTab } from '@/domains/scores';
import { ThreadTrace, useThreadTraceRow } from '@/domains/traces/components/thread-trace';
import type { ThreadTraceSelectedSpan } from '@/domains/traces/components/thread-trace';

import { ThreadViewSkeleton } from '@/domains/traces/components/thread-view-skeleton';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { useTracesListSource } from '@/domains/traces/hooks/use-traces-list-source';
import type { UseTracesListSourceArgs } from '@/domains/traces/hooks/use-traces-list-source';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { ScorersIcon } from '@/ds/icons/ScorersIcon';
import { useLinkComponent } from '@/lib/framework';

// `queryTraces` requires a time range and rejects ranges over 31 days; the legacy endpoint is left unbounded.
const THREAD_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;

export interface ThreadViewByTraceProps {
  threadId: string;
  /** Lists the thread through the trace-query API; `false` falls back to `listTracesLight`. */
  withQueryTrace: boolean;
  /** Shows the per-trace Feedback tab and fetches its feedback. */
  withFeedback: boolean;
  /** Fires when a span detail opens or closes (`null`). */
  onSelectedSpanChange?: (selected: ThreadTraceSelectedSpan | null) => void;
  /** Opens a score from a trace's Scores tab; the app owns routing. */
  onOpenScore: (traceId: string, scoreId: string) => void;
  /** Turns loaded per page: the latest ones on open, then older ones as the reader scrolls up. */
  pageSize?: number;
}

/**
 * A memory thread rendered as its traces, like a chat: one row per agent turn (oldest at the top),
 * opened on the latest turns, with older turns loaded as the reader scrolls up. Each row shows the
 * reconstructed messages on the left and the span tree on the right. Clicking a span opens its
 * detail panel on the side so the conversation stays readable.
 */
export function ThreadViewByTrace({
  threadId,
  withQueryTrace,
  withFeedback,
  onSelectedSpanChange,
  onOpenScore,
  pageSize = 10,
}: ThreadViewByTraceProps) {
  const legacyFilters = useMemo<UseTracesListSourceArgs['legacyFilters']>(() => ({ threadId }), [threadId]);
  const { rows, isLoading, isPlaceholderData, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useTracesListSource({
      initialAutoRefetch: false,
      withQueryTrace,
      legacyFilters,
      limit: pageSize,
      query: now => ({
        timeRange: {
          from: new Date(now.getTime() - THREAD_WINDOW_MS).toISOString(),
          to: now.toISOString(),
        },
        where: { op: 'eq', left: { path: 'threadId' }, right: { literal: threadId } },
        orderBy: [{ field: 'startedAt', direction: 'desc' }],
      }),
    });
  // Pages come newest first; the conversation reads oldest first.
  const traceIds = rows.map(trace => trace.traceId).reverse();
  const listSettled = !isLoading && !isPlaceholderData;

  // The first page is shown only once its turns' spans have settled too, so the rows mount complete
  // instead of each one loading on its own. Older pages keep their per-row loading.
  const client = useMastraClient();
  const [readyThreadId, setReadyThreadId] = useState<string | null>(null);
  const isReady = readyThreadId === threadId;
  const firstPageSpansSettled = useQueries({
    queries: (isReady || !listSettled ? [] : traceIds).map(traceId => ({
      ...traceSpansQueryOptions(client, traceId),
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
    combine: results => results.every(result => !result.isPending),
  });
  if (!isReady && listSettled && firstPageSpansSettled) setReadyThreadId(threadId);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <TracesErrorContent error={error} resource="traces" errorTitle="Failed to load traces" />
      </div>
    );
  }

  if (!isReady) return <ThreadViewSkeleton withFeedback={withFeedback} />;

  if (traceIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Txt variant="body" tone="muted">
          No traces found for this thread.
        </Txt>
      </div>
    );
  }

  return (
    <ThreadTrace
      key={threadId}
      traceIds={traceIds}
      onSelectedSpanChange={onSelectedSpanChange}
      onLoadOlder={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
    >
      <ThreadTrace.List data-testid="thread-view-by-trace">
        {traceIds.map((traceId, index) => (
          <ThreadTrace.Row key={traceId} traceId={traceId}>
            <ThreadTraceRowContent turn={index + 1} withFeedback={withFeedback} onOpenScore={onOpenScore} />
          </ThreadTrace.Row>
        ))}
      </ThreadTrace.List>
      <ThreadTrace.SpanPanel />
    </ThreadTrace>
  );
}

function ThreadTraceRowContent({
  turn,
  withFeedback,
  onOpenScore,
}: {
  /** 1-based position among the loaded turns. */
  turn: number;
  withFeedback: boolean;
  onOpenScore: (traceId: string, scoreId: string) => void;
}) {
  const { traceId, highlightSpans } = useThreadTraceRow();
  const { Link, paths } = useLinkComponent();
  const traceHref = paths.traceLink(traceId);
  // Same query the span tree observes (passive: the tree drives refetches).
  const { data: traceData } = useTraceSpans({ traceId: traceId, passive: true, queryOptions: { enabled: !!traceId } });
  const rootSpanId = traceData?.spans.find(span => span.parentSpanId == null)?.spanId;

  return (
    <>
      <ThreadTrace.Divider label={`Turn ${turn}`}>
        {traceHref && (
          <>
            <Button render={<Link href={traceHref} />} variant="ghost" size="sm" icon={<ExternalLinkIcon />}>
              Go to trace
            </Button>
            <span aria-hidden className="h-4 w-px bg-border" />
          </>
        )}
        <ThreadTrace.TabList>
          <ThreadTrace.Tab value="messages">
            <Icon size="xs">
              <MessageSquareTextIcon />
            </Icon>
            Messages
          </ThreadTrace.Tab>
          {withFeedback && (
            <ThreadTrace.Tab value="feedback">
              <Icon size="xs">
                <MessageSquareReplyIcon />
              </Icon>
              Feedback
            </ThreadTrace.Tab>
          )}
          <ThreadTrace.Tab value="scores">
            <Icon size="xs">
              <ScorersIcon />
            </Icon>
            Scores
          </ThreadTrace.Tab>
        </ThreadTrace.TabList>
      </ThreadTrace.Divider>
      <ThreadTrace.RowBody>
        <ThreadTrace.Messages>
          <ThreadTrace.TabContent value="messages" flush>
            <TraceThreadItemView traceId={traceId} onHighlightSpans={highlightSpans} />
          </ThreadTrace.TabContent>
          {withFeedback && (
            <ThreadTrace.TabContent value="feedback" className="min-h-0 py-3">
              <TraceFeedbackTab key={traceId} traceId={traceId} variant="thread" />
            </ThreadTrace.TabContent>
          )}
          <ThreadTrace.TabContent value="scores" className="min-h-0 py-3">
            {rootSpanId ? (
              <TraceScoresTab
                key={traceId}
                traceId={traceId}
                spanId={rootSpanId}
                onScoreSelect={scoreId => onOpenScore(traceId, scoreId)}
              />
            ) : null}
          </ThreadTrace.TabContent>
        </ThreadTrace.Messages>
        <ThreadTrace.Details>
          <ThreadTrace.Spans />
        </ThreadTrace.Details>
      </ThreadTrace.RowBody>
    </>
  );
}
