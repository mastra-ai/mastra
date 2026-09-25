import { describe, expectTypeOf, it } from 'vitest';
import type { TRACE_AGGREGATE_FIXED_MEASURES, TraceAggregateMeasure, TraceAggregateRow } from './trace-aggregate';

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
    expectTypeOf<'cost.sum'>().not.toMatchTypeOf<TraceAggregateMeasure>();
  });

  it('keys response measures by measure name', () => {
    expectTypeOf<keyof TraceAggregateRow['measures']>().toEqualTypeOf<TraceAggregateMeasure>();
  });
});
