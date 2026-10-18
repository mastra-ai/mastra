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

  it('filters root_scope by plain root columns and leaves computed or related predicates to candidates', () => {
    const compiled = compilePostgresTraceAggregate(
      'custom',
      plan({
        where: {
          op: 'and',
          args: [
            { op: 'eq', left: { path: 'entityName' }, right: { literal: 'agent-a' } },
            { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
            { op: 'eq', left: { path: 'metadata.tenant' }, right: { literal: 'acme' } },
            { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'lookup' } } } },
          ],
        },
      }),
    );

    const rootScope = compiled.text.slice(
      compiled.text.indexOf('root_scope AS'),
      compiled.text.indexOf('current_spans AS'),
    );
    const candidates = compiled.text.slice(compiled.text.indexOf('candidates AS'), compiled.text.indexOf('facts AS'));
    expect(rootScope).toContain('r."entityName" IS NOT DISTINCT FROM $3');
    expect(rootScope).not.toContain(`'error'`);
    expect(rootScope).not.toContain('metadataSearch');
    expect(candidates).not.toContain('r."entityName"');
    expect(candidates).toContain(`THEN 'error'`);
    expect(candidates).toContain('metadataSearch');
    expect(candidates).toContain('FROM current_spans s');
    expect(compiled.values.slice(0, 3)).toEqual([TIME_RANGE.from, TIME_RANGE.to, 'agent-a']);
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

  it('omits the usage join for plans without token or cost measures', () => {
    const compiled = compilePostgresTraceAggregate('public', plan({ measures: ['count', 'duration.p95'] }));

    expect(compiled.text).not.toContain('mastra_metric_events');
    expect(compiled.text).not.toContain('usage');
  });

  it('joins usage per trace, pruning metric rows by the lower time bound only', () => {
    const compiled = compilePostgresTraceAggregate(
      'custom',
      planTraceAggregate(
        parseTraceAggregateRequest({ timeRange: TIME_RANGE, measures: ['tokens.total.sum', 'cost.avg'] }),
        { scope: { organizationId: 'org-a', resourceId: 'res-1' } },
      ),
    );

    const usageRows = compiled.text.slice(compiled.text.indexOf('usage_rows AS'), compiled.text.indexOf('usage AS'));
    expect(usageRows).toContain('FROM "custom"."mastra_metric_events" m');
    expect(usageRows).toContain('SELECT DISTINCT ON (m."metricId")');
    expect(usageRows).toContain('m."traceId" IN (SELECT "traceId" FROM candidates)');
    expect(usageRows).toMatch(/m\."timestamp" >= \$\d+::timestamptz/);
    expect(usageRows).not.toMatch(/m\."timestamp" </);
    expect(usageRows).toMatch(/m\."organizationId" = \$\d+/);
    expect(usageRows).toMatch(/m\."resourceId" = \$\d+/);
    expect(usageRows).not.toContain('org-a');
    expect(usageRows).not.toContain('mastra_model');
    expect(compiled.text).toContain('LEFT JOIN usage u ON u."traceId" = r."traceId"');
    expect(compiled.values).toContainEqual([
      'mastra_model_total_input_tokens',
      'mastra_model_total_output_tokens',
      'mastra_model_output_reasoning_tokens',
      'mastra_model_input_cache_read_tokens',
    ]);
    expect(compiled.values).toContainEqual(['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens']);
    expect(compiled.values).toEqual(expect.arrayContaining(['org-a', 'res-1', 'mixed']));
    expect(compiled.text).toContain('(SUM("t0" + "t1"))::float8');
    expect(compiled.text).toContain('AS "costCoverage"');
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

  it('keeps null token and cost measures null and attaches row cost fields', async () => {
    const { client } = mockClient([
      { d0: 'research', m0: 2, m1: null, m2: 1500, costCoverage: 1, costUnit: 'mixed' },
      { d0: 'scheduler', m0: 2, m1: null, m2: null, costCoverage: null, costUnit: null },
    ]);

    const response = await aggregateTraces(
      client,
      'public',
      plan({ groupBy: ['entityName'], measures: ['count', 'cost.sum', 'tokens.input.avg'] }),
      15000,
    );

    expect(response.rows).toEqual([
      {
        dimensions: { entityName: 'research' },
        measures: { count: 2, 'cost.sum': null, 'tokens.input.avg': 1500 },
        cost: { coverage: 1, unit: 'mixed' },
      },
      {
        dimensions: { entityName: 'scheduler' },
        measures: { count: 2, 'cost.sum': null, 'tokens.input.avg': null },
        cost: { coverage: null, unit: null },
      },
    ]);
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
