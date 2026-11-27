import { traceQueryPredicateSchema } from '@mastra/core/storage';
import type { TraceQueryPredicate } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  expressionToTracePredicate,
  traceOperatorsFor,
  tracePredicateToExpression,
} from './trace-predicate-expression';
import type { FilterBarExpression, FilterBarField, FilterBarPlace } from '@/ds/components/FilterBar';

const status = { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } } as const;
const duration = { op: 'gt', left: { path: 'durationMs' }, right: { literal: 500 } } as const;
const roundTrip = (predicate: TraceQueryPredicate) => {
  const expression = tracePredicateToExpression(predicate);
  if (!expression) throw new Error('predicate is not editable');
  return expressionToTracePredicate(expression);
};

describe('tracePredicateToExpression', () => {
  it('reads no predicate as an empty bar', () => {
    expect(tracePredicateToExpression(undefined)).toEqual({ logic: 'and', nodes: [] });
  });

  it('reads one condition as one root chip', () => {
    expect(tracePredicateToExpression(status)).toEqual({
      logic: 'and',
      nodes: [{ id: '0', fieldId: 'status', operatorId: 'eq', value: 'error' }],
    });
  });

  it('spreads a root group over the root chips with its logic', () => {
    expect(tracePredicateToExpression({ op: 'or', args: [status, duration] })).toEqual({
      logic: 'or',
      nodes: [
        { id: '0', fieldId: 'status', operatorId: 'eq', value: 'error' },
        { id: '1', fieldId: 'durationMs', operatorId: 'gt', value: 500 },
      ],
    });
  });

  it('reads each condition family into a chip value', () => {
    const expression = tracePredicateToExpression({
      op: 'and',
      args: [
        { op: 'in', value: { path: 'entityName' }, set: ['a', 'b'] },
        { op: 'notExists', path: 'threadId' },
        { op: 'includes', path: 'tags', value: 'prod' },
        { op: 'matches', left: { path: 'entityName' }, right: { literal: 'agent' } },
        { op: 'hasAllTokens', left: { path: 'all' }, right: { literal: 'timeout' } },
        { op: 'eq', left: { path: 'metadata.ok' }, right: { literal: true } },
      ],
    });
    expect(expression?.nodes).toEqual([
      { id: '0', fieldId: 'entityName', operatorId: 'in', value: ['a', 'b'] },
      { id: '1', fieldId: 'threadId', operatorId: 'notExists', value: '' },
      { id: '2', fieldId: 'tags', operatorId: 'includes', value: 'prod' },
      { id: '3', fieldId: 'entityName', operatorId: 'matches', value: 'agent' },
      { id: '4', fieldId: 'all', operatorId: 'hasAllTokens', value: 'timeout' },
      { id: '5', fieldId: 'metadata.ok', operatorId: 'eq', value: true },
    ]);
  });

  it('reads `not` as a negated node, wrapping a node already negated', () => {
    const expression = tracePredicateToExpression({
      op: 'and',
      args: [
        { op: 'not', arg: status },
        { op: 'not', arg: { op: 'or', args: [status, duration] } },
        { op: 'not', arg: { op: 'not', arg: duration } },
      ],
    });
    expect(expression?.nodes).toEqual([
      { id: '0', fieldId: 'status', operatorId: 'eq', value: 'error', negated: true },
      {
        id: '1',
        kind: 'group',
        logic: 'or',
        negated: true,
        nodes: [
          { id: '1.0', fieldId: 'status', operatorId: 'eq', value: 'error' },
          { id: '1.1', fieldId: 'durationMs', operatorId: 'gt', value: 500 },
        ],
      },
      {
        id: '2',
        kind: 'group',
        logic: 'and',
        negated: true,
        nodes: [{ id: '2.0', fieldId: 'durationMs', operatorId: 'gt', value: 500, negated: true }],
      },
    ]);
  });

  it('reads a negated root as one negated node', () => {
    expect(tracePredicateToExpression({ op: 'not', arg: status })?.nodes).toEqual([
      { id: '0', fieldId: 'status', operatorId: 'eq', value: 'error', negated: true },
    ]);
  });

  it('reads a related clause as a scoped group with its quantifier', () => {
    const expression = tracePredicateToExpression({
      op: 'and',
      args: [
        { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'llm' } } } },
        {
          scores: {
            none: {
              op: 'and',
              args: [
                { op: 'eq', left: { path: 'scorerId' }, right: { literal: 'tone' } },
                { op: 'lt', left: { path: 'score' }, right: { literal: 0.5 } },
              ],
            },
          },
        },
      ],
    });
    expect(expression?.nodes).toEqual([
      {
        id: '0',
        kind: 'group',
        logic: 'and',
        scope: { id: 'spans', quantifierId: 'some' },
        nodes: [{ id: '0.0', fieldId: 'name', operatorId: 'eq', value: 'llm' }],
      },
      {
        id: '1',
        kind: 'group',
        logic: 'and',
        scope: { id: 'scores', quantifierId: 'none' },
        nodes: [
          { id: '1.0', fieldId: 'scorerId', operatorId: 'eq', value: 'tone' },
          { id: '1.1', fieldId: 'score', operatorId: 'lt', value: 0.5 },
        ],
      },
    ]);
  });

  it('returns undefined for shapes the bar cannot show', () => {
    expect(tracePredicateToExpression({ op: 'eq', left: { literal: 1 }, right: { path: 'durationMs' } })).toBe(
      undefined,
    );
    expect(tracePredicateToExpression({ op: 'eq', left: { path: 'a' }, right: { path: 'b' } })).toBe(undefined);
    expect(tracePredicateToExpression({ op: 'eq', left: { path: 'a' }, right: { literal: null } })).toBe(undefined);
    expect(
      tracePredicateToExpression({ op: 'or', args: [status, { op: 'in', value: { path: 'a' }, set: ['x', null] }] }),
    ).toBe(undefined);
  });
});

