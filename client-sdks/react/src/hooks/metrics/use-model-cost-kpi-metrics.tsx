import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MetricsQueryFilters } from './metrics-query-filters';

/** Total Model Cost — sum of estimatedCost across input and output token metrics */
export function useModelCostKpiMetrics(params: MetricsQueryFilters) {
  const client = useMastraClient();
  const { filters, filterKey } = params;

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
