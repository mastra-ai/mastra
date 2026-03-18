import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { useMetricsFilters } from './use-metrics-filters';

/** Total Tokens — sum of all input + output tokens */
export function useTotalTokensKpiMetrics() {
  const client = useMastraClient();
  const { datePreset, customRange, timestamp } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'total-tokens-kpi', datePreset, customRange],
    queryFn: async () => {
      const [input, output] = await Promise.all([
        client.getMetricAggregate({
          name: ['mastra_model_total_input_tokens'],
          aggregation: 'sum',
          filters: { timestamp },
          comparePeriod: 'previous_period',
        }),
        client.getMetricAggregate({
          name: ['mastra_model_total_output_tokens'],
          aggregation: 'sum',
          filters: { timestamp },
          comparePeriod: 'previous_period',
        }),
      ]);

      const value = (input.value ?? 0) + (output.value ?? 0);
      const previousValue = (input.previousValue ?? 0) + (output.previousValue ?? 0);
      const changePercent = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : null;

      return { value: value || null, previousValue: previousValue || null, changePercent };
    },
  });
}
