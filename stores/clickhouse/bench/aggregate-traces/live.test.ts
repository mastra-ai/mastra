import { describe, expect, it } from 'vitest';

import { cte, isAggregateStatement, parseAggregateShape, shapeKey, splitItems, summarize } from './live';
import type { LiveRecord } from './live';
import { COMPILED } from './live.fixtures';

/** What query_log stores: one line, and `CAST(x AS T)` normalised to `CAST(x, 'T')`. */
const logged = (sql: string) =>
  sql.replace(/CAST\(([^()]*?) AS Nullable\(String\)\)/g, "CAST($1, 'Nullable(String)')").replace(/\s+/g, ' ');

describe('live aggregate fingerprint', () => {
  it('matches every compiled aggregate statement, as compiled and as logged', () => {
    for (const sql of Object.values(COMPILED)) {
      expect(isAggregateStatement(sql)).toBe(true);
      expect(isAggregateStatement(logged(sql))).toBe(true);
    }
  });

  it('ignores trace queries and harness metadata reads', () => {
    expect(isAggregateStatement('SELECT traceId FROM mastra_trace_roots WHERE organizationId = {o:String}')).toBe(
      false,
    );
    expect(
      isAggregateStatement("SELECT memory_usage FROM system.query_log WHERE position(query, 'facts AS (') > 0"),
    ).toBe(false);
  });
});

describe('parseAggregateShape', () => {
  it.each([
    [
      'grouped',
      {
        dimensions: ['entityName', 'status'],
        measures: ['count', 'errorRate', 'duration.p95', 'tokens.input.sum', 'cost.sum'],
        windowDays: 30,
        scope: 'project',
        projectId: 'PROJ_Y',
        spans: false,
        rootFilter: false,
        having: false,
        orderBy: 'count',
        limit: 50,
        usage: 'usage+fallback',
      },
    ],
    [
      'interval',
      {
        dimensions: ['entityName'],
        measures: ['count', 'countDistinct.threadId'],
        interval: '1d',
        scope: 'org',
        limit: 20,
        having: false,
        usage: 'none',
      },
    ],
    [
      'hourlyHaving',
      {
        interval: '1h',
        windowDays: 7,
        having: true,
        orderBy: 'duration.p95',
        limit: 10,
        measures: ['count', 'duration.p95'],
      },
    ],
    ['spans', { dimensions: ['metadata'], spans: true, windowDays: 31, measures: ['count', 'countDistinct.threadId'] }],
    [
      'standIn',
      {
        dimensions: ['projectId', 'entityId'],
        measures: ['count', 'duration.p50', 'duration.p99', 'tokens.total.sum', 'cost.sum'],
        orderBy: 'cost.sum',
        limit: 100,
        scope: 'org',
      },
    ],
    ['none', { dimensions: [], measures: ['count'], windowDays: 365, scope: 'project', usage: 'none' }],
  ] as const)('reads the %s request back out of its SQL, compiled or logged', (name, expected) => {
    for (const sql of [COMPILED[name]!, logged(COMPILED[name]!)]) {
      const shape = parseAggregateShape(sql);
      expect(shape).toMatchObject({ organizationId: 'ORG_X', ...expected });
      if ('scope' in expected && expected.scope === 'org') expect(shape.projectId).toBeUndefined();
    }
  });

  it('marks a Platform stand-in filter on the candidates as a root filter', () => {
    const sql = logged(COMPILED.standIn!).replace(
      /(FROM root_scope (?:AS )?r) WHERE 1 \)/,
      '$1 WHERE isNull(r.entityName) )',
    );
    expect(sql).toContain('isNull(r.entityName)');
    expect(parseAggregateShape(sql).rootFilter).toBe(true);
  });

  it('keys shapes by scope, window bucket, dimensions, interval and measures', () => {
    expect(shapeKey(parseAggregateShape(COMPILED.interval!))).toBe(
      'org | ≤31d | entityName | 1d | count,countDistinct.threadId | none',
    );
    expect(shapeKey(parseAggregateShape(COMPILED.none!))).toBe('project | >92d | (none) | - | count | none');
  });
});

describe('SQL helpers', () => {
  it('splits a select list on top-level commas only', () => {
    expect(splitItems("a, f(b, c) AS x, if(d, 'e,f', g) AS y")).toEqual(['a', 'f(b, c) AS x', "if(d, 'e,f', g) AS y"]);
  });

  it('extracts a CTE by balanced parentheses', () => {
    expect(cte('WITH a AS (SELECT (1)), b AS (SELECT 2) SELECT 3', 'a')).toBe('a AS (SELECT (1))');
    expect(cte('WITH a AS (SELECT 1) SELECT 2', 'missing')).toBeUndefined();
  });
});

describe('summarize', () => {
  const record = (over: Partial<LiveRecord>): LiveRecord => ({
    ...parseAggregateShape(COMPILED.grouped!),
    t: '2026-10-16 12:00:00',
    tenant: 'p99:abc',
    org: 'o1',
    durationMs: 100,
    memMiB: 10,
    readRows: 1,
    readMiB: 1,
    resultRows: 1,
    exc: 0,
    agent: 'clickhouse-js/1.23.1',
    sourceMiB: 0,
    cacheMiB: 10,
    shape: 's1',
    ...over,
  });

  it('counts failures with their codes and takes percentiles per group', () => {
    const s = summarize([
      record({ durationMs: 100, memMiB: 10 }),
      record({ durationMs: 300, memMiB: 30, exc: 241, sourceMiB: 2 }),
      record({ durationMs: 200, memMiB: 20, tenant: 'p99:def', shape: 's2', sourceMiB: 10 }),
    ]);
    expect(s.total[0]).toMatchObject({
      n: 3,
      failed: 1,
      codes: '241',
      p50ms: 200,
      maxMs: 300,
      maxMiB: 30,
      tenants: 2,
      touchedSource: 2,
      mostlyCold: 1,
    });
    expect(s.byShape.map(r => [r.key, r.n])).toEqual([
      ['s1', 2],
      ['s2', 1],
    ]);
  });
});
