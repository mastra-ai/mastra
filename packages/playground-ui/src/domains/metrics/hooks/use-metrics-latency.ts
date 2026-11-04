import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { BucketLabels } from '../lib/metrics-buckets';
import { bucketGrid, bucketPlan, gridIndex, intervalHours } from '../lib/metrics-buckets';
import { useMetricsFilters } from './use-metrics-filters';

export type LatencyEntity = 'agents' | 'workflows' | 'tools';

/** A bucket without runs has no percentile: the line skips it instead of dropping to zero. */
export type LatencyBucket = BucketLabels & Partial<Record<LatencyPercentile, number>>;

export type LatencyPercentile = 'p50' | 'p95' | 'p99';

const PERCENTILES: Record<number, LatencyPercentile> = { 0.5: 'p50', 0.95: 'p95', 0.99: 'p99' };

const DURATION: Record<LatencyEntity, string> = {
  agents: 'mastra_agent_duration_ms',
  workflows: 'mastra_workflow_duration_ms',
  tools: 'mastra_tool_duration_ms',
};

/**
 * P50, P95 and P99 duration of agent runs, workflow runs or tool calls. Percentiles can't be merged
 * across buckets, so this keeps the API's own 1h or 1d buckets (more points than the bar charts).
 */
export function useMetricsLatency(entity: LatencyEntity) {
  const client = useMastraClient();
  const { filters, filterKey, timestamp } = useMetricsFilters();
  const { interval } = bucketPlan(timestamp.start, timestamp.end);
  const stepHours = intervalHours(interval);

  return useQuery({
    queryKey: ['metrics', 'latency-percentiles', entity, filterKey, interval],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<LatencyBucket[]> => {
      const result = await client.getMetricPercentiles({
        name: DURATION[entity],
        percentiles: [0.5, 0.95, 0.99],
        interval,
        filters,
      });
      const buckets: LatencyBucket[] = bucketGrid(timestamp.start, timestamp.end, stepHours);
      const indexOf = gridIndex(buckets, stepHours);
      for (const s of result.series) {
        const key = PERCENTILES[s.percentile];
        if (!key) continue;
        for (const p of s.points) {
          const bucket = buckets[indexOf(p) ?? -1];
          if (bucket) bucket[key] = Math.round(p.value);
        }
      }
      return buckets;
    },
  });
}
