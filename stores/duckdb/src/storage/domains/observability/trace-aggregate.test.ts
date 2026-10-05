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

/** Inlines positional values into the SQL so tests can check each one lands at its placeholder. */
function render(compiled: { sql: string; values: unknown[] }): string {
  let index = 0;
  return compiled.sql.replace(/\?/g, () => {
    const value = compiled.values[index++];
    return typeof value === 'string' ? `'${value}'` : String(value);
  });
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
    expect(compiled.sql).toMatch(/root_trace_ids AS \([\s\S]*?r\.environment IS NOT DISTINCT FROM \?/);
    expect(compiled.values.slice(0, 6)).toEqual([
      TIME_RANGE.from,
      TIME_RANGE.to,
      'prod',
      TIME_RANGE.from,
      TIME_RANGE.to,
      'prod',
    ]);
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
    expect(compiled.values).toEqual([
      TIME_RANGE.from,
      TIME_RANGE.to,
      TIME_RANGE.from,
      TIME_RANGE.to,
      path,
      path,
      path,
      path,
      0.25,
      101,
    ]);
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

    expect(compiled.sql).not.toMatch(/FROM facts[\s\S]*GROUP BY/);
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

  it('omits the usage join for plans without token or cost measures', () => {
    const compiled = compileDuckDBTraceAggregate(plan({ measures: ['count', 'duration.p95'] }));

    expect(compiled.sql).not.toContain('metric_events');
    expect(compiled.sql).not.toContain('usage');
  });

  it('joins usage per trace, pruning metric rows by the lower time bound only', () => {
    const compiled = compileDuckDBTraceAggregate(
      planTraceAggregate(
        parseTraceAggregateRequest({ timeRange: TIME_RANGE, measures: ['tokens.total.sum', 'cost.avg'] }),
        { scope: { organizationId: 'org-a', resourceId: 'res-1' } },
      ),
    );

    const sql = render(compiled);
    const between = (from: string, to: string) => sql.slice(sql.indexOf(from), sql.indexOf(to));
    // candidates is read once, into the narrow base_facts.
    expect(sql.match(/FROM candidates/g)).toHaveLength(1);
    expect(between('base_facts AS', 'usage_bounds AS')).toContain('FROM candidates r');
    const bounds = between('usage_bounds AS', 'usage_rows AS');
    expect(bounds).toContain('traceId IN (SELECT traceId FROM base_facts)');
    expect(bounds).toContain(`timestamp >= CAST('${TIME_RANGE.from}' AS TIMESTAMP)`);
    expect(bounds).toContain(`organizationId = 'org-a'`);
    expect(bounds).toContain(`resourceId = 'res-1'`);
    const rows = between('usage_rows AS', 'usage AS');
    expect(rows).toContain('m.timestamp >= (SELECT minTs FROM usage_bounds)');
    expect(rows).toContain('m.timestamp <= (SELECT maxTs FROM usage_bounds)');
    expect(rows).toContain('m.traceId IN (SELECT traceId FROM base_facts)');
    expect(rows).toContain(`m.organizationId = 'org-a'`);
    expect(rows).toContain(
      `CASE WHEN m.name IN ('mastra_model_total_input_tokens', 'mastra_model_total_output_tokens')`,
    );
    // No upper bound from the request: only the exact range of qualifying rows.
    expect(between('usage_bounds AS', 'LEFT JOIN usage')).not.toContain(`'${TIME_RANGE.to}'`);
    expect(compiled.sql).not.toContain('org-a');
    expect(compiled.sql).not.toContain('mastra_model');
    expect(sql).toContain('LEFT JOIN usage u ON u.traceId = b.traceId');
    expect(sql).toContain('CAST(sum(t0 + t1) AS DOUBLE)');
    expect(sql).toContain('CAST(count_if(covered) AS DOUBLE) / NULLIF(count_if(usageBearing), 0) AS costCoverage');
    expect(placeholders(compiled.sql)).toBe(compiled.values.length);
  });

  it('dedupes metric rows only when metricId is not known to be unique', () => {
    const tokensPlan = plan({ measures: ['tokens.input.sum'] });

    expect(compileDuckDBTraceAggregate(tokensPlan).sql).toContain('SELECT DISTINCT ON (m.metricId) m.traceId');
    expect(compileDuckDBTraceAggregate(tokensPlan, { metricIdsUnique: true }).sql).not.toContain('DISTINCT ON');
  });

  it('reads no cost columns for token-only plans', () => {
    const sql = compileDuckDBTraceAggregate(plan({ measures: ['tokens.input.sum', 'tokens.output.avg'] })).sql;

    for (const column of [
      'estimatedCost',
      'costUnit',
      'costMetadata',
      'json_type',
      'costRow',
      'traceCost',
      'unitMin',
    ]) {
      expect(sql).not.toContain(column);
    }
  });

  it('binds placeholders in text order with metadata dimensions, scope, having, and interval', () => {
    const compiled = compileDuckDBTraceAggregate(
      planTraceAggregate(
        parseTraceAggregateRequest({
          timeRange: TIME_RANGE,
          where: { op: 'eq', left: { path: 'metadata.tenant' }, right: { literal: 'acme' } },
          groupBy: ['metadata.region'],
          interval: '1h',
          measures: ['cost.sum', 'tokens.input.sum', 'countDistinct.metadata.team'],
          having: { op: 'gt', left: { path: 'tokens.input.sum' }, right: { literal: 10 } },
          orderBy: { field: 'cost.sum', direction: 'desc' },
        }),
        { scope: { organizationId: 'org-a' } },
      ),
    );

    expect(placeholders(compiled.sql)).toBe(compiled.values.length);
    const sql = render(compiled);
    const baseFacts = sql.slice(sql.indexOf('base_facts AS'), sql.indexOf('usage_bounds AS'));
    expect(baseFacts).toContain(`'$."region"'`);
    expect(baseFacts).toContain(`'$."team"'`);
    const usage = sql.slice(sql.indexOf('usage_bounds AS'), sql.indexOf('LEFT JOIN usage'));
    expect(usage).toContain(`timestamp >= CAST('${TIME_RANGE.from}' AS TIMESTAMP)`);
    expect(usage).toContain(`name = 'mastra_model_input_cache_read_tokens'`);
    expect(usage).not.toContain(`'$."region"'`);
    expect(compiled.values.slice(-4)).toEqual([10, 101, 100, 100]);
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

  it('keeps null token and cost measures null and attaches row cost fields', async () => {
    const { db } = mockDb([
      { d0: 'research', m0: 2, m1: null, m2: 1500, costCoverage: 1, costUnit: 'mixed' },
      { d0: 'scheduler', m0: 2, m1: null, m2: null, costCoverage: null, costUnit: null },
    ]);

    const response = await aggregateTraces(
      db,
      plan({ groupBy: ['entityName'], measures: ['count', 'cost.sum', 'tokens.input.avg'] }),
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
