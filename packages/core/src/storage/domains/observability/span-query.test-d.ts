import { expectTypeOf, test } from 'vitest';
import type { SpanQueryRequest, SpanQueryRow, TrustedSpanQueryPlan } from './span-query';
import type { TrustedTraceQueryScalarPredicate } from './trace-query';

test('the span contract shares scalar predicates and keeps authorization outside caller input', () => {
  expectTypeOf<TrustedSpanQueryPlan['where']>().toEqualTypeOf<TrustedTraceQueryScalarPredicate | undefined>();
  expectTypeOf<SpanQueryRequest>().not.toHaveProperty('scope');
  expectTypeOf<SpanQueryRequest>().not.toHaveProperty('authorizationBinding');
  expectTypeOf<SpanQueryRow>().not.toHaveProperty('input');
  expectTypeOf<SpanQueryRow>().not.toHaveProperty('output');
  expectTypeOf<SpanQueryRow['cost']>().toEqualTypeOf<
    { state: 'available'; amount: number; currency: string } | { state: 'missing' } | { state: 'unavailable' }
  >();
});
