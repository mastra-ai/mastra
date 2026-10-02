import { parseTraceAggregateRequest, planTraceAggregate, TraceQueryResourceLimitError } from '@mastra/core/storage';
import type { TrustedTraceAggregatePlan } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { DuckDBConnection } from '../../db/index';
import { aggregateTraces, compileDuckDBTraceAggregate } from './trace-aggregate';

const TIME_RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };

function plan(input: Record<string, unknown> = {}): TrustedTraceAggregatePlan {
  return planTraceAggregate(parseTraceAggregateRequest({ timeRange: TIME_RANGE, measures: ['count'], ...input }));
}

function placeholders(sql: string): number {
  return sql.match(/\?/g)?.length ?? 0;
}

describe('DuckDB trace aggregate compiler', () => {
  it('selects from the same candidate population as trace queries', () => {
    const compiled = compileDuckDBTraceAggregate(
      plan({ where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } } }),
    );

    expect(compiled.sql).toContain('current_roots AS (');
    expect(compiled.sql).toContain('root_scope AS (');
    expect(compiled.sql).toContain('candidates AS (');
    expect(compiled.sql).toContain('FROM candidates r');
    expect(compiled.values.slice(0, 3)).toEqual([TIME_RANGE.from, TIME_RANGE.to, 'prod']);
    expect(placeholders(compiled.sql)).toBe(compiled.values.length);
  });

  it('parameterizes metadata keys and having literals in placeholder order', () => {
    const compiled = compileDuckDBTraceAggregate(
      plan({
        groupBy: ["metadata.tenant' OR TRUE --"],
        measures: ['count', 'errorRate', "countDistinct.metadata.tenant' OR TRUE --"],
        having: { op: 'gt', left: { path: 'errorRate' }, right: { literal: 0.25 } },
      }),
    );

    const path = `$.${JSON.stringify("tenant' OR TRUE --")}`;
    expect(compiled.sql).not.toContain('OR TRUE');
    expect(compiled.sql).not.toContain('0.25');
    expect(compiled.sql).toContain("json_type(r.metadata, ?) = 'VARCHAR'");
    expect(compiled.values).toEqual([TIME_RANGE.from, TIME_RANGE.to, path, path, path, path, 0.25, 101]);
    expect(placeholders(compiled.sql)).toBe(compiled.values.length);
  });

  it('compiles measures, percentiles, and null-last group ordering', () => {
    const compiled = compileDuckDBTraceAggregate(
      plan({
        groupBy: ['entityName', 'status'],
        measures: ['count', 'errorCount', 'duration.avg', 'duration.p95', 'countDistinct.threadId'],
        orderBy: { field: 'duration.p95', direction: 'desc' },
      }),
    );

    expect(compiled.sql).toContain('quantile_cont(durationMs, 0.95)');
    expect(compiled.sql).toContain('count(DISTINCT cd0)');
    expect(compiled.sql).toContain(`CASE WHEN r.error IS NOT NULL THEN 'error' ELSE 'success' END`);
    expect(compiled.sql).toContain(
      'ORDER BY quantile_cont(durationMs, 0.95) DESC NULLS LAST, d0 ASC NULLS LAST, d1 ASC NULLS LAST',
    );
    expect(compiled.sql).toContain('GROUP BY d0, d1');
    expect(compiled.sql).not.toContain('ranked');
    expect(compiled.values.at(-1)).toBe(101);
  });

  it('suppresses the zero row for an ungrouped empty population', () => {
    const compiled = compileDuckDBTraceAggregate(plan());

    expect(compiled.sql).not.toContain('GROUP BY');
    expect(compiled.sql).toContain('HAVING count(*) > 0');
  });

  it('ranks groups on whole-window measures before expanding buckets', () => {
    const compiled = compileDuckDBTraceAggregate(
      plan({
        groupBy: ['entityName'],
        interval: '1h',
        measures: ['errorRate'],
        having: { op: 'gte', left: { path: 'count' }, right: { literal: 2 } },
        limit: 5,
      }),
    );

    expect(compiled.sql).toContain('ranked AS (');
    expect(compiled.sql).toContain('row_number() OVER (ORDER BY CAST(count(*) AS DOUBLE) DESC NULLS LAST');
    expect(compiled.sql).toContain('f.d0 IS NOT DISTINCT FROM g.d0');
    expect(compiled.sql).toContain('epoch_ms((epoch_ms(r.startedAt) // 3600000) * 3600000)');
    expect(compiled.sql).toContain('ORDER BY g.rank ASC, f.bucket ASC');
    expect(compiled.values.slice(-4)).toEqual([2, 6, 5, 5]);
    expect(placeholders(compiled.sql)).toBe(compiled.values.length);
  });

  it('fails closed on unmapped dimensions and measures', () => {
    const base = plan();
    expect(() => compileDuckDBTraceAggregate({ ...base, dimensions: ['traceId' as never] })).toThrow(
      'Unsupported trusted trace-aggregate field',
    );
    expect(() =>
      compileDuckDBTraceAggregate({ ...base, measures: [{ type: 'canonical', name: 'tokens.total' as never }] }),
    ).toThrow('Unsupported trusted trace-aggregate measure');
  });
});

describe('DuckDB trace aggregate execution', () => {
  function mockDb(rows: Record<string, unknown>[] | Error) {
    const query = rows instanceof Error ? vi.fn().mockRejectedValue(rows) : vi.fn().mockResolvedValue(rows);
    return { db: { query } as unknown as DuckDBConnection, query };
  }

  it('shapes rows and reports truncation from the extra group', async () => {
    const { db } = mockDb([
      { d0: 'triage', m0: 3, m1: 0.5 },
      { d0: null, m0: 1, m1: 0 },
    ]);

    const response = await aggregateTraces(
      db,
      plan({ groupBy: ['entityName'], measures: ['count', 'errorRate'], limit: 1 }),
    );

    expect(response).toEqual({
      rows: [{ dimensions: { entityName: 'triage' }, measures: { count: 3, errorRate: 0.5 } }],
      truncated: true,
    });
  });

  it('serializes buckets as UTC ISO strings and reads truncation from the ranked count', async () => {
    const { db } = mockDb([{ bucket: new Date('2026-01-01T01:00:00.000Z'), m0: 2, truncated: false }]);

    const response = await aggregateTraces(db, plan({ interval: '1h' }));

    expect(response).toEqual({
      rows: [{ bucket: '2026-01-01T01:00:00.000Z', measures: { count: 2 } }],
      truncated: false,
    });
  });

  it('maps out-of-memory failures to a resource-limit error', async () => {
    const { db } = mockDb(new Error('Out of Memory Error: failed to allocate'));

    await expect(aggregateTraces(db, plan())).rejects.toBeInstanceOf(TraceQueryResourceLimitError);
  });
});
