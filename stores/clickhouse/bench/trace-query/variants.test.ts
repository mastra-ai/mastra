import { describe, expect, it } from 'vitest';

import { DOC_LITERALS } from '../shared/profile';
import { RewriteError } from '../shared/scope';
import { caseById, compileCase, timeRangeFor, WINDOWS } from './cases';
import type { TraceQueryLiterals } from './cases';
import { hashStatement, resolveTargets, summarize } from './experiments';
import type { ExpRecord } from './experiments';
import { planVariant, resultColumns, VARIANTS } from './variants';

const LITERALS: TraceQueryLiterals = {
  ...DOC_LITERALS,
  metadataValue: 'v',
  tag: 't',
  model: 'm',
  entityName: 'e',
  feedbackType: 'f',
};
const SCOPE = { organizationId: 'org', projectId: 'proj' };
const RANGE = timeRangeFor(WINDOWS['30d'], new Date('2026-10-05T17:00:00Z'));
const CURSORS = {
  K2: { kind: 'traces', traceId: 't', sortValue: '2026-10-01T00:00:00.000Z' },
  D1: { kind: 'delta', cursorId: '0', traceId: '' },
} as const;

function base(id: string) {
  return compileCase(caseById(id), 'base', LITERALS, RANGE, SCOPE, {
    cursor: CURSORS[id as keyof typeof CURSORS],
    deltaHead: id === 'D1' ? { cursorId: '9', traceId: 'x' } : undefined,
  }).compiled;
}

const KEYSET = ['T0', 'T1', 'T3', 'T4', 'T7', 'T9', 'T10', 'O1', 'O2', 'K1', 'K2'];
const projectScopes = (q: string) => (q.match(/projectId = \{bench_project_id:String\}/g) ?? []).length;

/** Which rewrites apply to which case shape. Anything else must refuse (fail closed). */
const APPLIES: Record<string, (id: string) => boolean> = {
  noblob: () => true,
  nh: id => KEYSET.includes(id) || id === 'D1',
  nh2: id => KEYSET.includes(id),
  rs: () => true,
  topn: id => KEYSET.includes(id) && id !== 'O2',
  topn2: id => KEYSET.includes(id) && id !== 'O2',
  pg: id => id === 'P0',
  sp: id => ['T7', 'T9', 'T10'].includes(id),
  g2: id => id === 'G0',
  dtop: id => id === 'D1',
};

