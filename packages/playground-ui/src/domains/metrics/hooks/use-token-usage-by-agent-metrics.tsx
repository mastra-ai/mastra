import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useMetricsFilters } from './use-metrics-filters';

export interface TokenUsageByAgentRow {
  name: string;
  total: number;
  input: number;
  output: number;
}

export function useTokenUsageByAgentMetrics() {
  const client = useMastraClient();
  const { datePreset, customRange, timestamp } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'token-usage-by-agent', datePreset, customRange],
    queryFn: async (): Promise<TokenUsageByAgentRow[]> => {
      const [inputRes, outputRes] = await Promise.all([
        client.getMetricBreakdown({
          name: ['mastra_model_total_input_tokens'],
          groupBy: ['entityName'],
          aggregation: 'sum',
          filters: { timestamp },
        }),
        client.getMetricBreakdown({
          name: ['mastra_model_total_output_tokens'],
          groupBy: ['entityName'],
          aggregation: 'sum',
          filters: { timestamp },
        }),
      ]);

      const agentMap = new Map<string, { input: number; output: number }>();

      const ensure = (name: string) => {
        if (!agentMap.has(name)) {
          agentMap.set(name, { input: 0, output: 0 });
        }
        return agentMap.get(name)!;
      };

      for (const group of inputRes.groups) {
        const name = group.dimensions.entityName ?? 'unknown';
        ensure(name).input = group.value;
      }
      for (const group of outputRes.groups) {
        const name = group.dimensions.entityName ?? 'unknown';
        ensure(name).output = group.value;
      }

      return Array.from(agentMap.entries())
        .map(([name, vals]) => ({
          name,
          input: vals.input,
          output: vals.output,
          total: vals.input + vals.output,
        }))
        .sort((a, b) => b.total - a.total);
    },
  });
}
