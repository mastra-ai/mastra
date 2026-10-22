import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

/** What the Usage card's Models and Threads tabs rank. */
export type SpendDimension = 'model' | 'threadId';

export type SpendRow = { key: string; tokens: number; cost: number };

/** Input and output tokens: their estimated cost already covers cache reads and other details. */
const TOKEN_METRICS: [string, ...string[]] = ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'];

/** Threads are many: the API ranks them and returns the top ones (models are few). */
const TOP_GROUPS = 100;

/** Tokens and estimated cost per model or per thread, ranked by tokens. */
export function useTokenSpend(dimension: SpendDimension) {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'token-spend', dimension, filterKey],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SpendRow[]> => {
      const { groups } = await client.getMetricBreakdown({
        name: TOKEN_METRICS,
        groupBy: [dimension],
        aggregation: 'sum',
        orderDirection: 'DESC',
        limit: TOP_GROUPS,
        filters,
      });
      return groups.map(group => ({
        key: String(group.dimensions[dimension] ?? 'unknown'),
        tokens: group.value,
        cost: group.estimatedCost ?? 0,
      }));
    },
  });
}
