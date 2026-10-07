import { parseTraceAggregateRequest, planTraceAggregate } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { compileClickHouseTraceAggregate } from '../../src/storage/domains/observability/v-next/trace-aggregate';
import { anchorTo, CASES, compileCase, compilePayloadStage, DOC_LITERALS, timeRangeFor } from './cases';
import { stageQuery } from './floor';
import { applyVariant, injectProjectScope, PROJECT_PARAM, RewriteError } from './scope';

const SCOPE = { organizationId: 'org-test', projectId: 'proj-test' };
const LITERALS = { environment: 'env-x', tool: 'tool-x', metadataKey: 'key-x', entityType: 'agent' };
const TO = anchorTo(new Date('2026-10-05T13:37:12.345Z'));

function scopedCount(sql: string): number {
  return sql.split(`AND projectId = {${PROJECT_PARAM}:String}`).length - 1;
}

describe('case catalogue', () => {
  const combos = CASES.flatMap(def =>
    def.windows.flatMap(window => def.variants.map(variant => ({ def, window, variant }))),
  );

  it.each(combos.map(c => [`${c.def.id}/${c.variant}/${c.window.id}`, c] as const))(
    '%s plans, compiles and is project-scoped',
    (_label, { def, window, variant }) => {
      const compiled = compileCase(def, variant, LITERALS, timeRangeFor(window, TO), SCOPE);
      // Every tenant-scoped scan also carries the project, and the project is a bound parameter.
      const usage = def.group === 'tokens' ? 1 : 0;
      expect(compiled.query.includes('usage AS (')).toBe(usage === 1);
      const expected = 2 + def.relations.length + usage + (variant === 'w1' ? 1 : 0);
      expect(scopedCount(compiled.query)).toBe(expected);
      expect(compiled.query).not.toContain('proj-test');
      expect(compiled.query).not.toContain('org-test');
      expect(compiled.query_params[PROJECT_PARAM]).toBe('proj-test');
      expect(Object.values(compiled.query_params)).toContain('org-test');
      if (variant === 'exact') expect(compiled.query).toContain('quantileExact(');
      if (variant === 'uniq') expect(compiled.query).not.toContain('uniqExact(');
      if (variant === 'mkey') {
        expect(compiled.query).not.toContain('GROUP BY traceId, metricId');
        expect(compiled.query).toContain('any(traceId) AS mkTraceId');
      }
    },
  );

  it('uses discovered literals unless the case asks for the doc literals', () => {
    const tr = timeRangeFor({ id: '1d', ms: 86_400_000 }, TO);
    const e1 = compileCase(
      CASES.find(c => c.id === 'E1')!,
      'base',
      LITERALS,
      tr,
      SCOPE,
    );
    const e1doc = compileCase(
      CASES.find(c => c.id === 'E1-doc')!,
      'base',
      LITERALS,
      tr,
      SCOPE,
    );
    expect(Object.values(e1.query_params)).toContain('env-x');
    expect(Object.values(e1doc.query_params)).toContain(DOC_LITERALS.environment);
  });

  it('anchors interval windows on bucket boundaries within the planner caps', () => {
    expect(TO.toISOString()).toBe('2026-10-05T13:00:00.000Z');
    for (const id of ['I1', 'I2', 'I3', 'I4']) {
      const def = CASES.find(c => c.id === id)!;
      // compileCase runs the planner, which rejects > 1000 buckets or > 10 000 rows.
      expect(() => compileCase(def, 'base', LITERALS, timeRangeFor(def.windows[0]!, TO), SCOPE)).not.toThrow();
    }
  });

  it('builds the payload stage unscoped as compiled, and scoped on request', () => {
    const keys = [{ traceId: 't', rootSpanId: 's', startedAt: TO.toISOString(), endedAt: TO.toISOString() }];
    expect(compilePayloadStage(keys, SCOPE, false).query).not.toContain('projectId');
    const scoped = compilePayloadStage(keys, SCOPE, true);
    expect(scoped.query).toContain('organizationId = {bench_org_id:String} AND projectId = {bench_project_id:String}');
    expect(scoped.query_params).toMatchObject({ bench_org_id: 'org-test', bench_project_id: 'proj-test' });
  });
});

