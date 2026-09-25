import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ThreadTrace, useThreadTraceRow } from '@mastra/playground-ui/domains/traces/components/thread-trace';
import type { ThreadTraceSelectedSpan } from '@mastra/playground-ui/domains/traces/components/thread-trace';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { useTracesListSource } from '@mastra/playground-ui/domains/traces/hooks/use-traces-list-source';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { ExternalLinkIcon, MessageSquareReplyIcon, MessageSquareTextIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { ThreadViewSkeleton } from '@/domains/traces/components/thread-view-skeleton';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceScoresTab } from '@/domains/traces/components/trace-scores-tab';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { useThreadRailTurns } from '@/domains/traces/hooks/use-thread-rail-turns';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';

export interface ThreadViewByTraceProps {
  threadId: string;
  /** Lists the thread through the trace-query API; `false` falls back to `listTracesLight`. */
  withQueryTrace: boolean;
  /** Shows the per-trace Feedback tab and fetches its feedback. */
  withFeedback: boolean;
  /** Fires when a span detail opens or closes (`null`). */
  onSelectedSpanChange?: (selected: ThreadTraceSelectedSpan | null) => void;
}

/**
 * A memory thread rendered as its traces: one row per agent turn (oldest first), with the
 * reconstructed messages on the left and the span tree on the right. Clicking a span opens
 * its detail panel on the side so the conversation stays readable.
 */
export function ThreadViewByTrace({
  threadId,
  withQueryTrace,
  withFeedback,
  onSelectedSpanChange,
}: ThreadViewByTraceProps) {
  const { rows, isLoading, setEndOfListElement, error } = useTracesListSource({
    initialAutoRefetch: false,
    withQueryTrace,
    query: now => ({
      timeRange: {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
      },
      where: { op: 'eq', left: { path: 'threadId' }, right: { literal: threadId } },
      orderBy: [{ field: 'startedAt', direction: 'asc' }],
    }),
  });
  const traceIds = rows.map(trace => trace.traceId);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <TracesErrorContent error={error} resource="traces" errorTitle="Failed to load traces" />
      </div>
    );
  }

  if (isLoading) return <ThreadViewSkeleton />;

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
    <LoadedThreadViewByTrace
      key={threadId}
      traceIds={traceIds}
      setEndOfListElement={setEndOfListElement}
      withFeedback={withFeedback}
      onSelectedSpanChange={onSelectedSpanChange}
    />
  );
}

interface LoadedThreadViewByTraceProps {
  traceIds: string[];
  setEndOfListElement: (node: HTMLDivElement | null) => void;
  withFeedback: boolean;
  onSelectedSpanChange?: (selected: ThreadTraceSelectedSpan | null) => void;
}

/** Mounts once the first page is in, so state seeded from `traces` at mount only sees that page. */
function LoadedThreadViewByTrace({
  traceIds,
  setEndOfListElement,
  withFeedback,
  onSelectedSpanChange,
}: LoadedThreadViewByTraceProps) {
  const railTurns = useThreadRailTurns(traceIds);

  // "Open full thread" on the traces page lands here with the originating trace: that row starts
  // expanded and scrolls into view when it mounts. Best effort on the first page only: resolved
  // once at mount, so a row that arrives on a later page is left alone.
  const [searchParams] = useSearchParams();
  const [anchorTraceId] = useState(() => {
    const requested = searchParams.get('traceId');
    return requested && traceIds.includes(requested) ? requested : null;
  });

  return (
    <ThreadTrace traceIds={traceIds} anchorTraceId={anchorTraceId} onSelectedSpanChange={onSelectedSpanChange}>
      <ThreadTrace.List data-testid="thread-view-by-trace">
        <ThreadTrace.Rail turns={railTurns} />
        {traceIds.map(traceId => (
          <ThreadTrace.Row key={traceId} traceId={traceId}>
            <ThreadTraceRowContent withFeedback={withFeedback} />
          </ThreadTrace.Row>
        ))}
        <ThreadTrace.LoadMoreSentinel ref={setEndOfListElement} />
      </ThreadTrace.List>
      <ThreadTrace.SpanPanel />
    </ThreadTrace>
  );
}

function ThreadTraceRowContent({ withFeedback }: { withFeedback: boolean }) {
  const { traceId, highlightSpans } = useThreadTraceRow();
  const navigate = useNavigate();
  // First page only, for the tab badges; the Feedback and Scores bodies own their own pagination
  // and share these queries through the React Query cache.
  const { data: feedbackData } = useTraceFeedback({ traceId, enabled: withFeedback });
  // Same query the span tree observes (passive: the tree drives refetches).
  const { data: traceData } = useTraceSpans(traceId, { passive: true });
  const rootSpanId = traceData?.spans.find(span => span.parentSpanId == null)?.spanId;
  const { data: spanScoresData } = useTraceSpanScores({ traceId, spanId: rootSpanId });
  const feedbackTotal = feedbackData?.pagination?.total;
  const scoresTotal = spanScoresData?.pagination?.total;

  return (
    <>
      <ThreadTrace.Messages>
        <ThreadTrace.MessagesHeader>
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
                Feedback{feedbackTotal != null && <> ({feedbackTotal})</>}
              </ThreadTrace.Tab>
            )}
            <ThreadTrace.Tab value="scores">
              <Icon size="xs">
                <ScorersIcon />
              </Icon>
              Scores{scoresTotal != null && <> ({scoresTotal})</>}
            </ThreadTrace.Tab>
          </ThreadTrace.TabList>
        </ThreadTrace.MessagesHeader>
        <ThreadTrace.TabContent value="messages" flush>
          <TraceThreadItemView traceId={traceId} onHighlightSpans={highlightSpans} />
        </ThreadTrace.TabContent>
        {withFeedback && (
          <ThreadTrace.TabContent value="feedback" className="min-h-0 py-3 pl-2">
            <TraceFeedbackTab key={traceId} traceId={traceId} variant="thread" />
          </ThreadTrace.TabContent>
        )}
        <ThreadTrace.TabContent value="scores" className="min-h-0 py-3 pl-2">
          {rootSpanId ? (
            <TraceScoresTab
              key={traceId}
              traceId={traceId}
              spanId={rootSpanId}
              onScoreSelect={scoreId =>
                navigate(`/traces?traceId=${encodeURIComponent(traceId)}&scoreId=${encodeURIComponent(scoreId)}`)
              }
            />
          ) : null}
        </ThreadTrace.TabContent>
      </ThreadTrace.Messages>
      <ThreadTrace.Details>
        <ThreadTrace.DetailsHeader>
          <ThreadTrace.DetailsActions>
            <Button
              render={<Link to={`/traces?traceId=${encodeURIComponent(traceId)}`} />}

              variant="ghost"
              size="sm"
              icon={<ExternalLinkIcon />}
            >
              Go to trace
            </Button>
          </ThreadTrace.DetailsActions>
        </ThreadTrace.DetailsHeader>
        <ThreadTrace.Spans />
      </ThreadTrace.Details>
    </>
  );
}
