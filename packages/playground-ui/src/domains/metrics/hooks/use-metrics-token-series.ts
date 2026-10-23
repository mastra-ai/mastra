import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { bucketGrid, bucketPlan, intervalHours } from '../lib/metrics-buckets';
import { useMetricsFilters } from './use-metrics-filters';

type TimeSeriesArgs = Parameters<MastraClient['getMetricTimeSeries']>[0];

/** Input plus output tokens; each point's `estimatedCost` prices both, cache and reasoning included. */
export const TOKEN_SERIES_METRICS = ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'];

export type TokenSeriesOptions = {
  /** Dimensions the series split by, e.g. `['projectId']` or `['entityName']`. */
  groupBy: string[];
  /** Filters added to the page's, e.g. `{ entityType: 'agent' }`. */
  filters?: Partial<NonNullable<TimeSeriesArgs['filters']>>;
  enabled?: boolean;
};

/**
 * Tokens and cost per group per bucket, on the page's grid. Cards asking for the same split send
 * one request: the Breakdown card's Projects tab and the Usage card's Projects view share it.
 */
export function useMetricsTokenSeries({ groupBy, filters: extra, enabled = true }: TokenSeriesOptions) {
  const client = useMastraClient();
  const { filters, filterKey, timestamp } = useMetricsFilters();
  const { interval } = bucketPlan(timestamp.start, timestamp.end);
  const stepHours = intervalHours(interval);

  const query = useQuery({
    queryKey: ['metrics', 'token-series', groupBy, extra ?? null, filterKey, interval],
    placeholderData: keepPreviousData,
    // The page's window is frozen, so a card mounting later reuses the answer instead of refetching it.
    staleTime: Infinity,
    enabled,
    queryFn: () =>
      client.getMetricTimeSeries({
        name: TOKEN_SERIES_METRICS,
        interval,
        aggregation: 'sum',
        groupBy,
        filters: { ...filters, ...extra },
      }),
  });

  return { ...query, grid: { buckets: bucketGrid(timestamp.start, timestamp.end, stepHours), stepHours } };
}
