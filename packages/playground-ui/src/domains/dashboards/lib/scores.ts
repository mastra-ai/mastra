import type { DashboardQuery } from '@mastra/client-js';
import type { BucketLabels } from '../../metrics/lib/bucket-labels';
import { bucketGrid, gridIndex } from '../../metrics/lib/metrics-buckets';
import { seriesOf, valueOf } from './answers';
import type { DashboardAnswer } from './requests';

export type Scorer = { scorerId: string; name: string };

export type ScoresBucket = BucketLabels & Record<string, number | string | undefined>;

/** Whether the query leaves its scorer out, so the widget has to find the scorers itself. */
export const needsScorer = (query: DashboardQuery | undefined) =>
  query?.source === 'scores' && query.scorerId === undefined;

/** The scorer the view's queries name themselves, when none of them leaves it out. */
export function ownScorers(queries: DashboardQuery[]): Scorer[] {
  const own = queries.find(q => q.source === 'scores' && q.scorerId);
  const scorerId = own?.source === 'scores' ? own.scorerId : undefined;
  return scorerId ? [{ scorerId, name: scorerId }] : [];
}

/** Every scorer among the recent scores, sorted by id, named as the scores name them. */
export function discoveredScorers(scores: { scorerId: string; scorerName?: string }[]): Scorer[] {
  const names = new Map(scores.map(s => [s.scorerId, s.scorerName ?? s.scorerId]));
  return [...names.keys()].toSorted().map(scorerId => ({ scorerId, name: names.get(scorerId) ?? scorerId }));
}

/** The query for one scorer: its own scorer if it names one, else `scorerId`. */
export const withScorer = (query: DashboardQuery | undefined, scorerId: string): DashboardQuery | undefined =>
  query?.source === 'scores' && query.scorerId === undefined ? { ...query, scorerId } : query;

/**
 * Lays each scorer's points on the window's bucket grid, keyed by scorer id, and reads each scorer's
 * mean (0 when the aggregate has no value, as the Scores card shows it). `means` and `points` hold
 * one answer per scorer, in `scorers`' order.
 */
export function shapeScores(
  scorers: Scorer[],
  means: (DashboardAnswer | undefined)[],
  points: (DashboardAnswer | undefined)[],
  window: { start: Date; end: Date },
  stepHours: number,
) {
  const buckets: ScoresBucket[] = bucketGrid(window.start, window.end, stepHours);
  const indexOf = gridIndex(buckets, stepHours);
  scorers.forEach(({ scorerId }, i) => {
    for (const s of seriesOf(points[i]) ?? []) {
      for (const p of s.points) {
        const at = indexOf(p);
        const bucket = at === undefined ? undefined : buckets[at];
        if (bucket) bucket[scorerId] = p.value;
      }
    }
  });
  const lines = scorers.map((scorer, i) => ({ ...scorer, mean: valueOf(means[i])?.value ?? 0 }));
  return { buckets, lines };
}
