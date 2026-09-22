import type { ClickHouseClient } from '@clickhouse/client';
import { coreFeatures } from '@mastra/core/features';
import {
  encodeTraceQueryCursor,
  encodeTraceQueryDeltaCursor,
  parseGetTraceQueryFieldsArgs,
  parseQueryThreadsInput,
  parseTraceQueryRequest,
  planThreadQuery,
  planTraceQuery,
  planTraceQueryObservedFields,
  TraceQueryExecutionError,
  TraceQueryResourceLimitError,
} from '@mastra/core/storage';
import type { TrustedThreadQueryPlan, TrustedTraceQueryPlan } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { SCORE_EVENTS_DDL, SPAN_EVENTS_DDL, TRACE_BRANCHES_DDL, TRACE_ROOTS_DDL } from './ddl';
import {
  compileClickHouseThreadQuery,
  compileClickHouseTraceQuery,
  compileClickHouseTraceQueryObservedFields,
  queryThreads,
  queryTraces,
  runWithClickHouseTraceQueryTimeout,
} from './trace-query';
import { ObservabilityStorageClickhouseVNext } from '.';

const TIME_RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };

function plan(input: Record<string, unknown> = {}): TrustedTraceQueryPlan {
  return planTraceQuery(parseTraceQueryRequest({ timeRange: TIME_RANGE, ...input }));
}

function threadPlan(input: Record<string, unknown> = {}): TrustedThreadQueryPlan {
  return planThreadQuery(parseQueryThreadsInput({ traces: { timeRange: TIME_RANGE }, ...input }));
}

