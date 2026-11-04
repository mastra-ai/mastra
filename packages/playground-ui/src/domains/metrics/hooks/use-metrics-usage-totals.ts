import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

type BreakdownArgs = Parameters<MastraClient['getMetricBreakdown']>[0];

/** Input plus output tokens; each group's `estimatedCost` prices both, cache and reasoning included. */
export const USAGE_METRICS: [string, ...string[]] = [
  'mastra_model_total_input_tokens',
  'mastra_model_total_output_tokens',
];

/**
 * What a group's value is.
 * - `tokens`: tokens summed, with their cost.
 * - `modelSpans`: model calls. Each call with usage emits one input-token event, so counting them
 *   counts the calls (`model_generation` spans; calls that report no usage aren't counted).
 */
export type UsageTotalsMeasure = 'tokens' | 'modelSpans';

export type UsageTotalsOptions = {
  /** Dimensions the totals split by, e.g. `['projectId']` or `['entityName']`. */
  groupBy: string[];
  /** Filters added to the page's, e.g. `{ entityType: 'agent' }`. */
  filters?: Partial<NonNullable<BreakdownArgs['filters']>>;
  window: { start: Date; end: Date };
  measure?: UsageTotalsMeasure;
  enabled?: boolean;
};

/** Tokens and cost, or model spans, per group as totals over a window, with the page's other filters. */
export function useMetricsUsageTotals({
  groupBy,
  filters: extra,
  window,
  measure = 'tokens',
  enabled = true,
}: UsageTotalsOptions) {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: [
      'metrics',
      'cost-breakdown',
      measure,
      groupBy,
      extra,
      filterKey,
      window.start.toISOString(),
      window.end.toISOString(),
    ],
    // The page's window is frozen, so a tab opened again reuses the answer instead of refetching it.
    staleTime: Infinity,
    enabled,
    queryFn: () =>
      client.getMetricBreakdown({
        name: measure === 'tokens' ? USAGE_METRICS : ['mastra_model_total_input_tokens'],
        groupBy,
        aggregation: measure === 'tokens' ? 'sum' : 'count',
        orderDirection: 'DESC',
        limit: 1000,
        filters: { ...filters, ...extra, timestamp: window },
      }),
  });
}
