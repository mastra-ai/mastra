import { coreFeatures } from '@mastra/core/features';
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
  selectTraceQueryRoots,
  THREAD_QUERY_CONFORMANCE_CASES,
  THREAD_QUERY_FIXTURE_DATA,
  TRACE_QUERY_CONFORMANCE_CASES,
  TRACE_QUERY_FEEDBACK_REPLACEMENT_SCENARIOS,
  TRACE_QUERY_FIXTURE_DATA,
  TRACE_QUERY_ORDINAL_FIXTURE_DATA,
  TRACE_QUERY_SCORE_REPLACEMENT_CASES,
  TRACE_QUERY_SCORE_REPLACEMENT_FIXTURE_DATA,
  TRACE_QUERY_SCORE_TIE_CASE,
  TRACE_QUERY_SCORE_TIE_FIXTURE_DATA,
  TRACE_QUERY_TIED_TIMESTAMP_CASES,
  TRACE_QUERY_TIED_TIMESTAMP_FIXTURE_DATA,
} from './trace-query';

describe('trace-query reference evaluator', () => {
  it('owns only trace expectations; grouped requests live in thread-query conformance', () => {
    for (const testCase of TRACE_QUERY_CONFORMANCE_CASES) {
      expect(testCase.request.group, `${testCase.name} must not use deprecated grouping`).toBeUndefined();
      for (const entry of testCase.expected) {
        expect(Object.keys(entry)).toEqual(['traceId']);
      }
    }
  });

  it('selectTraceQueryRoots returns the same roots evaluateTraceQuery paginates', () => {
    const cases = [
      TRACE_QUERY_CONFORMANCE_CASES.find(testCase => testCase.request.where === undefined)!,
      TRACE_QUERY_CONFORMANCE_CASES.find(testCase => testCase.request.where !== undefined)!,
    ];
    for (const testCase of cases) {
      const plan = planTraceQuery(parseTraceQueryRequest(testCase.request));
      const response = evaluateTraceQuery(TRACE_QUERY_FIXTURE_DATA, plan);
      if (!('traces' in response)) throw new Error('Expected traces');
      const selected = selectTraceQueryRoots(TRACE_QUERY_FIXTURE_DATA, plan)
        .map(root => root.traceId)
        .sort();
      expect(selected, testCase.name).toEqual(response.traces.map(trace => trace.traceId).sort());
      expect(selected.length, testCase.name).toBe(testCase.expected.length);
    }
  });

  it('hands numbered pages to delta and detects completion without child re-emission', () => {
    const feature = 'observability-delta-polling';
    const enabled = coreFeatures.has(feature);
    coreFeatures.add(feature);
    try {
      const timeRange = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };
      const data = structuredClone(TRACE_QUERY_FIXTURE_DATA);
      const page = evaluateTraceQueryRequest(data, { timeRange, pagination: {} });
      if (!('pagination' in page)) throw new Error('Expected page');
      expect(page.deltaCursor).toBeTruthy();
      const head = Math.max(...data.spans.map(span => span.cursorId));
      const template = data.spans.find(span => span.parentSpanId === null && !span.isPending)!;
      data.spans.push({
        ...template,
        cursorId: head + 1,
        traceId: 'pending',
        spanId: 'pending',
        isPending: true,
        endedAt: null,
      });
      const empty = evaluateTraceQueryRequest(data, { timeRange, mode: 'delta', after: page.deltaCursor });
      if (!('delta' in empty)) throw new Error('Expected delta');
      expect(empty.traces).toEqual([]);
      data.spans.push({ ...template, cursorId: head + 2, traceId: 'pending', spanId: 'pending' });
      data.spans.push({ ...template, cursorId: head + 3, traceId: 'inserted', spanId: 'inserted' });
      const first = evaluateTraceQueryRequest(data, { timeRange, mode: 'delta', after: empty.deltaCursor, limit: 1 });
      if (!('delta' in first)) throw new Error('Expected delta');
      expect(first.traces.map(trace => trace.traceId)).toEqual(['pending']);
      expect(first.delta.hasMore).toBe(true);
      const second = evaluateTraceQueryRequest(data, { timeRange, mode: 'delta', after: first.deltaCursor, limit: 1 });
      if (!('delta' in second)) throw new Error('Expected delta');
      expect(second.traces.map(trace => trace.traceId)).toEqual(['inserted']);
      expect(second.delta.hasMore).toBe(false);
      data.spans.push({
        ...template,
        cursorId: head + 4,
        traceId: 'pending',
        spanId: 'child',
        parentSpanId: 'pending',
      });
      const child = evaluateTraceQueryRequest(data, { timeRange, mode: 'delta', after: second.deltaCursor });
      expect('traces' in child && child.traces).toEqual([]);
      const bootstrap = evaluateTraceQueryRequest(data, { timeRange, mode: 'delta' });
      expect('traces' in bootstrap && bootstrap.traces).toEqual([]);
    } finally {
      if (!enabled) coreFeatures.delete(feature);
    }
  });

  for (const testCase of TRACE_QUERY_CONFORMANCE_CASES) {
    it(testCase.name, () => {
      expect(
        normalizeTraceQueryResponse(
          evaluateTraceQueryRequest(TRACE_QUERY_FIXTURE_DATA, testCase.request, testCase.scope),
        ),
      ).toEqual(testCase.expected);
    });
    if (!testCase.request.group) {
      it(`delta: ${testCase.name}`, () => {
        const request = {
          timeRange: testCase.request.timeRange,
          where: testCase.request.where,
          mode: 'delta' as const,
          limit: 2,
        };
        const bootstrap = evaluateTraceQueryRequest({ spans: [], scores: [], feedback: [] }, request, testCase.scope);
        if (!('delta' in bootstrap)) throw new Error('Expected delta');
        let after = bootstrap.deltaCursor;
        const ids: string[] = [];
        let completed = false;
        for (let page = 0; page < 20; page++) {
          const batch = evaluateTraceQueryRequest(TRACE_QUERY_FIXTURE_DATA, { ...request, after }, testCase.scope);
          if (!('delta' in batch)) throw new Error('Expected delta');
          ids.push(...batch.traces.map(trace => trace.traceId));
          if (batch.delta.hasMore) expect(batch.deltaCursor).not.toBe(after);
          after = batch.deltaCursor;
          if (!batch.delta.hasMore) {
            completed = true;
            break;
          }
        }
        expect(completed).toBe(true);
        expect(ids.sort()).toEqual(testCase.expected.map(row => ('traceId' in row ? row.traceId : '')).sort());
      });
    }
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

  describe('score replacement contract', () => {
    for (const testCase of TRACE_QUERY_SCORE_REPLACEMENT_CASES) {
      it(testCase.name, () => {
        expect(
          normalizeTraceQueryResponse(
            evaluateTraceQueryRequest(TRACE_QUERY_SCORE_REPLACEMENT_FIXTURE_DATA, testCase.request),
          ),
        ).toEqual(testCase.expected);
      });
    }

    it(TRACE_QUERY_SCORE_TIE_CASE.name, () => {
      const reversed = {
        ...TRACE_QUERY_SCORE_TIE_FIXTURE_DATA,
        scores: [...TRACE_QUERY_SCORE_TIE_FIXTURE_DATA.scores].reverse(),
      };
      expect(
        normalizeTraceQueryResponse(
          evaluateTraceQueryRequest(TRACE_QUERY_SCORE_TIE_FIXTURE_DATA, TRACE_QUERY_SCORE_TIE_CASE.request),
        ),
      ).toEqual(TRACE_QUERY_SCORE_TIE_CASE.expected);
      expect(
        normalizeTraceQueryResponse(evaluateTraceQueryRequest(reversed, TRACE_QUERY_SCORE_TIE_CASE.request)),
      ).toEqual(TRACE_QUERY_SCORE_TIE_CASE.expected);
    });
  });

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

  it('returns list-compatible first, middle, final, and out-of-range pages', () => {
    const timeRange = { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' };
    const cases = [
      { page: 0, ids: ['trace-d', 'trace-c'], hasMore: true },
      { page: 1, ids: ['trace-a', 'trace-b'], hasMore: false },
      { page: 2, ids: [], hasMore: false },
    ];

    for (const testCase of cases) {
      const response = evaluateTraceQueryRequest(TRACE_QUERY_FIXTURE_DATA, {
        timeRange,
        pagination: { page: testCase.page, perPage: 2 },
      });
      if (!('pagination' in response)) throw new Error('Expected page pagination');
      expect(response.traces.map(trace => trace.traceId)).toEqual(testCase.ids);
      expect(response.pagination).toEqual({ total: 4, page: testCase.page, perPage: 2, hasMore: testCase.hasMore });
    }
  });

  it('applies filtering and deterministic ascending ordering before page pagination', () => {
    const response = evaluateTraceQueryRequest(TRACE_QUERY_FIXTURE_DATA, {
      timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
      where: { op: 'exists', path: 'threadId' },
      orderBy: [{ field: 'startedAt', direction: 'asc' }],
      pagination: { page: 0, perPage: 3 },
    });
    if (!('pagination' in response)) throw new Error('Expected page pagination');
    expect(response.traces.map(trace => trace.traceId)).toEqual(['trace-a', 'trace-b', 'trace-c']);
    expect(response.pagination).toEqual({ total: 3, page: 0, perPage: 3, hasMore: false });
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
          name: 'root-a',
          entityId: null,
          parentSpanId: null,
          createdAt: '2026-08-05T10:00:00.000Z',
          metadata: TRACE_QUERY_FIXTURE_DATA.spans.find(span => span.spanId === 'root-a')?.metadata,
          inputPreview: null,
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
      expect(evaluateThreadQueryRequest(THREAD_QUERY_FIXTURE_DATA, testCase.request, testCase.scope).threads).toEqual(
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
