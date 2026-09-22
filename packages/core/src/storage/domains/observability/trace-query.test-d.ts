import { expectTypeOf, test } from 'vitest';
import { encodeTraceQueryDeltaCursor } from './trace-query';
import type {
  TraceQueryExactMetadataPath,
  TraceQueryMetadataDotPath,
  TrustedThreadQueryPlan,
  TrustedTraceQueryDeltaTracesPlan,
  TrustedTraceQueryGroupsPlan,
  TrustedTraceQueryKeysetTracesPlan,
  TrustedTraceQueryPaginatedTracesPlan,
} from './trace-query';

test('delta cursors accept only numbered-page and delta trace plans', () => {
  type CursorPlan = Parameters<typeof encodeTraceQueryDeltaCursor>[0];
  expectTypeOf<CursorPlan>().toEqualTypeOf<TrustedTraceQueryPaginatedTracesPlan | TrustedTraceQueryDeltaTracesPlan>();
  expectTypeOf<TrustedTraceQueryKeysetTracesPlan>().not.toExtend<CursorPlan>();
  expectTypeOf<TrustedTraceQueryGroupsPlan>().not.toExtend<CursorPlan>();
  expectTypeOf<TrustedThreadQueryPlan>().not.toExtend<CursorPlan>();
});

test('metadata paths require a rooted non-empty tuple or canonical dot path', () => {
  expectTypeOf<'metadata.customer.id'>().toExtend<TraceQueryMetadataDotPath>();
  expectTypeOf<'customer.id'>().not.toExtend<TraceQueryMetadataDotPath>();
  expectTypeOf<readonly ['metadata', 'customer.id']>().toExtend<TraceQueryExactMetadataPath>();
  expectTypeOf<readonly ['metadata', 'customer.id', 'profile']>().toExtend<TraceQueryExactMetadataPath>();
  expectTypeOf<readonly ['attributes', 'customer.id']>().not.toExtend<TraceQueryExactMetadataPath>();
  expectTypeOf<readonly ['metadata']>().not.toExtend<TraceQueryExactMetadataPath>();
});
