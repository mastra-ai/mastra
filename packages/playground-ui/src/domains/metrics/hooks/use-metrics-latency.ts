import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { BucketLabels } from '../lib/metrics-buckets';
import { bucketGrid, bucketPlan, gridIndex, intervalHours } from '../lib/metrics-buckets';
import { useMetricsFilters } from './use-metrics-filters';

export type LatencyEntity = 'agents' | 'workflows' | 'tools';

/** A bucket without runs has no percentile: the line skips it instead of dropping to zero. */
export type LatencyBucket = BucketLabels & Partial<Record<`${LatencyEntity}P50` | `${LatencyEntity}P95`, number>>;

const DURATION: Record<LatencyEntity, string> = {
  agents: 'mastra_agent_duration_ms',
  workflows: 'mastra_workflow_duration_ms',
  tools: 'mastra_tool_duration_ms',
};

const ENTITIES: LatencyEntity[] = ['agents', 'workflows', 'tools'];

/**
 * P50 and P95 duration of agent runs, workflow runs and tool calls. Percentiles can't be merged
 * across buckets, so this keeps the API's own 1h or 1d buckets (more points than the bar charts).
 */
export function useMetricsLatency() {
  const client = useMastraClient();
  const { filters, filterKey, timestamp } = useMetricsFilters();
  const { interval } = bucketPlan(timestamp.start, timestamp.end);
  const stepHours = intervalHours(interval);

  return useQuery({
    queryKey: ['metrics', 'latency-percentiles', filterKey, interval],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<LatencyBucket[]> => {
      const results = await Promise.all(
        ENTITIES.map(entity =>
          client.getMetricPercentiles({
            name: DURATION[entity],
            percentiles: [0.5, 0.95],
            interval,
            filters,
          }),
        ),
      );
      const buckets: LatencyBucket[] = bucketGrid(timestamp.start, timestamp.end, stepHours);
      const indexOf = gridIndex(buckets, stepHours);
      results.forEach((result, i) => {
        const entity = ENTITIES[i];
        if (!entity) return;
        for (const s of result.series) {
          const key = percentileKey(entity, s.percentile);
          if (!key) continue;
          for (const p of s.points) {
            const bucket = buckets[indexOf(p) ?? -1];
            if (bucket) bucket[key] = Math.round(p.value);
          }
        }
      });
      return buckets;
    },
  });
}

function percentileKey(entity: LatencyEntity, percentile: number) {
  if (percentile === 0.5) return `${entity}P50` as const;
  if (percentile === 0.95) return `${entity}P95` as const;
  return undefined;
}
