import { parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  collectTraceQueryPages,
  evaluateTraceQuery,
  evaluateTraceQueryRequest,
  normalizeTraceQueryResponse,
  TRACE_QUERY_CONFORMANCE_CASES,
  TRACE_QUERY_FIXTURE_DATA,
  TRACE_QUERY_TIED_TIMESTAMP_CASES,
  TRACE_QUERY_TIED_TIMESTAMP_FIXTURE_DATA,
} from './trace-query';

describe('trace-query reference evaluator', () => {
  for (const testCase of TRACE_QUERY_CONFORMANCE_CASES) {
    it(testCase.name, () => {
      expect(
        normalizeTraceQueryResponse(evaluateTraceQueryRequest(TRACE_QUERY_FIXTURE_DATA, testCase.request)),
      ).toEqual(testCase.expected);
    });
  }

  for (const testCase of TRACE_QUERY_TIED_TIMESTAMP_CASES) {
    it(testCase.name, () => {
      expect(
        normalizeTraceQueryResponse(
          evaluateTraceQueryRequest(TRACE_QUERY_TIED_TIMESTAMP_FIXTURE_DATA, testCase.request),
        ),
      ).toEqual(testCase.expected);
    });
  }

  it('projects only fixed lightweight fields', () => {
    const response = evaluateTraceQueryRequest(TRACE_QUERY_FIXTURE_DATA, {
      timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
      where: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } },
    });
    expect(response).toEqual({
      traces: [
        {
          traceId: 'trace-a',
          rootSpanId: 'root-a',
          threadId: 'thread-1',
          resourceId: 'resource-1',
          startedAt: '2026-08-05T10:00:00.000Z',
          endedAt: '2026-08-05T10:00:02.000Z',
          entityName: 'support-agent',
          entityType: 'agent',
          environment: 'production',
          status: 'success',
        },
      ],
      page: { next: null },
    });
  });

  it('traverses tied trace pages without duplicates or omissions', async () => {
    const request = {
      timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
      orderBy: [{ field: 'startedAt' as const, direction: 'asc' as const }],
      page: { limit: 1 },
    };
    const results = await collectTraceQueryPages(async normalized => {
      return evaluateTraceQuery(TRACE_QUERY_FIXTURE_DATA, planTraceQuery(normalized));
    }, request);

    expect(results).toEqual([
      { traceId: 'trace-a' },
      { traceId: 'trace-b' },
      { traceId: 'trace-c' },
      { traceId: 'trace-d' },
    ]);
    expect(new Set(results.map(result => JSON.stringify(result))).size).toBe(results.length);
  });

  it('traverses group pages without duplicates or null thread IDs', async () => {
    const request = {
      timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
      group: { by: ['threadId'] as ['threadId'] },
      page: { limit: 1 },
    };
    const results = await collectTraceQueryPages(async normalized => {
      return evaluateTraceQuery(TRACE_QUERY_FIXTURE_DATA, planTraceQuery(normalized));
    }, request);
    expect(results).toEqual([{ threadId: 'thread-1' }, { threadId: 'thread-2' }]);
  });

  it('applies timeRange to trace start time before predicates', () => {
    const normalized = parseTraceQueryRequest({
      timeRange: { from: '2026-08-06T00:00:00Z', to: '2026-08-09T00:00:00Z' },
      where: { op: 'exists', path: 'traceId' },
    });
    expect(
      normalizeTraceQueryResponse(evaluateTraceQuery(TRACE_QUERY_FIXTURE_DATA, planTraceQuery(normalized))),
    ).toEqual([{ traceId: 'trace-d' }, { traceId: 'trace-c' }]);
  });
});
