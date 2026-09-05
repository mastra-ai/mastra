import {
  encodeTraceQueryCursor,
  parseTraceQueryRequest,
  planTraceQuery,
  TraceQueryExecutionError,
} from '@mastra/core/storage';
import type { TrustedTraceQueryPlan } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { DbClient } from '../../../client';
import { compilePostgresTraceQuery, queryTraces } from './trace-query';
import { ObservabilityStoragePostgresVNext } from '.';

const TIME_RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };

function plan(input: Record<string, unknown> = {}): TrustedTraceQueryPlan {
  return planTraceQuery(parseTraceQueryRequest({ timeRange: TIME_RANGE, ...input }));
}

describe('Postgres advanced trace query', () => {
  it('rejects invalid trace-query timeout configuration at construction', () => {
    expect(
      () =>
        new ObservabilityStoragePostgresVNext({
          client: {} as DbClient,
          traceQueryTimeoutMs: Number.POSITIVE_INFINITY,
        }),
    ).toThrow('traceQueryTimeoutMs must be an integer between');
  });

  it('parameterizes literals and compiles one correlated existence check per collection clause', () => {
    const compiled = compilePostgresTraceQuery(
      'custom',
      plan({
        where: {
          scores: {
            some: {
              op: 'and',
              args: [
                { op: 'eq', left: { path: 'scorerId' }, right: { literal: "factuality' OR TRUE --" } },
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

    expect(compiled.text).not.toContain("factuality' OR TRUE --");
    expect(compiled.values).toContain("factuality' OR TRUE --");
    expect(compiled.text.match(/EXISTS \(/g)).toHaveLength(3);
    expect(compiled.text).toContain('s."traceId" = r."traceId"');
    expect(compiled.text).toContain('newer."scoreId" = s."scoreId"');
    expect(compiled.text).toContain('s."scorerVersion" IS NOT DISTINCT FROM');
    expect(compiled.text).toContain('s."scoreSource" IS NOT NULL');
    expect(compiled.text).toContain('s."timestamp" IS NOT NULL AND s."timestamp" >=');
    expect(compiled.text).toContain('s."spanId" IS NOT NULL');
    expect(compiled.text).toContain('s."entityVersionId" IS NOT DISTINCT FROM');
    expect(compiled.text).toContain('s."parentEntityVersionId" IS NOT NULL');
    expect(compiled.text).toContain('s."rootEntityVersionId" IS NULL OR s."rootEntityVersionId" NOT IN');
    expect(compiled.values).toContain('2026-01-01T12:00:00.000Z');
  });

  it('emits only referenced relation scopes and reuses each current-record reconstruction', () => {
    const spanClause = {
      spans: { some: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } } },
    };
    const scoreClause = {
      scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: 0.6 } } },
    };
    const traceOnly = compilePostgresTraceQuery('public', plan()).text;
    const spanOnly = compilePostgresTraceQuery('public', plan({ where: spanClause })).text;
    const scoreOnly = compilePostgresTraceQuery('public', plan({ where: scoreClause })).text;
    const repeated = compilePostgresTraceQuery(
      'public',
      plan({ where: { op: 'and', args: [spanClause, spanClause, scoreClause, scoreClause] } }),
    ).text;

    expect(traceOnly).not.toContain('current_spans AS');
    expect(traceOnly).not.toContain('current_scores AS');
    expect(traceOnly).not.toContain('mastra_score_events');
    expect(spanOnly.match(/current_spans AS MATERIALIZED/g)).toHaveLength(1);
    expect(spanOnly).not.toContain('current_scores AS');
    expect(spanOnly).not.toContain('mastra_score_events');
    expect(scoreOnly.match(/current_scores AS MATERIALIZED/g)).toHaveLength(1);
    expect(scoreOnly).not.toContain('current_spans AS');
    expect(repeated.match(/current_spans AS MATERIALIZED/g)).toHaveLength(1);
    expect(repeated.match(/current_scores AS MATERIALIZED/g)).toHaveLength(1);
    expect(repeated.match(/FROM current_spans s/g)).toHaveLength(2);
    expect(repeated.match(/FROM current_scores s/g)).toHaveLength(2);
  });

  it('filters null-ended roots before projection and pagination', () => {
    const compiled = compilePostgresTraceQuery('public', plan());

    expect(compiled.text).toContain('NOT r."isPending"');
    expect(compiled.text).toContain('r."endedAt" IS NOT NULL');
  });

  it('uses total null semantics for negative predicates', () => {
    const compiled = compilePostgresTraceQuery(
      'public',
      plan({ where: { op: 'ne', left: { path: 'threadId' }, right: { literal: 'excluded' } } }),
    );

    expect(compiled.text).toContain('r."threadId" IS DISTINCT FROM $3');
  });

  it('matches the requested keyset order and always ties on traceId ascending', () => {
    const first = plan({ orderBy: [{ field: 'endedAt', direction: 'desc' }], page: { limit: 2 } });
    const after = plan({
      orderBy: [{ field: 'endedAt', direction: 'desc' }],
      page: {
        limit: 2,
        after: queryCursor(first, { sortValue: '2026-01-01T12:00:00.000Z', traceId: 'trace-b' }),
      },
    });
    const compiled = compilePostgresTraceQuery('public', after);

    expect(compiled.text).toContain('"endedAt" < $3');
    expect(compiled.text).toContain('"traceId" > $4');
    expect(compiled.text).toContain('ORDER BY "endedAt" DESC, "traceId" ASC');
    expect(compiled.values.at(-1)).toBe(3);
  });

  it('compiles grouped queries as distinct non-null thread IDs', () => {
    const compiled = compilePostgresTraceQuery('public', plan({ group: { by: ['threadId'] }, page: { limit: 4 } }));

    expect(compiled.text).toContain('WHERE "threadId" IS NOT NULL');
    expect(compiled.text).toContain('GROUP BY "threadId"');
    expect(compiled.text).toContain('ORDER BY "threadId" ASC');
    expect(compiled.values.at(-1)).toBe(5);
  });

  it('fails closed when a trusted plan contains an unmapped field', () => {
    const trusted = plan({ where: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } } });
    const invalid = {
      ...trusted,
      where: { type: 'comparison', field: 'rawSql', operator: 'eq', value: 'x' },
    } as unknown as TrustedTraceQueryPlan;

    expect(() => compilePostgresTraceQuery('public', invalid)).toThrow('Unsupported trusted trace-query field');
  });

  it('applies a transaction-local timeout and computes the next cursor from the last visible row', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const any = vi
      .fn()
      .mockResolvedValue([
        traceRow('trace-a', '2026-01-01T12:00:00.000Z'),
        traceRow('trace-b', '2026-01-01T11:00:00.000Z'),
      ]);
    const tx = vi.fn(async callback => callback({ query, any }));
    const response = await queryTraces({ tx } as unknown as DbClient, 'public', plan({ page: { limit: 1 } }), 15_000);

    expect(query).toHaveBeenCalledWith(`SELECT set_config('statement_timeout', $1, true)`, ['15000ms']);
    expect(response).toMatchObject({
      traces: [
        {
          traceId: 'trace-a',
          rootSpanId: 'root-trace-a',
          status: 'success',
        },
      ],
      page: { next: expect.any(String) },
    });
    expect(Object.keys(response.traces[0]!)).toHaveLength(10);
  });

  it('never converts a null database timestamp into an epoch cursor', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const any = vi.fn().mockResolvedValue([{ ...traceRow('malformed', '2026-01-01T12:00:00.000Z'), endedAt: null }]);
    const tx = vi.fn(async callback => callback({ query, any }));

    await expect(queryTraces({ tx } as unknown as DbClient, 'public', plan(), 15_000)).rejects.toThrow(
      'Trace query returned a null timestamp',
    );
  });

  it('normalizes PostgreSQL statement timeouts without exposing driver details', async () => {
    const driverError = Object.assign(new Error('canceling statement due to statement timeout: SELECT secret'), {
      code: '57014',
    });
    const tx = vi.fn().mockRejectedValue(driverError);

    await expect(queryTraces({ tx } as unknown as DbClient, 'public', plan(), 1)).rejects.toEqual(
      expect.objectContaining<Partial<TraceQueryExecutionError>>({
        code: 'TRACE_QUERY_EXECUTION_TIMEOUT',
        message: 'The trace query exceeded its execution timeout',
      }),
    );
  });
});

function queryCursor(plan: TrustedTraceQueryPlan, values: { sortValue: string; traceId: string }): string {
  if (plan.result !== 'traces') throw new Error('Expected a trace plan');
  return encodeTraceQueryCursor(plan, { result: 'traces', ...values });
}

function traceRow(traceId: string, startedAt: string) {
  return {
    traceId,
    rootSpanId: `root-${traceId}`,
    threadId: null,
    resourceId: null,
    startedAt: new Date(startedAt),
    endedAt: new Date(new Date(startedAt).getTime() + 1_000),
    entityName: null,
    entityType: null,
    environment: null,
    status: 'success',
  };
}
