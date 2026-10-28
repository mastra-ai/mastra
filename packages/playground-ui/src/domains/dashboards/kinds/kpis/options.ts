import { z } from 'zod/v4';
import { exprRefs, outOfRangeQueries, valueExprSchema } from '../../lib/values';
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

export type Aggregate = {
  value?: number | null;
  previousValue?: number | null;
  changePercent?: number | null;
  estimatedCost?: number | null;
  previousEstimatedCost?: number | null;
  costChangePercent?: number | null;
};

export type KpiFigures = { value: number | null; previous: number | null; change: number | null };

/** One aggregate's figures: its value (or price) now, before, and the change the API reports. */
function refFigures(response: Aggregate | undefined, ref: ValueRef): KpiFigures {
  if (ref.field === 'estimatedCost') {
    return {
      value: response?.estimatedCost ?? null,
      previous: response?.previousEstimatedCost ?? null,
      change: response?.costChangePercent ?? null,
    };
  }
  return {
    value: response?.value ?? null,
    previous: response?.previousValue ?? null,
    change: response?.changePercent ?? null,
  };
}

/**
 * A KPI's figures. A single aggregate keeps the API's own change; a sum adds the parts and works
 * out the change from the summed previous value, as the Tokens KPI does.
 */
export function kpiFigures(expr: ValueExpr, responses: (Aggregate | undefined)[]): KpiFigures {
  if (!('sum' in expr)) {
    const [ref] = exprRefs(expr);
    return ref ? refFigures(responses[ref.query], ref) : { value: null, previous: null, change: null };
  }
  const parts = expr.sum.map(e => kpiFigures(e, responses));
  const hasCurrent = parts.some(p => p.value != null);
  const hasPrevious = parts.some(p => p.previous != null);
  const value = parts.reduce((a, p) => a + (p.value ?? 0), 0);
  const previous = parts.reduce((a, p) => a + (p.previous ?? 0), 0);
  return {
    value: hasCurrent ? value : null,
    previous: hasPrevious ? previous : null,
    change: hasPrevious && previous > 0 ? ((value - previous) / previous) * 100 : null,
  };
}

/** What the schema can't say: query indexes in range, and only aggregates or sums. */
export const kpisIssues = (view: ResolvedView<KpisOptions>) => [
  ...outOfRangeQueries(
    view.options.items.map(i => i.value),
    view.queries.length,
  ).map(r => `options reference query ${r.query}, which the view doesn't have`),
  ...view.options.items
    .filter(i => 'minus' in i.value || 'ratio' in i.value)
    .map(i => `KPI '${i.label}' can only read an aggregate or sum several`),
];
