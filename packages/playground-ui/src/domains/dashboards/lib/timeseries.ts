import type { DashboardQuery } from '@mastra/client-js';
import { z } from 'zod/v4';
import type { BucketLabels } from '../../metrics/lib/bucket-labels';
import { bucketGrid, bucketPlan, gridIndex, intervalHours } from '../../metrics/lib/metrics-buckets';
import type { ApiInterval } from '../../metrics/lib/metrics-buckets';
import { bucketTraceAggregateRows } from '../../metrics/lib/trace-aggregate';
import type { TraceAggregateRow } from '../../metrics/lib/trace-aggregate';
import { measureOf, rowsOf, seriesOf, valueOf } from './answers';
import type { DashboardAnswer } from './requests';
import {
  colorSchema,
  evaluate,
  exprRefs,
  formatSchema,
  matchesGroups,
  queryRefSchema,
  unknownQueryIssues,
  valueExprSchema,
} from './values';
import type { ValueExpr, ValueRef } from './values';

export const timeseriesSeriesSchema = z
  .object({
    dataKey: z.string().min(1),
    label: z.string().min(1),
    color: colorSchema,
    emphasis: z.boolean().optional(),
    /** The series' value per bucket. */
    value: valueExprSchema,
    /** The series' value over the whole range, shown beside the card's title marked with the series' color. */
    rangeTotal: valueExprSchema.optional(),
    /** Rounds each bucket's value to a whole number. */
    round: z.boolean().optional(),
  })
  .strict();

export const timeseriesOptionsSchema = z
  .object({
    chart: z.enum(['stackedBar', 'line']),
    format: formatSchema,
    /** `false` leaves the y-axis to the chart's default labels. */
    axis: z.boolean().optional(),
    series: z.array(timeseriesSeriesSchema).min(1),
    /**
     * `chart` re-buckets metrics onto the bar charts' grid (sums merge); `api` keeps the API's 1h or 1d
     * buckets (percentiles and averages can't merge). Trace and span aggregates always keep the API's.
     */
    buckets: z.enum(['chart', 'api']).optional(),
    /** Ids of queries sent over the whole range, without an interval (e.g. distinct counts, which can't be summed). */
    totals: z.array(queryRefSchema).optional(),
    /** Hides a series whose range total (or, without one, sum of buckets) is zero. */
    hideEmpty: z.boolean().optional(),
    /** Emphasizes the first series shown. */
    emphasizeFirst: z.boolean().optional(),
    xLabels: z.literal('edges').optional(),
    /** The y-axis range when every plotted value is zero. */
    flatYDomain: z.tuple([z.number(), z.number()]).optional(),
    yDomain: z.tuple([z.number(), z.number()]).optional(),
    /** The card's total, beside its title. Ignored when a series has a `rangeTotal`. */
    total: z
      .object({
        /** `total`: every series summed over the range; `peak`: one series' highest bucket; or an expression over range totals. */
        value: z.union([z.literal('total'), z.object({ peak: z.string().min(1) }).strict(), valueExprSchema]),
        format: formatSchema.optional(),
      })
      .strict()
      .optional(),
    emptyMessage: z.string().optional(),
    /** Empty when this is zero over the range; by default, when every plotted value is zero. */
    emptyWhenZero: valueExprSchema.optional(),
  })
  .strict();

export type TimeseriesOptions = z.infer<typeof timeseriesOptionsSchema>;
export type TimeseriesSeries = z.infer<typeof timeseriesSeriesSchema>;

type Window = { start: Date; end: Date };

export type ChartBucket = BucketLabels & Record<string, number | string | undefined>;

export type ShapedTimeseries = {
  data: ChartBucket[];
  /** The series shown, each with its range total when it has one. */
  series: (Omit<TimeseriesSeries, 'rangeTotal'> & { rangeTotal?: number })[];
  /** Hours per bucket, for a clicked bucket's window. */
  stepHours: number;
  /** The card's total, from `options.total`. */
  total?: number;
  /** Every plotted value is zero (or missing). */
  flat: boolean;
  /** Nothing to show in the range. */
  empty: boolean;
};

