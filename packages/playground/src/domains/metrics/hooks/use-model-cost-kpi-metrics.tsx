import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useMetricsFilters } from './use-metrics-filters';

/** Total Model Cost — sum of estimatedCost across input and output token metrics */
export function useModelCostKpiMetrics() {
  const client = useMastraClient();
  const { datePreset, customRange, timestamp } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'model-cost-kpi', datePreset, customRange],
    queryFn: async () => {
      const res = await client.getMetricAggregate({
        name: ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'],
        aggregation: 'sum',
        filters: { timestamp },
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
