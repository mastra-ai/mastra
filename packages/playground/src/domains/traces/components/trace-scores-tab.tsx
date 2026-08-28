import { useState } from 'react';

import { SpanScoresList } from './span-scores-list';
import { TraceScoreLineChart } from '@/domains/observability/components/trace-score-line-chart';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';

type TraceScoresTabProps = {
  traceId: string;
  spanId: string;
  onScoreSelect: (scoreId: string) => void;
};

/**
 * Scores for the trace's anchor span. Owns its own pagination: mount it with a `key`
 * on the trace/anchor pair so a page index never leaks across traces.
 * Starting a scorer run lives in the trace header, not here.
 */
export function TraceScoresTab({ traceId, spanId, onScoreSelect }: TraceScoresTabProps) {
  const [page, setPage] = useState(0);
  const { data: scoresData, isLoading } = useTraceSpanScores({ traceId, spanId, page });

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-6">
      <TraceScoreLineChart scoresData={scoresData} className="min-h-0 w-full" />
      <div className="min-h-0 overflow-y-auto">
        <SpanScoresList
          scoresData={scoresData}
          onPageChange={setPage}
          isLoadingScoresData={isLoading}
          onScoreSelect={score => onScoreSelect(score.id)}
        />
      </div>
    </div>
  );
}
