import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

export type ModelSpendRow = { model: string; tokens: number; cost: number };

const TOKEN_METRICS = ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'];

/** Input plus output tokens and estimated cost per model, for the Usage card's Models tab. */
export function useModelUsage() {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'model-usage', filterKey],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ModelSpendRow[]> => {
      const results = await Promise.all(
        TOKEN_METRICS.map(name =>
          client.getMetricBreakdown({
            name: [name],
            groupBy: ['model'],
            aggregation: 'sum',
            orderDirection: 'DESC',
            filters,
          }),
        ),
      );
      const byModel = new Map<string, ModelSpendRow>();
      for (const result of results) {
        for (const group of result.groups) {
          const model = String(group.dimensions.model ?? 'unknown');
          const row = byModel.get(model) ?? { model, tokens: 0, cost: 0 };
          row.tokens += group.value;
          row.cost += group.estimatedCost ?? 0;
          byModel.set(model, row);
        }
      }
      return [...byModel.values()];
    },
  });
}
