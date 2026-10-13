import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { formatCompactNumber } from '../shared/cost';
import { getOrCreate } from '../shared/map';
import type { MastraQueryOptions } from '../shared/query-options';
import type { MetricsQueryFilters } from './metrics-query-filters';

export interface ModelUsageRow {
  model: string;
  provider?: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
  cost: number | null;
  costUnit: string | null;
}

export function useModelUsageCostMetrics<TData = ModelUsageRow[]>(
  params: MetricsQueryFilters & { queryOptions?: MastraQueryOptions<ModelUsageRow[], TData> },
): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  const { filters, filterKey, queryOptions } = params;

  return useQuery({
    queryKey: ['metrics', 'model-usage-cost', filterKey],
    queryFn: async (): Promise<ModelUsageRow[]> => {
      const [inputRes, outputRes, cacheReadRes, cacheWriteRes] = await Promise.all(
        (
          [
            'mastra_model_total_input_tokens',
            'mastra_model_total_output_tokens',
            'mastra_model_input_cache_read_tokens',
            'mastra_model_input_cache_write_tokens',
          ] as const
        ).map(name =>
          client.getMetricBreakdown({
            name: [name],
            groupBy: ['model', 'provider'],
            aggregation: 'sum',
            orderDirection: 'DESC',
            filters,
          }),
        ),
      );

      if (!inputRes || !outputRes || !cacheReadRes || !cacheWriteRes) return [];

      type ModelEntry = {
        model: string;
        provider: string | undefined;
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        cost: number | null;
        costUnit: string | null;
      };

      const modelMap = new Map<string, ModelEntry>();

      const ensureModel = (dimensions: { model?: string | null; provider?: string | null }): ModelEntry => {
        const model = dimensions.model ?? 'unknown';
        const provider = dimensions.provider ?? undefined;
        return getOrCreate(modelMap, `${model}\u0000${provider ?? ''}`, () => ({
          model,
          provider,
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: null,
          costUnit: null,
        }));
      };

      // total_input/total_output estimatedCost already rolls up cache + other detail
      // costs. The cache breakdowns are kept for their token counts only.
      const addCost = (entry: ModelEntry, group: { estimatedCost?: number | null; costUnit?: string | null }) => {
        if (group.estimatedCost != null) {
          entry.cost = (entry.cost ?? 0) + group.estimatedCost;
          if (group.costUnit) entry.costUnit = group.costUnit;
        }
      };

      for (const group of inputRes.groups) {
        const entry = ensureModel(group.dimensions);
        entry.input = group.value;
        addCost(entry, group);
      }
      for (const group of outputRes.groups) {
        const entry = ensureModel(group.dimensions);
        entry.output = group.value;
        addCost(entry, group);
      }
      for (const group of cacheReadRes.groups) {
        const entry = ensureModel(group.dimensions);
        entry.cacheRead = group.value;
      }
      for (const group of cacheWriteRes.groups) {
        const entry = ensureModel(group.dimensions);
        entry.cacheWrite = group.value;
      }

      return Array.from(modelMap.values())
        .map(vals => ({
          model: vals.model,
          ...(vals.provider ? { provider: vals.provider } : {}),
          input: formatCompactNumber(vals.input),
          output: formatCompactNumber(vals.output),
          cacheRead: formatCompactNumber(vals.cacheRead),
          cacheWrite: formatCompactNumber(vals.cacheWrite),
          cost: vals.cost,
          costUnit: vals.costUnit,
        }))
        .sort((a, b) => a.model.localeCompare(b.model) || (a.provider ?? '').localeCompare(b.provider ?? ''));
    },
    ...queryOptions,
  });
}
