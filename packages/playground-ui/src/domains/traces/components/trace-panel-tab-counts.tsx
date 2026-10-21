import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import { useSpanFeedback, useTraceFeedback } from '@mastra/react/hooks/traces';

/** Tab label suffix: ` (N)` once the count is known, nothing before. */
export function TabCount({ count }: { count: number | undefined }) {
  if (count == null) return null;
  return <> ({count})</>;
}

// The counts subscribe to the same first-page queries as the tab bodies, so React Query
// serves both from one request; only the label re-renders when a count resolves.

export function TraceFeedbackCount({ traceId }: { traceId: string }) {
  const { data } = useTraceFeedback({ traceId, page: 0, queryOptions: { enabled: !!traceId } });
  return <TabCount count={data?.pagination?.total} />;
}

export function SpanFeedbackCount({ traceId, spanId }: { traceId: string; spanId: string }) {
  const { data } = useSpanFeedback({ traceId, spanId, page: 0, queryOptions: { enabled: !!traceId && !!spanId } });
  return <TabCount count={data?.pagination?.total} />;
}

export function TraceScoresCount({ traceId, spanId }: { traceId: string; spanId: string }) {
  const { data } = useTraceSpanScores({ traceId, spanId, page: 0, queryOptions: { enabled: !!traceId && !!spanId } });
  return <TabCount count={data?.pagination?.total} />;
}
