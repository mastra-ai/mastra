import { encodeTraceQueryCursor, parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import type { TrustedTraceQueryPlan } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { DuckDBConnection } from '../../db/index';
import { compileDuckDBTraceQuery, queryTraces } from './trace-query';

const TIME_RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };

function plan(input: Record<string, unknown> = {}): TrustedTraceQueryPlan {
  return planTraceQuery(parseTraceQueryRequest({ timeRange: TIME_RANGE, ...input }));
}

describe('DuckDB advanced trace query', () => {
  it('parameterizes literals and compiles one correlated existence check per collection clause', () => {
    const compiled = compileDuckDBTraceQuery(
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

    expect(compiled.sql).not.toContain("factuality' OR TRUE --");
    expect(compiled.values).toContain("factuality' OR TRUE --");
    expect(compiled.sql.match(/EXISTS \(/g)).toHaveLength(1);
    expect(compiled.sql).toContain('s.traceId = r.traceId');
    expect(compiled.sql).toContain('FROM current_scores s');
    expect(compiled.sql).toContain('s.scorerVersion IS NOT DISTINCT FROM ?');
    expect(compiled.sql).toContain('s.scoreSource IS NOT NULL AND s.scoreSource IN (?)');
    expect(compiled.sql).toContain('s.timestamp IS NOT NULL AND s.timestamp >= CAST(? AS TIMESTAMP)');
    expect(compiled.sql).toContain('s.spanId IS NOT NULL');
    expect(compiled.sql).toContain('s.entityVersionId IS NOT DISTINCT FROM ?');
    expect(compiled.sql).toContain('s.parentEntityVersionId IS NOT NULL');
    expect(compiled.sql).toContain('s.rootEntityVersionId IS NULL OR s.rootEntityVersionId NOT IN (?)');
    expect(compiled.values).toContain('2026-01-01T12:00:00.000Z');
  });

  it('parameterizes metadata keys and values with total missing semantics', () => {
    const key = `message'id`;
    const value = `message' OR TRUE --`;
    const compiled = compileDuckDBTraceQuery(
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

    expect(compiled.sql).not.toContain(key);
    expect(compiled.sql).not.toContain(value);
    expect(compiled.sql).toContain(
      `NULLIF(trim(CASE WHEN json_type(r.metadata, ?) = 'VARCHAR' THEN json_extract_string(r.metadata, ?) END), '')`,
    );
    expect(compiled.values).toEqual([
      TIME_RANGE.from,
      TIME_RANGE.to,
      `$.${JSON.stringify(key)}`,
      `$.${JSON.stringify(key)}`,
      value,
      '$."actorRole"',
      '$."actorRole"',
      '$."actorRole"',
      '$."actorRole"',
      'assistant',
      'tool',
      '$."parentMessageId"',
      '$."parentMessageId"',
      101,
    ]);
  });

  it('projects canonical span values with guarded JSON strings and typed timestamps', () => {
    const compiled = compileDuckDBTraceQuery(
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

    expect(compiled.sql.match(/FROM current_spans s/g)).toHaveLength(1);
    expect(compiled.sql).toContain(`json_type(attributes, '$.model') = 'VARCHAR'`);
    expect(compiled.sql).toContain(`json_extract_string(attributes, '$.model')`);
    expect(compiled.sql).toContain(`json_type(attributes, '$.provider') = 'VARCHAR'`);
    expect(compiled.sql).toContain(`date_diff('millisecond', startedAt, endedAt) AS durationMs`);
    expect(compiled.sql).toContain('s.startedAt IS NOT NULL AND s.startedAt >= CAST(? AS TIMESTAMP)');
    expect(compiled.sql).toContain('s.durationMs IS NOT NULL AND s.durationMs > ?');
    expect(compiled.values).toContain('2026-01-01T12:00:00.000Z');
    expect(compiled.values).toContain(5000);
  });

  it('selects the latest logical root before applying completion and time filters', () => {
    const compiled = compileDuckDBTraceQuery(plan());

    expect(compiled.sql).toContain('row_number() OVER (PARTITION BY traceId ORDER BY cursorId DESC)');
    expect(compiled.sql).toContain('FROM current_roots r');
    expect(compiled.sql).toContain('r.endedAt IS NOT NULL');
  });

  it('emits only referenced signal work and reuses current-record CTEs', () => {
    const traceOnly = compileDuckDBTraceQuery(plan());
    const scoreOnly = compileDuckDBTraceQuery(
      plan({
        where: { scores: { some: { op: 'lt', left: { path: 'score' }, right: { literal: 0.5 } } } },
      }),
    );
    const spanOnly = compileDuckDBTraceQuery(
      plan({
        where: { spans: { some: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } } } },
      }),
    );
    const repeatedSpans = compileDuckDBTraceQuery(
      plan({
        where: {
          op: 'and',
          args: [
            { spans: { some: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } } } },
            { spans: { none: { op: 'exists', path: 'error' } } },
          ],
        },
      }),
    );

    expect(traceOnly.sql.match(/FROM span_events/g)).toHaveLength(1);
    expect(traceOnly.sql).not.toContain('score_events');
    expect(traceOnly.sql).not.toContain('current_spans AS');

    expect(scoreOnly.sql.match(/FROM span_events/g)).toHaveLength(1);
    expect(scoreOnly.sql.match(/current_scores AS/g)).toHaveLength(1);
    expect(scoreOnly.sql).not.toContain('current_spans AS');

    expect(spanOnly.sql.match(/FROM span_events/g)).toHaveLength(2);
    expect(spanOnly.sql.match(/current_spans AS/g)).toHaveLength(1);
    expect(spanOnly.sql).not.toContain('score_events');

    expect(repeatedSpans.sql.match(/current_spans AS/g)).toHaveLength(1);
  });

  it('uses total null semantics for negative predicates', () => {
    const compiled = compileDuckDBTraceQuery(
      plan({ where: { op: 'ne', left: { path: 'threadId' }, right: { literal: 'excluded' } } }),
    );

    expect(compiled.sql).toContain('r.threadId IS DISTINCT FROM ?');
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
    const compiled = compileDuckDBTraceQuery(after);

    expect(compiled.sql).toContain('endedAt < CAST(? AS TIMESTAMP)');
    expect(compiled.sql).toContain('traceId > ?');
    expect(compiled.sql).toContain('ORDER BY endedAt DESC, traceId ASC');
    expect(compiled.values.at(-1)).toBe(3);
  });

  it('compiles grouped queries as distinct non-null thread IDs', () => {
    const compiled = compileDuckDBTraceQuery(plan({ group: { by: ['threadId'] }, page: { limit: 4 } }));

    expect(compiled.sql).toContain('WHERE threadId IS NOT NULL');
    expect(compiled.sql).toContain('GROUP BY threadId');
    expect(compiled.sql).toContain('ORDER BY threadId ASC');
    expect(compiled.values.at(-1)).toBe(5);
  });

  it('fails closed when a trusted plan contains an unmapped field', () => {
    const trusted = plan({ where: { op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } } });
    const invalid = {
      ...trusted,
      where: { type: 'comparison', field: 'rawSql', operator: 'eq', value: 'x' },
    } as unknown as TrustedTraceQueryPlan;

    expect(() => compileDuckDBTraceQuery(invalid)).toThrow('Unsupported trusted trace-query field');
  });

  it('returns fixed records and computes the next cursor from the last visible row', async () => {
    const query = vi
      .fn()
      .mockResolvedValue([
        traceRow('trace-a', '2026-01-01T12:00:00.000Z'),
        traceRow('trace-b', '2026-01-01T11:00:00.000Z'),
      ]);
    const response = await queryTraces({ query } as unknown as DuckDBConnection, plan({ page: { limit: 1 } }));

    expect(response).toMatchObject({
      traces: [{ traceId: 'trace-a', rootSpanId: 'root-trace-a', status: 'success' }],
      page: { next: expect.any(String) },
    });
    if (!('traces' in response)) throw new Error('Expected trace results');
    expect(Object.keys(response.traces[0]!)).toHaveLength(10);
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
