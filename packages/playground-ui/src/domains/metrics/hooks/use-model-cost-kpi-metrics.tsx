import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

/** Total Model Cost — sum of estimatedCost across input and output token metrics */
export function useModelCostKpiMetrics() {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'model-cost-kpi', filterKey],
    queryFn: async () => {
      const res = await client.getMetricAggregate({
        name: ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'],
        aggregation: 'sum',
        filters,
        comparePeriod: 'previous_period',
      });

      return {
        cost: res.estimatedCost ?? null,
        costUnit: res.costUnit ?? null,
        previousCost: res.previousEstimatedCost ?? null,
        costChangePercent: res.costChangePercent ?? null,
      };
    },
  });
}
