import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ThreadTrace, useThreadTraceRow } from '@mastra/playground-ui/domains/traces/components/thread-trace';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { ExternalLinkIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { NeedsReviewDot } from '@/domains/traces/components/needs-review-dot';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { useThreadRailTurns } from '@/domains/traces/hooks/use-thread-rail-turns';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';
import { useTracesListSource } from '@/pages/traces/hooks/use-traces-list-source';

export interface ThreadViewByTraceProps {
  threadId: string;
}

/**
 * A memory thread rendered as its traces: one row per agent turn (oldest first), with the
 * reconstructed messages on the left and the span tree on the right. Clicking a span opens
 * its detail panel on the side so the conversation stays readable.
 */
export function ThreadViewByTrace({ threadId }: ThreadViewByTraceProps) {
  const filters = useMemo(() => ({ threadId }), [threadId]);
  const { rows, source, isLoading, setEndOfListElement, error } = useTracesListSource({
    filters,
    query: now => ({
      timeRange: {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
      },
      where: { op: 'eq', left: { path: 'threadId' }, right: threadId },
      orderBy: [{ field: 'startedAt', direction: 'asc' }],
    }),
  });
  const traceIds = rows.map(trace => trace.traceId);
  if (source === 'list') traceIds.reverse();

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

  if (traceIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Txt variant="ui-md" className="text-neutral3">
          No traces found for this thread.
        </Txt>
      </div>
    );
  }

  return (
    <LoadedThreadViewByTrace
      key={`${threadId}:${source}`}
      traceIds={traceIds}
      loadOlder={source === 'list'}
      setEndOfListElement={setEndOfListElement}
    />
  );
}

interface LoadedThreadViewByTraceProps {
  traceIds: string[];
  loadOlder: boolean;
  setEndOfListElement: (node: HTMLDivElement | null) => void;
}

/** Mounts once the first page is in, so state seeded from `traces` at mount only sees that page. */
function LoadedThreadViewByTrace({ traceIds, loadOlder, setEndOfListElement }: LoadedThreadViewByTraceProps) {
  const railTurns = useThreadRailTurns(traceIds);

  // "View full thread" on the traces page lands here with the originating trace: that row starts
  // expanded and scrolls into view when it mounts. Best effort on the first page only: resolved
  // once at mount, so a row that arrives on a later page is left alone.
  const [searchParams] = useSearchParams();
  const [anchorTraceId] = useState(() => {
    const requested = searchParams.get('traceId');
    return requested && traceIds.includes(requested) ? requested : null;
  });

  return (
    <ThreadTrace traceIds={traceIds} anchorTraceId={anchorTraceId}>
      <ThreadTrace.List data-testid="thread-view-by-trace">
        <ThreadTrace.Rail turns={railTurns} />
        {loadOlder && <ThreadTrace.LoadMoreSentinel ref={setEndOfListElement} />}
        {traceIds.map((traceId, index) => (
          <ThreadTrace.Row key={traceId} traceId={traceId} isFirst={index === 0}>
            <ThreadTraceRowContent />
          </ThreadTrace.Row>
        ))}
        {!loadOlder && <ThreadTrace.LoadMoreSentinel ref={setEndOfListElement} />}
      </ThreadTrace.List>
      <ThreadTrace.SpanPanel />
    </ThreadTrace>
  );
}

function ThreadTraceRowContent() {
  const { traceId, highlightSpans } = useThreadTraceRow();
  // First page only, for the tab badge; the Feedback tab body owns its own pagination and
  // shares this query through the React Query cache.
  const { data: feedbackData } = useTraceFeedback({ traceId });

  return (
    <>
      <ThreadTrace.Messages>
        <TraceThreadItemView traceId={traceId} onHighlightSpans={highlightSpans} />
      </ThreadTrace.Messages>
      <ThreadTrace.Details>
        <ThreadTrace.DetailsHeader>
          <ThreadTrace.TabList>
            <ThreadTrace.Tab value="spans">Spans</ThreadTrace.Tab>
            <ThreadTrace.Tab value="feedback">
              Feedback
              <NeedsReviewDot feedback={feedbackData?.feedback} />
            </ThreadTrace.Tab>
          </ThreadTrace.TabList>
          <ThreadTrace.DetailsActions>
            <Button
              as={Link}
              to={`/traces?traceId=${encodeURIComponent(traceId)}`}
              variant="ghost"
              size="md"
              icon={<ExternalLinkIcon />}
            >
              Go to trace
            </Button>
          </ThreadTrace.DetailsActions>
        </ThreadTrace.DetailsHeader>
        <ThreadTrace.SpansTab />
        <ThreadTrace.TabContent value="feedback" className="min-h-0 pt-2 pb-4">
          <TraceFeedbackTab key={traceId} traceId={traceId} variant="thread" />
        </ThreadTrace.TabContent>
      </ThreadTrace.Details>
    </>
  );
}
