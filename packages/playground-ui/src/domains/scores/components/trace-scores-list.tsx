import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import { useState } from 'react';
import { TraceScoresListView } from './trace-scores-list-view';

export type TraceScoresListProps = {
  traceId: string;
  spanId: string;
  onScoreSelect: (scoreId: string) => void;
};

/**
 * Studio adapter of {@link TraceScoresListView}: loads the scores of the trace's anchor span through
 * the Mastra client. Owns its own pagination: mount it with a `key` on the trace/anchor pair so a
 * page index never leaks across traces.
 */
export function TraceScoresList({ traceId, spanId, onScoreSelect }: TraceScoresListProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useTraceSpanScores({
    traceId,
    spanId,
    page,
    queryOptions: { enabled: !!traceId && !!spanId },
  });

  return (
    <TraceScoresListView scores={data} isLoading={isLoading} onScoreSelect={onScoreSelect} onPageChange={setPage} />
  );
}
