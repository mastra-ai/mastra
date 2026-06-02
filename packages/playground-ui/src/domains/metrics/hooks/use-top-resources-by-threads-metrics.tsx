import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useMetricsFilters } from './use-metrics-filters';

export interface ResourceThreadsRow {
  resourceId: string;
  threadCount: number;
  tokens: number;
  cost: number | null;
  costUnit: string | null;
}

const TOP_N = 20;

/** Top Resources by Thread Count — the resources with the most distinct threads
 *  in the selected range. Uses `count_distinct(threadId)` per `resourceId`,
 *  with server-side TopK (`ORDER BY value DESC LIMIT 20`).
 *
 *  Tokens + cost are joined in from parallel breakdowns on `resourceId` so the
 *  table can show cost/usage without a separate backend aggregation. */
export function useTopResourcesByThreadsMetrics() {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'top-resources-by-threads', filterKey],
    queryFn: async (): Promise<ResourceThreadsRow[]> => {
      const breakdownBase = {
        groupBy: ['resourceId'],
        orderDirection: 'DESC' as const,
        filters,
      };

      const [threadsRes, inputRes, outputRes] = await Promise.all([
        client.getMetricBreakdown({
          ...breakdownBase,
          name: ['mastra_agent_duration_ms'],
          aggregation: 'count_distinct',
          distinctColumn: 'threadId' as never,
          limit: TOP_N,
        }),
        // Token breakdowns use the same groupBy and a server-side TopK so the
        // response stays bounded even when the underlying resource set has very
        // high cardinality. Resources that are top-N by thread count but not by
        // tokens will display 0 tokens (an acceptable approximation in exchange
        // for a bounded query).
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
      const byResource = new Map<string, Entry>();

      const ensure = (resourceId: string): Entry => {
        if (!byResource.has(resourceId)) byResource.set(resourceId, { tokens: 0, cost: null, costUnit: null });
        return byResource.get(resourceId)!;
      };

      const foldTokens = (groups: typeof inputRes.groups) => {
        for (const group of groups) {
          const resourceId = group.dimensions.resourceId;
          if (!resourceId) continue;
          const entry = ensure(resourceId as string);
          entry.tokens += group.value;
          if (group.estimatedCost != null) {
            entry.cost = (entry.cost ?? 0) + group.estimatedCost;
            if (group.costUnit) entry.costUnit = group.costUnit;
          }
        }
      };
      foldTokens(inputRes.groups);
      foldTokens(outputRes.groups);

      return threadsRes.groups
        .filter(group => !!group.dimensions.resourceId)
        .map(group => {
          const resourceId = group.dimensions.resourceId as string;
          const extra = byResource.get(resourceId);
          return {
            resourceId,
            threadCount: group.value,
            tokens: extra?.tokens ?? 0,
            cost: extra?.cost ?? null,
            costUnit: extra?.costUnit ?? null,
          };
        });
    },
  });
}
