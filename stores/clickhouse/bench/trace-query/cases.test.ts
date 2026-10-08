import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { queryTraces } from '../../src/storage/domains/observability/v-next/trace-query';
import type { QueryOutcome } from '../shared/client';
import { PROJECT_PARAM, RewriteError, injectSpanProjectScope } from '../shared/scope';
import { CASES, caseById, compileCase, DELTA_HEAD_SQL, timeRangeFor, WINDOWS } from './cases';
import type { TraceQueryLiterals } from './cases';
import { literalsFor, SIDECAR_SQL } from './discover';
import { captureSpanHydration, captureTraceQuery, scopedSpanHydration, walkCursor } from './stages';
import type { KeyRunner, SpanSelectRow, Statement } from './stages';

const SCOPE = { organizationId: 'org-test', projectId: 'proj-test' };
const LITERALS: TraceQueryLiterals = {
  environment: 'env-x',
  tool: 'tool-x',
  metadataKey: 'key-x',
  entityType: 'agent',
  metadataValue: 'mv-x',
  tag: 'tag-x',
  model: 'model-x',
  entityName: 'name-x',
  feedbackType: 'fb-x',
};
const TO = new Date('2026-10-05T17:00:00.000Z');
const scoped = (sql: string) => sql.split(`AND projectId = {${PROJECT_PARAM}:String}`).length - 1;