describe('expressionToTracePredicate', () => {
  it('returns undefined for an empty bar', () => {
    expect(expressionToTracePredicate({ logic: 'and', nodes: [] })).toBe(undefined);
  });

  it('drops empty groups and related clauses', () => {
    const expression: FilterBarExpression = {
      logic: 'and',
      nodes: [
        { id: 'a', fieldId: 'status', operatorId: 'eq', value: 'error' },
        { id: 'g', kind: 'group', logic: 'or', nodes: [] },
        { id: 's', kind: 'group', logic: 'and', scope: { id: 'spans', quantifierId: 'some' }, nodes: [] },
      ],
    };
    expect(expressionToTracePredicate(expression)).toEqual(status);
  });

  it('keeps a nested group of one condition as a group', () => {
    const expression: FilterBarExpression = {
      logic: 'and',
      nodes: [
        { id: 'a', fieldId: 'status', operatorId: 'eq', value: 'error' },
        {
          id: 'g',
          kind: 'group',
          logic: 'or',
          nodes: [{ id: 'b', fieldId: 'durationMs', operatorId: 'gt', value: 500 }],
        },
      ],
    };
    expect(expressionToTracePredicate(expression)).toEqual({
      op: 'and',
      args: [status, { op: 'or', args: [duration] }],
    });
  });

  it('writes a single value into a set and a list into a comparison as its first value', () => {
    const expression: FilterBarExpression = {
      logic: 'and',
      nodes: [
        { id: 'a', fieldId: 'entityName', operatorId: 'in', value: 'a' },
        { id: 'b', fieldId: 'status', operatorId: 'eq', value: ['error', 'ok'] },
      ],
    };
    expect(expressionToTracePredicate(expression)).toEqual({
      op: 'and',
      args: [{ op: 'in', value: { path: 'entityName' }, set: ['a'] }, status],
    });
  });

  it('throws on an operator that is not a predicate operator', () => {
    expect(() =>
      expressionToTracePredicate({
        logic: 'and',
        nodes: [{ id: 'a', fieldId: 'x', operatorId: 'contains', value: 'y' }],
      }),
    ).toThrow(/contains/);
  });

  it('throws on a scope that is not a related collection', () => {
    expect(() =>
      expressionToTracePredicate({
        logic: 'and',
        nodes: [
          {
            id: 's',
            kind: 'group',
            logic: 'and',
            scope: { id: 'threads', quantifierId: 'some' },
            nodes: [{ id: 'a', fieldId: 'x', operatorId: 'eq', value: 'y' }],
          },
        ],
      }),
    ).toThrow(/threads/);
  });
});

