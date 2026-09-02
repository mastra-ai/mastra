import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { useState } from 'react';

import { SpanScoresList } from './span-scores-list';
import { SpanScoring } from './span-scoring';
import { TraceScoreLineChart } from '@/domains/observability/components/trace-score-line-chart';
import { useScorers } from '@/domains/scores';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';

type TraceScoresTabProps = {
  traceId: string;
  spanId: string;
  isTopLevelSpan: boolean;
  entityType?: 'Agent' | 'Workflow';
  onScoreSelect: (scoreId: string) => void;
};

/**
 * Scores for the trace's anchor span. Owns its own pagination: mount it with a `key`
 * on the trace/anchor pair so a page index never leaks across traces.
 */
export function TraceScoresTab({ traceId, spanId, isTopLevelSpan, entityType, onScoreSelect }: TraceScoresTabProps) {
  const [page, setPage] = useState(0);
  const { data: scoresData, isLoading } = useTraceSpanScores({ traceId, spanId, page });
  const { data: scorers, isLoading: isLoadingScorers } = useScorers();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-6">
      <SpanScoring
        traceId={traceId}
        isTopLevelSpan={isTopLevelSpan}
        spanId={spanId}
        entityType={entityType}
        scorers={scorers}
        isLoadingScorers={isLoadingScorers}
      />
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
