import { Card, CardContent } from '@mastra/playground-ui/components/Card';
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
 */
export function TraceScoresTab({ traceId, spanId, onScoreSelect }: TraceScoresTabProps) {
  const [page, setPage] = useState(0);
  const { data: scoresData, isLoading } = useTraceSpanScores({ traceId, spanId, page });

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <TraceScoreLineChart scoresData={scoresData} className="min-h-0 w-full" />
      <Card appearance="surface" className="min-h-0 w-full overflow-hidden">
        <CardContent className="h-full overflow-y-auto">
          <SpanScoresList
            scoresData={scoresData}
            onPageChange={setPage}
            isLoadingScoresData={isLoading}
            onScoreSelect={score => onScoreSelect(score.id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