describe('round trip', () => {
  const predicates: [string, TraceQueryPredicate][] = [
    ['one condition', status],
    ['a root group', { op: 'or', args: [status, duration] }],
    ['nested groups', { op: 'and', args: [status, { op: 'or', args: [duration, { op: 'and', args: [status] }] }] }],
    [
      'negations',
      {
        op: 'and',
        args: [
          { op: 'not', arg: status },
          { op: 'not', arg: { op: 'or', args: [status, duration] } },
        ],
      },
    ],
    ['a negated root group', { op: 'not', arg: { op: 'and', args: [status, duration] } }],
    [
      'related clauses',
      {
        op: 'or',
        args: [
          { spans: { some: { op: 'and', args: [status, { op: 'not', arg: duration }] } } },
          { op: 'not', arg: { feedback: { none: { op: 'exists', path: 'value' } } } },
        ],
      },
    ],
  ];

  it.each(predicates)('keeps %s', (_, predicate) => {
    expect(traceQueryPredicateSchema.safeParse(predicate).success).toBe(true);
    expect(roundTrip(predicate)).toEqual(predicate);
  });

  it('writes a double negation back through the group that holds it', () => {
    expect(roundTrip({ op: 'not', arg: { op: 'not', arg: duration } })).toEqual({
      op: 'not',
      arg: { op: 'and', args: [{ op: 'not', arg: duration }] },
    });
  });

  it('reads back every expression it writes', () => {
    const expression: FilterBarExpression = {
      logic: 'or',
      nodes: [
        { id: '0', fieldId: 'status', operatorId: 'eq', value: 'error', negated: true },
        {
          id: '1',
          kind: 'group',
          logic: 'and',
          negated: true,
          scope: { id: 'spans', quantifierId: 'none' },
          nodes: [
            { id: '1.0', fieldId: 'name', operatorId: 'in', value: ['a', 'b'] },
            {
              id: '1.1',
              kind: 'group',
              logic: 'or',
              nodes: [{ id: '1.1.0', fieldId: 'durationMs', operatorId: 'gte', value: 10 }],
            },
          ],
        },
        {
          id: '2',
          kind: 'group',
          logic: 'and',
          nodes: [{ id: '2.0', fieldId: 'all', operatorId: 'hasAllTokens', value: 'x' }],
        },
      ],
    };
    const predicate = expressionToTracePredicate(expression);
    expect(traceQueryPredicateSchema.safeParse(predicate).success).toBe(true);
    expect(tracePredicateToExpression(predicate)).toEqual(expression);
  });
});

describe('traceOperatorsFor', () => {
  const field: FilterBarField = { id: 'all', label: 'Words', operators: ['hasAllTokens', 'matches'] };
  const place = (patch: Partial<FilterBarPlace> = {}): FilterBarPlace => ({ negated: false, ...patch });

  it('keeps every operator where word search runs', () => {
    expect(traceOperatorsFor(field, place())).toBe(undefined);
    expect(traceOperatorsFor(field, place({ scope: { id: 'spans', quantifierId: 'some' } }))).toBe(undefined);
  });

  it('drops word search under a negation or a `none` clause', () => {
    expect(traceOperatorsFor(field, place({ negated: true }))).toEqual(['matches']);
    expect(traceOperatorsFor(field, place({ scope: { id: 'spans', quantifierId: 'none' } }))).toEqual(['matches']);
  });

  it('drops word search from fields that list no operators', () => {
    const ops = traceOperatorsFor({ id: 'status', label: 'Status' }, place({ negated: true }));
    expect(ops).toContain('eq');
    expect(ops).not.toContain('hasAllTokens');
  });
});
