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
  cost: number | null;
  costUnit: string | null;
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

      type ModelEntry = {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        cost: number | null;
        costUnit: string | null;
      };

      const modelMap = new Map<string, ModelEntry>();

      const ensureModel = (model: string): ModelEntry => {
        if (!modelMap.has(model)) {
          modelMap.set(model, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: null, costUnit: null });
        }
        return modelMap.get(model)!;
      };

      const addCost = (entry: ModelEntry, group: { estimatedCost?: number | null; costUnit?: string | null }) => {
        if (group.estimatedCost != null) {
          entry.cost = (entry.cost ?? 0) + group.estimatedCost;
          if (group.costUnit) entry.costUnit = group.costUnit;
        }
      };

      for (const group of inputRes.groups) {
        const m = group.dimensions.model ?? 'unknown';
        const entry = ensureModel(m);
        entry.input = group.value;
        addCost(entry, group);
      }
      for (const group of outputRes.groups) {
        const m = group.dimensions.model ?? 'unknown';
        const entry = ensureModel(m);
        entry.output = group.value;
        addCost(entry, group);
      }
      for (const group of cacheReadRes.groups) {
        const m = group.dimensions.model ?? 'unknown';
        const entry = ensureModel(m);
        entry.cacheRead = group.value;
        addCost(entry, group);
      }
      for (const group of cacheWriteRes.groups) {
        const m = group.dimensions.model ?? 'unknown';
        const entry = ensureModel(m);
        entry.cacheWrite = group.value;
        addCost(entry, group);
      }

      return Array.from(modelMap.entries())
        .map(([model, vals]) => ({
          model,
          input: formatCompact(vals.input),
          output: formatCompact(vals.output),
          cacheRead: formatCompact(vals.cacheRead),
          cacheWrite: formatCompact(vals.cacheWrite),
          cost: vals.cost,
          costUnit: vals.costUnit,
        }))
        .sort((a, b) => a.model.localeCompare(b.model));
    },
  });
}
