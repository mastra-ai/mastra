import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useMetricsFilters } from './use-metrics-filters';

export interface ActiveThreadRow {
  threadId: string;
  resourceId: string | null;
  runs: number;
  tokens: number;
  cost: number | null;
  costUnit: string | null;
}

const TOP_N = 20;

/** Top Active Threads — the threads with the most agent runs in the selected
 *  range. Server-side TopK (`ORDER BY value DESC LIMIT 20`) is required so the
 *  query never returns the full thread set when cardinality is in the millions.
 *
 *  Tokens + cost are joined in from parallel breakdowns on the same `threadId`
 *  grouping so we don't need any new backend aggregation support. */
export function useTopActiveThreadsMetrics() {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'top-active-threads', filterKey],
    queryFn: async (): Promise<ActiveThreadRow[]> => {
      const breakdownBase = {
        groupBy: ['threadId', 'resourceId'],
        orderDirection: 'DESC' as const,
        filters,
      };

      const [runsRes, inputRes, outputRes] = await Promise.all([
        client.getMetricBreakdown({
          ...breakdownBase,
          name: ['mastra_agent_duration_ms'],
          aggregation: 'count',
          limit: TOP_N,
        }),
        // Token breakdowns use the same groupBy and a server-side TopK so the
        // response stays bounded even when the underlying thread set has very
        // high cardinality. Threads that are top-N by runs but not by tokens
        // will display 0 tokens (an acceptable approximation in exchange for
        // a bounded query).
        client.getMetricBreakdown({
          ...breakdownBase,
          name: ['mastra_model_total_input_tokens'],
          aggregation: 'sum',
          limit: TOP_N,
        }),
        client.getMetricBreakdown({
          ...breakdownBase,
          name: ['mastra_model_total_output_tokens'],
          aggregation: 'sum',
          limit: TOP_N,
        }),
      ]);

      type Entry = { tokens: number; cost: number | null; costUnit: string | null };
      const byThread = new Map<string, Entry>();

      const ensure = (threadId: string): Entry => {
        if (!byThread.has(threadId)) byThread.set(threadId, { tokens: 0, cost: null, costUnit: null });
        return byThread.get(threadId)!;
      };

      const foldTokens = (groups: typeof inputRes.groups) => {
        for (const group of groups) {
          const threadId = group.dimensions.threadId;
          if (!threadId) continue;
          const entry = ensure(threadId as string);
          entry.tokens += group.value;
          if (group.estimatedCost != null) {
            entry.cost = (entry.cost ?? 0) + group.estimatedCost;
            if (group.costUnit) entry.costUnit = group.costUnit;
          }
        }
      };
      foldTokens(inputRes.groups);
      foldTokens(outputRes.groups);

      return runsRes.groups
        .filter(group => !!group.dimensions.threadId)
        .map(group => {
          const threadId = group.dimensions.threadId as string;
          const extra = byThread.get(threadId);
          return {
            threadId,
            resourceId: (group.dimensions.resourceId as string | undefined) ?? null,
            runs: group.value,
            tokens: extra?.tokens ?? 0,
            cost: extra?.cost ?? null,
            costUnit: extra?.costUnit ?? null,
          };
        });
    },
  });
}
