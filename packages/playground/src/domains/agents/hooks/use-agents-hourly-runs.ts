import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import type { useMetricsQueryFilters } from '@mastra/react/hooks/metrics';
import { useQuery } from '@tanstack/react-query';

const HOUR_MS = 60 * 60 * 1000;
const AGENT_RUN_METRIC = 'mastra_agent_duration_ms';

type TimeSeriesPoint = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>['series'][number]['points'][number];

export function hourlyBuckets(points: { tsMs: number; value: number }[], hours: number, now: number) {
  const buckets = Array.from<number>({ length: hours }).fill(0);
  const firstHourMs = now - hours * HOUR_MS;
  for (const point of points) {
    const hour = Math.floor((point.tsMs - firstHourMs) / HOUR_MS);
    if (hour >= 0 && hour < hours) buckets[hour] += point.value;
  }
  return buckets;
}

function toTimedValues(points: TimeSeriesPoint[]) {
  return points.map(point => ({ tsMs: new Date(point.timestamp).getTime(), value: point.value ?? 0 }));
}

/** Agent runs and failed runs per hour, under the same filters as the Metrics dashboard. */
export function useAgentsHourlyRuns({ filters, filterKey }: ReturnType<typeof useMetricsQueryFilters>) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['metrics', 'agents-hourly-runs', filterKey],
    queryFn: async () => {
      const response = await client.getMetricTimeSeries({
        name: [AGENT_RUN_METRIC],
        aggregation: 'count',
        interval: '1h',
        groupBy: ['status'],
        filters,
      });
      return {
        runs: response.series.flatMap(series => toTimedValues(series.points)),
        errors: response.series
          .filter(series => series.name === 'error')
          .flatMap(series => toTimedValues(series.points)),
      };
    },
  });
}
