import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useMetricsFilters } from './use-metrics-filters';

/** Avg Score — average score from the old scores storage */
export function useAvgScoreKpiMetrics() {
  const client = useMastraClient();
  const { datePreset, customRange, timestamp } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'avg-score-kpi', datePreset, customRange],
    queryFn: async () => {
      const scorersMap = await client.listScorers();
      const scorerIds = Object.keys(scorersMap ?? {});

      if (scorerIds.length === 0) {
        return { value: null, previousValue: null, changePercent: null };
      }

      const allResults = await Promise.all(
        scorerIds.map(scorerId => client.listScoresByScorerId({ scorerId, perPage: 100 })),
      );

      const startMs = timestamp.start.getTime();
      const endMs = timestamp.end.getTime();
      const allScoreValues: number[] = [];
      for (const result of allResults) {
        for (const s of result?.scores ?? []) {
          const ts = new Date(s.createdAt).getTime();
          if (ts >= startMs && ts <= endMs) {
            allScoreValues.push(s.score);
          }
        }
      }

      if (allScoreValues.length === 0) {
        return { value: null, previousValue: null, changePercent: null };
      }

      const avg = allScoreValues.reduce((sum, v) => sum + v, 0) / allScoreValues.length;
      return { value: Math.round(avg * 100) / 100, previousValue: null, changePercent: null };
    },
  });
}
