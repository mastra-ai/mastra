import type { ClickHouseClient } from '@clickhouse/client';
import {
  parseTraceAggregateRequest,
  planTraceAggregate,
  TraceQueryExecutionError,
  TraceQueryResourceLimitError,
} from '@mastra/core/storage';
import type { TrustedTraceAggregatePlan } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { aggregateTraces, compileClickHouseTraceAggregate } from './trace-aggregate';

const TIME_RANGE = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' };

function plan(input: Record<string, unknown> = {}): TrustedTraceAggregatePlan {
  return planTraceAggregate(parseTraceAggregateRequest({ timeRange: TIME_RANGE, measures: ['count'], ...input }));
}

function mockClient(rows: Record<string, unknown>[] | Error) {
  const query =
    rows instanceof Error ? vi.fn().mockRejectedValue(rows) : vi.fn().mockResolvedValue({ json: async () => rows });
  return { client: { query } as unknown as ClickHouseClient, query };
}

describe('ClickHouse trace aggregate compiler', () => {
  it('selects from the same merge-independent candidate population as trace queries', () => {
    const compiled = compileClickHouseTraceAggregate(
      plan({ where: { op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } } }),
    );

    expect(compiled.query).toContain('LIMIT 1 BY dedupeKey');
    expect(compiled.query).toContain('LIMIT 1 BY traceId');
    expect(compiled.query).toContain('candidates AS (');
    expect(compiled.query).toContain('FROM candidates r');
    expect(compiled.query).not.toContain('FINAL');
    expect(Object.values(compiled.query_params)).toContain('prod');
  });

  it('parameterizes metadata keys and having literals', () => {
    const compiled = compileClickHouseTraceAggregate(
      plan({
        groupBy: ["metadata.tenant' OR 1 --"],
        measures: ['count', 'errorRate'],
        having: { op: 'gt', left: { path: 'errorRate' }, right: { literal: 0.25 } },
      }),
    );

    expect(compiled.query).not.toContain('OR 1');
    expect(compiled.query).not.toContain('0.25');
    expect(Object.values(compiled.query_params)).toContain("tenant' OR 1 --");
    expect(Object.values(compiled.query_params)).toContain(0.25);
    expect(compiled.query).toMatch(/mapContains\(r\.metadataSearch, \{trace_query_\d+:String\}\)/);
    expect(compiled.query).toMatch(/countIf\(isError\) \/ count\(\) > \{trace_query_\d+:Float64\}/);
  });

  it('compiles measures, percentiles, and null-last group ordering', () => {
    const compiled = compileClickHouseTraceAggregate(
      plan({
        groupBy: ['entityName', 'status'],
        measures: ['count', 'errorCount', 'duration.avg', 'duration.p95', 'countDistinct.threadId'],
        orderBy: { field: 'duration.p95', direction: 'desc' },
      }),
    );

    expect(compiled.query).toContain('cityHash64(r.traceId) AS traceSeed');
    expect(compiled.query).toContain('quantileDeterministic(0.95)(durationMs, traceSeed) AS m3');
    expect(compiled.query).not.toMatch(/\bquantile\(/);
    expect(compiled.query).toContain('toFloat64(uniqExact(cd0)) AS m4');
    expect(compiled.query).toContain(`CAST(if(isNotNull(r.error), 'error', 'success') AS Nullable(String)) AS d1`);
    expect(compiled.query).toContain(
      'ORDER BY quantileDeterministic(0.95)(durationMs, traceSeed) DESC NULLS LAST, d0 ASC NULLS LAST, d1 ASC NULLS LAST',
    );
    expect(compiled.query).toContain('GROUP BY d0, d1');
    expect(compiled.query).not.toContain('GROUPING SETS');
    expect(Object.values(compiled.query_params).at(-1)).toBe(101);
  });

  it('suppresses the zero row for an ungrouped empty population', () => {
    const compiled = compileClickHouseTraceAggregate(plan());

    expect(compiled.query).not.toContain('GROUP BY');
    expect(compiled.query).toContain('HAVING count() > 0');
  });

  it('compiles empty membership lists to constants', () => {
    // The request grammar rejects empty lists; the trusted plan type still allows them.
    const compiled = compileClickHouseTraceAggregate({
      ...plan(),
      having: {
        type: 'boolean',
        operator: 'or',
        args: [
          { type: 'membership', measure: 'count', operator: 'in', values: [] },
          { type: 'membership', measure: 'count', operator: 'nin', values: [] },
        ],
      },
    });

    expect(compiled.query).toContain('HAVING count() > 0 AND ((0) OR (1))');
  });

  it('ranks groups on whole-window measures before expanding buckets', () => {
    const compiled = compileClickHouseTraceAggregate(
      plan({
        groupBy: ['entityName'],
        interval: '1h',
        measures: ['errorRate'],
        having: { op: 'gte', left: { path: 'count' }, right: { literal: 2 } },
        limit: 5,
      }),
    );

    expect(compiled.query).toContain('GROUP BY GROUPING SETS ((d0, bucket), (d0))');
    expect(compiled.query).toContain('grouping(bucket) = 1 AS __isGroup');
    expect(compiled.query).toMatch(
      /ifNull\(count\(\) > 0 AND \(toFloat64\(count\(\)\) >= \{trace_query_\d+:Float64\}\), 0\) AS __keep/,
    );
    expect(compiled.query).toContain('toFloat64(count()) AS __order');
    expect(compiled.query).toContain(
      'row_number() OVER (PARTITION BY __isGroup, __keep ORDER BY __order DESC NULLS LAST, d0 ASC NULLS LAST)',
    );
    expect(compiled.query).toContain('maxIf(__groupRank, __isGroup) OVER (PARTITION BY d0) AS __rank');
    expect(compiled.query).toContain('intDiv(toUnixTimestamp64Milli(r.startedAt), 3600000) * 3600000');
    expect(compiled.query).toMatch(/WHERE NOT __isGroup AND __rank BETWEEN 1 AND \{trace_query_\d+:UInt64\}/);
    expect(compiled.query).toContain('ORDER BY __rank ASC, bucket ASC');
    expect(Object.values(compiled.query_params).slice(-2)).toEqual([2, 5]);
  });

  it('expands an ungrouped interval request against the whole-window total', () => {
    const compiled = compileClickHouseTraceAggregate(plan({ interval: '1d' }));

    expect(compiled.query).toContain('GROUP BY GROUPING SETS ((bucket), ())');
    expect(compiled.query).toContain('maxIf(__groupRank, __isGroup) OVER () AS __rank');
  });

  it('fails closed on unmapped dimensions and measures', () => {
    const base = plan();
    expect(() => compileClickHouseTraceAggregate({ ...base, dimensions: ['traceId' as never] })).toThrow(
      'Unsupported trusted trace-aggregate field',
    );
    expect(() =>
      compileClickHouseTraceAggregate({ ...base, measures: [{ type: 'canonical', name: 'tokens.total' as never }] }),
    ).toThrow('Unsupported trusted trace-aggregate measure');
  });

  it('omits the usage join for plans without token or cost measures', () => {
    const compiled = compileClickHouseTraceAggregate(plan({ measures: ['count', 'duration.p95'] }));

    expect(compiled.query).not.toContain('mastra_metric_events');
    expect(compiled.query).not.toContain('usage');
  });

  it('joins usage per trace, deduplicating metricId and pruning by the lower time bound only', () => {
    const compiled = compileClickHouseTraceAggregate(
      planTraceAggregate(
        parseTraceAggregateRequest({ timeRange: TIME_RANGE, measures: ['tokens.total.sum', 'cost.avg'] }),
        { scope: { organizationId: 'org-a', resourceId: 'res-1' } },
      ),
    );

    const usage = compiled.query.slice(compiled.query.indexOf('usage AS'), compiled.query.indexOf('facts AS'));
    expect(usage).toContain('FROM mastra_metric_events');
    expect(usage).toContain('argMax(tuple(name, value, estimatedCost, costUnit, hasError), timestamp) AS latest');
    expect(usage).toContain('GROUP BY traceId, metricId');
    expect(usage).not.toContain('LIMIT 1 BY');
    expect(usage).not.toContain('FINAL');
    expect(usage).toContain('traceId IN (SELECT traceId FROM candidates)');
    expect(usage).toMatch(/timestamp >= \{trace_query_\d+:DateTime64\(3, 'UTC'\)\}/);
    expect(usage).not.toMatch(/timestamp </);
    expect(usage).toMatch(/organizationId = \{trace_query_\d+:String\}/);
    expect(usage).toMatch(/resourceId = \{trace_query_\d+:String\}/);
    expect(usage).not.toContain('org-a');
    expect(usage).not.toContain('mastra_model');
    expect(compiled.query).toContain('LEFT JOIN usage u ON u.traceId = r.traceId');
    expect(Object.values(compiled.query_params)).toEqual(
      expect.arrayContaining([
        'mastra_model_total_input_tokens',
        'mastra_model_total_output_tokens',
        'mastra_model_output_reasoning_tokens',
        'mastra_model_input_cache_read_tokens',
        'org-a',
        'res-1',
        'mixed',
      ]),
    );
    expect(compiled.query).toContain('toFloat64(sumOrNull(t0 + t1))');
    expect(compiled.query).toContain('countIf(covered) / nullIf(countIf(usageBearing), 0) AS costCoverage');
  });
});

