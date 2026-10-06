import { parseTraceAggregateRequest, planTraceAggregate } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { compileClickHouseTraceAggregate } from '../../src/storage/domains/observability/v-next/trace-aggregate';
import { anchorTo, CASES, compileCase, compilePayloadStage, DOC_LITERALS, timeRangeFor } from './cases';
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
      const expected = 2 + def.relations.length + (variant === 'w1' ? 1 : 0);
      expect(scopedCount(compiled.query)).toBe(expected);
      expect(compiled.query).not.toContain('proj-test');
      expect(compiled.query).not.toContain('org-test');
      expect(compiled.query_params[PROJECT_PARAM]).toBe('proj-test');
      expect(Object.values(compiled.query_params)).toContain('org-test');
      if (variant === 'exact') expect(compiled.query).toContain('quantileExact(');
      if (variant === 'uniq') expect(compiled.query).not.toContain('uniqExact(');
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
