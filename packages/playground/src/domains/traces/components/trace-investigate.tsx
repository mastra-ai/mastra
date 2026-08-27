import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { useMemo } from 'react';

import { useTraceFeedback } from '../hooks/use-trace-feedback';
import { buildThreadTimeline, type ThreadTimeline, type TimelineSpan } from '../lib/build-thread-timeline';
import { formatClock } from '../lib/span-kind';
import { SpanFeedbackBubble } from './span-feedback-bubble';
import { SpanRowList } from './span-rows';
import { TimelineRow } from './timeline-row';
import { TraceFeedbackDisclosure } from './trace-feedback-disclosure';

export type TraceTimelineProps = {
  timeline: ThreadTimeline;
  traceId: string;
  /** Comments per span id, so a row can advertise an existing thread. */
  feedbackCounts?: Record<string, number>;
};

/** Presentational half of a turn, split out so it can be rendered without the network. */
export function TraceTimeline({ timeline, traceId, feedbackCounts }: TraceTimelineProps) {
  return (
    <article
      data-testid="trace-investigate"
      data-trace-id={traceId}
      className="flex flex-col gap-2"
      // Shared with the same turn on the investigation page, so navigating there morphs it.
      style={{ viewTransitionName: `trace-turn-${traceId}` }}
    >
      <ul className="flex flex-col">
        {timeline.userTurn ? (
          <TimelineRow
            as="li"
            kind="USER"
            offset={formatClock(timeline.turnStart ? new Date(timeline.turnStart) : undefined)}
            testId="trace-investigate-user-turn"
          >
            <MarkdownRenderer className="text-neutral6 text-ui-smd font-medium">{timeline.userTurn}</MarkdownRenderer>
          </TimelineRow>
        ) : null}

        <SpanRowList nodes={timeline.entries} traceId={traceId} feedbackCounts={feedbackCounts} />

        {timeline.answer ? (
          <TimelineRow
            as="li"
            kind="ASSISTANT"
            offset={formatClock(timeline.answerAt ? new Date(timeline.answerAt) : undefined)}
            testId="trace-investigate-answer"
            action={
              timeline.answerSpanId ? (
                <SpanFeedbackBubble
                  traceId={traceId}
                  spanId={timeline.answerSpanId}
                  count={feedbackCounts?.[timeline.answerSpanId]}
                />
              ) : undefined
            }
          >
            <MarkdownRenderer className="text-neutral6 text-ui-smd">{timeline.answer}</MarkdownRenderer>
          </TimelineRow>
        ) : null}

        {/* The turn is read before it is judged, so its comments close it rather than open it. */}
        <TimelineRow as="li">
          <TraceFeedbackDisclosure traceId={traceId} />
        </TimelineRow>
      </ul>
    </article>
  );
}

export type TraceTurnProps = {
  traceId: string;
  /** The trace's spans, already resolved by the caller. */
  spans: TimelineSpan[];
};

/**
 * One conversation turn built from spans the caller already holds — the user message, then the
 * significant steps, flattened. Only the turn's comments are fetched here.
 */
export function TraceTurn({ traceId, spans }: TraceTurnProps) {
  // Same query key as the trace-level thread below, so the whole page issues one feedback request:
  // this observer just keeps the span-scoped records the thread drops and tallies them per span.
  const { data: feedback } = useTraceFeedback({ traceId, traceLevelOnly: false });

  const feedbackCounts = useMemo(
    () =>
      (feedback?.feedback ?? []).reduce<Record<string, number>>((counts, item) => {
        if (!item.spanId) return counts;
        counts[item.spanId] = (counts[item.spanId] ?? 0) + 1;
        return counts;
      }, {}),
    [feedback],
  );

  const timeline = useMemo(() => buildThreadTimeline(spans), [spans]);

  return <TraceTimeline timeline={timeline} traceId={traceId} feedbackCounts={feedbackCounts} />;
}

export type TraceInvestigateProps = {
  traceId: string;
};

/** Fetches a trace's spans, then renders its turn. */
export function TraceInvestigate({ traceId }: TraceInvestigateProps) {
  const { data, isLoading, isError, error } = useTraceSpans(traceId);

  if (isLoading) {
    return (
      <div className="p-2" data-testid="trace-investigate-loading">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-accent2 text-ui-smd" data-testid="trace-investigate-error">
        {error?.message ?? `Failed to load trace ${traceId}.`}
      </div>
    );
  }

  // `useTraceSpans` types spans against the light projection, but `getTrace` returns full ones.
  return <TraceTurn traceId={traceId} spans={(data?.spans ?? []) as TimelineSpan[]} />;
}
