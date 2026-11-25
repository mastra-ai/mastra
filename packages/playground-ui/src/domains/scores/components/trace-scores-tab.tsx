import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import { useState } from 'react';
import { TraceScoresTabView } from './trace-scores-tab-view';

export type TraceScoresTabProps = {
  traceId: string;
  spanId: string;
  onScoreSelect: (scoreId: string) => void;
};

/**
 * Studio adapter of {@link TraceScoresTabView}: loads the scores of the trace's anchor span through
 * the Mastra client. Owns its own pagination: mount it with a `key` on the trace/anchor pair so a
 * page index never leaks across traces.
 */
export function TraceScoresTab({ traceId, spanId, onScoreSelect }: TraceScoresTabProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useTraceSpanScores({
    traceId,
    spanId,
    page,
    queryOptions: { enabled: !!traceId && !!spanId },
  });

  return (
    <TraceScoresTabView scores={data} isLoading={isLoading} onScoreSelect={onScoreSelect} onPageChange={setPage} />
  );
}
