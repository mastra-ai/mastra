import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

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

      const hasCurrent = input.value != null || output.value != null;
      const hasPrevious = input.previousValue != null || output.previousValue != null;
      const value = (input.value ?? 0) + (output.value ?? 0);
      const previousValue = (input.previousValue ?? 0) + (output.previousValue ?? 0);
      const changePercent = hasPrevious && previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : null;

      return {
        value: hasCurrent ? value : null,
        previousValue: hasPrevious ? previousValue : null,
        changePercent,
      };
    },
  });
}
