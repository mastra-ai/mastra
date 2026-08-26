import type { ClientScoreRowData } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { GaugeIcon } from 'lucide-react';
import { useMemo } from 'react';

export type ExperimentScorerSummaryProps = {
  scoresByItemId?: Record<string, ClientScoreRowData[]>;
  experimentStatus?: ExperimentStatus;
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
    const hasLoadedScores = scoresByItemId !== undefined;

    let title: string;
    let description: string;

    if (isRunning) {
      title = 'Experiment in progress';
      description = 'Summary metrics will appear here once the experiment completes.';
    } else if (!hasLoadedScores) {
      title = 'Loading scores';
      description = 'Fetching scorer results…';
    } else {
      title = 'No scorers configured';
      description = 'Add scorers when triggering an experiment to evaluate results and see summary metrics here.';
    }

    return (
      <div className="flex h-full items-center justify-center py-12">
        <EmptyState
          iconSlot={<GaugeIcon className="text-neutral3 h-8 w-8" />}
          titleSlot={title}
          descriptionSlot={description}
        />
      </div>
    );
  }

  const gridColumns = columns.map(c => c.size).join(' ');

  return (
    <DataList columns={gridColumns} fit="container">
      <DataList.Top>
        {columns.map(col => (
          <DataList.TopCell key={col.name}>{col.label}</DataList.TopCell>
        ))}
      </DataList.Top>

      {scorerSummaries.map(({ scorerId, avg, count }) => (
        <DataList.RowStatic key={scorerId}>
          <DataList.TextCell height="compact">{scorerId}</DataList.TextCell>
          <DataList.MonoCell>{avg.toFixed(3)}</DataList.MonoCell>
          <DataList.MonoCell>{count}</DataList.MonoCell>
        </DataList.RowStatic>
      ))}
    </DataList>
  );
}