describe('memory-experiment variants', () => {
  const cases = [...KEYSET, 'D1', 'P0', 'G0'];
  for (const variant of Object.keys(APPLIES)) {
    it.each(cases)(`${variant} on %s applies exactly where expected and stays project-scoped`, id => {
      const statement = base(id);
      if (!APPLIES[variant]!(id)) {
        expect(() => planVariant(variant, statement)).toThrow(RewriteError);
        return;
      }
      const plan = planVariant(variant, statement);
      const query = plan.statements[0]!.query;
      expect(query).not.toBe(statement.query);
      // Every variant keeps at least the base's tenant scoping; the re-read/lookup ones add more.
      expect(projectScopes(query)).toBeGreaterThanOrEqual(projectScopes(statement.query));
      expect(query).toMatch(/organizationId = \{trace_query_\d+:String\} AND projectId = \{bench_project_id:String\}/);
    });
  }

  it('nh hydrates blobs by the full root sort key, scoped to the project', () => {
    const query = planVariant('nh', base('T0')).statements[0]!.query;
    expect(query).toContain(
      '(startedAt, traceId, dedupeKey) IN (SELECT startedAt, traceId, __dedupeKey FROM __winners)',
    );
    expect(query).toMatch(/SELECT \* EXCEPT \(metadata, input\)\n {2}FROM candidates/);
    expect(query.split('LIMIT {trace_query_4:UInt64}').length - 1).toBe(1);
  });

  it('nh2 splits into a narrow list and a key lookup that binds only tenant + keys', () => {
    const plan = planVariant('nh2', base('K2'));
    expect(plan.statements[0]!.query).toContain(
      'SELECT * EXCEPT (metadata, input)\nFROM candidates\nWHERE (startedAt <',
    );
    const hydrate = plan.hydrate!([['2026-10-01T00:00:00.000Z', 't', 'k']]);
    expect(Object.keys(hydrate.query_params).sort()).toEqual([
      'bench_payload_keys',
      'bench_project_id',
      'trace_query_3',
    ]);
    expect(hydrate.query).toContain('projectId = {bench_project_id:String}');
  });

  it('@2 overlays apply settings to the lookup only', () => {
    const plan = planVariant('nh2+pf8+nopf@2+t1@2', base('T0'));
    expect(plan.settings).toEqual({ filesystem_prefetches_limit: '8' });
    expect(plan.hydrateSettings).toMatchObject({ ...VARIANTS.nopf!.settings, max_threads: 1 });
    expect(() => planVariant('pf8+nopf@2', base('T0'))).toThrow(RewriteError);
    expect(() => planVariant('nh2+rs@2', base('T0'))).toThrow(/only settings overlays/);
  });

  it('rs scopes and time-bounds the re-read and bounds the seed scan by endedAt', () => {
    const query = planVariant('rs', base('T0')).statements[0]!.query;
    expect(query).toMatch(
      /WHERE organizationId = \{trace_query_3:String\} AND projectId = \{bench_project_id:String\}\n\s+AND startedAt >= \{trace_query_1:DateTime64\(3, 'UTC'\)\} AND startedAt < \{trace_query_2:DateTime64\(3, 'UTC'\)\} AND endedAt >= \{trace_query_1/,
    );
    expect(query).toMatch(/FROM mastra_trace_roots r\n\s+WHERE endedAt >= \{trace_query_1/);
  });

  it('topn keeps the cursor and dedupes in sort-key order, streaming to the limit', () => {
    const query = planVariant('topn', base('K2')).statements[0]!.query;
    expect(query).toMatch(
      /ORDER BY r\.startedAt DESC, r\.traceId ASC, r\.dedupeKey ASC\nLIMIT 1 BY r\.traceId\nLIMIT \{trace_query_6:UInt64\}$/,
    );
    expect(query).toContain('AND ((startedAt < {trace_query_4');
    expect(planVariant('topn', base('O1')).statements[0]!.query).toContain('ORDER BY r.startedAt ASC');
  });

  it('topn2 finds the boundary from the sort key only, then reads just those roots', () => {
    const query = planVariant('topn2', base('K2')).statements[0]!.query;
    expect(query).toContain(
      'AND r.startedAt >= (\n    SELECT min(__s) FROM (\n      SELECT DISTINCT r.startedAt AS __s, r.traceId AS __t',
    );
    expect(query).toMatch(/ORDER BY __s DESC\n\s+LIMIT \{trace_query_6:UInt64\}/);
    expect(query.split('AND ((startedAt < {trace_query_4').length - 1).toBe(2);
    expect(planVariant('topn2', base('O1')).statements[0]!.query).toContain(
      'AND r.startedAt <= (\n    SELECT max(__s)',
    );
  });

  it('nh2+topn2 keeps the blobs out of the threshold list and hydrates them separately', () => {
    const plan = planVariant('nh2+topn2', base('T0'));
    const tail = plan.statements[0]!.query.split('\n  )\nSELECT ').at(-1)!;
    expect(tail).toContain('r.dedupeKey AS __dedupeKey');
    expect(tail).not.toMatch(/AS (metadata|input),/);
    expect(tail).toContain('SELECT min(__s)');
    expect(plan.hydrate).toBeDefined();
  });

  it('pg replaces the window function with a uniqExact total and a boundary-limited page', () => {
    const query = planVariant('pg', base('P0')).statements[0]!.query;
    expect(query).not.toContain('count() OVER ()');
    expect(query).toContain('SELECT uniqExact(r.traceId) AS total');
    expect(query).toContain('(SELECT total FROM __total) AS total');
    expect(query).toMatch(/ORDER BY __s DESC\n\s+LIMIT \{trace_query_5:UInt64\}/);
    expect(query).toMatch(
      /WHERE \(__row_position > \{trace_query_4:UInt64\} AND __row_position <= \{trace_query_5:UInt64\}\) OR __row_position = 1/,
    );
    expect(query.split('page_rows AS')[1]).not.toMatch(/AS (metadata|input),/);
  });

  it('dtop limits the scoped delta page before reading roots', () => {
    const query = planVariant('dtop', base('D1')).statements[0]!.query;
    expect(query.match(/FROM mastra_trace_roots_delta\n/g)).toHaveLength(2);
    expect(query.match(/ORDER BY latestCursorId ASC, traceId ASC\n {2}LIMIT \{trace_query_\d+:UInt64\}/g)).toHaveLength(
      2,
    );
    expect(query).toMatch(/AND traceId IN \(SELECT r\.traceId FROM mastra_trace_roots r WHERE r\.organizationId = /);
  });

  it('settings variants only add settings and compose with rewrites', () => {
    const plan = planVariant('nh+rs+pf8', base('T0'));
    expect(plan.settings).toEqual(VARIANTS.pf8!.settings);
    expect(plan.statements[0]!.query).toContain('__winners');
    expect(plan.statements[0]!.query).toContain('AND endedAt >=');
    expect(planVariant('nopf', base('P0')).statements[0]!.query).toBe(base('P0').query);
    expect(() => planVariant('nh2+nh2', base('T0'))).toThrow(RewriteError);
    expect(() => planVariant('nope', base('T0'))).toThrow(/Unknown variant/);
  });

  it('result columns cover the API row, including the delta cursor', () => {
    expect(resultColumns(base('T0').query)).toEqual(expect.arrayContaining(['traceId', 'metadata', 'input', 'status']));
    expect(resultColumns(base('D1').query)).toContain('__delta_cursor');
    expect(hashStatement(base('T0'), ['traceId']).query).toMatch(/^SELECT count\(\) AS n/);
  });

  it('resolves targets by bucket or hash prefix and summarizes against base', () => {
    const selection = {
      projects: [
        { bucket: 'p99', hash: 'aaaa1111', representative: true },
        { bucket: 'p99', hash: 'bbbb2222', representative: false },
      ],
    } as never;
    expect(resolveTargets(selection, 'p99,p99:bbbb').map(p => p.hash)).toEqual(['aaaa1111', 'bbbb2222']);
    expect(() => resolveTargets(selection, 'largest')).toThrow();
    const rec = (variant: string, mem: number): ExpRecord => ({
      runId: 'r',
      exp: 'QX',
      kind: 'ab',
      caseId: 'T0',
      variant,
      window: '30d',
      bucket: 'p99',
      hash: 'aaaa1111',
      rep: 0,
      ok: true,
      ts: '',
      metrics: {
        source: 'summary',
        durationMs: 10,
        readRows: 1,
        readBytes: 1e6,
        memoryBytes: mem * 2 ** 20,
        resultRows: 1,
        resultBytes: 1,
        selectedMarks: null,
        selectedParts: null,
        exceptionCode: 0,
      },
    });
    const table = summarize([rec('base', 200), rec('nh', 50)]);
    expect(table).toContain('| nh | 50.0 (1) | ×0.25 |');
  });
});
