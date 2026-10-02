import { describe, expectTypeOf, it } from 'vitest';
import type {
  TRACE_AGGREGATE_FIXED_MEASURES,
  TraceAggregateMeasure,
  TraceAggregateRow,
  TraceAggregateRowCost,
} from './trace-aggregate';

type FixedMeasure = (typeof TRACE_AGGREGATE_FIXED_MEASURES)[number];

/**
 * The measure-name grammar must survive type inference: a plain `.refine()` on
 * `z.string()` would widen `TraceAggregateMeasure` to `string`, so the public
 * request and response types would silently accept names the parser rejects.
 */
describe('TraceAggregateMeasure type', () => {
  it('keeps the fixed literals and the countDistinct.<field> pattern', () => {
    expectTypeOf<TraceAggregateMeasure>().toEqualTypeOf<FixedMeasure | `countDistinct.${string}`>();
    expectTypeOf<TraceAggregateMeasure>().not.toEqualTypeOf<string>();
    expectTypeOf<'countDistinct.threadId'>().toMatchTypeOf<TraceAggregateMeasure>();
    expectTypeOf<'cost.sum'>().toMatchTypeOf<TraceAggregateMeasure>();
    expectTypeOf<'tokens.total.avg'>().toMatchTypeOf<TraceAggregateMeasure>();
    expectTypeOf<'cost.coverage'>().not.toMatchTypeOf<TraceAggregateMeasure>();
    expectTypeOf<'costUnit'>().not.toMatchTypeOf<TraceAggregateMeasure>();
  });

  it('keys response measures by measure name with numeric or null values', () => {
    expectTypeOf<keyof TraceAggregateRow['measures']>().toEqualTypeOf<TraceAggregateMeasure>();
    expectTypeOf<TraceAggregateRow['measures']['count']>().toEqualTypeOf<number | null>();
    expectTypeOf<TraceAggregateRow['cost']>().toEqualTypeOf<TraceAggregateRowCost | undefined>();
    expectTypeOf<TraceAggregateRowCost>().toEqualTypeOf<{ coverage: number | null; unit: string | null }>();
  });
});
