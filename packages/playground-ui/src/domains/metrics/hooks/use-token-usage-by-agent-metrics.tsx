import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

export interface TokenUsageByAgentRow {
  name: string;
  total: number;
  input: number;
  output: number;
  cost: number | null;
  costUnit: string | null;
}

export function useTokenUsageByAgentMetrics() {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'token-usage-by-agent', filterKey],
    queryFn: async (): Promise<TokenUsageByAgentRow[]> => {
      const breakdownBase = {
        groupBy: ['entityName'],
        aggregation: 'sum' as const,
        orderDirection: 'DESC' as const,
        filters,
      };
      const [inputRes, outputRes, cacheReadRes, cacheWriteRes] = await Promise.all([
        client.getMetricBreakdown({ ...breakdownBase, name: ['mastra_model_total_input_tokens'] }),
        client.getMetricBreakdown({ ...breakdownBase, name: ['mastra_model_total_output_tokens'] }),
        client.getMetricBreakdown({ ...breakdownBase, name: ['mastra_model_input_cache_read_tokens'] }),
        client.getMetricBreakdown({ ...breakdownBase, name: ['mastra_model_input_cache_write_tokens'] }),
      ]);

      type AgentEntry = { input: number; output: number; cost: number | null; costUnit: string | null };

      const agentMap = new Map<string, AgentEntry>();

      const ensure = (name: string): AgentEntry => {
        if (!agentMap.has(name)) {
          agentMap.set(name, { input: 0, output: 0, cost: null, costUnit: null });
        }
        return agentMap.get(name)!;
      };

      const addCost = (entry: AgentEntry, group: { estimatedCost?: number | null; costUnit?: string | null }) => {
        if (group.estimatedCost != null) {
          entry.cost = (entry.cost ?? 0) + group.estimatedCost;
          if (group.costUnit) entry.costUnit = group.costUnit;
        }
      };

      for (const group of inputRes.groups) {
        const name = group.dimensions.entityName ?? 'unknown';
        const entry = ensure(name);
        entry.input = group.value;
        addCost(entry, group);
      }
      for (const group of outputRes.groups) {
        const name = group.dimensions.entityName ?? 'unknown';
        const entry = ensure(name);
        entry.output = group.value;
        addCost(entry, group);
      }
      for (const group of cacheReadRes.groups) {
        const name = group.dimensions.entityName ?? 'unknown';
        const entry = ensure(name);
        addCost(entry, group);
      }
      for (const group of cacheWriteRes.groups) {
        const name = group.dimensions.entityName ?? 'unknown';
        const entry = ensure(name);
        addCost(entry, group);
      }

      return Array.from(agentMap.entries())
        .map(([name, vals]) => ({
          name,
          input: vals.input,
          output: vals.output,
          total: vals.input + vals.output,
          cost: vals.cost,
          costUnit: vals.costUnit,
        }))
        .sort((a, b) => b.total - a.total);
    },
  });
}
