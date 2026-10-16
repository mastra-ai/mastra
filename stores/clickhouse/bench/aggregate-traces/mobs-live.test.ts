import { describe, expect, it } from 'vitest';

import { COMPILED } from './live.fixtures';
import { buildCells, percentileDrift, rewritePercentiles, summarizeCell } from './mobs-live';
import type { QueryStat, RunRecord } from './mobs-live';

const FULL = { environment: 'production', tool: 'tool-x', metadataKey: 'key-x' };
const DAY_BUCKETS = (days: number, interval: string) => Math.ceil((days * 24) / (interval === '1h' ? 1 : 24)) + 1;

describe('buildCells', () => {
  it('gives every cell a unique id and keeps windows within the planner cap', () => {
    for (const role of ['p99', 'largest'] as const) {
      for (const scope of ['project', 'org'] as const) {
        const cells = buildCells({ role, scope, ...FULL });
        expect(new Set(cells.map(c => c.id)).size).toBe(cells.length);
        for (const c of cells) expect(c.days).toBeLessThanOrEqual(365);
      }
    }
  });

  it('keeps bucketed cells under 10,000 rows, counting a partial bucket at each end', () => {
    for (const c of buildCells({ role: 'largest', scope: 'org', ...FULL })) {
      const interval = c.body.interval as string | undefined;
      if (!interval) continue;
      const limit = (c.body.limit as number | undefined) ?? 100;
      expect(limit * DAY_BUCKETS(c.days, interval), c.id).toBeLessThanOrEqual(10_000);
    }
  });

  it('groups by projectId only org-wide', () => {
    const ids = (scope: 'project' | 'org') => buildCells({ role: 'p99', scope, ...FULL }).map(c => c.id);
    expect(ids('org')).toContain('A:projectId:30d');
    expect(ids('project').some(id => id.includes('projectId'))).toBe(false);
  });

  it('skips the examples that need a tenant literal it does not have', () => {
    const ids = buildCells({ role: 'p99', scope: 'project' }).map(c => c.id);
    expect(ids).not.toContain('Ex1');
    expect(ids).not.toContain('Ex3');
    expect(ids).toEqual(expect.arrayContaining(['Ex2', 'Ex4']));
  });

  it('runs cold on 30 days or more, and on 7 days for the largest org only', () => {
    const cold = (role: 'p99' | 'largest', id: string) =>
      buildCells({ role, scope: 'org', ...FULL }).find(c => c.id === id)!.cold;
    expect(cold('p99', 'A:entityName:7d')).toBe(false);
    expect(cold('largest', 'A:entityName:7d')).toBe(true);
    expect(cold('largest', 'A:entityName:1d')).toBe(false);
    expect(cold('p99', 'A:entityName:30d')).toBe(true);
  });
});

describe('rewritePercentiles', () => {
  const sql =
    'SELECT quantileDeterministic(0.5)(durationMs, traceSeed) AS m1, quantileDeterministic(0.95)(durationMs, traceSeed) AS m2 FROM facts HAVING quantileDeterministic(0.95)(durationMs, traceSeed) > 1';

  it('leaves the approximate SQL as compiled', () => {
    expect(rewritePercentiles(sql, 'approx')).toBe(sql);
  });

  it('swaps every percentile, including in having, for an exact or fused one', () => {
    expect(rewritePercentiles(sql, 'exact')).toBe(
      'SELECT quantileExact(0.5)(durationMs) AS m1, quantileExact(0.95)(durationMs) AS m2 FROM facts HAVING quantileExact(0.95)(durationMs) > 1',
    );
    expect(rewritePercentiles(sql, 'exactFused')).toContain('quantilesExact(0.5, 0.95)(durationMs)[2] > 1');
    expect(rewritePercentiles(sql, 'approxFused')).toContain(
      'quantilesDeterministic(0.5, 0.95)(durationMs, traceSeed)[1] AS m1',
    );
    expect(rewritePercentiles(sql, 'exact')).not.toContain('Deterministic');
    expect(rewritePercentiles(sql, 'exactInclusive')).toContain('quantileExactInclusive(0.95)(durationMs) > 1');
  });

  it('rewrites the compiler output without leaving an approximate percentile behind', () => {
    const out = rewritePercentiles(COMPILED.hourlyHaving!, 'exact');
    expect(out).toContain('quantileExact(0.95)(durationMs)');
    expect(out).not.toContain('quantileDeterministic');
  });

  it('refuses SQL that has no percentile to rewrite', () => {
    expect(() => rewritePercentiles(COMPILED.none!, 'exact')).toThrow('no percentiles');
  });
});

