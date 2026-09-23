import { describe, expectTypeOf, it } from 'vitest';
import type { TraceAggregateMeasure } from './trace-aggregate';
import type { TrustedTraceAggregateOrderBy, TrustedTraceAggregatePlan } from './trace-aggregate-planner';
import type { TraceAggregateDimension } from './trace-aggregate-registry';

/**
 * The plan must stay narrower than the request: measure names and dimensions are the
 * registry unions, never `string`, so backend compilers cannot receive an unmapped name.
 */
describe('TrustedTraceAggregatePlan type', () => {
  it('narrows measure names to the registry unions', () => {
    type PlannedMeasureName = TrustedTraceAggregatePlan['measures'][number]['name'];
    expectTypeOf<PlannedMeasureName>().toMatchTypeOf<TraceAggregateMeasure>();
    expectTypeOf<string>().not.toMatchTypeOf<PlannedMeasureName>();
    expectTypeOf<'countDistinct.anything'>().not.toMatchTypeOf<PlannedMeasureName>();
    expectTypeOf<TrustedTraceAggregatePlan['dimensions'][number]>().toEqualTypeOf<TraceAggregateDimension>();
  });

  it('discriminates orderBy on target', () => {
    expectTypeOf<Extract<TrustedTraceAggregateOrderBy, { target: 'dimension' }>>().toHaveProperty('dimension');
    expectTypeOf<Extract<TrustedTraceAggregateOrderBy, { target: 'measure' }>>().toHaveProperty('measure');
    expectTypeOf<Extract<TrustedTraceAggregateOrderBy, { target: 'measure' }>>().not.toHaveProperty('dimension');
  });
});
