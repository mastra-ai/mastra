import { describe, expectTypeOf, it } from 'vitest';
import type { ObservabilityStorage, ObservabilityStorageFeature } from './base';
import type {
  SpanAggregateDimension,
  SpanAggregateResponse,
  TrustedSpanAggregateHavingPredicate,
  TrustedSpanAggregateOrderBy,
  TrustedSpanAggregatePlan,
} from './span-aggregate';
import type { TraceAggregateMeasure } from './trace-aggregate';

describe('TrustedSpanAggregatePlan type', () => {
  it('narrows measures and dimensions to the span registries', () => {
    type Name = TrustedSpanAggregatePlan['measures'][number]['name'];
    expectTypeOf<Name>().toMatchTypeOf<TraceAggregateMeasure>();
    expectTypeOf<string>().not.toMatchTypeOf<Name>();
    expectTypeOf<'countDistinct.traceId'>().toMatchTypeOf<Name>();
    expectTypeOf<'countDistinct.rootEntityName'>().toMatchTypeOf<Name>();
    expectTypeOf<'countDistinct.spanId'>().not.toMatchTypeOf<Name>();
    expectTypeOf<'countDistinct.metadata.tenant'>().not.toMatchTypeOf<Name>();
    expectTypeOf<TrustedSpanAggregatePlan['dimensions'][number]>().toEqualTypeOf<SpanAggregateDimension>();
    expectTypeOf<'metadata.tenant'>().not.toMatchTypeOf<SpanAggregateDimension>();
    expectTypeOf<'model' | 'provider'>().not.toMatchTypeOf<SpanAggregateDimension>();
    expectTypeOf<'parentEntityName' | 'rootEntityType'>().toMatchTypeOf<SpanAggregateDimension>();
  });

  it('narrows having and orderBy references the same way', () => {
    type Name = TrustedSpanAggregatePlan['measures'][number]['name'];
    expectTypeOf<Extract<TrustedSpanAggregateHavingPredicate, { measure: unknown }>['measure']>().toEqualTypeOf<Name>();
    expectTypeOf<Extract<TrustedSpanAggregateOrderBy, { target: 'measure' }>['measure']>().toEqualTypeOf<Name>();
    expectTypeOf<
      Extract<TrustedSpanAggregateOrderBy, { target: 'dimension' }>['dimension']
    >().toEqualTypeOf<SpanAggregateDimension>();
  });

  it('is a storage operation behind its own feature', () => {
    expectTypeOf<'span-aggregate'>().toMatchTypeOf<ObservabilityStorageFeature>();
    expectTypeOf<ObservabilityStorage['aggregateSpans']>().parameters.toEqualTypeOf<[TrustedSpanAggregatePlan]>();
    expectTypeOf<ObservabilityStorage['aggregateSpans']>().returns.resolves.toEqualTypeOf<SpanAggregateResponse>();
  });
});
