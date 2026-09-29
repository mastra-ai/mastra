import { ExternalLinkIcon, MessageSquareReplyIcon, WaypointsIcon } from 'lucide-react';
import { useState } from 'react';
import { useTraceSpanScores, TraceScoresTab } from '@/domains/scores';
import { ThreadTrace, useThreadTraceRow } from '@/domains/traces/components/thread-trace';
import type { ThreadTraceLayout } from '@/domains/traces/components/thread-trace';

import { ThreadViewSkeleton } from '@/domains/traces/components/thread-view-skeleton';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { useThreadRailTurns } from '@/domains/traces/hooks/use-thread-rail-turns';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';
import { useTraceSpans } from '@/domains/traces/hooks/use-trace-spans';
import { useTracesListSource } from '@/domains/traces/hooks/use-traces-list-source';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { ScorersIcon } from '@/ds/icons/ScorersIcon';
import { useLinkComponent } from '@/lib/framework';

export interface ThreadViewByTraceProps {
  threadId: string;
  /** Lists the thread through the trace-query API; `false` falls back to `listTracesLight`. */
  withQueryTrace: boolean;
  /** Shows the per-trace Feedback tab and fetches its feedback. */
  withFeedback: boolean;
  /** Fires when the trace or span column opens or closes. */
  onLayoutChange?: (layout: ThreadTraceLayout) => void;
  /** Trace to scroll to on mount (first page only). */
  anchorTraceId?: string;
  /** Opens a score from a trace's Scores tab; the app owns routing. */
  onOpenScore: (traceId: string, scoreId: string) => void;
}

/**
 * A memory thread rendered as a conversation, one turn per trace (oldest first). A turn's trace
 * opens in a column beside the conversation, and its spans in a third column.
 */
export function ThreadViewByTrace({
  threadId,
  withQueryTrace,
  withFeedback,
  onLayoutChange,
  anchorTraceId,
  onOpenScore,
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
      onLayoutChange={onLayoutChange}
      anchorTraceId={anchorTraceId}
      onOpenScore={onOpenScore}
    />
  );
}

interface LoadedThreadViewByTraceProps {
  traceIds: string[];
  setEndOfListElement: (node: HTMLDivElement | null) => void;
  withFeedback: boolean;
  onLayoutChange?: (layout: ThreadTraceLayout) => void;
  anchorTraceId?: string;
  onOpenScore: (traceId: string, scoreId: string) => void;
}

/** Mounts once the first page is in, so state seeded from `traces` at mount only sees that page. */
function LoadedThreadViewByTrace({
  traceIds,
  setEndOfListElement,
  withFeedback,
  onLayoutChange,
  anchorTraceId: requestedAnchorTraceId,
  onOpenScore,
}: LoadedThreadViewByTraceProps) {
  const railTurns = useThreadRailTurns(traceIds);
  const { Link, paths } = useLinkComponent();

  // "Open full thread" lands here with the originating trace: that turn's trace opens and the row
  // scrolls into view when it mounts. Best effort on the first page only: resolved once at mount,
  // so a row that arrives on a later page is left alone.
  const [anchorTraceId] = useState(() =>
    requestedAnchorTraceId && traceIds.includes(requestedAnchorTraceId) ? requestedAnchorTraceId : null,
  );

  return (
    <ThreadTrace traceIds={traceIds} anchorTraceId={anchorTraceId} onLayoutChange={onLayoutChange}>
      <ThreadTrace.List data-testid="thread-view-by-trace">
        <ThreadTrace.Rail turns={railTurns} />
        {traceIds.map(traceId => (
          <ThreadTrace.Row key={traceId} traceId={traceId}>
            <ThreadTraceRowContent />
          </ThreadTrace.Row>
        ))}
        <ThreadTrace.LoadMoreSentinel ref={setEndOfListElement} />
      </ThreadTrace.List>
      <ThreadTrace.TracePanel
        actions={traceId => {
          const traceHref = paths.traceLink(traceId);
          if (!traceHref) return null;
          return (
            <Button render={<Link href={traceHref} />} variant="ghost" size="sm" icon={<ExternalLinkIcon />}>
              Go to trace
            </Button>
          );
        }}
      >
        {traceId => <TraceColumnTabs traceId={traceId} withFeedback={withFeedback} onOpenScore={onOpenScore} />}
      </ThreadTrace.TracePanel>
      <ThreadTrace.SpanPanel />
    </ThreadTrace>
  );
}

function ThreadTraceRowContent() {
  const { traceId, highlightSpans } = useThreadTraceRow();
  return (
    <>
      <ThreadTrace.TurnDivider />
      <TraceThreadItemView traceId={traceId} onHighlightSpans={highlightSpans} />
    </>
  );
}

function TraceColumnTabs({
  traceId,
  withFeedback,
  onOpenScore,
}: {
  traceId: string;
  withFeedback: boolean;
  onOpenScore: (traceId: string, scoreId: string) => void;
}) {
  // First page only, for the tab badges; the Feedback and Scores bodies own their own pagination
  // and share these queries through the React Query cache.
  const { data: feedbackData } = useTraceFeedback({ traceId, enabled: withFeedback });
  const { data: traceData } = useTraceSpans(traceId, { passive: true });
  const rootSpanId = traceData?.spans.find(span => span.parentSpanId == null)?.spanId;
  const { data: spanScoresData } = useTraceSpanScores({ traceId, spanId: rootSpanId });
  const feedbackTotal = feedbackData?.pagination?.total;
  const scoresTotal = spanScoresData?.pagination?.total;

  return (
    <ThreadTrace.Tabs>
      <ThreadTrace.TabsHeader>
        <ThreadTrace.TabList>
          <ThreadTrace.Tab value="spans">
            <Icon size="xs">
              <WaypointsIcon />
            </Icon>
            Spans
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
      </ThreadTrace.TabsHeader>
      <ThreadTrace.TabContent value="spans" flush>
        <ThreadTrace.Spans traceId={traceId} />
      </ThreadTrace.TabContent>
      {withFeedback && (
        <ThreadTrace.TabContent value="feedback" className="px-4 py-3">
          <TraceFeedbackTab traceId={traceId} variant="thread" />
        </ThreadTrace.TabContent>
      )}
      <ThreadTrace.TabContent value="scores" className="px-4 py-3">
        {rootSpanId ? (
          <TraceScoresTab
            traceId={traceId}
            spanId={rootSpanId}
            onScoreSelect={scoreId => onOpenScore(traceId, scoreId)}
          />
        ) : null}
      </ThreadTrace.TabContent>
    </ThreadTrace.Tabs>
  );
}
