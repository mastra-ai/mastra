import type { ListTracesResponse } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';

type TraceRow = ListTracesResponse['spans'][number];

type MakeTraceRowArgs = Pick<TraceRow, 'traceId' | 'spanId' | 'name'> &
  Partial<Omit<TraceRow, 'traceId' | 'spanId' | 'name'>>;

export function makeTraceRow({ traceId, spanId, name, ...overrides }: MakeTraceRowArgs): TraceRow {
  const startedAt = overrides.startedAt ?? new Date('2026-06-20T12:00:00.000Z');
  const endedAt = overrides.endedAt ?? new Date(new Date(startedAt).getTime() + 1_000);
  const createdAt = overrides.createdAt ?? startedAt;
  const updatedAt = overrides.updatedAt ?? endedAt;

  return {
    traceId,
    spanId,
    name,
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    startedAt,
    endedAt,
    createdAt,
    updatedAt,
    status: 'success',
    ...overrides,
  };
}

export function makeListTracesResponse({
  spans,
  hasMore = false,
  deltaCursor,
  total = spans.length,
  page = 0,
  perPage = 25,
}: {
  spans: TraceRow[];
  hasMore?: boolean;
  deltaCursor?: string;
  total?: number;
  page?: number;
  perPage?: number;
}): ListTracesResponse {
  return {
    pagination: { total, page, perPage, hasMore },
    spans,
    ...(deltaCursor ? { deltaCursor } : {}),
  };
}

export function makeDeltaTracesResponse({
  spans,
  deltaCursor,
  hasMore = false,
  limit = 100,
}: {
  spans: TraceRow[];
  deltaCursor: string;
  hasMore?: boolean;
  limit?: number;
}): ListTracesResponse {
  return {
    delta: { limit, hasMore },
    deltaCursor,
    spans,
  };
}
