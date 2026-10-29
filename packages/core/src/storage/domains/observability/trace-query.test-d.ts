import { expectTypeOf, test } from 'vitest';
import type {
  encodeTraceQueryDeltaCursor,
  TrustedThreadQueryPlan,
  TrustedTraceQueryDeltaTracesPlan,
  TrustedTraceQueryGroupsPlan,
  TrustedTraceQueryKeysetTracesPlan,
  TrustedTraceQueryPaginatedTracesPlan,
  TraceQueryTrace,
} from './trace-query';

test('delta cursors accept only numbered-page and delta trace plans', () => {
  type CursorPlan = Parameters<typeof encodeTraceQueryDeltaCursor>[0];
  expectTypeOf<CursorPlan>().toEqualTypeOf<TrustedTraceQueryPaginatedTracesPlan | TrustedTraceQueryDeltaTracesPlan>();
  expectTypeOf<TrustedTraceQueryKeysetTracesPlan>().not.toExtend<CursorPlan>();
  expectTypeOf<TrustedTraceQueryGroupsPlan>().not.toExtend<CursorPlan>();
  expectTypeOf<TrustedThreadQueryPlan>().not.toExtend<CursorPlan>();
});

test('trace rows expose the root span outcome fields as optional and nullable', () => {
  expectTypeOf<TraceQueryTrace['outcome']>().toEqualTypeOf<string | null | undefined>();
  expectTypeOf<TraceQueryTrace['stopReason']>().toEqualTypeOf<string | null | undefined>();
  expectTypeOf<TraceQueryTrace['stopReasonContext']>().toEqualTypeOf<Record<string, unknown> | null | undefined>();
});
