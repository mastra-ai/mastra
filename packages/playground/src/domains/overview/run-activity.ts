import type { MastraClient } from '@mastra/client-js';
import { bucketCountOf, bucketIndexOf, bucketsByRange, previousWindow } from './overview-period';
import type { OverviewRange, PeriodWindow } from './overview-period';

export interface RunActivity {
  runs: number;
  errors: number;
  previousRuns: number;
  previousErrors: number;
  runsPerBucket: number[];
  errorsPerBucket: number[];
  lastRunBucketMs: number | null;
}

export interface RunTotals {
  runs: number;
  errors: number;
  previousRuns: number;
  previousErrors: number;
}

type Breakdown = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

const statusSeparator = '|';

export function emptyRunActivity(bucketCount: number): RunActivity {
  return {
    runs: 0,
    errors: 0,
    previousRuns: 0,
    previousErrors: 0,
    runsPerBucket: Array.from<number>({ length: bucketCount }).fill(0),
    errorsPerBucket: Array.from<number>({ length: bucketCount }).fill(0),
    lastRunBucketMs: null,
  };
}

function splitSeriesName(seriesName: string) {
  const separatorIndex = seriesName.lastIndexOf(statusSeparator);
  if (separatorIndex === -1) return { entityId: seriesName, status: undefined };
  return { entityId: seriesName.slice(0, separatorIndex), status: seriesName.slice(separatorIndex + 1) };
}

function addRunCounts(
  activityOf: (entityId: string | null | undefined) => RunActivity | undefined,
  breakdown: Breakdown,
  period: 'current' | 'previous',
) {
  for (const group of breakdown.groups) {
    const activity = activityOf(group.dimensions.entityId);
    if (!activity) continue;
    const isError = group.dimensions.status === 'error';
    if (period === 'current') {
      activity.runs += group.value;
      if (isError) activity.errors += group.value;
    } else {
      activity.previousRuns += group.value;
      if (isError) activity.previousErrors += group.value;
    }
  }
}

export async function fetchRunActivity(
  client: MastraClient,
  { metricName, window, range }: { metricName: string; window: PeriodWindow; range: OverviewRange },
) {
  const bucketCount = bucketCountOf(window, range);
  const runsByEntityAndStatus = (timestamp: PeriodWindow) =>
    client.getMetricBreakdown({
      name: [metricName],
      aggregation: 'count',
      groupBy: ['entityId', 'status'],
      filters: { timestamp },
    });
  const [current, previous, overTime] = await Promise.all([
    runsByEntityAndStatus(window),
    runsByEntityAndStatus(previousWindow(window)),
    client.getMetricTimeSeries({
      name: [metricName],
      aggregation: 'count',
      groupBy: ['entityId', 'status'],
      interval: bucketsByRange[range].interval,
      filters: { timestamp: window },
    }),
  ]);

  const byEntityId = new Map<string, RunActivity>();
  const activityOf = (entityId: string | null | undefined) => {
    if (!entityId) return undefined;
    const activity = byEntityId.get(entityId) ?? emptyRunActivity(bucketCount);
    byEntityId.set(entityId, activity);
    return activity;
  };

  addRunCounts(activityOf, current, 'current');
  addRunCounts(activityOf, previous, 'previous');
  for (const series of overTime.series) {
    const { entityId, status } = splitSeriesName(series.name);
    const activity = activityOf(entityId);
    if (!activity) continue;
    for (const point of series.points) {
      if (point.value <= 0) continue;
      const pointMs = new Date(point.timestamp).getTime();
      activity.lastRunBucketMs = Math.max(activity.lastRunBucketMs ?? pointMs, pointMs);
      const bucket = Math.min(Math.max(bucketIndexOf(pointMs, window, range), 0), bucketCount - 1);
      activity.runsPerBucket[bucket] += point.value;
      if (status === 'error') activity.errorsPerBucket[bucket] += point.value;
    }
  }
  return { byEntityId, bucketCount };
}

export function sumRunTotals(activities: Iterable<RunActivity>): RunTotals {
  const totals = { runs: 0, errors: 0, previousRuns: 0, previousErrors: 0 };
  for (const activity of activities) {
    totals.runs += activity.runs;
    totals.errors += activity.errors;
    totals.previousRuns += activity.previousRuns;
    totals.previousErrors += activity.previousErrors;
  }
  return totals;
}

export function errorRateOf(runs: number, errors: number) {
  return runs > 0 ? errors / runs : null;
}