describe('injectProjectScope', () => {
  const plan = (body: Record<string, unknown>, organizationId?: string) =>
    compileClickHouseTraceAggregate(
      planTraceAggregate(
        parseTraceAggregateRequest({
          timeRange: timeRangeFor({ id: '1d', ms: 86_400_000 }, TO),
          measures: ['count'],
          ...body,
        }),
        organizationId ? { scope: { organizationId } } : {},
      ),
    );

  it('fails closed when the plan has no tenant scope', () => {
    expect(() => injectProjectScope(plan({}), 'p', [])).toThrow(RewriteError);
  });

  it('fails closed when declared relations do not match the compiled CTEs', () => {
    const withSpans = plan(
      { where: { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'x' } } } } },
      'o',
    );
    expect(() => injectProjectScope(withSpans, 'p', [])).toThrow(/spans/);
    expect(() => injectProjectScope(plan({}, 'o'), 'p', ['spans'])).toThrow(/spans/);
  });

  it('scopes scores and feedback relations too', () => {
    const compiled = plan(
      {
        where: {
          op: 'and',
          args: [
            { scores: { some: { op: 'exists', path: 'score' } } },
            { feedback: { some: { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'x' } } } },
          ],
        },
      },
      'o',
    );
    expect(scopedCount(injectProjectScope(compiled, 'p', ['scores', 'feedback']).query)).toBe(4);
  });

  it('variants fail closed when their pattern is absent', () => {
    const scoped = injectProjectScope(plan({}, 'o'), 'p', []);
    expect(() => applyVariant(scoped, 'uniq')).toThrow(RewriteError);
    expect(() => applyVariant(scoped, 'exact')).toThrow(RewriteError);
    expect(() => applyVariant(plan({}, 'o'), 'w1')).toThrow(/not project-scoped/);
  });
});

describe('memory variants', () => {
  const e4 = CASES.find(c => c.id === 'E4')!;
  const tr = timeRangeFor({ id: '7d', ms: 7 * 86_400_000 }, TO);

  it('settings-only variants leave the SQL unchanged', () => {
    const base = compileCase(e4, 'base', LITERALS, tr, SCOPE);
    for (const variant of ['t2', 'spill'] as const) {
      expect(compileCase(e4, variant, LITERALS, tr, SCOPE).query).toBe(base.query);
    }
  });

  it('mkey fails closed on a query without the usage CTE', () => {
    const f0 = compileCase(
      CASES.find(c => c.id === 'F0')!,
      'base',
      LITERALS,
      tr,
      SCOPE,
    );
    expect(() => applyVariant(f0, 'mkey')).toThrow(RewriteError);
  });

  it('rejects tenant fragments that bind different organizations', () => {
    const base = compileCase(e4, 'base', LITERALS, tr, SCOPE);
    const params = Object.keys(base.query_params).filter(k => base.query_params[k] === 'org-test');
    expect(params.length).toBeGreaterThan(1);
    const plan = planTraceAggregate(parseTraceAggregateRequest({ ...e4.request(LITERALS), timeRange: tr }), {
      scope: { organizationId: 'org-test' },
    });
    const raw = compileClickHouseTraceAggregate(plan);
    const tampered = { ...raw, query_params: { ...raw.query_params, [params.at(-1)!]: 'other-org' } };
    expect(() => injectProjectScope(tampered, 'proj-test', [])).toThrow('same organization');
  });
});

