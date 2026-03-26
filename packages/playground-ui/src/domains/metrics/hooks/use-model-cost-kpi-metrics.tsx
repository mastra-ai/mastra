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
      const ALL_METRICS = [
        'mastra_model_total_input_tokens',
        'mastra_model_total_output_tokens',
        'mastra_model_input_text_tokens',
        'mastra_model_input_cache_read_tokens',
        'mastra_model_input_cache_write_tokens',
        'mastra_model_input_audio_tokens',
        'mastra_model_input_image_tokens',
        'mastra_model_output_text_tokens',
        'mastra_model_output_reasoning_tokens',
        'mastra_model_output_audio_tokens',
        'mastra_model_output_image_tokens',
      ];

      // DEBUG: check which metrics return cost data
      const results = await Promise.all(
        ALL_METRICS.map(async name => {
          const r = await client.getMetricAggregate({
            name: [name],
            aggregation: 'sum',
            filters: { timestamp },
          });
          return { name, value: r.value, estimatedCost: r.estimatedCost, costUnit: r.costUnit };
        }),
      );
      console.info('[ModelCostKpi] per-metric cost check:', results);

      // Use totals for the actual card
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
