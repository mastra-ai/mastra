import { describe, expect, it } from 'vitest';

import { anchorTo, CASES, compileCase, compilePayloadStage, timeRangeFor } from './cases';
import { assertReadOnlyStatement, categorize, settingsFor, StatementRejected, TIERS } from './client';
import { countMatches, needlesFrom } from './leak-check';
import {
  DISCOVERY_SQL,
  CANDIDATES_SQL,
  DISTRIBUTION_SQL,
  GAUGE_SQL,
  pickProjects,
  projectHash,
  STATS_SQL,
} from './profile';
import type { Candidate, SelectedProject, Selection } from './profile';
import { logLogSlope, median, renderReport } from './report';
import { needsGateB, parseSkipIndexes, planRuns, skippedByEscalation, variantSettings } from './run';
import type { RunRecord } from './run';

const SCOPE = { organizationId: 'org-test', projectId: 'proj-test' };
const LITERALS = { environment: 'env-x', tool: 'tool-x', metadataKey: 'key-x', entityType: 'agent' };
const TO = anchorTo(new Date('2026-10-05T13:37:00Z'));
const W = (id: string, days: number) => ({ id, ms: days * 86_400_000 });

describe('read-only allowlist', () => {
  it('accepts every compiled case, the payload stage and the harness metadata queries', () => {
    for (const def of CASES) {
      for (const variant of def.variants) {
        for (const window of def.windows) {
          assertReadOnlyStatement(compileCase(def, variant, LITERALS, timeRangeFor(window, TO), SCOPE).query);
        }
      }
    }
    const keys = [{ traceId: 't', rootSpanId: 's', startedAt: TO.toISOString(), endedAt: TO.toISOString() }];
    assertReadOnlyStatement(compilePayloadStage(keys, SCOPE, true).query);
    assertReadOnlyStatement('SELECT name FROM system.tables WHERE database = {db:String}');
    for (const sql of [
      GAUGE_SQL,
      DISTRIBUTION_SQL,
      CANDIDATES_SQL,
      ...Object.values(STATS_SQL),
      ...Object.values(DISCOVERY_SQL),
    ]) {
      assertReadOnlyStatement(sql);
    }
  });

  it.each([
    'INSERT INTO t VALUES (1)',
    'SELECT 1; DROP TABLE t',
    'ALTER TABLE t DELETE WHERE 1',
    'SYSTEM FLUSH LOGS',
    "SELECT 1 INTO OUTFILE 'x'",
    'WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x',
    'OPTIMIZE TABLE t FINAL',
    'SET max_threads = 1',
  ])('rejects %s', sql => {
    expect(() => assertReadOnlyStatement(sql)).toThrow(StatementRejected);
  });

  it('sets every limit explicitly and bypasses the filesystem cache only when cold', () => {
    const warm = settingsFor({ tier: TIERS[1], logComment: 'c' });
    expect(warm).toMatchObject({
      max_execution_time: 30,
      timeout_overflow_mode: 'throw',
      max_memory_usage: String(4 * 2 ** 30),
      max_threads: 4,
      max_bytes_to_read: String(50e9),
      read_overflow_mode: 'throw',
      max_result_rows: '20000',
      result_overflow_mode: 'throw',
      use_query_cache: 0,
      wait_end_of_query: 1,
      log_comment: 'c',
    });
    expect(warm).not.toHaveProperty('enable_filesystem_cache');
    expect(settingsFor({ tier: TIERS[1], logComment: 'c', cold: true })).toMatchObject({ enable_filesystem_cache: 0 });
  });

  it('categorizes limit errors', () => {
    expect(categorize('159')).toBe('timeout');
    expect(categorize('241')).toBe('memory');
    expect(categorize('307')).toBe('too_many_bytes');
    expect(categorize('62')).toBe('other');
    expect(categorize(undefined)).toBe('other');
  });
});

describe('parseSkipIndexes', () => {
  it('reads INDEX clauses from DDL', () => {
    const ddl =
      'CREATE TABLE t (`a` String, INDEX idx_traceId traceId TYPE bloom_filter(0.01) GRANULARITY 1, INDEX `i2` lower(x) TYPE minmax GRANULARITY 4) ENGINE = MergeTree ORDER BY a';
    expect(parseSkipIndexes('t', ddl)).toEqual([
      { table: 't', name: 'idx_traceId', expr: 'traceId', type: 'bloom_filter(0.01)' },
      { table: 't', name: 'i2', expr: 'lower(x)', type: 'minmax' },
    ]);
    expect(parseSkipIndexes('t', 'CREATE TABLE t (a String) ENGINE = MergeTree ORDER BY a')).toEqual([]);
  });
});