describe('trace-query case catalogue', () => {
  const combos = CASES.flatMap(def =>
    def.windows.flatMap(window => def.variants.map(variant => ({ def, window, variant }))),
  );

  it('has unique ids and covers every API in the plan', () => {
    expect(new Set(CASES.map(c => c.id)).size).toBe(CASES.length);
    expect(new Set(CASES.map(c => c.api))).toEqual(
      new Set(['traces', 'page', 'groups', 'delta', 'delta-head', 'threads', 'spans', 'fields', 'values']),
    );
  });

  it.each(combos.map(c => [`${c.def.id}/${c.variant}/${c.window.id}`, c] as const))(
    '%s plans through the real planner, compiles and is project-scoped (fail-closed)',
    (_label, { def, window, variant }) => {
      const { compiled } = compileCase(def, variant, LITERALS, timeRangeFor(window, TO), SCOPE);
      expect(compiled.query).not.toContain('proj-test');
      expect(compiled.query).not.toContain('org-test');
      if (def.api === 'delta-head') {
        // The delta index has no tenant columns; the store reads its head globally.
        expect(scoped(compiled.query)).toBe(0);
        return;
      }
      // queryTraces() also scopes its current-root key re-read; queryThreads() gets that from W1.
      // queryTraces() seeds the delta index and span existence checks with the tenant's window roots.
      const keyed = ['traces', 'page', 'groups', 'delta'].includes(def.api);
      const windows = (def.api === 'delta' ? 1 : 0) + (keyed && def.relations.includes('spans') ? 1 : 0);
      const expected = def.api === 'spans' ? 2 : 2 + windows + def.relations.length + (variant === 'w1' ? 1 : 0);
      expect(scoped(compiled.query)).toBe(expected);
      expect(compiled.query_params[PROJECT_PARAM]).toBe('proj-test');
      expect(Object.values(compiled.query_params)).toContain('org-test');
      if (variant === 'w1') expect(compiled.query).toContain(`organizationId = {`);
    },
  );

  it('uses the outer current_roots re-read wherever W1 is offered', () => {
    for (const def of CASES.filter(c => c.variants.includes('w1'))) {
      const { compiled } = compileCase(def, 'base', LITERALS, timeRangeFor(WINDOWS['1d'], TO), SCOPE);
      expect(compiled.query.match(/SELECT \*\s+FROM mastra_trace_roots\s+WHERE traceId IN \(/g)).toHaveLength(1);
    }
  });

  it('feeds deep cursors back through the real planner', () => {
    const tr = timeRangeFor(WINDOWS['7d'], TO);
    const k2 = compileCase(caseById('K2'), 'base', LITERALS, tr, SCOPE, {
      cursor: { kind: 'traces', traceId: 't-1', sortValue: '2026-10-04T00:00:00.000Z' },
    });
    expect(k2.compiled.query).toMatch(/startedAt < \{trace_query_\d+:DateTime64/);
    const th = compileCase(caseById('TH6'), 'base', LITERALS, tr, SCOPE, {
      cursor: { kind: 'threads', threadId: 'th-1' },
    });
    expect(th.compiled.query).toMatch(/threadId > \{trace_query_\d+:String\}/);
    const s8 = compileCase(caseById('S8'), 'base', LITERALS, tr, SCOPE, {
      cursor: {
        kind: 'spans',
        organizationId: 'org-test',
        resourceId: null,
        traceId: 't-1',
        spanId: 's-1',
        sortValue: '2026-10-04T00:00:00.000Z',
      },
    });
    expect(Object.values(s8.compiled.query_params)).toContain('s-1');
    const d2 = compileCase(caseById('D2'), 'base', LITERALS, tr, SCOPE, {
      cursor: { kind: 'delta', cursorId: '42', traceId: 't-1' },
      deltaHead: { cursorId: '99', traceId: 't-9' },
    });
    expect(d2.compiled.query).toContain('delta_candidates');
    expect(Object.values(d2.compiled.query_params)).toContain('42');
  });

  it('rejects cursors of the wrong kind and unknown variants', () => {
    const tr = timeRangeFor(WINDOWS['1d'], TO);
    expect(() =>
      compileCase(caseById('K2'), 'base', LITERALS, tr, SCOPE, { cursor: { kind: 'threads', threadId: 'x' } }),
    ).toThrow();
    expect(() => compileCase(caseById('T3'), 'w1', LITERALS, tr, SCOPE)).toThrow(/no variant/);
  });

  it('applies a limit override for cursor hops', () => {
    const { compiled } = compileCase(caseById('K3'), 'base', LITERALS, timeRangeFor(WINDOWS['1d'], TO), SCOPE, {
      limit: 1000,
    });
    expect(Object.values(compiled.query_params)).toContain(1001);
  });

  it('keeps DELTA_HEAD_SQL identical to the statement the store issues', () => {
    const source = readFileSync(
      join(import.meta.dirname, '../../src/storage/domains/observability/v-next/trace-query.ts'),
      'utf8',
    );
    const store = DELTA_HEAD_SQL.replace('mastra_trace_roots_delta', '${TABLE_TRACE_ROOTS_DELTA}');
    expect(source).toContain(store);
  });

  it('skips cases whose sidecar literal is missing', () => {
    const project = {
      hash: 'h1',
      literals: { environment: 'e', tool: 't', metadataKey: 'k', entityType: 'agent' },
      literalSource: { metadataKey: 'doc' },
    } as unknown as Parameters<typeof literalsFor>[0];
    const l = literalsFor(project, { version: 1, projects: { h1: { tag: 'tg', metadataValue: 'v' } } });
    // A doc-fallback metadata key never gets a discovered value paired with it.
    expect(l.metadataValue).toBeNull();
    expect(l.tag).toBe('tg');
    expect(l.model).toBeNull();
  });

  it('binds every discovery literal as a parameter', () => {
    for (const sql of Object.values(SIDECAR_SQL)) {
      expect(sql).toMatch(/organizationId = \{o:String\} AND projectId = \{p:String\}/);
      expect(sql).toMatch(/GROUP BY v ORDER BY count\(\) DESC, v LIMIT 1$/);
    }
  });
});

describe('stages', () => {
  /** Answers capture key reads: the page's root keys with `keys`, list key reads with `rows`. */
  const keyRunner = (keys: Record<string, unknown>[], rows: Record<string, unknown>[]) => {
    const seen: Array<{ statement: Statement; step: string }> = [];
    const run: KeyRunner = async <Row>(statement: Statement, step: string) => {
      seen.push({ statement, step });
      const out = step === 'trace-root-keys' ? keys : rows;
      return { ok: true, rows: out as Row[], wallMs: 1 } as QueryOutcome<Row>;
    };
    return { run, seen };
  };
  const capture = (id: string, run: KeyRunner, head?: { cursorId: string; traceId: string }) => {
    const def = caseById(id);
    const { plan } = compileCase(def, 'base', LITERALS, timeRangeFor(WINDOWS['1d'], TO), SCOPE, {
      ...(def.api === 'delta' ? { cursor: { kind: 'delta' as const, cursorId: '0', traceId: '' } } : {}),
    });
    if (plan.api !== 'traces' && plan.api !== 'page' && plan.api !== 'groups' && plan.api !== 'delta') {
      throw new Error(`${id} is not a queryTraces() case`);
    }
    return captureTraceQuery(queryTraces, plan.plan, SCOPE, def.relations, run, head);
  };
  const key = {
    traceId: 't-1',
    rootSpanId: 's-1',
    startedAt: '2026-10-05 00:00:00.000',
    endedAt: '2026-10-05 00:00:01.000',
  };

  const rootKey = {
    traceId: 't-1',
    dedupeKey: 't-1:s-1',
    sortValue: '2026-10-05T00:00:00.000Z',
    rootStartedAt: '2026-10-05T00:00:00.000Z',
    __total: '1',
  };

  it('captures keyset statements from the real store, project-scoped, with the store settings', async () => {
    const { run, seen } = keyRunner([rootKey], [key]);
    const traced = await capture('T7', run);

    expect(traced.main.query).toContain('count() OVER () AS __total');
    // Roots seed, the seeded traces' roots, and the span relation with its window-roots seed.
    expect(scoped(traced.main.query)).toBe(4);
    // The keyed rows (with payloads) are one scoped root read; no separate payload lookup.
    expect(traced.list!.query).toContain('r.metadataRaw AS metadata');
    expect(scoped(traced.list!.query)).toBe(1);
    expect(Object.values(traced.list!.query_params)).toEqual(
      expect.arrayContaining(['org-test', 't-1', 't-1:s-1', '2026-10-05 00:00:00.000']),
    );
    expect(traced.payload).toBeUndefined();
    for (const statement of [traced.main, traced.list!]) {
      expect(statement.settings).toMatchObject({ filesystem_prefetches_limit: '8' });
      expect(statement.settings).not.toHaveProperty('max_execution_time');
      expect(statement.settings).not.toHaveProperty('max_memory_usage');
    }
    expect(traced.main.sharedSnapshot).toBe(true);
    // Only key columns are read back.
    expect(seen.map(s => s.step)).toEqual(['trace-root-keys', 'trace-keys']);
    expect(seen[0]!.statement.query).toMatch(
      /^SELECT toString\(traceId\) AS traceId, toString\(dedupeKey\) AS dedupeKey, sortValue, rootStartedAt, __total FROM \(/,
    );
    expect(seen[1]!.statement.query).toMatch(
      /^SELECT toString\(traceId\) AS traceId, toString\(rootSpanId\) AS rootSpanId, startedAt, endedAt FROM \(/,
    );
  });

  it('captures only the keys statement for an empty first page', async () => {
    const { run } = keyRunner([], []);
    const traced = await capture('P0', run);
    expect(traced.main.query).toContain('count() OVER () AS __total');
    expect(traced.list).toBeUndefined();
    expect(traced.payload).toBeUndefined();
  });

  it('captures the total statement for a numbered page past the last one', async () => {
    const { run, seen } = keyRunner([], [{ traces: '3' }]);
    const traced = await capture('P1', run);
    expect(traced.main.query).toContain('count() OVER () AS __total');
    expect(traced.total!.query).toContain('uniqExact(traceId) AS traces');
    expect(traced.list).toBeUndefined();
    expect(seen.map(s => s.step)).toEqual(['trace-root-keys', 'trace-bound']);
  });

  it('captures the delta list with its cursor column, and groups without reading rows', async () => {
    const delta = keyRunner([], [{ ...key, __delta_cursor: '5' }]);
    const traced = await capture('D1', delta.run, { cursorId: '9', traceId: 't-9' });
    expect(traced.main.query).toContain('delta_candidates');
    expect(delta.seen[0]!.statement.query).toContain('__delta_cursor FROM (');
    expect(scoped(traced.payload!.query)).toBe(1);

    const groups = keyRunner([], []);
    const g0 = await capture('G0', groups.run);
    expect(g0.main.query).toContain('GROUP BY threadId');
    expect(groups.seen).toHaveLength(0);
  });

  it('captures querySpans() hydration from the real store code without a network', async () => {
    const tr = timeRangeFor(WINDOWS['1d'], TO);
    const { plan } = compileCase(caseById('S0'), 'base', LITERALS, tr, SCOPE);
    if (plan.api !== 'spans') throw new Error('expected a span plan');
    const selected: SpanSelectRow[] = [
      {
        organizationId: 'org-test',
        resourceId: null,
        traceId: 't',
        spanId: 's',
        startedAt: '2026-10-05 10:00:00.000',
        endedAt: '2026-10-05 10:00:01.000',
      },
    ];
    const h = await captureSpanHydration(plan.plan, selected);
    expect(h).toBeDefined();
    expect(h!.payload.query).toContain('FROM mastra_span_events');
    expect(h!.metrics.query).toContain('FROM mastra_metric_events');
    expect(await captureSpanHydration(plan.plan, [])).toBeUndefined();

    const s = scopedSpanHydration(h!, SCOPE, tr.from);
    expect(scoped(s.payload.query)).toBe(1);
    expect(scoped(s.metrics.query)).toBe(1);
    expect(s.payload.query).toContain('endedAt >= {bench_from:');
    expect(s.metrics.query).not.toContain('bench_from');
  });

  it('fails closed when span scope anchors drift', () => {
    expect(() => injectSpanProjectScope({ query: 'SELECT 1', query_params: {} }, 'p')).toThrow(RewriteError);
  });

  it('walks cursors in hops and refuses shallow results', async () => {
    const hop = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'threads' as const, threadId: `t${i}` }));
    let calls = 0;
    const at = await walkCursor(3000, 1000, async () => (calls++, hop(1001)));
    expect(calls).toBe(3);
    expect(at).toEqual({ kind: 'threads', threadId: 't999' });
    expect(await walkCursor(2000, 1000, async c => (c ? hop(10) : hop(1001)))).toBeUndefined();
    await expect(walkCursor(1500, 1000, async () => hop(1001))).rejects.toThrow();
  });
});
