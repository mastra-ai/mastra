import { describe, expect, it } from 'vitest';
import { planSpanAggregate } from './span-aggregate';
import { planSpanQuery, encodeSpanQueryCursor } from './span-query';
import { parseTraceAggregateRequest } from './trace-aggregate';
import { planTraceAggregate } from './trace-aggregate-planner';
import { parseTraceQueryRequest, TraceQueryCursorError } from './trace-query';
import { planTraceQuery } from './trace-query-plan';

const options = { allowTokenSearch: true };
const timeRange = { from: '2026-11-01T00:00:00Z', to: '2026-11-08T00:00:00Z' };
const token = (path: string, literal: unknown) => ({ op: 'hasAllTokens', left: { path }, right: { literal } });
const conjunction = { op: 'and', args: [token('input', 'tacos'), token('output', 'nachos')] };
const cases = [
  ['spans', (where: unknown, extra = {}) => planSpanQuery({ timeRange, where, ...extra }, options), false],
  [
    'span aggregates',
    (where: unknown, extra = {}) => planSpanAggregate({ timeRange, where, measures: ['count'], ...extra }, options),
    false,
  ],
  [
    'traces',
    (where: unknown, extra = {}) => planTraceQuery(parseTraceQueryRequest({ timeRange, where, ...extra }), options),
    true,
  ],
  [
    'trace aggregates',
    (where: unknown, extra = {}) =>
      planTraceAggregate(parseTraceAggregateRequest({ timeRange, where, measures: ['count'], ...extra }), options),
    true,
  ],
] as const;

describe.each(cases)('%s token predicates', (_, plan, related) => {
  const wrap = (predicate: unknown) => (related ? { spans: { some: predicate } } : predicate);
  it.each(['first', 'last'])('enforces the literal budget with the token predicate %s', position => {
    const memberships = Array.from({ length: 10 }, (_, index) => ({
      op: 'in',
      value: { path: 'name' },
      set: Array.from({ length: index === 9 ? 99 : 100 }, (_, value) => `span-${value}`),
    }));
    const search = token('input', 'tacos');
    const where = () =>
      wrap({ op: 'and', args: position === 'first' ? [search, ...memberships] : [...memberships, search] });

    expect(() => plan(where())).not.toThrow();
    memberships[9]!.set.push('span-99');
    expect(() => plan(where())).toThrow(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ message: 'Trace queries are limited to 1000 literal units' }),
        ]),
      }),
    );
  });
  it('preserves same-span conjunctions and selected fields', () => {
    const result = plan(wrap(conjunction));
    const expected = {
      type: 'boolean',
      operator: 'and',
      args: [
        { type: 'tokens', field: 'input', operator: 'hasAllTokens', value: 'tacos' },
        { type: 'tokens', field: 'output', operator: 'hasAllTokens', value: 'nachos' },
      ],
    };
    expect(result.where).toEqual(
      related ? { type: 'relation', collection: 'spans', quantifier: 'some', predicate: expected } : expected,
    );
  });
  it('supports all six fields without changing token case or punctuation', () => {
    const result = plan(wrap(token('all', '  foo-Bar 😀  ')));
    expect(JSON.stringify(result.where)).toContain('foo-Bar 😀');
  });
  it.each(['attributes', 'requestContext', 'name', 'all); DROP TABLE spans'])('rejects nonindexed field %s', field => {
    expect(() => plan(wrap(token(field, 'tacos')))).toThrow();
  });
  it.each(['', ' ', 'x'.repeat(257), null, 12])('rejects invalid search value %j', value => {
    expect(() => plan(wrap(token('input', value)))).toThrow();
  });
  it('counts Unicode code points for the token value limit', () => {
    expect(() => plan(wrap(token('input', '😀'.repeat(256))))).not.toThrow();
    expect(() => plan(wrap(token('input', '😀'.repeat(257))))).toThrow();
  });
  it('rejects the removed top-level textSearch field', () => {
    expect(() => plan(undefined, { textSearch: 'tacos' })).toThrow();
  });
});

it('binds span cursors to token fields and values', () => {
  const plan = planSpanQuery({ timeRange, where: token('input', 'tacos') }, options);
  const after = encodeSpanQueryCursor(plan, {
    organizationId: null,
    resourceId: null,
    traceId: 'trace',
    spanId: 'span',
    sortValue: '2026-11-02T00:00:00Z',
  });
  for (const where of [token('output', 'tacos'), token('input', 'nachos'), undefined]) {
    expect(() => planSpanQuery({ timeRange, where, page: { after } }, options)).toThrow(TraceQueryCursorError);
  }
});
it('rejects trace root, feedback, score, and delta token predicates', () => {
  for (const where of [
    token('input', 'tacos'),
    { feedback: { some: token('input', 'tacos') } },
    { scores: { some: token('input', 'tacos') } },
  ]) {
    expect(() => planTraceQuery(parseTraceQueryRequest({ timeRange, where }), options)).toThrow();
  }
  expect(() =>
    planTraceQuery(
      parseTraceQueryRequest({ timeRange, mode: 'delta', where: { spans: { some: token('all', 'tacos') } } }),
      options,
    ),
  ).toThrow();
});

it('rejects token predicates when an older host has not opted in', () => {
  const where = token('all', 'tacos');
  const traceWhere = { spans: { some: where } };
  expect(() => planSpanQuery({ timeRange, where })).toThrow();
  expect(() => planSpanAggregate({ timeRange, where, measures: ['count'] })).toThrow();
  expect(() => planTraceQuery(parseTraceQueryRequest({ timeRange, where: traceWhere }))).toThrow();
  expect(() =>
    planTraceAggregate(parseTraceAggregateRequest({ timeRange, where: traceWhere, measures: ['count'] })),
  ).toThrow();
});
