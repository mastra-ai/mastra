import { useMemo } from 'react';
import type { ClientScoreRowData } from '@mastra/client-js';
import { ItemList } from '@/ds/components/ItemList';

export type ExperimentScorerSummaryProps = {
  scoresByItemId?: Record<string, ClientScoreRowData[]>;
};

const columns = [
  { name: 'scorer', label: 'Scorer', size: '1fr' },
  { name: 'avg', label: 'Avg Score', size: '1fr' },
  { name: 'count', label: 'Items Scored', size: '1fr' },
];

export function ExperimentScorerSummary({ scoresByItemId }: ExperimentScorerSummaryProps) {
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

  if (scorerSummaries.length === 0) return null;

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