/** A ref's value in one trace aggregate row set (ungrouped: one row). */
function fromRows(rows: TraceAggregateRow[], ref: ValueRef) {
  const { measure } = ref;
  if (!measure) return undefined;
  const values = rows.flatMap(r => measureOf(r.measures, measure) ?? []);
  return values.length ? values.reduce((a, b) => a + b, 0) : undefined;
}

/** A ref's value over the whole range, from a totals query or the sum of its buckets. */
function rangeValue(answer: DashboardAnswer | undefined, ref: ValueRef, perBucket: (number | undefined)[] | undefined) {
  const aggregate = rowsOf(answer);
  if (aggregate && !aggregate.rows.some(r => r.bucket)) return fromRows(aggregate.rows, ref) ?? 0;
  const value = valueOf(answer);
  if (value) return (ref.field === 'estimatedCost' ? value.estimatedCost : value.value) ?? undefined;
  return perBucket?.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

/**
 * Lays a timeseries view's answers on the chart's bucket grid. `chart` buckets add every point that
 * falls in a bucket (missing is 0); `api` buckets take the API's point (missing stays unset).
 */
export function shapeTimeseries({
  options,
  responses,
  window,
  hasTraceQueries,
}: {
  options: TimeseriesOptions;
  /** Each query's answer, by query id. */
  responses: ReadonlyMap<string, DashboardAnswer | undefined>;
  window: Window;
  hasTraceQueries: boolean;
}): ShapedTimeseries {
  const plan = bucketPlan(window.start, window.end);
  const merged = !hasTraceQueries && (options.buckets ?? 'chart') === 'chart';
  const stepHours = merged ? plan.stepHours : intervalHours(plan.interval);
  const grid: BucketLabels[] = bucketGrid(window.start, window.end, stepHours);
  const indexOf = gridIndex(grid, stepHours);
  const totals = new Set(options.totals ?? []);

  const cache = new Map<string, (number | undefined)[]>();
  const bucketed = (ref: ValueRef): (number | undefined)[] => {
    const key = JSON.stringify(ref);
    const hit = cache.get(key);
    if (hit) return hit;
    const values: (number | undefined)[] = grid.map(() => (merged ? 0 : undefined));
    const answer = responses.get(ref.query);
    const aggregate = rowsOf(answer);
    if (aggregate) {
      bucketTraceAggregateRows(aggregate.rows, window).forEach((b, i) => {
        values[i] = fromRows(b.rows, ref) ?? 0;
      });
    }
    for (const s of seriesOf(answer) ?? []) {
      if (ref.percentile !== undefined && s.percentile !== ref.percentile) continue;
      if (!matchesGroups(ref, s.name ?? '')) continue;
      for (const p of s.points) {
        const i = indexOf(p);
        if (i === undefined) continue;
        const v = ref.field === 'estimatedCost' ? (p.estimatedCost ?? 0) : p.value;
        // Every series the ref matches adds up (e.g. a grouped count); `api` buckets stay unset until one answers.
        values[i] = (values[i] ?? 0) + v;
      }
    }
    cache.set(key, values);
    return values;
  };
  const rangeOf = (ref: ValueRef) =>
    rangeValue(responses.get(ref.query), ref, totals.has(ref.query) ? undefined : bucketed(ref)) ?? 0;
  const overRange = (expr: ValueExpr) => evaluate(expr, rangeOf) ?? 0;

  const perSeries = options.series.map(s => {
    const values = grid.map((_, i) => {
      const v = evaluate(s.value, ref => bucketed(ref)[i]);
      return v === undefined ? undefined : s.round ? Math.round(v) : v;
    });
    const sum = values.reduce<number>((a, v) => a + (v ?? 0), 0);
    return { s, values, rangeTotal: s.rangeTotal ? overRange(s.rangeTotal) : undefined, sum };
  });

  const shown = perSeries.filter(p => !options.hideEmpty || (p.rangeTotal ?? p.sum) > 0);
  const data: ChartBucket[] = grid.map((labels, i) => {
    const bucket: ChartBucket = { ...labels };
    for (const p of shown) {
      const v = p.values[i];
      if (v !== undefined) bucket[p.s.dataKey] = v;
    }
    return bucket;
  });

  let total: number | undefined;
  const spec = options.total?.value;
  if (spec === 'total') total = shown.reduce((a, p) => a + p.sum, 0);
  else if (spec && 'peak' in spec) {
    const peak = perSeries.find(p => p.s.dataKey === spec.peak);
    total = Math.max(0, ...(peak?.values ?? []).map(v => v ?? 0));
  } else if (spec) total = overRange(spec);

  const flat = shown.every(p => p.values.every(v => !v));
  return {
    data,
    series: shown.map((p, i) => ({
      ...p.s,
      emphasis: options.emphasizeFirst ? i === 0 : p.s.emphasis,
      rangeTotal: p.rangeTotal,
    })),
    stepHours,
    total,
    flat,
    empty: options.emptyWhenZero ? overRange(options.emptyWhenZero) === 0 : flat,
  };
}

/** Aggregations whose values for several groups add up to the value for all of them. */
const ADDITIVE = new Set<string>(['sum', 'count']);

/**
 * What the schema can't say: query ids the view has, bucketed queries that leave their interval to the
 * chart's grid, refs that pick one of the percentiles their query asks for, and refs that pick one group
 * of a grouped aggregation that can't be added up.
 */
export function timeseriesIssues(options: TimeseriesOptions, queries: readonly DashboardQuery[]): string[] {
  const exprs = options.series.flatMap(s => (s.rangeTotal ? [s.value, s.rangeTotal] : [s.value]));
  const total = options.total?.value;
  if (total && total !== 'total' && !('peak' in total)) exprs.push(total);
  if (options.emptyWhenZero) exprs.push(options.emptyWhenZero);
  const refs = exprs.flatMap(exprRefs);
  const totals = new Set(options.totals ?? []);
  const byId = new Map(queries.map(q => [q.id, q]));

  // The chart lays every query on one grid built from the page's range; a query's own interval would
  // land its points in the wrong buckets.
  const ownIntervals = queries
    .filter(q => q.id !== undefined && !totals.has(q.id) && 'interval' in q && q.interval !== undefined)
    .map(q => `query '${q.id}' sets its own interval; the chart's buckets follow the page's range`);
  // Percentiles of one metric can't be added up, so a ref must pick one when its query asks for several.
  const ambiguousPercentiles = refs
    .filter(r => {
      const query = byId.get(r.query);
      return (
        r.percentile === undefined &&
        query !== undefined &&
        'request' in query &&
        query.request === 'percentiles' &&
        query.percentiles.length > 1
      );
    })
    .map(r => `a value reading query '${r.query}' must pick one of its percentiles`);
  const missingPercentiles = refs
    .filter(r => {
      const query = byId.get(r.query);
      return (
        r.percentile !== undefined &&
        query !== undefined &&
        'request' in query &&
        query.request === 'percentiles' &&
        !query.percentiles.includes(r.percentile)
      );
    })
    .map(r => `a value reading query '${r.query}' picks percentile ${r.percentile}, which the query doesn't ask for`);
  // Every series a ref matches adds up, which is only right for counts and sums.
  const mixedGroups = refs
    .filter(r => {
      const query = byId.get(r.query);
      return (
        r.groups?.length !== 1 &&
        query !== undefined &&
        'request' in query &&
        query.request === 'timeSeries' &&
        (query.groupBy?.length ?? 0) > 0 &&
        !ADDITIVE.has(query.aggregation)
      );
    })
    .map(r => `a value reading query '${r.query}' must pick one group, since its groups' values can't be added up`);

  return [
    ...unknownQueryIssues(
      refs.map(r => r.query),
      queries,
    ),
    ...unknownQueryIssues(options.totals ?? [], queries, 'options.totals'),
    ...ownIntervals,
    ...new Set(ambiguousPercentiles),
    ...new Set(missingPercentiles),
    ...new Set(mixedGroups),
  ];
}
