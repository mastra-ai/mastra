import { expectTypeOf, test } from 'vitest';
import { encodeTraceQueryDeltaCursor } from './trace-query';
import type {
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