describe('project selection', () => {
  const c = (bucket: Candidate['bucket'], id: string, traces: number): Candidate => ({
    bucket,
    organizationId: 'o',
    projectId: id,
    traces,
  });

  it('never reuses a project and lets the tail keep its projects', () => {
    const picked = pickProjects([
      c('largest', 'a', 1000),
      c('largest', 'b', 900),
      c('p99', 'a', 1000),
      c('p99', 'b', 900),
      c('p99', 'c', 800),
      c('small', 'd', 100),
    ]);
    expect(picked.map(p => `${p.bucket}:${p.projectId}`)).toEqual(['small:d', 'p99:c', 'largest:b', 'largest:a']);
    expect(
      picked
        .filter(p => p.representative)
        .map(p => p.projectId)
        .sort(),
    ).toEqual(['a', 'c', 'd']);
  });

  it('hashes are salted and opaque', () => {
    const h = projectHash('salt', SCOPE);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
    expect(projectHash('other', SCOPE)).not.toBe(h);
  });
});

function project(bucket: SelectedProject['bucket'], id: string, representative: boolean): SelectedProject {
  return {
    bucket,
    organizationId: 'o',
    projectId: id,
    hash: id,
    representative,
    stats: { traces30d: 1, spans30d: null, threads30d: null, users30d: null, tokenRows30d: null },
    literals: LITERALS,
    literalSource: {},
  };
}

describe('run planning', () => {
  const selection = {
    projects: [project('p99', 'a', true), project('p99', 'b', false), project('largest', 'c', true)],
  };

  it('holds Gate B cases back until approved', () => {
    const def = CASES.find(d => d.id === 'F0')!;
    expect(needsGateB(def, W('7d', 7), 'p99')).toBe(false);
    expect(needsGateB(def, W('30d', 30), 'p99')).toBe(true);
    expect(needsGateB(def, W('1d', 1), 'largest')).toBe(false);
    expect(needsGateB(def, W('7d', 7), 'largest')).toBe(true);
    expect(
      needsGateB(
        CASES.find(d => d.group === 'highcard')!,
        W('7d', 7),
        'p99',
      ),
    ).toBe(true);
    expect(
      needsGateB(
        CASES.find(d => d.id === 'I4')!,
        W('7d', 7),
        'p99',
      ),
    ).toBe(true);

    const planned = planRuns(selection, {
      buckets: ['p99', 'largest'],
      windows: ['1d', '7d', '30d'],
      gateBApproved: false,
    });
    expect(planned.length).toBeGreaterThan(0);
    for (const p of planned) expect(needsGateB(p.def, p.window, p.project.bucket)).toBe(false);
    expect(planned.some(p => p.project.bucket === 'largest' && p.window.ms > 86_400_000)).toBe(false);
  });

  it('runs core cases on every project and the rest on the representative, cheap first', () => {
    const planned = planRuns(selection, { buckets: ['p99'], windows: ['1d'], gateBApproved: false });
    expect(
      planned
        .filter(p => p.def.id === 'F0')
        .map(p => p.project.hash)
        .sort(),
    ).toEqual(['a', 'a', 'b', 'b']);
    expect(planned.filter(p => p.def.id === 'F2').map(p => p.project.hash)).toEqual(['a']);
    const costs = planned.map(p => p.def.cost);
    expect(costs).toEqual([...costs].sort((x, y) => x - y));
  });

  it('runs what-if variants on the representative only and honours the variant filter', () => {
    const planned = planRuns(selection, { buckets: ['p99'], windows: ['1d'], gateBApproved: false });
    const e4 = planned.filter(p => p.def.id === 'E4');
    expect(
      e4
        .filter(p => p.variant === 'base')
        .map(p => p.project.hash)
        .sort(),
    ).toEqual(['a', 'b']);
    expect(e4.filter(p => p.variant !== 'base').every(p => p.project.hash === 'a')).toBe(true);
    const filtered = planRuns(selection, {
      buckets: ['p99'],
      windows: ['1d'],
      cases: ['F3'],
      variants: ['base', 't2'],
      gateBApproved: false,
    });
    expect([...new Set(filtered.map(p => p.variant))].sort()).toEqual(['base', 't2']);
  });

  it('only lets variant settings tighten the tier', () => {
    expect(variantSettings('t2', TIERS[1])).toEqual({ max_threads: 2 });
    expect(variantSettings('base', TIERS[1])).toBeUndefined();
    expect(() => variantSettings('t2', { ...TIERS[1], maxThreads: 1 })).toThrow('above the tier');
  });

  it('applies the escalation rule', () => {
    const hits = [{ bucket: 'mid' as const, windowMs: 7 * 86_400_000 }];
    expect(skippedByEscalation(hits, 'small', W('30d', 30))).toBe(false);
    expect(skippedByEscalation(hits, 'mid', W('7d', 7))).toBe(false);
    expect(skippedByEscalation(hits, 'mid', W('30d', 30))).toBe(true);
    expect(skippedByEscalation(hits, 'p90', W('1d', 1))).toBe(false);
    expect(skippedByEscalation(hits, 'p90', W('7d', 7))).toBe(true);
  });
});

