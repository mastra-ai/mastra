import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { BucketLabels, Point } from '../lib/metrics-buckets';
import { bucketGrid, bucketPlan, gridIndex } from '../lib/metrics-buckets';
import { useMetricsFilters } from './use-metrics-filters';

export type ActivityBucket = BucketLabels & {
  /** Uncached input tokens. */
  input: number;
  cacheRead: number;
  output: number;
  /** Estimated model cost, USD. */
  cost: number;
  completed: number;
  failed: number;
  /** failed / (completed + failed), 0 when there were no runs. */
  failureRate: number;
};

const TOKEN_METRICS = {
  input: 'mastra_model_total_input_tokens',
  output: 'mastra_model_total_output_tokens',
  cacheRead: 'mastra_model_input_cache_read_tokens',
} as const;

const AGENT_DURATION = 'mastra_agent_duration_ms';

/**
 * Tokens, cost and agent runs per chart bucket, for the token, runs and failure-rate cards.
 * Keeps the previous range on screen while a new one loads (`isPlaceholderData`).
 */
export function useMetricsActivity() {
  const client = useMastraClient();
  const { filters, filterKey, timestamp } = useMetricsFilters();
  const { interval, stepHours } = bucketPlan(timestamp.start, timestamp.end);

  return useQuery({
    queryKey: ['metrics', 'activity', filterKey, interval],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ActivityBucket[]> => {
      const sum = (name: string) => client.getMetricTimeSeries({ name: [name], interval, aggregation: 'sum', filters });
      const [input, output, cacheRead, runs] = await Promise.all([
        sum(TOKEN_METRICS.input),
        sum(TOKEN_METRICS.output),
        sum(TOKEN_METRICS.cacheRead),
        client.getMetricTimeSeries({
          name: [AGENT_DURATION],
          interval,
          aggregation: 'count',
          groupBy: ['status'],
          filters,
        }),
      ]);

      const buckets: ActivityBucket[] = bucketGrid(timestamp.start, timestamp.end, stepHours).map(b => ({
        ...b,
        input: 0,
        cacheRead: 0,
        output: 0,
        cost: 0,
        completed: 0,
        failed: 0,
        failureRate: 0,
      }));
      const indexOf = gridIndex(buckets, stepHours);
      const at = (p: Point) => {
        const i = indexOf(p);
        return i === undefined ? undefined : buckets[i];
      };

      const addTokens = (points: Point[], key: 'input' | 'output' | 'cacheRead') => {
        for (const p of points) {
          const b = at(p);
          if (!b) continue;
          b[key] += p.value;
          // Cache reads are part of the input tokens, so their cost is already counted there.
          if (key !== 'cacheRead') b.cost += p.estimatedCost ?? 0;
        }
      };
      for (const s of input.series) addTokens(s.points, 'input');
      for (const s of output.series) addTokens(s.points, 'output');
      for (const s of cacheRead.series) addTokens(s.points, 'cacheRead');

      for (const s of runs.series) {
        const key = /error/i.test(s.name) ? 'failed' : 'completed';
        for (const p of s.points) {
          const b = at(p);
          if (b) b[key] += p.value;
        }
      }

      for (const b of buckets) {
        // Total input includes cache reads: chart the uncached part as "Input" so the stack sums up.
        b.input = Math.max(b.input - b.cacheRead, 0);
        const runsInBucket = b.completed + b.failed;
        b.failureRate = runsInBucket > 0 ? b.failed / runsInBucket : 0;
      }
      return buckets;
    },
  });
}