describe('ClickHouse trace aggregate execution', () => {
  it('shapes rows and reports truncation from the extra group', async () => {
    const { client, query } = mockClient([
      { d0: 'triage', m0: 3, m1: 0.5 },
      { d0: null, m0: 1, m1: 0 },
    ]);

    const response = await aggregateTraces(
      client,
      plan({ groupBy: ['entityName'], measures: ['count', 'errorRate'], limit: 1 }),
      15_000,
    );

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ clickhouse_settings: expect.objectContaining({ max_execution_time: 15 }) }),
    );
    expect(response).toEqual({
      rows: [{ dimensions: { entityName: 'triage' }, measures: { count: 3, errorRate: 0.5 } }],
      truncated: true,
    });
  });

  it('returns null dimensions and ISO buckets, and reads truncation from the ranked groups', async () => {
    const { client } = mockClient([
      { d0: null, bucket: '2026-01-01T01:00:00.000Z', m0: 2, truncated: 1 },
      { d0: null, bucket: '2026-01-01T02:00:00.000Z', m0: 1, truncated: 1 },
    ]);

    const response = await aggregateTraces(client, plan({ groupBy: ['entityName'], interval: '1h' }), 15_000);

    expect(response).toEqual({
      rows: [
        { dimensions: { entityName: null }, bucket: '2026-01-01T01:00:00.000Z', measures: { count: 2 } },
        { dimensions: { entityName: null }, bucket: '2026-01-01T02:00:00.000Z', measures: { count: 1 } },
      ],
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
      plan({ groupBy: ['entityName'], measures: ['count', 'cost.sum', 'tokens.input.avg'] }),
      15_000,
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
    await expect(aggregateTraces(client, plan({ interval: '1d' }), 15_000)).resolves.toEqual({
      rows: [],
      truncated: false,
    });
  });

  it('maps execution timeouts and memory limits like trace queries', async () => {
    const timeout = Object.assign(new Error('Timeout exceeded'), { code: '159', type: 'TIMEOUT_EXCEEDED' });
    await expect(aggregateTraces(mockClient(timeout).client, plan(), 15_000)).rejects.toBeInstanceOf(
      TraceQueryExecutionError,
    );

    const memory = Object.assign(new Error('Memory limit exceeded'), { code: '241', type: 'MEMORY_LIMIT_EXCEEDED' });
    await expect(aggregateTraces(mockClient(memory).client, plan(), 15_000)).rejects.toBeInstanceOf(
      TraceQueryResourceLimitError,
    );
  });
});
