import { describe, expect, it } from 'vitest';
import type { Predicate } from './index';
import { derivePredicateLabel, evaluatePredicate, predicateSchema } from './index';

describe('predicateSchema', () => {
  it('accepts every op shape', () => {
    const cases: Predicate[] = [
      { op: 'eq', left: { path: 'stepResults.a.b' }, right: { literal: 3 } },
      { op: 'ne', left: { literal: 'x' }, right: { path: 'inputData.name' } },
      { op: 'lt', left: { path: 'a' }, right: { literal: 10 } },
      { op: 'lte', left: { path: 'a' }, right: { literal: 10 } },
      { op: 'gt', left: { path: 'a' }, right: { literal: 10 } },
      { op: 'gte', left: { path: 'a' }, right: { literal: 10 } },
      { op: 'in', value: { path: 'x' }, set: ['a', 'b'] },
      { op: 'notIn', value: { path: 'x' }, set: [1, 2, 3] },
      { op: 'exists', path: 'stepResults.foo' },
      { op: 'notExists', path: 'stepResults.foo' },
      { op: 'truthy', value: { path: 'a' } },
      { op: 'falsy', value: { path: 'a' } },
      {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'a' }, right: { literal: 1 } },
          {
            op: 'or',
            args: [
              { op: 'truthy', value: { path: 'b' } },
              { op: 'notExists', path: 'c' },
            ],
          },
        ],
      },
      { op: 'not', arg: { op: 'exists', path: 'x' } },
    ];
    for (const c of cases) {
      expect(() => predicateSchema.parse(c)).not.toThrow();
    }
  });

  it('rejects malformed predicates', () => {
    expect(() => predicateSchema.parse({ op: 'eq' })).toThrow();
    expect(() => predicateSchema.parse({ op: 'and', args: [] })).toThrow();
    expect(() => predicateSchema.parse({ op: 'in', value: { path: 'x' }, set: [] })).toThrow();
    expect(() => predicateSchema.parse({ op: 'exists' })).toThrow();
    expect(() => predicateSchema.parse({ op: 'nope' })).toThrow();
    // Extra keys are rejected — strict object.
    expect(() => predicateSchema.parse({ op: 'exists', path: 'x', extra: 1 })).toThrow();
  });
});

