import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import type { MetricsQueryFilters } from './metrics-query-filters';

/** Total Model Cost — sum of estimatedCost across input and output token metrics */
export interface ModelCostKpi {
  cost: number | null;
  costUnit: string | null;
  previousCost: number | null;
  costChangePercent: number | null;
}

export function useModelCostKpiMetrics<TData = ModelCostKpi>(
  params: MetricsQueryFilters & { queryOptions?: MastraQueryOptions<ModelCostKpi, TData> },
): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  const { filters, filterKey, queryOptions } = params;

  return useQuery({
    queryKey: ['metrics', 'model-cost-kpi', filterKey],
    queryFn: async (): Promise<ModelCostKpi> => {
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
    ...queryOptions,
  });
}
