import type { ClickHouseClient } from '@clickhouse/client';
import {
  encodeTraceQueryCursor,
  parseTraceQueryRequest,
  planTraceQuery,
  TraceQueryExecutionError,
} from '@mastra/core/storage';
import type { TrustedTraceQueryPlan } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ALL_MIGRATIONS, SCORE_EVENTS_DDL, SPAN_EVENTS_DDL, TRACE_BRANCHES_DDL, TRACE_ROOTS_DDL } from './ddl';
import { spanRecordToRow } from './helpers';
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
                { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } },
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
  });

  it('collapses roots and related records without relying on background merges', () => {
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
    expect(compiled.query).toContain('WHERE NOT isPending');
    expect(compiled.query).toContain('ORDER BY dedupeKey, isPending ASC, ingestionVersion DESC');
    expect(compiled.query).toContain('ORDER BY traceId, ingestionVersion DESC');
    expect(compiled.query).toContain('LIMIT 1 BY dedupeKey');
    expect(compiled.query).toContain('LIMIT 1 BY traceId');
    expect(compiled.query).not.toMatch(/\bFINAL\b|\bOPTIMIZE\b/);
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

  it('persists replacement order in source and materialized trace tables', () => {
    for (const ddl of [SPAN_EVENTS_DDL, TRACE_ROOTS_DDL, TRACE_BRANCHES_DDL, SCORE_EVENTS_DDL]) {
      expect(ddl).toMatch(/ingestionVersion\s+UInt128/);
      expect(ddl).toContain('ReplacingMergeTree(ingestionVersion)');
      expect(ddl).toMatch(/ORDER BY \([^)]*ingestionVersion\)/);
    }
    expect(
      ALL_MIGRATIONS.filter(migration => migration.name === 'ingestionVersion').map(migration => migration.table),
    ).toEqual(['mastra_span_events', 'mastra_trace_roots', 'mastra_trace_branches', 'mastra_score_events']);

    const first = spanRecordToRow({
      traceId: 'trace-versioned',
      spanId: 'span-versioned',
      startedAt: new Date('2026-08-01T00:00:00Z'),
      endedAt: new Date('2026-08-01T00:00:01Z'),
    } as Parameters<typeof spanRecordToRow>[0]);
    const second = spanRecordToRow({
      traceId: 'trace-versioned',
      spanId: 'span-versioned',
      startedAt: new Date('2026-08-01T00:00:00Z'),
      endedAt: new Date('2026-08-01T00:00:01Z'),
    } as Parameters<typeof spanRecordToRow>[0]);
    expect(BigInt(second.ingestionVersion as string)).toBeGreaterThan(BigInt(first.ingestionVersion as string));
  });

  it('persists pending state in source and materialized trace tables', () => {
    expect(SPAN_EVENTS_DDL).toMatch(/isPending\s+Bool/);
    expect(TRACE_ROOTS_DDL).toMatch(/isPending\s+Bool/);
    expect(TRACE_BRANCHES_DDL).toMatch(/isPending\s+Bool/);
    expect(
      ALL_MIGRATIONS.filter(migration => migration.name === 'isPending').map(migration => migration.table),
    ).toEqual(['mastra_span_events', 'mastra_trace_roots', 'mastra_trace_branches']);

    const row = spanRecordToRow({
      traceId: 'trace-running',
      spanId: 'root-running',
      parentSpanId: null,
      startedAt: new Date('2026-08-01T00:00:00Z'),
      endedAt: null,
    } as Parameters<typeof spanRecordToRow>[0]);
    expect(row.isPending).toBe(true);
    expect(row.endedAt).toEqual(row.startedAt);
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
