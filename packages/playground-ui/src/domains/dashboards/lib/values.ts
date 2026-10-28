import { z } from 'zod/v4';

/**
 * The options vocabulary widget kinds share. Values reference a view's query results by index and
 * combine them with a few fixed operations; there are no free-form expressions.
 */

/** A number read from one query's result. */
export const valueRefSchema = z
  .object({
    /** Index into the view's `queries`. */
    query: z.number().int().min(0),
    /** Metrics and scores read `value` (or the price, `estimatedCost`); trace and span aggregates read a measure. */
    field: z.enum(['value', 'estimatedCost']).optional(),
    /** A trace or span aggregate measure, e.g. `countDistinct.threadId`. */
    measure: z.string().min(1).optional(),
    /** A percentile of a percentiles request, e.g. `0.95`. */
    percentile: z.number().min(0).max(1).optional(),
    /** Only the series whose group name contains one of these (case-insensitive)... */
    groupsIncluding: z.array(z.string().min(1)).min(1).optional(),
    /** ...or none of these. */
    groupsExcluding: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();

export type ValueRef = z.infer<typeof valueRefSchema>;

export type ValueExpr =
  | ValueRef
  | { sum: ValueExpr[] }
  /** The first minus the second, never below zero. */
  | { minus: [ValueExpr, ValueExpr] }
  /** `of / over`, 0 when `over` is 0. */
  | { ratio: { of: ValueExpr; over: ValueExpr } };

// Recursive through getters, as zod 4 recommends; `z.lazy` around a union recurses forever.
const sumSchema = z.strictObject({
  get sum() {
    return z.array(valueExprSchema).min(1);
  },
});
const minusSchema = z.strictObject({
  get minus() {
    return z.tuple([valueExprSchema, valueExprSchema]);
  },
});
const ratioSchema = z.strictObject({
  get ratio() {
    return z.strictObject({ of: valueExprSchema, over: valueExprSchema });
  },
});

export const valueExprSchema: z.ZodType<ValueExpr> = z.union([valueRefSchema, sumSchema, minusSchema, ratioSchema]);

export const VALUE_FORMATS = ['count', 'usd', 'duration', 'percent', 'score'] as const;
export const formatSchema = z.enum(VALUE_FORMATS);
export type ValueFormat = z.infer<typeof formatSchema>;

export const CHART_COLOR_NAMES = ['green', 'sky', 'violet', 'teal', 'indigo', 'warning', 'error', 'neutral'] as const;
export const colorSchema = z.enum(CHART_COLOR_NAMES);

/** Every ref an expression reads, in order. */
export function exprRefs(expr: ValueExpr): ValueRef[] {
  if ('sum' in expr) return expr.sum.flatMap(exprRefs);
  if ('minus' in expr) return expr.minus.flatMap(exprRefs);
  if ('ratio' in expr) return [...exprRefs(expr.ratio.of), ...exprRefs(expr.ratio.over)];
  return [expr];
}

/** Evaluates an expression, reading each ref through `read`; `undefined` when every ref is. */
export function evaluate(expr: ValueExpr, read: (ref: ValueRef) => number | undefined): number | undefined {
  if ('sum' in expr) {
    const parts = expr.sum.map(e => evaluate(e, read));
    return parts.every(p => p === undefined) ? undefined : parts.reduce<number>((total, p) => total + (p ?? 0), 0);
  }
  if ('minus' in expr) {
    const [a, b] = expr.minus.map(e => evaluate(e, read));
    if (a === undefined && b === undefined) return undefined;
    return Math.max((a ?? 0) - (b ?? 0), 0);
  }
  if ('ratio' in expr) {
    const of = evaluate(expr.ratio.of, read);
    const over = evaluate(expr.ratio.over, read);
    if (of === undefined && over === undefined) return undefined;
    return over ? (of ?? 0) / over : 0;
  }
  return read(expr);
}

/** Whether a series named `name` is one a ref reads. */
export function matchesGroups(ref: ValueRef, name: string) {
  const lower = name.toLowerCase();
  const has = (parts: string[]) => parts.some(p => lower.includes(p.toLowerCase()));
  if (ref.groupsIncluding && !has(ref.groupsIncluding)) return false;
  if (ref.groupsExcluding && has(ref.groupsExcluding)) return false;
  return true;
}

/** Query indexes an expression reads that are out of range for a view with `count` queries. */
export function outOfRangeQueries(exprs: ValueExpr[], count: number) {
  return exprs.flatMap(exprRefs).filter(r => r.query >= count);
}