describe('ClickHouse advanced trace query', () => {
  it('bootstraps delta polling and hands numbered pages a query-bound cursor', async () => {
    coreFeatures.add('observability-delta-polling');
    try {
      const query = vi.fn().mockResolvedValue({ json: async () => [{ cursorId: '7', traceId: 'trace-a' }] });
      const initial = await queryTraces(
        { query } as unknown as ClickHouseClient,
        plan({ mode: 'delta', limit: 2 }),
        15_000,
        'serial',
      );
      expect(initial).toEqual({ traces: [], delta: { limit: 2, hasMore: false }, deltaCursor: expect.any(String) });
      expect(query).toHaveBeenCalledTimes(1);
      query
        .mockResolvedValueOnce({ json: async () => [{ cursorId: '7', traceId: 'trace-a' }] })
        .mockResolvedValueOnce({ json: async () => [{ __metadata: 1, total: 0 }] });
      const numbered = await queryTraces(
        { query } as unknown as ClickHouseClient,
        plan({ pagination: { page: 0, perPage: 2 } }),
        15_000,
        'serial',
      );
      expect(numbered).toHaveProperty('deltaCursor', initial.deltaCursor);
    } finally {
      coreFeatures.delete('observability-delta-polling');
    }
  });

  it('orders delta candidates by watermark and trace ID after predicate evaluation and deduplication', () => {
    const first = plan({ mode: 'delta' });
    const after = encodeTraceQueryDeltaCursor(
      first,
      'clickhouse',
      JSON.stringify({ cursorId: '7', traceId: 'trace-a' }),
    );
    const compiled = compileClickHouseTraceQuery(plan({ mode: 'delta', after, limit: 2 }), {
      cursorId: '9',
      traceId: 'trace-z',
    });
    expect(compiled.query).toContain('GROUP BY traceId');
    expect(compiled.query).toContain('INNER JOIN delta_candidates');
    expect(compiled.query).toContain('ORDER BY d.latestCursorId ASC, c.traceId ASC');
    expect(Object.values(compiled.query_params)).toContain(3);
    expect(Object.values(compiled.query_params)).toContain('trace-a');
    expect(compiled.sharedSnapshot).toBe(true);
  });

  it('continues delta batches and preserves an empty cursor when retention removes the head', async () => {
    coreFeatures.add('observability-delta-polling');
    try {
      const first = plan({ mode: 'delta' });
      const after = encodeTraceQueryDeltaCursor(
        first,
        'clickhouse',
        JSON.stringify({ cursorId: '7', traceId: 'trace-a' }),
      );
      const query = vi
        .fn()
        .mockResolvedValueOnce({ json: async () => [{ cursorId: '9', traceId: 'trace-z' }] })
        .mockResolvedValueOnce({
          json: async () => [
            { ...traceRow('trace-b', TIME_RANGE.from), __delta_cursor: '8' },
            { ...traceRow('trace-c', TIME_RANGE.from), __delta_cursor: '8' },
          ],
        });
      const result = await queryTraces(
        { query } as unknown as ClickHouseClient,
        plan({ mode: 'delta', after, limit: 1 }),
        15_000,
        'serial',
      );
      expect(result).toMatchObject({ traces: [{ traceId: 'trace-b' }], delta: { limit: 1, hasMore: true } });
      expect(result).not.toHaveProperty('page');
      query.mockResolvedValue({ json: async () => [] });
      const empty = await queryTraces(
        { query } as unknown as ClickHouseClient,
        plan({ mode: 'delta', after: result.deltaCursor, limit: 1 }),
        15_000,
        'serial',
      );
      expect(empty).toEqual({ traces: [], delta: { limit: 1, hasMore: false }, deltaCursor: result.deltaCursor });
    } finally {
      coreFeatures.delete('observability-delta-polling');
    }
  });

  it('rejects invalid native watermarks and cursors from other adapters', () => {
    const first = plan({ mode: 'delta' });
    for (const [adapter, watermark] of [
      ['clickhouse', '{}'],
      ['pg', '7'],
    ]) {
      const after = encodeTraceQueryDeltaCursor(first, adapter!, watermark!);
      expect(() => compileClickHouseTraceQuery(plan({ mode: 'delta', after }))).toThrow();
    }
  });

  it('rejects invalid trace-query timeout configuration at construction', () => {
    expect(
      () =>
        new ObservabilityStorageClickhouseVNext({
          client: {} as ClickHouseClient,
          traceQuery: { timeoutMs: 0 },
        }),
    ).toThrow('traceQueryTimeoutMs must be an integer between');
  });

  it('rejects invalid discovery execution budget configuration at construction', () => {
    expect(
      () =>
        new ObservabilityStorageClickhouseVNext({
          client: {} as ClickHouseClient,
          traceQuery: { discovery: { timeoutMs: 0 } },
        }),
    ).toThrow('traceQueryTimeoutMs must be an integer between');
    expect(
      () =>
        new ObservabilityStorageClickhouseVNext({
          client: {} as ClickHouseClient,
          traceQuery: { discovery: { memoryLimitBytes: 0 } },
        }),
    ).toThrow('traceQuery.discovery.memoryLimitBytes must be a positive safe integer');
  });

  it('uses conservative discovery defaults and supports nested and legacy configuration', async () => {
    const query = vi.fn().mockResolvedValue({ json: async () => [] });
    const client = { query } as unknown as ClickHouseClient;
    const discoveryPlan = planTraceQueryObservedFields(
      parseGetTraceQueryFieldsArgs({ timeRange: TIME_RANGE, predicateScope: 'trace' }),
    );

    const defaultStorage = new ObservabilityStorageClickhouseVNext({ client });
    await defaultStorage.getTraceQueryObservedFields(discoveryPlan);
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clickhouse_settings: expect.objectContaining({
          max_execution_time: 5,
          max_memory_usage: String(256 * 1024 * 1024),
        }),
      }),
    );

    const configuredStorage = new ObservabilityStorageClickhouseVNext({
      client,
      traceQuery: {
        timeoutMs: 3_000,
        discovery: { timeoutMs: 1_000, memoryLimitBytes: 128 * 1024 * 1024 },
      },
    });
    await configuredStorage.queryTraces(plan());
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clickhouse_settings: expect.objectContaining({ max_execution_time: 3 }),
      }),
    );
    await configuredStorage.getTraceQueryObservedFields(discoveryPlan);
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clickhouse_settings: expect.objectContaining({
          max_execution_time: 1,
          max_memory_usage: String(128 * 1024 * 1024),
        }),
      }),
    );

    const legacyStorage = new ObservabilityStorageClickhouseVNext({ client, traceQueryTimeoutMs: 2_500 });
    await legacyStorage.getTraceQueryObservedFields(discoveryPlan);
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clickhouse_settings: expect.objectContaining({
          max_execution_time: 2.5,
          max_memory_usage: String(256 * 1024 * 1024),
        }),
      }),
    );
  });

  it('applies discovery execution budgets and normalizes memory exhaustion', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [] })
      .mockRejectedValueOnce({ code: '241', type: 'MEMORY_LIMIT_EXCEEDED' });
    const client = { query } as unknown as ClickHouseClient;
    const compiled = { query: 'SELECT 1', query_params: {} };

    await expect(
      runWithClickHouseTraceQueryTimeout(client, { timeoutMs: 5_000, memoryLimitBytes: 256 * 1024 * 1024 }, compiled),
    ).resolves.toEqual([]);
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clickhouse_settings: expect.objectContaining({
          max_execution_time: 5,
          max_memory_usage: String(256 * 1024 * 1024),
        }),
      }),
    );

    await expect(
      runWithClickHouseTraceQueryTimeout(client, { timeoutMs: 5_000, memoryLimitBytes: 1 }, compiled),
    ).rejects.toBeInstanceOf(TraceQueryResourceLimitError);
  });

  it('preserves resource-limit errors through public trace and thread queries', async () => {
    const query = vi.fn().mockRejectedValue({ code: '241', type: 'MEMORY_LIMIT_EXCEEDED' });
    const storage = new ObservabilityStorageClickhouseVNext({
      client: { query } as unknown as ClickHouseClient,
    });

    await expect(storage.queryTraces(plan())).rejects.toBeInstanceOf(TraceQueryResourceLimitError);
    await expect(storage.queryThreads(threadPlan())).rejects.toBeInstanceOf(TraceQueryResourceLimitError);
  });

  it('decodes each observed metadata value from the expanded JSON entry', () => {
    const compiled = compileClickHouseTraceQueryObservedFields(
      planTraceQueryObservedFields(
        parseGetTraceQueryFieldsArgs({
          timeRange: TIME_RANGE,
          predicateScope: 'trace',
        }),
      ),
    );

    expect(compiled.query).toContain('JSONExtractString(entry.2) AS value');
    expect(compiled.query).toContain("JSONType(rawValue) = 'String'");
    expect(compiled.query).toContain("trim(value) != ''");
    expect(compiled.query).toContain('length(value) <= 4096');
    expect(compiled.query).not.toContain('JSONExtractString(r.metadataRaw, entry.1)');
  });

  it('uses named parameters and one correlated existence check per collection clause', () => {
    const compiled = compileClickHouseTraceQuery(
      plan({
        where: {
          scores: {
            some: {
              op: 'and',
              args: [
                { op: 'eq', left: { path: 'scorerId' }, right: { literal: "factuality' OR 1" } },
                { op: 'eq', left: { path: 'scorerVersion' }, right: { literal: 'v2' } },
                { op: 'in', value: { path: 'scoreSource' }, set: ['automated'] },
                {
                  op: 'gte',
                  left: { path: 'timestamp' },
                  right: { literal: '2026-01-01T06:00:00-06:00' },
                },
                { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } },
                { op: 'exists', path: 'spanId' },
                { op: 'eq', left: { path: 'entityVersionId' }, right: { literal: 'entity-v2' } },
                { op: 'exists', path: 'parentEntityVersionId' },
                { op: 'notIn', value: { path: 'rootEntityVersionId' }, set: ['root-v2'] },
              ],
            },
          },
        },
      }),
    );

    expect(compiled.query).not.toContain("factuality' OR 1");
    expect(Object.values(compiled.query_params)).toContain("factuality' OR 1");
    expect(compiled.query.match(/EXISTS \(/g)).toHaveLength(1);
    expect(compiled.query).toContain('s.traceId = r.traceId');
    expect(compiled.query).toContain('FROM mastra_score_events_current FINAL');
    expect(compiled.query).not.toContain('FROM mastra_score_events FINAL');
    expect(compiled.query).not.toContain('LIMIT 1 BY scoreId');
    expect(compiled.query.indexOf('FROM mastra_score_events_current FINAL')).toBeLessThan(
      compiled.query.indexOf('current.traceId IN (SELECT traceId FROM root_scope)'),
    );
    expect(compiled.query).toContain('scorerVersion,');
    expect(compiled.query).toContain('scoreSource,');
    expect(compiled.query).toContain('timestamp,');
    expect(compiled.query).toContain('spanId,');
    expect(compiled.query).toContain('entityVersionId,');
    expect(compiled.query).toContain('parentEntityVersionId,');
    expect(compiled.query).toContain('rootEntityVersionId');
    expect(compiled.query).toMatch(/s\.timestamp >= \{trace_query_6:DateTime64\(3, 'UTC'\)\}/);
    expect(compiled.query).toContain('isNotNull(s.spanId)');
    expect(Object.values(compiled.query_params)).toContain('2026-01-01 12:00:00.000');
  });

  it('projects canonical span values with guarded JSON strings and typed parameters', () => {
    const compiled = compileClickHouseTraceQuery(
      plan({
        where: {
          spans: {
            some: {
              op: 'and',
              args: [
                { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } },
                { op: 'eq', left: { path: 'model' }, right: { literal: 'claude-sonnet-4-6' } },
                { op: 'eq', left: { path: 'provider' }, right: { literal: 'anthropic' } },
                {
                  op: 'gte',
                  left: { path: 'startedAt' },
                  right: { literal: '2026-01-01T06:00:00-06:00' },
                },
                { op: 'gt', left: { path: 'durationMs' }, right: { literal: 5000 } },
                { op: 'eq', left: { path: 'status' }, right: { literal: 'success' } },
              ],
            },
          },
        },
      }),
    );

    expect(compiled.query.match(/FROM current_spans s/g)).toHaveLength(1);
    expect(compiled.query).toContain(`JSONType(attributes, 'model') = 'String'`);
    expect(compiled.query).toContain(`JSONExtractString(attributes, 'model')`);
    expect(compiled.query).toContain(`JSONType(attributes, 'provider') = 'String'`);
    expect(compiled.query).toContain(`dateDiff('millisecond', startedAt, endedAt) AS durationMs`);
    expect(compiled.query).toMatch(/s\.startedAt >= \{trace_query_6:DateTime64\(3, 'UTC'\)\}/);
    expect(compiled.query).toMatch(/s\.durationMs > \{trace_query_7:Float64\}/);
    expect(Object.values(compiled.query_params)).toContain('2026-01-01 12:00:00.000');
    expect(Object.values(compiled.query_params)).toContain(5000);
  });

  it('parameterizes metadata keys and values with total missing semantics', () => {
    const key = ` message'id `;
    const value = `message' OR 1`;
    const compiled = compileClickHouseTraceQuery(
      plan({
        where: {
          op: 'and',
          args: [
            { op: 'eq', left: { path: `metadata.${key}` }, right: { literal: value } },
            { op: 'notIn', value: { path: 'metadata.actorRole' }, set: ['assistant', 'tool'] },
            { op: 'notExists', path: 'metadata.parentMessageId' },
          ],
        },
      }),
    );

    expect(compiled.query).not.toContain(key);
    expect(compiled.query).not.toContain(value);
    expect(compiled.query).toContain(
      "coalesce(if(mapContains(r.metadataSearch, {trace_query_3:String}), r.metadataSearch[{trace_query_3:String}], NULL), nullIf(trim(JSONExtractString(r.metadataRaw, {trace_query_3:String})), ''))",
    );
    expect(compiled.query).toContain('ifNull(');
    expect(compiled.query_params).toMatchObject({
      trace_query_3: key,
      trace_query_4: value,
      trace_query_5: 'actorRole',
      trace_query_6: 'assistant',
      trace_query_7: 'tool',
      trace_query_8: 'parentMessageId',
      trace_query_9: 101,
    });
  });

  it('deduplicates completed span deliveries without relying on background merges', () => {
    const compiled = compileClickHouseTraceQuery(
      plan({
        where: {
          spans: { some: { op: 'exists', path: 'error' } },
        },
      }),
    );

    expect(compiled.query).toContain('FROM mastra_trace_roots');
    expect(compiled.query).toContain('FROM mastra_span_events');
    expect(compiled.query).not.toContain('WHERE parentSpanId IS NULL');
    expect(compiled.query).toContain('ORDER BY dedupeKey');
    expect(compiled.query).toContain('ORDER BY traceId, dedupeKey');
    expect(compiled.query).toContain('LIMIT 1 BY dedupeKey');
    expect(compiled.query).toContain('LIMIT 1 BY traceId');
    expect(compiled.query).not.toMatch(/\bingestionVersion\b|\bisPending\b|\bFINAL\b|\bOPTIMIZE\b/);
  });

  it('uses trace_roots and emits one reusable reconstruction per referenced collection', () => {
    const spanClause = {
      spans: { some: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } } },
    };
    const scoreClause = {
      scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } } },
    };
    const traceOnly = compileClickHouseTraceQuery(plan()).query;
    const spanOnly = compileClickHouseTraceQuery(plan({ where: spanClause })).query;
    const scoreOnly = compileClickHouseTraceQuery(plan({ where: scoreClause })).query;
    const repeated = compileClickHouseTraceQuery(
      plan({ where: { op: 'and', args: [spanClause, spanClause, scoreClause, scoreClause] } }),
    ).query;

    for (const query of [traceOnly, spanOnly, scoreOnly, repeated]) {
      expect(query.match(/FROM mastra_trace_roots/g)).toHaveLength(1);
    }
    expect(traceOnly).not.toContain('mastra_span_events');
    expect(traceOnly).not.toContain('mastra_score_events');
    expect(spanOnly.match(/current_spans AS/g)).toHaveLength(1);
    expect(spanOnly.match(/FROM mastra_span_events/g)).toHaveLength(1);
    expect(spanOnly).not.toContain('current_scores AS');
    expect(spanOnly).not.toContain('mastra_score_events');
    expect(scoreOnly).not.toContain('score_ids_in_root_scope AS');
    expect(scoreOnly.match(/current_scores AS/g)).toHaveLength(1);
    expect(scoreOnly.match(/FROM mastra_score_events_current/g)).toHaveLength(1);
    expect(scoreOnly).not.toContain('FROM mastra_score_events FINAL');
    expect(scoreOnly).not.toContain('current_spans AS');
    expect(scoreOnly).not.toContain('mastra_span_events');
    expect(repeated.match(/current_spans AS/g)).toHaveLength(1);
    expect(repeated.match(/current_scores AS/g)).toHaveLength(1);
    expect(repeated.match(/FROM current_spans s/g)).toHaveLength(2);
    expect(repeated.match(/FROM current_scores s/g)).toHaveLength(2);
  });

  it('compiles typed feedback relations with one correlated existence check per clause', () => {
    const compiled = compileClickHouseTraceQuery(
      plan({
        where: {
          op: 'and',
          args: [
            {
              feedback: {
                some: {
                  op: 'and',
                  args: [
                    { op: 'eq', left: { path: 'feedbackType' }, right: { literal: "rating' OR 1" } },
                    { op: 'lt', left: { path: 'value' }, right: { literal: 0 } },
                    { op: 'gte', left: { path: 'timestamp' }, right: { literal: '2026-01-01T14:00:00+02:00' } },
                    { op: 'exists', path: 'value' },
                    { op: 'exists', path: 'comment' },
                  ],
                },
              },
            },
            { feedback: { none: { op: 'in', value: { path: 'value' }, set: ['bad', 'worse'] } } },
          ],
        },
      }),
    );

    expect(compiled.query.match(/current_feedback AS/g)).toHaveLength(1);
    expect(compiled.query.match(/FROM current_feedback s/g)).toHaveLength(2);
    expect(compiled.query).toContain('isNotNull(s.traceId)');
    expect(compiled.query).toContain('s.traceId = r.traceId');
    expect(compiled.query).toMatch(/s\.valueNumber < \{trace_query_\d+:Float64\}/);
    expect(compiled.query).toMatch(/s\.valueString IN \(\{trace_query_\d+:String\}/);
    expect(compiled.query).toContain('(isNotNull(s.valueString) OR isNotNull(s.valueNumber))');
    expect(compiled.query).toContain(`FROM (
      SELECT *
      FROM mastra_feedback_events FINAL
      ORDER BY feedbackId, writeVersion DESC, timestamp DESC
      LIMIT 1 BY feedbackId
    ) AS current
    WHERE isNotNull(traceId)
      AND traceId IN (SELECT traceId FROM root_scope)`);
    expect(compiled.query).not.toContain("rating' OR 1");
    expect(Object.values(compiled.query_params)).toContain("rating' OR 1");
    expect(Object.values(compiled.query_params)).toContain('2026-01-01 12:00:00.000');
  });

  it('emits feedback scope only when referenced', () => {
    const traceOnly = compileClickHouseTraceQuery(plan()).query;
    const feedbackOnly = compileClickHouseTraceQuery(
      plan({ where: { feedback: { some: { op: 'exists', path: 'value' } } } }),
    ).query;

    expect(traceOnly).not.toContain('current_feedback AS');
    expect(traceOnly).not.toContain('mastra_feedback_events');
    expect(feedbackOnly.match(/current_feedback AS/g)).toHaveLength(1);
  });

  it('uses total nullable semantics for negative predicates', () => {
    const compiled = compileClickHouseTraceQuery(
      plan({ where: { op: 'ne', left: { path: 'threadId' }, right: { literal: 'excluded' } } }),
    );

    expect(compiled.query).toMatch(/ifNull\(r\.threadId != \{trace_query_3:String\}, 1\)/);
  });

  it('matches the requested keyset order and always ties on traceId ascending', () => {
    const first = plan({ orderBy: [{ field: 'endedAt', direction: 'desc' }], page: { limit: 2 } });
    const after = plan({
      orderBy: [{ field: 'endedAt', direction: 'desc' }],
      page: {
        limit: 2,
        after: encodeTraceQueryCursor(first, {
          result: 'traces',
          sortValue: '2026-01-01T12:00:00.000Z',
          traceId: 'trace-b',
        }),
      },
    });
    const compiled = compileClickHouseTraceQuery(after);

    expect(compiled.query).toMatch(/endedAt < \{trace_query_3:DateTime64/);
    expect(compiled.query).toContain('traceId > {trace_query_4:String}');
    expect(compiled.query).toContain('ORDER BY endedAt DESC, traceId ASC');
    expect(Object.values(compiled.query_params).at(-1)).toBe(3);
  });

  it('compiles grouped queries as distinct non-null thread IDs', () => {
    const compiled = compileClickHouseTraceQuery(plan({ group: { by: ['threadId'] }, page: { limit: 4 } }));

    expect(compiled.query).toContain('WHERE isNotNull(threadId)');
    expect(compiled.query).toContain('GROUP BY threadId');
    expect(compiled.query).toContain('ORDER BY threadId ASC');
    expect(Object.values(compiled.query_params).at(-1)).toBe(5);
  });

  it('compiles list-compatible rows and metadata into one typed query', () => {
    const compiled = compileClickHouseTraceQuery(
      plan({
        orderBy: [{ field: 'endedAt', direction: 'asc' }],
        pagination: { page: 2, perPage: 25 },
      }),
    );

    expect(compiled.query).toContain('page_rows AS');
    expect(compiled.query).toContain('ORDER BY endedAt ASC, traceId ASC');
    expect(compiled.query).toContain('LIMIT {trace_query_3:UInt64} OFFSET {trace_query_4:UInt64}');
    expect(compiled.query).toContain('SELECT count() AS total\n  FROM candidates');
    expect(compiled.query).toContain('UNION ALL');
    expect(compiled.query).toContain("'' AS name");
    expect(compiled.query).toContain("CAST(NULL, 'Nullable(String)') AS metadata");
    expect(compiled.query).toContain("CAST(NULL, 'Nullable(String)') AS input");
    expect(compiled.query).toContain('1 AS __metadata');

    const candidatesProjection = /candidates AS \(\n\s*SELECT ([\s\S]*?)\n\s*FROM root_scope r/.exec(
      compiled.query,
    )?.[1];
    const metadataProjection = /UNION ALL\nSELECT\n([\s\S]*?)\nFROM page_total/.exec(compiled.query)?.[1];
    expect(candidatesProjection).toBeDefined();
    expect(metadataProjection).toBeDefined();
    const aliases = (projection: string | undefined) =>
      Array.from(projection?.matchAll(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/g) ?? [], match => match[1]);
    expect(aliases(metadataProjection)).toEqual([
      ...aliases(candidatesProjection),
      '__row_position',
      'total',
      '__metadata',
    ]);

    expect(compiled.query_params).toMatchObject({ trace_query_3: 25, trace_query_4: 50 });
    expect(compiled.sharedSnapshot).toBe(true);
  });

  it('compiles thread qualification over full eligible roots with dependencies from both scopes', () => {
    const metadataKey = ` actor'role `;
    const metadataValue = `clinician' OR TRUE`;
    const compiled = compileClickHouseThreadQuery(
      threadPlan({
        traces: {
          timeRange: TIME_RANGE,
          where: { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'medication_lookup' } } } },
        },
        where: {
          op: 'and',
          args: [
            {
              traces: {
                some: {
                  op: 'and',
                  args: [
                    { op: 'eq', left: { path: `metadata.${metadataKey}` }, right: { literal: metadataValue } },
                    { scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } } } },
                  ],
                },
              },
            },
            {
              traces: {
                none: {
                  feedback: {
                    some: { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'clinical-review' } },
                  },
                },
              },
            },
          ],
        },
        page: { limit: 4 },
      }),
    );

    expect(compiled.query.match(/current_spans AS/g)).toHaveLength(1);
    expect(compiled.query.match(/current_scores AS/g)).toHaveLength(1);
    expect(compiled.query.match(/current_feedback AS/g)).toHaveLength(1);
    expect(compiled.query.match(/FROM mastra_trace_roots/g)).toHaveLength(1);
    expect(compiled.query).toContain('FROM mastra_feedback_events FINAL');
    expect(compiled.query).toContain('eligible_roots AS');
    expect(compiled.query).toContain('SELECT *\n    FROM root_scope r');
    expect(compiled.query).toContain('SELECT 1 FROM eligible_roots r');
    expect(compiled.query).toContain('r.threadId = t.threadId');
    expect(compiled.query).toContain('NOT EXISTS (');
    expect(compiled.query).not.toContain(metadataKey);
    expect(compiled.query).not.toContain(metadataValue);
    expect(Object.values(compiled.query_params)).toEqual([
      '2026-01-01 00:00:00.000',
      '2026-01-02 00:00:00.000',
      'medication_lookup',
      metadataKey,
      metadataValue,
      0.6,
      'clinical-review',
      5,
    ]);
  });

  it('applies the thread cursor after qualification and fetches one lookahead row', () => {
    const first = threadPlan({ page: { limit: 1 } });
    const after = threadPlan({
      page: {
        limit: 1,
        after: encodeTraceQueryCursor(first, { result: 'threads', threadId: 'thread-1' }),
      },
    });
    const compiled = compileClickHouseThreadQuery(after);

    expect(compiled.query).toContain('FROM qualified_threads\nWHERE threadId > {trace_query_3:String}');
    expect(compiled.query).toContain('ORDER BY threadId ASC');
    expect(Object.values(compiled.query_params)).toEqual([
      '2026-01-01 00:00:00.000',
      '2026-01-02 00:00:00.000',
      'thread-1',
      2,
    ]);
  });

  it('fails closed when a trusted plan contains an unmapped field', () => {
    const trusted = plan({ where: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } } });
    const invalid = {
      ...trusted,
      where: { type: 'comparison', field: 'rawSql', operator: 'eq', value: 'x' },
    } as unknown as TrustedTraceQueryPlan;

    expect(() => compileClickHouseTraceQuery(invalid)).toThrow('Unsupported trusted trace-query field');

    const thread = threadPlan({
      where: { traces: { some: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } } } },
    });
    const invalidThread = {
      ...thread,
      where: {
        type: 'relation',
        collection: 'traces',
        quantifier: 'some',
        predicate: { type: 'comparison', field: 'rawSql', operator: 'eq', value: 'x' },
      },
    } as unknown as TrustedThreadQueryPlan;
    expect(() => compileClickHouseThreadQuery(invalidThread)).toThrow('Unsupported trusted trace-query field');
  });

  it('fails closed when a trusted plan contains an unmapped order field', () => {
    const trusted = plan();
    const invalid = {
      ...trusted,
      orderBy: { ...trusted.orderBy, field: 'endedAt DESC; DROP TABLE mastra_trace_roots' },
    } as unknown as TrustedTraceQueryPlan;

    expect(() => compileClickHouseTraceQuery(invalid)).toThrow('Unsupported trusted trace-query field');
  });

  it('returns fixed records and computes the next cursor from the last visible row', async () => {
    const json = vi
      .fn()
      .mockResolvedValue([
        traceRow('trace-a', '2026-01-01T12:00:00.000Z'),
        traceRow('trace-b', '2026-01-01T11:00:00.000Z'),
      ]);
    const query = vi.fn().mockResolvedValue({ json });
    const response = await queryTraces({ query } as unknown as ClickHouseClient, plan({ page: { limit: 1 } }), 15_000);

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ clickhouse_settings: expect.objectContaining({ max_execution_time: 15 }) }),
    );
    expect(response).toMatchObject({
      traces: [{ traceId: 'trace-a', rootSpanId: 'root-trace-a', status: 'success' }],
      page: { next: expect.any(String) },
    });
    expect(Object.keys(response.traces[0]!)).toHaveLength(16);
    expect(response.traces[0]).toMatchObject({
      name: 'Agent run',
      entityId: 'agent-1',
      parentSpanId: null,
      createdAt: '2026-01-01T12:00:00.000Z',
      metadata: { customer: { id: 'customer-1' }, count: 2 },
      inputPreview: 'Help with my order',
    });
    expect(response.traces[0]).not.toHaveProperty('input');
  });

  it('returns null for absent optional root span details', async () => {
    const row = {
      ...traceRow('trace-a', '2026-01-01T12:00:00.000Z'),
      entityId: null,
      metadata: null,
      input: null,
    };
    const json = vi.fn().mockResolvedValue([row]);
    const query = vi.fn().mockResolvedValue({ json });
    const response = await queryTraces({ query } as unknown as ClickHouseClient, plan(), 15_000);

    expect(response.traces[0]).toMatchObject({
      name: 'Agent run',
      entityId: null,
      parentSpanId: null,
      metadata: null,
      inputPreview: null,
    });
    expect(response.page.next).toBeNull();
  });

  it('returns exact list-compatible pagination metadata from one shared-snapshot query', async () => {
    const json = vi.fn().mockResolvedValue([
      { ...traceRow('trace-c', '2026-01-01T10:00:00.000Z'), total: '3', __metadata: 0 },
      { total: '3', __metadata: 1 },
    ]);
    const query = vi.fn().mockResolvedValue({ json });
    const response = await queryTraces(
      { query } as unknown as ClickHouseClient,
      plan({ pagination: { page: 1, perPage: 2 } }),
      15_000,
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        clickhouse_settings: expect.objectContaining({
          max_execution_time: 15,
          enable_shared_storage_snapshot_in_query: 1,
        }),
      }),
    );
    expect(response).toMatchObject({
      traces: [{ traceId: 'trace-c' }],
      pagination: { total: 3, page: 1, perPage: 2, hasMore: false },
    });
    expect(response).not.toHaveProperty('page');
  });

  it.each([
    ['empty', 0, 0],
    ['out-of-range', 3, 7],
  ])('preserves totals for %s pages without trace rows', async (_case, page, total) => {
    const json = vi.fn().mockResolvedValue([{ total: String(total), __metadata: 1 }]);
    const query = vi.fn().mockResolvedValue({ json });

    const response = await queryTraces(
      { query } as unknown as ClickHouseClient,
      plan({ pagination: { page, perPage: 2 } }),
      15_000,
    );

    expect(response).toEqual({
      traces: [],
      pagination: { total, page, perPage: 2, hasMore: false },
    });
  });

  it('reuses the execution timeout and returns fixed thread identities with a next cursor', async () => {
    const json = vi.fn().mockResolvedValue([{ threadId: 'thread-1' }, { threadId: 'thread-2' }]);
    const query = vi.fn().mockResolvedValue({ json });

    const response = await queryThreads(
      { query } as unknown as ClickHouseClient,
      threadPlan({ page: { limit: 1 } }),
      15_000,
    );

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ clickhouse_settings: expect.objectContaining({ max_execution_time: 15 }) }),
    );
    expect(response).toEqual({ threads: [{ threadId: 'thread-1' }], page: { next: expect.any(String) } });
    expect(Object.keys(response.threads[0]!)).toEqual(['threadId']);
  });

  it('normalizes ClickHouse execution timeouts without exposing driver details', async () => {
    const driverError = Object.assign(new Error('Timeout exceeded while reading secret query'), { code: '159' });
    const query = vi.fn().mockRejectedValue(driverError);

    await expect(queryTraces({ query } as unknown as ClickHouseClient, plan(), 1)).rejects.toEqual(
      expect.objectContaining<Partial<TraceQueryExecutionError>>({
        code: 'TRACE_QUERY_EXECUTION_TIMEOUT',
        message: 'The trace query exceeded its execution timeout',
      }),
    );
  });

  it('compiles against the existing completion-only schema', () => {
    for (const ddl of [SPAN_EVENTS_DDL, TRACE_ROOTS_DDL, TRACE_BRANCHES_DDL, SCORE_EVENTS_DDL]) {
      expect(ddl).not.toMatch(/\bingestionVersion\b|\bisPending\b|ReplacingMergeTree\s*\(/);
    }

    const compiled = compileClickHouseTraceQuery(plan({ where: { spans: { some: { op: 'exists', path: 'error' } } } }));
    expect(compiled.query).not.toMatch(/\bingestionVersion\b|\bisPending\b/);
  });
});

function traceRow(traceId: string, startedAt: string) {
  return {
    traceId,
    rootSpanId: `root-${traceId}`,
    name: 'Agent run',
    entityId: 'agent-1',
    parentSpanId: null,
    metadata: JSON.stringify({ customer: { id: 'customer-1' }, count: 2 }),
    input: JSON.stringify({ messages: [{ role: 'user', content: 'Help with my order' }] }),
    threadId: null,
    resourceId: null,
    startedAt,
    endedAt: new Date(new Date(startedAt).getTime() + 1_000).toISOString(),
    entityName: null,
    entityType: null,
    environment: null,
    status: 'success',
  };
}
