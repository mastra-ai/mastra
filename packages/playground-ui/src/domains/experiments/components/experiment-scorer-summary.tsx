import { useMemo } from 'react';
import type { ClientScoreRowData } from '@mastra/client-js';
import { GaugeIcon } from 'lucide-react';
import { EmptyState } from '@/ds/components/EmptyState';
import { ItemList } from '@/ds/components/ItemList';

export type ExperimentScorerSummaryProps = {
  scoresByItemId?: Record<string, ClientScoreRowData[]>;
  experimentStatus?: string;
};

const columns = [
  { name: 'scorer', label: 'Scorer', size: '1fr' },
  { name: 'avg', label: 'Avg Score', size: '1fr' },
  { name: 'count', label: 'Items Scored', size: '1fr' },
];

export function ExperimentScorerSummary({ scoresByItemId, experimentStatus }: ExperimentScorerSummaryProps) {
  const scorerSummaries = useMemo(() => {
    if (!scoresByItemId) return [];

    const scorerTotals: Record<string, { sum: number; count: number }> = {};

    for (const scores of Object.values(scoresByItemId)) {
      for (const score of scores) {
        if (!scorerTotals[score.scorerId]) {
          scorerTotals[score.scorerId] = { sum: 0, count: 0 };
        }
        scorerTotals[score.scorerId].sum += score.score;
        scorerTotals[score.scorerId].count++;
      }
    }

    return Object.entries(scorerTotals)
      .map(([scorerId, { sum, count }]) => ({
        scorerId,
        avg: sum / count,
        count,
      }))
      .sort((a, b) => a.scorerId.localeCompare(b.scorerId));
  }, [scoresByItemId]);

  if (scorerSummaries.length === 0) {
    const isRunning = experimentStatus === 'running' || experimentStatus === 'pending';
    return (
      <div className="flex h-full items-center justify-center py-12">
        <EmptyState
          iconSlot={<GaugeIcon className="w-8 h-8 text-neutral3" />}
          titleSlot={isRunning ? 'Experiment in progress' : 'No scorers configured'}
          descriptionSlot={
            isRunning
              ? 'Summary metrics will appear here once the experiment completes.'
              : 'Add scorers when triggering an experiment to evaluate results and see summary metrics here.'
          }
        />
      </div>
    );
  }

  return (
    <ItemList>
      <ItemList.Header columns={columns}>
        <ItemList.HeaderCol>Scorer</ItemList.HeaderCol>
        <ItemList.HeaderCol>Avg Score</ItemList.HeaderCol>
        <ItemList.HeaderCol>Items Scored</ItemList.HeaderCol>
      </ItemList.Header>

      <ItemList.Scroller>
        <ItemList.Items>
          {scorerSummaries.map(({ scorerId, avg, count }) => (
            <ItemList.Row key={scorerId} columns={columns}>
              <ItemList.TextCell>{scorerId}</ItemList.TextCell>
              <ItemList.TextCell className="font-mono">{avg.toFixed(3)}</ItemList.TextCell>
              <ItemList.TextCell className="font-mono">{count}</ItemList.TextCell>
            </ItemList.Row>
          ))}
        </ItemList.Items>
      </ItemList.Scroller>
    </ItemList>
  );
}
