import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { useMemo } from 'react';

import { buildThreadTimeline, type ThreadTimeline, type TimelineSpan } from '../lib/build-thread-timeline';
import { formatOffset } from '../lib/span-kind';
import { TimelineEntry } from './timeline-entry';
import { TimelineRow } from './timeline-row';
import { useLinkComponent } from '@/lib/framework';

export type TraceTimelineProps = {
  timeline: ThreadTimeline;
  traceId: string;
};

/** Presentational half of a turn, split out so it can be rendered without the network. */
export function TraceTimeline({ timeline, traceId }: TraceTimelineProps) {
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
          {/* Spacer: keeps the oversized marker from crowding the first step of the turn. */}
          <div className="h-4" aria-hidden />
        </TimelineRow>
        {timeline.userTurn ? (
          <TimelineRow as="li" kind="USER" offset="0.0s" testId="trace-investigate-user-turn">
            <p className="text-neutral6 text-ui-smd font-medium whitespace-pre-wrap">{timeline.userTurn}</p>
          </TimelineRow>
        ) : null}

        {timeline.entries.map(span => (
          <TimelineEntry key={span.spanId} span={span} turnStart={timeline.turnStart} />
        ))}

        {timeline.answer ? (
          <TimelineRow
            as="li"
            kind="ANSWER"
            offset={formatOffset(timeline.answerAt ? new Date(timeline.answerAt) : undefined, timeline.turnStart)}
            testId="trace-investigate-answer"
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

  return <TraceTimeline timeline={timeline} traceId={traceId} />;
}