describe('evaluatePredicate', () => {
  const ctx = {
    initData: { path: '/tmp/x', count: 3 },
    inputData: { tier: 'high' },
    stepResults: {
      classify: { tier: 'high', score: 0.8 },
      probe: null,
    },
  };

  it('handles equality on paths and literals', () => {
    expect(
      evaluatePredicate({ op: 'eq', left: { path: 'stepResults.classify.tier' }, right: { literal: 'high' } }, ctx),
    ).toBe(true);
    expect(
      evaluatePredicate({ op: 'ne', left: { path: 'stepResults.classify.tier' }, right: { literal: 'low' } }, ctx),
    ).toBe(true);
  });

  it('handles ordering ops on numbers and strings', () => {
    expect(evaluatePredicate({ op: 'gt', left: { path: 'initData.count' }, right: { literal: 2 } }, ctx)).toBe(true);
    expect(evaluatePredicate({ op: 'gte', left: { path: 'initData.count' }, right: { literal: 3 } }, ctx)).toBe(true);
    expect(evaluatePredicate({ op: 'lt', left: { path: 'initData.count' }, right: { literal: 3 } }, ctx)).toBe(false);
    expect(evaluatePredicate({ op: 'lt', left: { literal: 'a' }, right: { literal: 'b' } }, ctx)).toBe(true);
  });

  it('returns false when ordering ops receive incompatible types', () => {
    expect(evaluatePredicate({ op: 'lt', left: { literal: 'a' }, right: { literal: 1 } }, ctx)).toBe(false);
  });

  it('handles membership ops', () => {
    expect(
      evaluatePredicate({ op: 'in', value: { path: 'stepResults.classify.tier' }, set: ['high', 'low'] }, ctx),
    ).toBe(true);
    expect(
      evaluatePredicate({ op: 'notIn', value: { path: 'stepResults.classify.tier' }, set: ['low', 'mid'] }, ctx),
    ).toBe(true);
  });

  it('exists / notExists distinguish missing from null', () => {
    expect(evaluatePredicate({ op: 'exists', path: 'stepResults.classify' }, ctx)).toBe(true);
    expect(evaluatePredicate({ op: 'exists', path: 'stepResults.probe' }, ctx)).toBe(true);
    expect(evaluatePredicate({ op: 'notExists', path: 'stepResults.absent' }, ctx)).toBe(true);
    expect(evaluatePredicate({ op: 'exists', path: 'stepResults.absent' }, ctx)).toBe(false);
    expect(evaluatePredicate({ op: 'exists', path: 'stepResults.classify.missing.deep' }, ctx)).toBe(false);
  });

  it('falls back to getStepResult when no stepResults map is provided', () => {
    const called: string[] = [];
    const accessorCtx = {
      inputData: {},
      getStepResult: (id: string) => {
        called.push(id);
        if (id === 'classify') return { tier: 'high' };
        return null;
      },
    };
    expect(
      evaluatePredicate(
        { op: 'eq', left: { path: 'stepResults.classify.tier' }, right: { literal: 'high' } },
        accessorCtx,
      ),
    ).toBe(true);
    expect(evaluatePredicate({ op: 'exists', path: 'stepResults.absent' }, accessorCtx)).toBe(false);
    expect(called).toContain('classify');
  });

  it('accepts template-style paths', () => {
    expect(evaluatePredicate({ op: 'eq', left: { path: '${initData.count}' }, right: { literal: 3 } }, ctx)).toBe(true);
    expect(evaluatePredicate({ op: 'exists', path: '${stepResults.classify}' }, ctx)).toBe(true);
  });

  it('missing paths on comparison return false', () => {
    expect(evaluatePredicate({ op: 'eq', left: { path: 'stepResults.absent.x' }, right: { literal: 1 } }, ctx)).toBe(
      false,
    );
    expect(evaluatePredicate({ op: 'in', value: { path: 'stepResults.absent' }, set: [1] }, ctx)).toBe(false);
    expect(evaluatePredicate({ op: 'notIn', value: { path: 'stepResults.absent' }, set: [1] }, ctx)).toBe(true);
  });

  it('truthy / falsy respect JS semantics but treat missing as falsy', () => {
    expect(evaluatePredicate({ op: 'truthy', value: { literal: 1 } }, ctx)).toBe(true);
    expect(evaluatePredicate({ op: 'truthy', value: { literal: 0 } }, ctx)).toBe(false);
    expect(evaluatePredicate({ op: 'truthy', value: { literal: '' } }, ctx)).toBe(false);
    expect(evaluatePredicate({ op: 'truthy', value: { path: 'stepResults.absent' } }, ctx)).toBe(false);
    expect(evaluatePredicate({ op: 'falsy', value: { path: 'stepResults.absent' } }, ctx)).toBe(true);
  });

  it('composes and / or / not correctly', () => {
    const pred: Predicate = {
      op: 'and',
      args: [
        { op: 'eq', left: { path: 'stepResults.classify.tier' }, right: { literal: 'high' } },
        {
          op: 'or',
          args: [
            { op: 'gt', left: { path: 'stepResults.classify.score' }, right: { literal: 0.9 } },
            { op: 'not', arg: { op: 'notExists', path: 'stepResults.classify' } },
          ],
        },
      ],
    };
    expect(evaluatePredicate(pred, ctx)).toBe(true);
  });

  it('unknown scopes return false, never throw', () => {
    expect(evaluatePredicate({ op: 'exists', path: 'bogus.x' }, ctx)).toBe(false);
    expect(evaluatePredicate({ op: 'eq', left: { path: 'bogus.x' }, right: { literal: 1 } }, ctx)).toBe(false);
  });
});

describe('derivePredicateLabel', () => {
  it('renders comparison ops readably', () => {
    expect(derivePredicateLabel({ op: 'eq', left: { path: 'stepResults.a.tier' }, right: { literal: 'high' } })).toBe(
      'stepResults.a.tier == "high"',
    );
    expect(derivePredicateLabel({ op: 'gte', left: { path: 'x' }, right: { literal: 3 } })).toBe('x >= 3');
  });

  it('parenthesizes boolean composites', () => {
    const label = derivePredicateLabel({
      op: 'and',
      args: [
        { op: 'eq', left: { path: 'a' }, right: { literal: 1 } },
        {
          op: 'or',
          args: [
            { op: 'exists', path: 'b' },
            { op: 'notExists', path: 'c' },
          ],
        },
      ],
    });
    expect(label).toBe('a == 1 AND (b exists OR c missing)');
  });

  it('renders NOT with parentheses around composites', () => {
    expect(
      derivePredicateLabel({
        op: 'not',
        arg: {
          op: 'and',
          args: [
            { op: 'exists', path: 'a' },
            { op: 'exists', path: 'b' },
          ],
        },
      }),
    ).toBe('NOT (a exists AND b exists)');
  });

  it('truncates with an ellipsis when longer than maxLength', () => {
    const long = derivePredicateLabel(
      {
        op: 'eq',
        left: { path: 'stepResults.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.deep.path' },
        right: { literal: 'a very long literal value that will push us over the limit' },
      },
      40,
    );
    expect(long.length).toBe(40);
    expect(long.endsWith('…')).toBe(true);
  });

  it('JSON-encodes string literals so quotes and special chars are safe', () => {
    const label = derivePredicateLabel({
      op: 'eq',
      left: { path: 'x' },
      right: { literal: 'has "quotes" and\nnewline' },
    });
    expect(label).toContain('\\"quotes\\"');
    expect(label).toContain('\\n');
  });
});
