import type { SpanSelection } from '@/domains/spans/components/span-detail-panel';

/** The open span, read from the same `traceId` + `spanId` params as the traces page. */
export function readSpanSelection(params: URLSearchParams): SpanSelection | undefined {
  const traceId = params.get('traceId');
  const spanId = params.get('spanId');
  return traceId && spanId ? { traceId, spanId } : undefined;
}

/** A copy of `params` with the span selection set, or cleared when `selection` is undefined. */
export function withSpanSelection(params: URLSearchParams, selection: SpanSelection | undefined): URLSearchParams {
  const next = new URLSearchParams(params);
  if (selection) {
    next.set('traceId', selection.traceId);
    next.set('spanId', selection.spanId);
  } else {
    next.delete('traceId');
    next.delete('spanId');
  }
  return next;
}

/** The search for opening a span inside its trace on the traces page. */
export function spanTraceSearch({ traceId, spanId }: SpanSelection): URLSearchParams {
  return new URLSearchParams({ traceId, spanId });
}

/** The open thread, read from the `threadId` param. */
export function readThreadSelection(params: URLSearchParams): string | undefined {
  return params.get('threadId') ?? undefined;
}

/** A copy of `params` with the thread selection set, or cleared when `threadId` is undefined. */
export function withThreadSelection(params: URLSearchParams, threadId: string | undefined): URLSearchParams {
  const next = new URLSearchParams(params);
  if (threadId) next.set('threadId', threadId);
  else next.delete('threadId');
  return next;
}
