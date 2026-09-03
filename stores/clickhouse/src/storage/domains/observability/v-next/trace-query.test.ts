import type { ClickHouseClient } from '@clickhouse/client';
import {
  encodeTraceQueryCursor,
  parseTraceQueryRequest,
  planTraceQuery,
  TraceQueryExecutionError,
} from '@mastra/core/storage';
import type { TrustedTraceQueryPlan } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { SCORE_EVENTS_DDL, SPAN_EVENTS_DDL, TRACE_BRANCHES_DDL, TRACE_ROOTS_DDL } from './ddl';
import { compileClickHouseTraceQuery, queryTraces } from './trace-query';
import { ObservabilityStorageClickhouseVNext } from '.';

const TIME_RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };

function plan(input: Record<string, unknown> = {}): TrustedTraceQueryPlan {
  return planTraceQuery(parseTraceQueryRequest({ timeRange: TIME_RANGE, ...input }));
}

describe('ClickHouse advanced trace query', () => {
  it('rejects invalid trace-query timeout configuration at construction', () => {
    expect(
      () =>
        new ObservabilityStorageClickhouseVNext({
          client: {} as ClickHouseClient,
          traceQueryTimeoutMs: 0,
        }),
    ).toThrow('traceQueryTimeoutMs must be an integer between');
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
    expect(compiled.query).toContain('LIMIT 1 BY scoreId');
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
    expect(scoreOnly.match(/current_scores AS/g)).toHaveLength(1);
    expect(scoreOnly.match(/FROM mastra_score_events/g)).toHaveLength(1);
    expect(scoreOnly).not.toContain('current_spans AS');
    expect(scoreOnly).not.toContain('mastra_span_events');
    expect(repeated.match(/current_spans AS/g)).toHaveLength(1);
    expect(repeated.match(/current_scores AS/g)).toHaveLength(1);
    expect(repeated.match(/FROM current_spans s/g)).toHaveLength(2);
    expect(repeated.match(/FROM current_scores s/g)).toHaveLength(2);
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

  it('fails closed when a trusted plan contains an unmapped field', () => {
    const trusted = plan({ where: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } } });
    const invalid = {
      ...trusted,
      where: { type: 'comparison', field: 'rawSql', operator: 'eq', value: 'x' },
    } as unknown as TrustedTraceQueryPlan;

    expect(() => compileClickHouseTraceQuery(invalid)).toThrow('Unsupported trusted trace-query field');
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
    expect(Object.keys(response.traces[0]!)).toHaveLength(10);
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
