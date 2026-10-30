import type { DashboardQuery } from '@mastra/client-js';
import { z } from 'zod/v4';
import type { AggregateValue } from '../../lib/answers';
import { exprRefs, unknownQueryIssues, valueExprSchema } from '../../lib/values';
import type { ValueExpr, ValueRef } from '../../lib/values';
import type { ResolvedView } from '../../widget-kind';

const kpiItemSchema = z
  .object({
    label: z.string().min(1),
    icon: z.enum(['bot', 'coins', 'hash', 'threads']),
    format: z.enum(['count', 'usd']),
    /** A metrics or scores aggregate value, or the sum of several. Comparing needs `compare` on the queries. */
    value: valueExprSchema,
    detail: z.string(),
    lowerIsBetter: z.boolean().optional(),
  })
  .strict();

export const kpisOptionsSchema = z.object({ items: z.array(kpiItemSchema).min(1) }).strict();

export type KpisOptions = z.infer<typeof kpisOptionsSchema>;

export type KpiFigures = { value?: number; previous?: number; change?: number };

/** One aggregate's figures: its value (or price) now, before, and the change the API reports. */
function refFigures(response: AggregateValue | undefined, ref: ValueRef): KpiFigures {
  if (ref.field === 'estimatedCost') {
    return {
      value: response?.estimatedCost ?? undefined,
      previous: response?.previousEstimatedCost ?? undefined,
      change: response?.costChangePercent ?? undefined,
    };
  }
  return {
    value: response?.value ?? undefined,
    previous: response?.previousValue ?? undefined,
    change: response?.changePercent ?? undefined,
  };
}

/**
 * A KPI's figures. A single aggregate keeps the API's own change; a sum adds the parts and works
 * out the change from the summed previous value, as the Tokens KPI does.
 */
export function kpiFigures(expr: ValueExpr, responses: ReadonlyMap<string, AggregateValue | undefined>): KpiFigures {
  if (!('sum' in expr)) {
    const [ref] = exprRefs(expr);
    return ref ? refFigures(responses.get(ref.query), ref) : {};
  }
  const parts = expr.sum.map(e => kpiFigures(e, responses));
  const hasCurrent = parts.some(p => p.value !== undefined);
  const hasPrevious = parts.some(p => p.previous !== undefined);
  const value = parts.reduce((a, p) => a + (p.value ?? 0), 0);
  const previous = parts.reduce((a, p) => a + (p.previous ?? 0), 0);
  return {
    value: hasCurrent ? value : undefined,
    previous: hasPrevious ? previous : undefined,
    change: hasPrevious && previous > 0 ? ((value - previous) / previous) * 100 : undefined,
  };
}

const readsAggregates = (expr: ValueExpr): boolean =>
  'query' in expr || ('sum' in expr && expr.sum.every(readsAggregates));

const isAggregate = (query: DashboardQuery | undefined) =>
  (query?.source === 'metrics' || query?.source === 'scores') && query.request === 'aggregate';

/** What the schema can't say: query ids the view has, and only metrics or scores aggregates, or sums of them. */
export const kpisIssues = (view: ResolvedView<KpisOptions>) => {
  const byId = new Map(view.queries.map(q => [q.id, q]));
  return [
    ...unknownQueryIssues(
      view.options.items.flatMap(i => exprRefs(i.value).map(r => r.query)),
      view.queries,
    ),
    ...view.options.items
      .filter(i => !readsAggregates(i.value))
      .map(i => `KPI '${i.label}' can only read an aggregate or sum several`),
    ...view.options.items.flatMap(i =>
      exprRefs(i.value)
        .filter(r => byId.has(r.query) && !isAggregate(byId.get(r.query)))
        .map(r => `KPI '${i.label}' reads query '${r.query}', which is not a metrics or scores aggregate`),
    ),
  ];
};
