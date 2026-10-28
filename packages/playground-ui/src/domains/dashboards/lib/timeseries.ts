import { z } from 'zod/v4';
import type { BucketLabels } from '../../metrics/lib/bucket-labels';
import { bucketGrid, bucketPlan, gridIndex, intervalHours } from '../../metrics/lib/metrics-buckets';
import type { ApiInterval } from '../../metrics/lib/metrics-buckets';
import { bucketTraceAggregateRows } from '../../metrics/lib/trace-aggregate';
import type { TraceAggregateRow } from '../../metrics/lib/trace-aggregate';
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
    /** Shown beside the series in the legend, over the whole range (e.g. a range total). */
    legendValue: valueExprSchema.optional(),
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
    /** Hides a series whose legend value (or range total) is zero. */
    hideEmpty: z.boolean().optional(),
    /** Emphasizes the first series shown. */
    emphasizeFirst: z.boolean().optional(),
    xLabels: z.literal('edges').optional(),
    /** The y-axis range when every plotted value is zero. */
    flatYDomain: z.tuple([z.number(), z.number()]).optional(),
    yDomain: z.tuple([z.number(), z.number()]).optional(),
    summary: z
      .object({
        label: z.string().min(1),
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

type Point = { timestamp: string | Date; value: number; estimatedCost?: number | null };
type MetricsSeriesResponse = { series: { name?: string; percentile?: number; points: Point[] }[] };
type AggregateResponse = { rows: TraceAggregateRow[] };
type ValueResponse = { value?: number | null; estimatedCost?: number | null };

type Window = { start: Date; end: Date };

export type ChartBucket = BucketLabels & Record<string, number | string | undefined>;

export type ShapedTimeseries = {
  data: ChartBucket[];
  /** The series shown, with their legend values. */
  series: (TimeseriesSeries & { legend?: number })[];
  /** Hours per bucket, for a clicked bucket's window. */
  stepHours: number;
  summary?: number;
  /** Every plotted value is zero (or missing). */
  flat: boolean;
  /** Nothing to show in the range. */
  empty: boolean;
};

const isTraceRows = (response: unknown): response is AggregateResponse =>
  typeof response === 'object' && response !== null && 'rows' in response;
const isSeries = (response: unknown): response is MetricsSeriesResponse =>
  typeof response === 'object' && response !== null && 'series' in response;

/** A ref's value in one trace aggregate row set (ungrouped: one row). */
function fromRows(rows: TraceAggregateRow[], ref: ValueRef) {
  if (!ref.measure) return undefined;
  const values = rows.map(r => r.measures[ref.measure as keyof typeof r.measures]).filter(v => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) : undefined;
}

/** A ref's value over the whole range, from a totals query or the sum of its buckets. */
function rangeValue(response: unknown, ref: ValueRef, perBucket: (number | undefined)[] | undefined) {
  if (isTraceRows(response) && !response.rows.some(r => r.bucket)) return fromRows(response.rows, ref) ?? 0;
  if (response && typeof response === 'object' && 'value' in response) {
    const r = response as ValueResponse;
    return (ref.field === 'estimatedCost' ? r.estimatedCost : r.value) ?? undefined;
  }
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
  responses: ReadonlyMap<string, unknown>;
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
    const response = responses.get(ref.query);
    if (isTraceRows(response)) {
      bucketTraceAggregateRows(response.rows, window).forEach((b, i) => {
        values[i] = fromRows(b.rows, ref) ?? 0;
      });
    } else if (isSeries(response)) {
      for (const s of response.series) {
        if (ref.percentile !== undefined && s.percentile !== ref.percentile) continue;
        if (!matchesGroups(ref, s.name ?? '')) continue;
        for (const p of s.points) {
          const i = indexOf(p);
          if (i === undefined) continue;
          const v = ref.field === 'estimatedCost' ? (p.estimatedCost ?? 0) : p.value;
          values[i] = merged ? (values[i] ?? 0) + v : v;
        }
      }
    }
    cache.set(key, values);
    return values;
  };
  const total = (ref: ValueRef) =>
    rangeValue(responses.get(ref.query), ref, totals.has(ref.query) ? undefined : bucketed(ref)) ?? 0;
  const overRange = (expr: ValueExpr) => evaluate(expr, total) ?? 0;

  const perSeries = options.series.map(s => {
    const values = grid.map((_, i) => {
      const v = evaluate(s.value, ref => bucketed(ref)[i]);
      return v === undefined ? undefined : s.round ? Math.round(v) : v;
    });
    const sum = values.reduce<number>((a, v) => a + (v ?? 0), 0);
    return { s, values, legend: s.legendValue ? overRange(s.legendValue) : undefined, sum };
  });

  const shown = perSeries.filter(p => !options.hideEmpty || (p.legend ?? p.sum) > 0);
  const data: ChartBucket[] = grid.map((labels, i) => {
    const bucket: ChartBucket = { ...labels };
    for (const p of shown) {
      const v = p.values[i];
      if (v !== undefined) bucket[p.s.dataKey] = v;
    }
    return bucket;
  });

  let summary: number | undefined;
  const spec = options.summary?.value;
  if (spec === 'total') summary = shown.reduce((a, p) => a + p.sum, 0);
  else if (spec && 'peak' in spec) {
    const peak = perSeries.find(p => p.s.dataKey === spec.peak);
    summary = Math.max(0, ...(peak?.values ?? []).map(v => v ?? 0));
  } else if (spec) summary = overRange(spec);

  const flat = shown.every(p => p.values.every(v => !v));
  return {
    data,
    series: shown.map((p, i) => ({
      ...p.s,
      ...(options.emphasizeFirst ? { emphasis: i === 0 } : {}),
      ...(p.legend === undefined ? {} : { legend: p.legend }),
    })),
    stepHours,
    summary,
    flat,
    empty: options.emptyWhenZero ? overRange(options.emptyWhenZero) === 0 : flat,
  };
}

/** Query ids the view's options read that it doesn't have. */
export function timeseriesIssues(options: TimeseriesOptions, queries: readonly { id?: string }[]): string[] {
  const exprs = options.series.flatMap(s => [s.value, ...(s.legendValue ? [s.legendValue] : [])]);
  const summary = options.summary?.value;
  if (summary && summary !== 'total' && !('peak' in summary)) exprs.push(summary);
  if (options.emptyWhenZero) exprs.push(options.emptyWhenZero);
  return [
    ...unknownQueryIssues(
      exprs.flatMap(exprRefs).map(r => r.query),
      queries,
    ),
    ...unknownQueryIssues(options.totals ?? [], queries, 'options.totals'),
  ];
}
