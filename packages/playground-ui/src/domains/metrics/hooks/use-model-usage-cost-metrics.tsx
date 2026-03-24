import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { formatCompact } from '../components/metrics-utils';
import { useMetricsFilters } from './use-metrics-filters';

export interface ModelUsageRow {
  model: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
}

export function useModelUsageCostMetrics() {
  const client = useMastraClient();
  const { datePreset, customRange, timestamp } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'model-usage-cost', datePreset, customRange],
    queryFn: async (): Promise<ModelUsageRow[]> => {
      const metrics = [
        'mastra_model_total_input_tokens',
        'mastra_model_total_output_tokens',
        'mastra_model_input_cache_read_tokens',
        'mastra_model_input_cache_write_tokens',
      ] as const;

      const [inputRes, outputRes, cacheReadRes, cacheWriteRes] = await Promise.all(
        metrics.map(name =>
          client.getMetricBreakdown({
            name: [name],
            groupBy: ['model'],
            aggregation: 'sum',
            filters: { timestamp },
          }),
        ),
      );

      const modelMap = new Map<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>();

      const ensureModel = (model: string) => {
        if (!modelMap.has(model)) {
          modelMap.set(model, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
        }
        return modelMap.get(model)!;
      };

      for (const group of inputRes.groups) {
        const m = group.dimensions.model ?? 'unknown';
        ensureModel(m).input = group.value;
      }
      for (const group of outputRes.groups) {
        const m = group.dimensions.model ?? 'unknown';
        ensureModel(m).output = group.value;
      }
      for (const group of cacheReadRes.groups) {
        const m = group.dimensions.model ?? 'unknown';
        ensureModel(m).cacheRead = group.value;
      }
      for (const group of cacheWriteRes.groups) {
        const m = group.dimensions.model ?? 'unknown';
        ensureModel(m).cacheWrite = group.value;
      }

      return Array.from(modelMap.entries())
        .map(([model, vals]) => ({
          model,
          input: formatCompact(vals.input),
          output: formatCompact(vals.output),
          cacheRead: formatCompact(vals.cacheRead),
          cacheWrite: formatCompact(vals.cacheWrite),
        }))
        .sort((a, b) => a.model.localeCompare(b.model));
    },
  });
}
