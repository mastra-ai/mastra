import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { useMemo } from 'react';

import { useTraceFeedback } from '../hooks/use-trace-feedback';
import { buildThreadTimeline, type ThreadTimeline, type TimelineSpan } from '../lib/build-thread-timeline';
import { formatOffset } from '../lib/span-kind';
import { SpanFeedbackBubble } from './span-feedback-bubble';
import { SpanRowList } from './span-rows';
import { TimelineRow } from './timeline-row';
import { TraceFeedbackTab } from './trace-feedback-tab';
import { useLinkComponent } from '@/lib/framework';

export type TraceTimelineProps = {
  timeline: ThreadTimeline;
  traceId: string;
  /** Comments per span id, so a row can advertise an existing thread. */
  feedbackCounts?: Record<string, number>;
};

/** Presentational half of a turn, split out so it can be rendered without the network. */
export function TraceTimeline({ timeline, traceId, feedbackCounts }: TraceTimelineProps) {
  const { Link } = useLinkComponent();

  return (
    <article data-testid="trace-investigate" className="flex flex-col gap-2">
      <ul className="flex flex-col">
        <TimelineRow
          as="li"
          marker={
            <Button
              as={Link}
              size="icon-md"
              variant="outline"
              className="bg-surface2"
              href={`/traces?traceId=${encodeURIComponent(traceId)}`}
              tooltip={`Visit trace page ${traceId}`}
              data-testid="trace-investigate-full-link"
            >
              <TraceIcon />
            </Button>
          }
        >
          {/* Trace-level comments open the turn, level with the trace button, the way Notion sits
              page comments under the title. `min-h-8` keeps the oversized marker from crowding the
              first step when the thread is empty. */}
          <section aria-label="Trace comments" className="min-h-8">
            <TraceFeedbackTab traceId={traceId} variant="embed" />
          </section>
        </TimelineRow>
        {timeline.userTurn ? (
          <TimelineRow as="li" kind="USER" offset="0.0s" testId="trace-investigate-user-turn">
            <p className="text-neutral6 text-ui-smd font-medium whitespace-pre-wrap">{timeline.userTurn}</p>
          </TimelineRow>
        ) : null}

        <SpanRowList
          nodes={timeline.entries}
          turnStart={timeline.turnStart}
          traceId={traceId}
          feedbackCounts={feedbackCounts}
        />

        {timeline.answer ? (
          <TimelineRow
            as="li"
            kind="ANSWER"
            offset={formatOffset(timeline.answerAt ? new Date(timeline.answerAt) : undefined, timeline.turnStart)}
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
            <p className="text-neutral6 text-ui-smd whitespace-pre-wrap">{timeline.answer}</p>
          </TimelineRow>
        ) : null}
      </ul>
    </article>
  );
}

export type TraceInvestigateProps = {
  traceId: string;
};

/** Renders one conversation turn: the user message, then the significant steps, flattened. */
export function TraceInvestigate({ traceId }: TraceInvestigateProps) {
  const { data, isLoading, isError, error } = useTraceSpans(traceId);
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

  // `useTraceSpans` is typed against the light projection, but `getTrace` returns full spans.
  const timeline = useMemo(() => buildThreadTimeline((data?.spans ?? []) as TimelineSpan[]), [data]);

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

  return <TraceTimeline timeline={timeline} traceId={traceId} feedbackCounts={feedbackCounts} />;
}
