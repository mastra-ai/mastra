import type { DashboardQuery } from '@mastra/client-js';
import { z } from 'zod/v4';
import { measureOf, rowsOf, valueOf } from '../../lib/answers';
import type { DashboardAnswer } from '../../lib/requests';
import { evaluate, exprRefs, formatSchema, unknownQueryIssues, valueExprSchema } from '../../lib/values';
import type { ValueExpr, ValueRef } from '../../lib/values';
import type { ResolvedView } from '../../widget-kind';

export const KPI_ICONS = ['bot', 'coins', 'hash', 'threads'] as const;
export type KpiIcon = (typeof KPI_ICONS)[number];

export const kpiItemSchema = z
  .object({
    label: z.string().min(1),
    icon: z.enum(KPI_ICONS).optional(),
    format: formatSchema,
    /**
     * Aggregates combined with the value operations: metrics and scores aggregates, or ungrouped trace
     * and span aggregates (whose measures include percentiles such as `duration.p95`). Comparing needs
     * `compare` on the queries.
     */
    value: valueExprSchema,
    detail: z.string().optional(),
    lowerIsBetter: z.boolean().optional(),
  })
  .strict();

export const kpisOptionsSchema = z.object({ items: z.array(kpiItemSchema).min(1) }).strict();

export type KpisOptions = z.infer<typeof kpisOptionsSchema>;
export type KpiItem = z.infer<typeof kpiItemSchema>;

export type KpiFigures = { value?: number; previous?: number; change?: number };

/** One query's answers: the page's window, and the previous window when it's a request of its own. */
export type KpiAnswers = { current?: DashboardAnswer; previous?: DashboardAnswer };

const changeOf = (value: number | undefined, previous: number | undefined) =>
  value !== undefined && previous !== undefined && previous !== 0
    ? ((value - previous) / Math.abs(previous)) * 100
    : undefined;

const countsOrSums = (measure: string) =>
  measure === 'count' ||
  measure === 'errorCount' ||
  measure.endsWith('.sum') ||
  measure.endsWith('.count') ||
  measure.startsWith('countDistinct.');

/**
 * An ungrouped trace or span aggregate's one row, read at `ref`'s measure. A window with nothing in it
 * answers no rows at all, which is 0 for a count or sum, and no figure for an average, rate or percentile.
 */
const rowMeasure = (answer: DashboardAnswer | undefined, ref: ValueRef) => {
  const rows = rowsOf(answer)?.rows;
  if (!rows || !ref.measure) return undefined;
  const row = rows[0];
  if (!row) return countsOrSums(ref.measure) ? 0 : undefined;
  return measureOf(row.measures, ref.measure);
};

/**
 * One ref's figures. A metrics or scores aggregate answers its previous value and change itself; a trace
 * or span aggregate reads the previous window's own answer.
 */
function refFigures(ref: ValueRef, answers: KpiAnswers | undefined): KpiFigures {
  const aggregate = valueOf(answers?.current);
  if (aggregate && ref.field === 'estimatedCost') {
    return {
      value: aggregate.estimatedCost ?? undefined,
      previous: aggregate.previousEstimatedCost ?? undefined,
      change: aggregate.costChangePercent ?? undefined,
    };
  }
  if (aggregate) {
    return {
      value: aggregate.value ?? undefined,
      previous: aggregate.previousValue ?? undefined,
      change: aggregate.changePercent ?? undefined,
    };
  }
  const value = rowMeasure(answers?.current, ref);
  const previous = rowMeasure(answers?.previous, ref);
  return { value, previous, change: changeOf(value, previous) };
}

/**
 * A KPI's figures. A single ref keeps the API's own change; any other expression is evaluated over
 * the page's window and over the previous one, and the change is worked out from the two. Only when
 * every part with a figure now has one before, too: a part that doesn't compare would otherwise
 * count as 0 in the previous window and show a change that isn't there.
 */
export function kpiFigures(expr: ValueExpr, answers: ReadonlyMap<string, KpiAnswers | undefined>): KpiFigures {
  if ('query' in expr) return refFigures(expr, answers.get(expr.query));
  const figures = (ref: ValueRef) => refFigures(ref, answers.get(ref.query));
  const value = evaluate(expr, ref => figures(ref).value);
  const comparable = exprRefs(expr).every(ref => {
    const { value, previous } = figures(ref);
    return value === undefined || previous !== undefined;
  });
  const previous = comparable ? evaluate(expr, ref => figures(ref).previous) : undefined;
  return { value, previous, change: changeOf(value, previous) };
}

const isTraceAggregate = (query: DashboardQuery) =>
  query.source === 'traceAggregate' || query.source === 'spanAggregate';

const isAggregate = (query: DashboardQuery) =>
  isTraceAggregate(query) ||
  ((query.source === 'metrics' || query.source === 'scores') && query.request === 'aggregate');

/**
 * What the schema can't say: query ids the view has, and only aggregates that answer one figure: metrics
 * or scores aggregates (scores naming a scorer), or trace and span aggregates that neither group nor
 * bucket, read at a measure they request.
 */
export const kpisIssues = (view: ResolvedView<KpisOptions>) => {
  const byId = new Map(view.queries.map(q => [q.id, q]));
  const refIssues = (label: string, ref: ValueRef): string[] => {
    const query = byId.get(ref.query);
    if (!query) return [];
    const reads = `KPI '${label}' reads query '${ref.query}'`;
    if (!isAggregate(query)) return [`${reads}, which is not an aggregate`];
    // A KPI shows one figure, so it can't discover scorers the way the scores widget does.
    if (query.source === 'scores' && query.scorerId === undefined)
      return [`KPI '${label}' reads scores query '${ref.query}', which must name a scorer`];
    if (!isTraceAggregate(query)) return [];
    if (query.groupBy?.length || query.interval !== undefined) {
      return [`${reads}, which groups or buckets its rows; a KPI shows one figure`];
    }
    if (ref.measure === undefined || !(query.measures as readonly string[]).includes(ref.measure)) {
      return [`${reads} without naming one of its measures`];
    }
    return [];
  };
  return [
    ...unknownQueryIssues(
      view.options.items.flatMap(i => exprRefs(i.value).map(r => r.query)),
      view.queries,
    ),
    ...view.options.items.flatMap(i => exprRefs(i.value).flatMap(r => refIssues(i.label, r))),
  ];
};
