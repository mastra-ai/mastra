import { describe, expect, it } from 'vitest';
import { planSpanAggregate } from './span-aggregate';
import { planSpanQuery, encodeSpanQueryCursor } from './span-query';
import { parseTraceAggregateRequest } from './trace-aggregate';
import { planTraceAggregate } from './trace-aggregate-planner';
import {
  parseQueryThreadsInput,
  parseTraceQueryRequest,
  TraceQueryCursorError,
  TRACE_QUERY_TOKEN_FIELDS,
} from './trace-query';
import { planThreadQuery, planTraceQuery } from './trace-query-plan';

const issue = (code: string, path: Array<string | number>) =>
  expect.objectContaining({ issues: expect.arrayContaining([expect.objectContaining({ code, path })]) });

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
  it.each([
    ['direct NOT', { op: 'not', arg: token('input', 'tacos') }],
    ['NOT around AND', { op: 'not', arg: conjunction }],
    ['double NOT', { op: 'not', arg: { op: 'not', arg: token('input', 'tacos') } }],
    ['NOT under OR', { op: 'or', args: [token('output', 'nachos'), { op: 'not', arg: token('input', 'tacos') }] }],
  ])('rejects token search beneath %s', (_, predicate) => {
    expect(() => plan(wrap(predicate))).toThrow(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'operator_not_allowed',
            message: 'Token search is not supported beneath not or none',
          }),
        ]),
      }),
    );
  });
  if (related) {
    it.each([
      ['spans.none', { spans: { none: conjunction } }],
      ['NOT around spans.some', { op: 'not', arg: { spans: { some: conjunction } } }],
      ['NOT inside spans.none', { spans: { none: { op: 'not', arg: token('input', 'tacos') } } }],
    ])('rejects token search beneath %s', (_, predicate) => {
      expect(() => plan(predicate)).toThrow(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: 'operator_not_allowed',
              message: 'Token search is not supported beneath not or none',
            }),
          ]),
        }),
      );
    });
  }
  it('allows a positive search alongside an ordinary negative filter', () => {
    const result = plan(
      wrap({
        op: 'and',
        args: [
          token('input', 'tacos'),
          { op: 'not', arg: { op: 'eq', left: { path: 'name' }, right: { literal: 'ignored' } } },
        ],
      }),
    );
    expect(result.where).toMatchObject(
      related
        ? { type: 'relation', quantifier: 'some', predicate: { type: 'boolean', operator: 'and' } }
        : { type: 'boolean', operator: 'and' },
    );
  });
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
  it.each(TRACE_QUERY_TOKEN_FIELDS)('supports %s without changing token case or punctuation', field => {
    const result = plan(wrap(token(field, '  foo-Bar 😀  ')));
    const expected = { type: 'tokens', field, operator: 'hasAllTokens', value: 'foo-Bar 😀' };
    expect(result.where).toEqual(
      related ? { type: 'relation', collection: 'spans', quantifier: 'some', predicate: expected } : expected,
    );
  });
  it.each(['attributes', 'requestContext', 'name', 'all); DROP TABLE spans'])('rejects nonindexed field %s', field => {
    expect(() => plan(wrap(token(field, 'tacos')))).toThrow(issue('invalid_request', ['where']));
  });
  it.each(['', ' ', 'x'.repeat(257), null, 12])('rejects invalid search value %j', value => {
    expect(() => plan(wrap(token('input', value)))).toThrow(
      issue(
        'invalid_request',
        typeof value === 'string'
          ? [...(related ? ['where', 'spans', 'some'] : ['where']), 'right', 'literal']
          : ['where'],
      ),
    );
  });
  it('counts Unicode code points for the token value limit', () => {
    expect(() => plan(wrap(token('input', '😀'.repeat(256))))).not.toThrow();
    expect(() => plan(wrap(token('input', '😀'.repeat(257))))).toThrow(
      issue('invalid_request', [...(related ? ['where', 'spans', 'some'] : ['where']), 'right', 'literal']),
    );
  });
  it('rejects the removed top-level textSearch field', () => {
    expect(() => plan(undefined, { textSearch: 'tacos' })).toThrow(issue('invalid_request', []));
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
  for (const [where, path] of [
    [token('input', 'tacos'), ['where']],
    [{ feedback: { some: token('input', 'tacos') } }, ['where', 'feedback', 'some']],
    [{ scores: { some: token('input', 'tacos') } }, ['where', 'scores', 'some']],
  ] as const) {
    expect(() => planTraceQuery(parseTraceQueryRequest({ timeRange, where }), options)).toThrow(
      issue('field_not_allowed', [...path]),
    );
  }
  expect(() =>
    planTraceQuery(
      parseTraceQueryRequest({ timeRange, mode: 'delta', where: { spans: { some: token('all', 'tacos') } } }),
      options,
    ),
  ).toThrow(issue('invalid_request', ['where']));
});

it('rejects token predicates when an older host has not opted in', () => {
  const where = token('all', 'tacos');
  const traceWhere = { spans: { some: where } };
  expect(() => planSpanQuery({ timeRange, where })).toThrow(issue('operator_not_allowed', ['where', 'op']));
  expect(() => planSpanAggregate({ timeRange, where, measures: ['count'] })).toThrow(
    issue('operator_not_allowed', ['where', 'op']),
  );
  expect(() => planTraceQuery(parseTraceQueryRequest({ timeRange, where: traceWhere }))).toThrow(
    issue('operator_not_allowed', ['where', 'spans', 'some', 'op']),
  );
  expect(() =>
    planTraceAggregate(parseTraceAggregateRequest({ timeRange, where: traceWhere, measures: ['count'] })),
  ).toThrow(issue('operator_not_allowed', ['where', 'spans', 'some', 'op']));
});

it.each(['selection', 'related trace'])('explains that thread queries cannot use token search in %s', location => {
  const where = { spans: { some: token('input', 'tacos') } };
  const request =
    location === 'selection'
      ? { traces: { timeRange, where } }
      : { traces: { timeRange }, where: { traces: { some: where } } };
  expect(() => planThreadQuery(parseQueryThreadsInput(request), options)).toThrow(
    expect.objectContaining({
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'operator_not_allowed',
          message: 'Token search is not supported in thread queries',
        }),
      ]),
    }),
  );
});

describe('aggregate having token predicates', () => {
  it.each(['traces', 'spans'])('rejects token operators explicitly for %s', kind => {
    const request = { timeRange, measures: ['count'], having: token('all', 'needle') };
    const run = () =>
      kind === 'traces'
        ? planTraceAggregate(parseTraceAggregateRequest(request), options)
        : planSpanAggregate(request, options);
    expect(run).toThrow(issue('operator_not_allowed', ['having', 'op']));
  });
});