describe('report', () => {
  it('computes medians and log-log slopes', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(
      logLogSlope([
        [10, 100],
        [100, 1000],
        [1000, 10000],
      ]),
    ).toBeCloseTo(1);
    expect(
      logLogSlope([
        [10, 100],
        [100, 1000],
      ]),
    ).toBeNull();
  });

  it('renders only hashes and buckets', () => {
    const record = (rep: number, ms: number): RunRecord => ({
      runId: 'r',
      key: 'k',
      caseId: 'F0',
      group: 'pushdown',
      variant: 'base',
      stage: 'main',
      window: '1d',
      windowMs: 86_400_000,
      bucket: 'small',
      hash: 'abcd1234',
      traces30d: 100,
      rep,
      cold: rep === 0,
      tier: 1,
      anchorTo: TO.toISOString(),
      ts: TO.toISOString(),
      ok: true,
      wallMs: ms,
      streamedRows: 1,
      metrics: {
        source: 'query_log',
        durationMs: ms,
        readRows: 1000,
        readBytes: 2e6,
        memoryBytes: 2 ** 20,
        resultRows: 1,
        resultBytes: 10,
        selectedMarks: 1,
        selectedParts: 1,
        exceptionCode: 0,
      },
    });
    const text = renderReport([record(0, 900), record(1, 100), record(2, 300)]);
    expect(text).toContain('| F0 | 1d | 200 ms / 300 ms (cold 900 ms)');
  });
});

describe('leak check', () => {
  it('finds secrets, ids, salt and discovered literals but ignores public values', () => {
    const selection: Selection = {
      version: 1,
      salt: 'salt-value-1234',
      database: 'db',
      profiledAt: '',
      anchorTo: '',
      distribution: {
        windowDays: 30,
        projects: 1,
        traces: 1,
        p25: 1,
        p75: 1,
        p50: 1,
        p90: 1,
        p99: 1,
        max: 1,
        nullProjectTraces: 0,
      },
      projects: [
        {
          ...project('small', 'proj-real-id', true),
          organizationId: 'org-real-id',
          literals: { environment: 'customer-env', tool: 'production', metadataKey: 'secret-key', entityType: 'agent' },
          literalSource: {
            environment: 'discovered',
            tool: 'discovered',
            metadataKey: 'doc',
            entityType: 'discovered',
          },
        },
      ],
    };
    const needles = needlesFrom(
      {
        BENCH_CLICKHOUSE_URL: 'https://gyiixsk9we.us-central1.gcp.clickhouse.cloud:8443',
        BENCH_CLICKHOUSE_USER: 'bench-user',
        BENCH_CLICKHOUSE_PASSWORD: 'p@ss/word',
      },
      selection,
    );
    expect(needles.map(n => n.value).sort()).toEqual(
      ['bench-user', 'customer-env', 'org-real-id', 'p@ss/word', 'proj-real-id', 'salt-value-1234'].sort(),
    );
    expect(
      countMatches('host gyiixsk9we.us-central1.gcp.clickhouse.cloud, agent, production, secret-key', needles),
    ).toEqual({});
    expect(countMatches('x org-real-id y p%40ss%2Fword z customer-env', needles)).toEqual({
      id: 1,
      credential: 1,
      literal: 1,
    });
  });
});
