import {
  parseTraceAggregateRequest,
  planTraceAggregate,
  TraceQueryExecutionError,
  TraceQueryResourceLimitError,
} from '@mastra/core/storage';
import type { TrustedTraceAggregatePlan } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { DbClient } from '../../../client';
import { aggregateTraces, compilePostgresTraceAggregate } from './trace-aggregate';

const TIME_RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };

function plan(input: Record<string, unknown> = {}): TrustedTraceAggregatePlan {
  return planTraceAggregate(parseTraceAggregateRequest({ timeRange: TIME_RANGE, measures: ['count'], ...input }));
}

function mockClient(rows: Record<string, unknown>[] | Error) {
  const any = rows instanceof Error ? vi.fn().mockRejectedValue(rows) : vi.fn().mockResolvedValue(rows);
  const query = vi.fn();
  const tx = vi.fn(async callback => callback({ any, query }));
  return { client: { tx } as unknown as DbClient, any, query };
}

describe('Postgres trace aggregate compiler', () => {
  it('selects from the same candidate population as trace queries', () => {
    const compiled = compilePostgresTraceAggregate(
      'custom',
      plan({ where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } } }),
    );

    expect(compiled.text).toContain('root_scope AS MATERIALIZED');
    expect(compiled.text).toContain('candidates AS (');
    expect(compiled.text).toContain('FROM candidates r');
    expect(compiled.text).toContain('"custom"."mastra_span_events"');
    expect(compiled.values.slice(0, 3)).toEqual([TIME_RANGE.from, TIME_RANGE.to, 'prod']);
  });

  it('parameterizes metadata keys and having literals', () => {
    const compiled = compilePostgresTraceAggregate(
      'public',
      plan({
        groupBy: ["metadata.tenant' OR TRUE --"],
        measures: ['count', 'errorRate'],
        having: { op: 'gt', left: { path: 'errorRate' }, right: { literal: 0.25 } },
      }),
    );

    expect(compiled.text).not.toContain('OR TRUE');
    expect(compiled.text).not.toContain('0.25');
    expect(compiled.values).toContain("tenant' OR TRUE --");
    expect(compiled.values).toContain(0.25);
    expect(compiled.text).toMatch(/r\."metadataSearch" ->> \$\d+/);
  });

  it('compiles measures, percentiles, and null-last group ordering', () => {
    const compiled = compilePostgresTraceAggregate(
      'public',
      plan({
        groupBy: ['entityName', 'status'],
        measures: ['count', 'errorCount', 'duration.avg', 'duration.p95', 'countDistinct.threadId'],
        orderBy: { field: 'duration.p95', direction: 'desc' },
      }),
    );

    expect(compiled.text).toContain('percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")');
    expect(compiled.text).toContain('COUNT(DISTINCT "cd0")');
    expect(compiled.text).toContain(`CASE WHEN r."error" IS NOT NULL THEN 'error' ELSE 'success' END`);
    expect(compiled.text).toContain(
      'ORDER BY percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") DESC NULLS LAST, "d0" COLLATE "C" ASC NULLS LAST, "d1" COLLATE "C" ASC NULLS LAST',
    );
    expect(compiled.text).toContain('GROUP BY "d0", "d1"');
    expect(compiled.text).not.toContain('ranked');
    expect(compiled.values.at(-1)).toBe(101);
  });

  it('suppresses the zero row for an ungrouped empty population', () => {
    const compiled = compilePostgresTraceAggregate('public', plan());

    expect(compiled.text).toContain('GROUP BY ()');
    expect(compiled.text).toContain('HAVING COUNT(*) > 0');
  });

  it('ranks groups on whole-window measures before expanding buckets', () => {
    const compiled = compilePostgresTraceAggregate(
      'public',
      plan({
        groupBy: ['entityName'],
        interval: '1h',
        measures: ['errorRate'],
        having: { op: 'gte', left: { path: 'count' }, right: { literal: 2 } },
        limit: 5,
      }),
    );

    expect(compiled.text).toContain('ranked AS (');
    expect(compiled.text).toContain('row_number() OVER (ORDER BY COUNT(*)::float8 DESC NULLS LAST');
    expect(compiled.text).toContain(
      `COALESCE(f."d0", '') = COALESCE(g."d0", '') AND (f."d0" IS NULL) = (g."d0" IS NULL)`,
    );
    expect(compiled.text).toContain('floor(EXTRACT(EPOCH FROM r."startedAt") * 1000 / 3600000) * 3600000');
    expect(compiled.text).toContain('ORDER BY g."rank" ASC, f."bucket" ASC');
    expect(compiled.values.slice(-3)).toEqual([2, 6, 5]);
  });

  it('fails closed on unmapped dimensions and measures', () => {
    const base = plan();
    expect(() => compilePostgresTraceAggregate('public', { ...base, dimensions: ['traceId' as never] })).toThrow(
      'Unsupported trusted trace-aggregate field',
    );
    expect(() =>
      compilePostgresTraceAggregate('public', {
        ...base,
        measures: [{ type: 'canonical', name: 'tokens.total' as never }],
      }),
    ).toThrow('Unsupported trusted trace-aggregate measure');
  });
});

describe('Postgres trace aggregate execution', () => {
  it('shapes rows and reports truncation from the extra group', async () => {
    const { client, query } = mockClient([
      { d0: 'triage', m0: 3, m1: '0.5' },
      { d0: null, m0: 1, m1: 0 },
    ]);

    const response = await aggregateTraces(
      client,
      'public',
      plan({ groupBy: ['entityName'], measures: ['count', 'errorRate'], limit: 1 }),
      15000,
    );

    expect(query).toHaveBeenCalledWith(`SELECT set_config('statement_timeout', $1, true)`, ['15000ms']);
    expect(response).toEqual({
      rows: [{ dimensions: { entityName: 'triage' }, measures: { count: 3, errorRate: 0.5 } }],
      truncated: true,
    });
  });

  it('returns buckets as ISO timestamps and reads truncation from the ranked groups', async () => {
    const { client } = mockClient([{ bucket: new Date('2026-01-01T01:00:00.000Z'), m0: 2, truncated: true }]);

    const response = await aggregateTraces(client, 'public', plan({ interval: '1h' }), 15000);

    expect(response).toEqual({
      rows: [{ bucket: '2026-01-01T01:00:00.000Z', measures: { count: 2 } }],
      truncated: true,
    });
  });

  it('returns no rows for an empty population', async () => {
    const { client } = mockClient([]);
    await expect(aggregateTraces(client, 'public', plan({ interval: '1d' }), 15000)).resolves.toEqual({
      rows: [],
      truncated: false,
    });
  });

  it('maps statement timeouts and resource limits like trace queries', async () => {
    const timeout = Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' });
    await expect(aggregateTraces(mockClient(timeout).client, 'public', plan(), 15000)).rejects.toBeInstanceOf(
      TraceQueryExecutionError,
    );

    const resources = Object.assign(new Error('out of memory'), { code: '53200' });
    await expect(aggregateTraces(mockClient(resources).client, 'public', plan(), 15000)).rejects.toBeInstanceOf(
      TraceQueryResourceLimitError,
    );
  });
});
