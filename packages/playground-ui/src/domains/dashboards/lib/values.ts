import { z } from 'zod/v4';

/**
 * The options vocabulary widget kinds share. Values reference a view's query results and
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
    /** Only the series whose group key is exactly one of these... */
    groups: z.array(z.string()).min(1).optional(),
    /** ...or is none of these. */
    notGroups: z.array(z.string()).min(1).optional(),
  })
  .strict();

export type ValueRef = z.infer<typeof valueRefSchema>;

export type ValueExpr =
  | ValueRef
  | { const: number }
  | { sum: ValueExpr[] }
  /** The first minus the second. */
  | { minus: [ValueExpr, ValueExpr] }
  /** `of / over`; no value when `over` is 0 or has none. */
  | { ratio: { of: ValueExpr; over: ValueExpr } }
  /** The largest part that has a value. */
  | { max: ValueExpr[] }
  /** The first part that has a value. */
  | { coalesce: ValueExpr[] };

// Recursive through getters, as zod 4 recommends; `z.lazy` around a union recurses forever.
const constSchema = z.strictObject({ const: z.number() });
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
const maxSchema = z.strictObject({
  get max() {
    return z.array(valueExprSchema).min(1);
  },
});
const coalesceSchema = z.strictObject({
  get coalesce() {
    return z.array(valueExprSchema).min(1);
  },
});

export const valueExprSchema: z.ZodType<ValueExpr> = z.union([
  valueRefSchema,
  constSchema,
  sumSchema,
  minusSchema,
  ratioSchema,
  maxSchema,
  coalesceSchema,
]);

export const VALUE_FORMATS = ['count', 'usd', 'duration', 'percent', 'score'] as const;
export const formatSchema = z.enum(VALUE_FORMATS);
export type ValueFormat = z.infer<typeof formatSchema>;

export const CHART_COLOR_NAMES = ['green', 'sky', 'violet', 'teal', 'indigo', 'warning', 'error', 'neutral'] as const;
export const colorSchema = z.enum(CHART_COLOR_NAMES);

/** Every ref an expression reads, in order. */
export function exprRefs(expr: ValueExpr): ValueRef[] {
  if ('const' in expr) return [];
  if ('sum' in expr) return expr.sum.flatMap(exprRefs);
  if ('minus' in expr) return expr.minus.flatMap(exprRefs);
  if ('ratio' in expr) return [...exprRefs(expr.ratio.of), ...exprRefs(expr.ratio.over)];
  if ('max' in expr) return expr.max.flatMap(exprRefs);
  if ('coalesce' in expr) return expr.coalesce.flatMap(exprRefs);
  return [expr];
}

const defined = (values: (number | undefined)[]) => values.filter((v): v is number => v !== undefined);

/**
 * Evaluates an expression, reading each ref through `read`. A missing operand counts as 0 in `sum` and
 * `minus` while another has a value; the result is missing when every operand is.
 */
export function evaluate(expr: ValueExpr, read: (ref: ValueRef) => number | undefined): number | undefined {
  const run = (e: ValueExpr) => evaluate(e, read);
  if ('const' in expr) return expr.const;
  if ('sum' in expr) {
    const parts = expr.sum.map(run);
    return defined(parts).length ? parts.reduce<number>((total, p) => total + (p ?? 0), 0) : undefined;
  }
  if ('minus' in expr) {
    const [a, b] = expr.minus.map(run);
    return a === undefined && b === undefined ? undefined : (a ?? 0) - (b ?? 0);
  }
  if ('ratio' in expr) {
    const over = run(expr.ratio.over);
    if (!over) return undefined;
    return (run(expr.ratio.of) ?? 0) / over;
  }
  if ('max' in expr) {
    const parts = defined(expr.max.map(run));
    return parts.length ? Math.max(...parts) : undefined;
  }
  if ('coalesce' in expr) {
    for (const e of expr.coalesce) {
      const v = run(e);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  return read(expr);
}

/** Whether the series with group key `name` is one a ref reads. */
export function matchesGroups(ref: ValueRef, name: string) {
  if (ref.groups && !ref.groups.includes(name)) return false;
  if (ref.notGroups?.includes(name)) return false;
  return true;
}

/** Query indexes an expression reads that are out of range for a view with `count` queries. */
export function outOfRangeQueries(exprs: ValueExpr[], count: number) {
  return exprs.flatMap(exprRefs).filter(r => r.query >= count);
}
