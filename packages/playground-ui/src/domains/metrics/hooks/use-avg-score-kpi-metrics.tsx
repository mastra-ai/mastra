import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

/** Avg Score — average score across all scorers via aggregate API */
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

      const filters = {
        timestamp: { start: timestamp.start, end: timestamp.end },
      };

      const results = await Promise.all(
        scorerIds.map(async scorerId => {
          const [avg, count] = await Promise.all([
            client.getScoreAggregate({ scorerId, aggregation: 'avg', filters }),
            client.getScoreAggregate({ scorerId, aggregation: 'count', filters }),
          ]);
          return { avg: avg.value ?? 0, count: count.value ?? 0 };
        }),
      );

      const withData = results.filter(r => r.count > 0);

      if (withData.length === 0) {
        return { value: null, previousValue: null, changePercent: null };
      }

      const totalCount = withData.reduce((sum, r) => sum + r.count, 0);
      const weightedSum = withData.reduce((sum, r) => sum + r.avg * r.count, 0);
      const avg = weightedSum / totalCount;
      return { value: Math.round(avg * 100) / 100, previousValue: null, changePercent: null };
    },
  });
}
