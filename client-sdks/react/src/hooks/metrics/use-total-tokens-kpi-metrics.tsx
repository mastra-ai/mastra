import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import type { MetricsQueryFilters } from './metrics-query-filters';

/** Total Tokens — sum of all input + output tokens */
export interface TotalTokensKpi {
  value: number | null;
  previousValue: number | null;
  changePercent: number | null;
}

export function useTotalTokensKpiMetrics<TData = TotalTokensKpi>(
  params: MetricsQueryFilters & { queryOptions?: MastraQueryOptions<TotalTokensKpi, TData> },
): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  const { filters, filterKey, queryOptions } = params;

  return useQuery({
    queryKey: ['metrics', 'total-tokens-kpi', filterKey],
    queryFn: async (): Promise<TotalTokensKpi> => {
      const [input, output] = await Promise.all([
        client.getMetricAggregate({
          name: ['mastra_model_total_input_tokens'],
          aggregation: 'sum',
          filters,
          comparePeriod: 'previous_period',
        }),
        client.getMetricAggregate({
          name: ['mastra_model_total_output_tokens'],
          aggregation: 'sum',
          filters,
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
    ...queryOptions,
  });
}
