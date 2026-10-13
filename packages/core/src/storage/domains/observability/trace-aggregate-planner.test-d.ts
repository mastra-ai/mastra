import { describe, expectTypeOf, it } from 'vitest';
import type { ObservabilityStorage, ObservabilityStorageFeature } from './base';
import type { TraceAggregateMeasure, TraceAggregateResponse } from './trace-aggregate';
import type {
  TrustedTraceAggregateHavingPredicate,
  TrustedTraceAggregateOrderBy,
  TrustedTraceAggregatePlan,
} from './trace-aggregate-planner';
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

  it('narrows having and orderBy measure references the same way', () => {
    type PlannedMeasureName = TrustedTraceAggregatePlan['measures'][number]['name'];
    type HavingMeasure = Extract<TrustedTraceAggregateHavingPredicate, { measure: unknown }>['measure'];
    type OrderByMeasure = Extract<TrustedTraceAggregateOrderBy, { target: 'measure' }>['measure'];
    expectTypeOf<HavingMeasure>().toEqualTypeOf<PlannedMeasureName>();
    expectTypeOf<OrderByMeasure>().toEqualTypeOf<PlannedMeasureName>();
    expectTypeOf<'countDistinct.anything'>().not.toMatchTypeOf<HavingMeasure>();
    expectTypeOf<'countDistinct.anything'>().not.toMatchTypeOf<OrderByMeasure>();
  });

  it('discriminates orderBy on target', () => {
    expectTypeOf<Extract<TrustedTraceAggregateOrderBy, { target: 'dimension' }>>().toHaveProperty('dimension');
    expectTypeOf<Extract<TrustedTraceAggregateOrderBy, { target: 'measure' }>>().toHaveProperty('measure');
    expectTypeOf<Extract<TrustedTraceAggregateOrderBy, { target: 'measure' }>>().not.toHaveProperty('dimension');
  });
});

describe('trace-aggregate storage capability type', () => {
  it('declares trace-aggregate as a storage feature', () => {
    expectTypeOf<'trace-aggregate'>().toMatchTypeOf<ObservabilityStorageFeature>();
  });

  it('types aggregateTraces over the trusted plan and aggregate response', () => {
    expectTypeOf<ObservabilityStorage['aggregateTraces']>().parameters.toEqualTypeOf<[TrustedTraceAggregatePlan]>();
    expectTypeOf<ObservabilityStorage['aggregateTraces']>().returns.toEqualTypeOf<Promise<TraceAggregateResponse>>();
  });
});
