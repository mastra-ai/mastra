import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { BucketLabels } from '../lib/metrics-buckets';
import { bucketGrid, bucketPlan, gridIndex, intervalHours } from '../lib/metrics-buckets';
import { useMetricsFilters } from './use-metrics-filters';

/** A scorer with results in the range, and its mean score over the range. */
export type ScorerAverage = { scorerId: string; name: string; average: number };

/** One bucket of average scores, keyed by scorer id; a bucket without results has no value. */
export type ScoresBucket = BucketLabels & { [scorerId: string]: number | string | undefined };

export type MetricsScores = { scorers: ScorerAverage[]; buckets: ScoresBucket[] };

/** How many recent scores to read to find the scorers in the range (the API's page limit). */
const DISCOVERY_PAGE_SIZE = 100;

/**
 * Average score per scorer over the range, and per bucket of the API's own 1h or 1d buckets
 * (averages can't be merged across buckets). Score queries need a scorer id, and Platform's
 * observability API can't list scorers, so the scorers come from the most recent scores in the
 * range: a scorer with no result among them is left out.
 */
export function useMetricsScores() {
  const client = useMastraClient();
  const { filters, filterKey, timestamp } = useMetricsFilters();
  const { interval } = bucketPlan(timestamp.start, timestamp.end);
  const stepHours = intervalHours(interval);

  return useQuery({
    queryKey: ['metrics', 'scores', filterKey, interval],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MetricsScores> => {
      const recent = await client.listScores({
        filters,
        pagination: { page: 0, perPage: DISCOVERY_PAGE_SIZE },
      });
      const names = new Map(recent.scores.map(s => [s.scorerId, s.scorerName ?? s.scorerId]));
      const scorerIds = [...names.keys()].toSorted();

      const results = await Promise.all(
        scorerIds.map(scorerId =>
          Promise.all([
            client.getScoreAggregate({ scorerId, aggregation: 'avg', filters }),
            client.getScoreTimeSeries({ scorerId, aggregation: 'avg', interval, filters }),
          ]),
        ),
      );

      const buckets: ScoresBucket[] = bucketGrid(timestamp.start, timestamp.end, stepHours);
      const indexOf = gridIndex(buckets, stepHours);
      const scorers: ScorerAverage[] = [];
      results.forEach(([aggregate, timeSeries], i) => {
        const scorerId = scorerIds[i];
        if (!scorerId) return;
        scorers.push({ scorerId, name: names.get(scorerId) ?? scorerId, average: aggregate.value ?? 0 });
        for (const s of timeSeries.series) {
          for (const p of s.points) {
            const bucket = buckets[indexOf(p) ?? -1];
            if (bucket) bucket[scorerId] = p.value;
          }
        }
      });
      return { scorers, buckets };
    },
  });
}
