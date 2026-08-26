import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
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

      <div className="text-neutral2/70 text-ui-sm flex items-center gap-2 pt-1 pl-[10.1rem]">
        <Link
          className="underline"
          href={`/traces?traceId=${encodeURIComponent(traceId)}`}
          data-testid="trace-investigate-full-link"
        >
          View full trace
        </Link>
      </div>
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