describe('query-shape variants', () => {
  const tr = timeRangeFor({ id: '30d', ms: 30 * 86_400_000 }, TO);
  const compile = (id: string, variant: Parameters<typeof compileCase>[1]) =>
    compileCase(
      CASES.find(c => c.id === id)!,
      variant,
      LITERALS,
      tr,
      SCOPE,
    );

  it('rs scopes and time-bounds the outer re-read and partition-bounds the seed', () => {
    const q = compile('F0', 'rs').query;
    const outer = /SELECT \*\s+FROM mastra_trace_roots\s+WHERE ([\s\S]*?)traceId IN \(/.exec(q)?.[1] ?? '';
    expect(outer).toMatch(/organizationId = \{trace_query_\d+:String\} AND projectId = \{bench_project_id:String\}/);
    expect(outer).toMatch(/startedAt >= .*startedAt < .*endedAt >= /s);
    expect(q).toMatch(
      /FROM mastra_trace_roots r\s+WHERE startedAt >= \{trace_query_\d+:DateTime64\(3, 'UTC'\)\} AND endedAt >= /,
    );
  });

  it('r1 leaves a single LIMIT BY in current_roots', () => {
    const q = compile('F0', 'r1').query;
    expect(q).not.toContain('LIMIT 1 BY dedupeKey');
    expect(q).toContain('LIMIT 1 BY traceId');
  });

  it('sp drops the span dedupe only, and needs a span relation', () => {
    const q = compile('F3', 'sp').query;
    const spans = /current_spans AS \(([\s\S]*?)\n {2}\),/.exec(q)?.[1] ?? '';
    expect(spans).not.toContain('LIMIT 1 BY dedupeKey');
    expect(spans).toMatch(/endedAt >= \{trace_query_\d+:DateTime64/);
    expect(q).toContain('LIMIT 1 BY dedupeKey'); // current_roots keeps its dedupe
    expect(() => compile('F0', 'sp')).toThrow(RewriteError);
  });

  it('shape composes the rewrites, including the usage dedupe for token cases', () => {
    const q = compile('E4', 'shape').query;
    expect(q).not.toContain('GROUP BY traceId, metricId');
    expect(q).not.toContain('LIMIT 1 BY dedupeKey');
    expect(compile('F3', 'shape').query).not.toContain('LIMIT 1 BY dedupeKey');
  });

  it('stageQuery ends the WITH chain at the named CTE', () => {
    const q = compile('E4', 'base').query;
    expect(stageQuery(q, 'usage')).toMatch(/\nSELECT count\(\) AS n, sum\(cityHash64\(\*\)\) AS h FROM usage$/);
    expect(stageQuery(q, 'current_roots')).toMatch(/cityHash64\(traceId\)\) AS h FROM current_roots$/);
    expect(() => stageQuery(q, 'nope')).toThrow(/no CTE/);
  });
});

describe('schema variants (lab)', () => {
  const tr = timeRangeFor({ id: '30d', ms: 30 * 86_400_000 }, TO);
  const compile = (id: string, variant: Parameters<typeof compileCase>[1]) =>
    compileCase(
      CASES.find(c => c.id === id)!,
      variant,
      LITERALS,
      tr,
      SCOPE,
    );

  it('urollup reads usage from the per-trace rollup with every usage sum mapped', () => {
    const q = compile('E4', 'urollup').query;
    const usage = /usage AS \(([\s\S]*?)\n {2}\),/.exec(q)?.[1] ?? '';
    expect(usage).toContain('FROM mastra_trace_usage');
    expect(usage).not.toContain('mastra_metric_events');
    expect(usage.match(/sum\(u\d\) AS t\d/g)).toHaveLength(4);
    expect(usage).toMatch(/organizationId = \{trace_query_\d+:String\} AND projectId = \{bench_project_id:String\}/);
    expect(() => compile('F0', 'urollup')).toThrow(RewriteError);
  });

  it('snidx answers spans.some(name) from the span-name index, scoped and time-bounded', () => {
    const q = compile('F3', 'snidx').query;
    expect(q).toMatch(
      /FROM mastra_trace_span_names s\n\s+WHERE isNotNull\(s\.traceId\)\n\s+AND s\.organizationId = \{trace_query_\d+:String\} AND s\.projectId = \{bench_project_id:String\} AND s\.endedAt >= /,
    );
    expect(q).not.toContain('FROM current_spans s');
    expect(() => compile('F0', 'snidx')).toThrow(RewriteError);
  });

  it('snidx refuses span predicates beyond the name', () => {
    const c = compile('F3', 'base');
    const tampered = { ...c, query: c.query.replace(/ifNull\(s\.name = /, 'ifNull(s.spanType = ') };
    expect(() => applyVariant(tampered, 'snidx')).toThrow(/more than the span name/);
  });

  it('arch combines shape, rollup and index where they apply', () => {
    const q = compile('T4', 'arch').query;
    expect(q).toContain('FROM mastra_trace_usage');
    expect(q).toContain('FROM mastra_trace_span_names s');
    expect(q).not.toContain('LIMIT 1 BY dedupeKey');
    expect(compile('F0', 'arch').query).toContain('ORDER BY startedAt, traceId, dedupeKey');
    expect(compile('F0', 'rio').query).not.toContain('LIMIT 1 BY dedupeKey');
  });
});

describe('dashboard rollup and lean per-trace path (lab)', () => {
  const tr = timeRangeFor({ id: '30d', ms: 30 * 86_400_000 }, TO);
  const compile = (id: string, variant: Parameters<typeof compileCase>[1]) =>
    compileCase(
      CASES.find(c => c.id === id)!,
      variant,
      LITERALS,
      tr,
      SCOPE,
    );

  it('hourly answers additive token/cost queries from the hourly rollup alone', () => {
    const q = compile('E4', 'hourly').query;
    expect(q.startsWith('WITH facts AS (')).toBe(true);
    expect(q).toContain('FROM mastra_usage_hourly');
    expect(q).not.toMatch(/mastra_trace_roots|mastra_metric_events|LEFT JOIN/);
    expect(q).toMatch(/organizationId = \{trace_query_\d+:String\} AND projectId = \{bench_project_id:String\}/);
    const grouped = /grouped AS \(([\s\S]*?)FROM facts/.exec(q)?.[1] ?? '';
    expect(grouped).toContain('sum(n)');
    expect(grouped).not.toMatch(/count\(\)|countIf\(/);
    expect(compile('T2', 'hourly').query).toContain('nullIf(sum(usageN), 0)');
  });

  it('hourly refuses queries that need per-trace data', () => {
    expect(() => compile('T3', 'hourly')).toThrow(/groupBy uses threadId/);
    expect(() => compile('E2', 'hourly')).toThrow(/not additive/);
    expect(() => compile('F3', 'hourly')).toThrow(/per-trace data/);
    const c = compile('E4', 'base');
    const quarterHour = { ...c, query: c.query.replaceAll('86400000', '900000') };
    expect(() => applyVariant(quarterHour, 'hourly')).toThrow(/whole hours/);
  });

  it('hk keys traceId sets and the usage join by cityHash64', () => {
    const q = compile('E4', 'arch2').query;
    expect(q).toContain('cityHash64(traceId) AS traceHash');
    expect(q).toContain('ON u.traceHash = cityHash64(r.traceId)');
    expect(q).not.toMatch(/\btraceId IN \(/);
    expect(q).not.toContain('LIMIT 1 BY traceId');
  });

  it('arch3 reads usage from the root row and drops the usage join', () => {
    const q = compile('E4', 'arch3').query;
    expect(q).toContain('FROM mastra_trace_roots_u');
    expect(q).not.toMatch(/usage AS \(|LEFT JOIN|\bu\./);
    expect(q).toMatch(/if\(r\.hasUsage = 1, r\.u\d, NULL\) AS t0/);
    expect(compile('F0', 'arch3').query).toBe(compile('F0', 'arch2').query);
  });
});