describe('percentileDrift', () => {
  it('compares matching groups and buckets only', () => {
    const base = [
      { d0: 'a', bucket: '1', m2: 100 },
      { d0: 'b', bucket: '1', m2: 200 },
    ];
    const other = [
      { d0: 'a', bucket: '1', m2: 110 },
      { d0: 'b', bucket: '1', m2: 200 },
      { d0: 'c', bucket: '1', m2: 5 },
    ];
    const drift = percentileDrift(base, other, 'm2');
    expect(drift.groups).toBe(2);
    expect(drift.median).toBe(0);
    expect(drift.max).toBeCloseTo(10 / 110);
  });
});

describe('summarizeCell', () => {
  const stat = (durationMs: number, memMiB: number, exc = 0): QueryStat => ({
    durationMs,
    memMiB,
    readRows: 1,
    readMiB: 1,
    resultRows: 1,
    exc,
  });
  const rec = (over: Partial<RunRecord>, q: QueryStat): RunRecord => ({
    runId: 'r',
    role: 'largest',
    hash: 'h',
    scope: 'org',
    group: 'A',
    id: 'A:x',
    days: 30,
    variant: 'approx',
    arm: 'measure',
    phase: 'warm',
    rep: 1,
    ok: true,
    wallMs: q.durationMs,
    queries: [q],
    ...over,
  });
  const warm = (ms: number, mib: number) => [1, 2, 3].map(rep => rec({ rep }, stat(ms, mib)));

  it('reads quoted 64-bit integers as numbers', () => {
    const quoted = { ...stat(0, 0), durationMs: '113' as unknown as number, memMiB: 109 };
    expect(summarizeCell([rec({}, quoted), rec({ rep: 2 }, quoted), rec({ rep: 3 }, quoted)]).warmMs).toBe(113);
  });

  it('passes a cell well under the caps', () => {
    expect(summarizeCell([...warm(500, 300), rec({ arm: 'prod' }, stat(500, 300))]).flag).toBeUndefined();
  });

  it('flags a cell close to a cap on memory, time or a cold timeout', () => {
    expect(summarizeCell(warm(500, 800)).flag).toBe('CLOSE');
    expect(summarizeCell(warm(6500, 300)).flag).toBe('CLOSE');
    expect(
      summarizeCell([
        ...warm(500, 300),
        rec({ arm: 'prod', phase: 'cold', ok: false, errorCode: 'TraceQueryExecutionError' }, stat(9000, 300, 159)),
      ]).flag,
    ).toBe('CLOSE cold 159');
  });

  it('fails a cell over a cap, or whose service call errors', () => {
    expect(summarizeCell(warm(500, 1100)).flag).toBe('FAIL');
    expect(summarizeCell([...warm(500, 300), rec({ arm: 'prod', ok: false }, stat(500, 1024, 241))]).flag).toBe(
      'FAIL svc 241',
    );
  });

  it('ignores exact-percentile variants when judging the cell', () => {
    const exact = [1, 2, 3, 4].map(rep => rec({ variant: 'exact', rep }, stat(500, 2000)));
    const cell = summarizeCell([...warm(500, 300), ...exact]);
    expect(cell.warmMiB).toBe(300);
    expect(cell.flag).toBeUndefined();
  });
});
