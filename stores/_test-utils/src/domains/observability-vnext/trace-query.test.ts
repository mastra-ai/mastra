import { parseTraceQueryRequest, planThreadQuery, planTraceQuery } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  collectThreadQueryPages,
  collectTraceQueryPages,
  evaluateThreadQuery,
  evaluateThreadQueryRequest,
  evaluateTraceQuery,
  evaluateTraceQueryRequest,
  normalizeTraceQueryResponse,
  THREAD_QUERY_CONFORMANCE_CASES,
  THREAD_QUERY_FIXTURE_DATA,
  TRACE_QUERY_CONFORMANCE_CASES,
  TRACE_QUERY_FEEDBACK_REPLACEMENT_SCENARIOS,
  TRACE_QUERY_FIXTURE_DATA,
  TRACE_QUERY_ORDINAL_FIXTURE_DATA,
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

  describe('feedback replacement contract', () => {
    for (const scenario of TRACE_QUERY_FEEDBACK_REPLACEMENT_SCENARIOS) {
      it(scenario.name, () => {
        for (const assertion of scenario.assertions) {
          expect
            .soft(
              normalizeTraceQueryResponse(evaluateTraceQueryRequest(scenario.fixture, assertion.request)),
              assertion.name,
            )
            .toEqual(assertion.expected);
        }
      });
    }
  });

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

  it('paginates tied mixed-case and non-ASCII trace IDs using ordinal order', async () => {
    const results = await collectTraceQueryPages(
      async normalized => {
        return evaluateTraceQuery(TRACE_QUERY_ORDINAL_FIXTURE_DATA, planTraceQuery(normalized));
      },
      {
        timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
        orderBy: [{ field: 'startedAt', direction: 'asc' }],
        page: { limit: 1 },
      },
    );

    expect(results).toEqual([{ traceId: 'A' }, { traceId: 'a' }, { traceId: 'é' }, { traceId: 'Ω' }]);
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

  it('paginates mixed-case and non-ASCII thread groups using ordinal order', async () => {
    const results = await collectTraceQueryPages(
      async normalized => {
        return evaluateTraceQuery(TRACE_QUERY_ORDINAL_FIXTURE_DATA, planTraceQuery(normalized));
      },
      {
        timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
        group: { by: ['threadId'] },
        page: { limit: 1 },
      },
    );

    expect(results).toEqual([{ threadId: 'A' }, { threadId: 'a' }, { threadId: 'é' }, { threadId: 'Ω' }]);
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

describe('thread-query reference evaluator', () => {
  for (const testCase of THREAD_QUERY_CONFORMANCE_CASES) {
    it(testCase.name, () => {
      expect(evaluateThreadQueryRequest(THREAD_QUERY_FIXTURE_DATA, testCase.request).threads).toEqual(
        testCase.expected,
      );
    });
  }

  it('returns only thread identities', () => {
    expect(
      evaluateThreadQueryRequest(THREAD_QUERY_FIXTURE_DATA, {
        traces: { timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' } },
        where: {
          traces: {
            some: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-1' } },
          },
        },
      }),
    ).toEqual({ threads: [{ threadId: 'thread-1' }], page: { next: null } });
  });

  it('traverses thread pages without duplicates or omissions', async () => {
    const request = {
      traces: { timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' } },
      page: { limit: 1 },
    };
    const results = await collectThreadQueryPages(async normalized => {
      return evaluateThreadQuery(THREAD_QUERY_FIXTURE_DATA, planThreadQuery(normalized));
    }, request);

    expect(results).toEqual([{ threadId: 'thread-1' }, { threadId: 'thread-2' }]);
    expect(new Set(results.map(result => result.threadId)).size).toBe(results.length);
  });

  it('paginates mixed-case and non-ASCII threads using ordinal order', async () => {
    const results = await collectThreadQueryPages(
      async normalized => evaluateThreadQuery(TRACE_QUERY_ORDINAL_FIXTURE_DATA, planThreadQuery(normalized)),
      {
        traces: { timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' } },
        page: { limit: 1 },
      },
    );

    expect(results).toEqual([{ threadId: 'A' }, { threadId: 'a' }, { threadId: 'é' }, { threadId: 'Ω' }]);
  });
});
