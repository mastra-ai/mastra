import { describe, expect, it } from 'vitest';
import type { Predicate } from './index';
import {
  MISSING,
  collectInvalidPredicatePaths,
  createPredicateEvaluator,
  derivePredicateLabel,
  normalizePredicatePath,
  predicateSchema,
  walk,
} from './index';

describe('normalizePredicatePath', () => {
  it('returns plain dotted paths unchanged', () => {
    expect(normalizePredicatePath('foo.bar')).toBe('foo.bar');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizePredicatePath('  foo.bar  ')).toBe('foo.bar');
  });

  it('unwraps template-style paths', () => {
    expect(normalizePredicatePath('${foo.bar}')).toBe('foo.bar');
  });

  it('trims whitespace inside a template placeholder', () => {
    expect(normalizePredicatePath('${  foo.bar  }')).toBe('foo.bar');
  });

  it('returns MISSING for an empty string', () => {
    expect(normalizePredicatePath('')).toBe(MISSING);
  });

  it('returns MISSING for a whitespace-only string', () => {
    expect(normalizePredicatePath('   ')).toBe(MISSING);
  });

  it('does not treat an empty placeholder as a template (no inner content)', () => {
    // The template pattern requires at least one inner character, so `${}`
    // is treated as a plain (non-empty) path and returned unchanged.
    expect(normalizePredicatePath('${}')).toBe('${}');
  });
});

describe('walk', () => {
  it('returns the root for an empty path', () => {
    const root = { a: 1 };
    expect(walk(root, '')).toBe(root);
  });

  it('resolves a single segment', () => {
    expect(walk({ a: 1 }, 'a')).toBe(1);
  });

  it('resolves a nested path', () => {
    expect(walk({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('returns MISSING when a segment does not exist', () => {
    expect(walk({ a: { b: 1 } }, 'a.c')).toBe(MISSING);
  });

  it('returns MISSING when traversing through null', () => {
    expect(walk({ a: null }, 'a.b')).toBe(MISSING);
  });

  it('returns MISSING when traversing through undefined', () => {
    expect(walk({ a: undefined }, 'a.b')).toBe(MISSING);
  });

  it('returns MISSING when traversing through a non-object', () => {
    expect(walk({ a: 5 }, 'a.b')).toBe(MISSING);
  });

  it('resolves a present value of null', () => {
    expect(walk({ a: null }, 'a')).toBe(null);
  });

  it('ignores inherited prototype properties', () => {
    expect(walk({}, 'constructor')).toBe(MISSING);
    expect(walk({}, 'toString')).toBe(MISSING);
  });
});

// Evaluator over a plain object graph via `walk`.
const evaluate = createPredicateEvaluator<Record<string, unknown>>((path, ctx) => walk(ctx, path));

describe('createPredicateEvaluator', () => {
  describe('comparison ops', () => {
    it('eq compares equal scalars', () => {
      expect(evaluate({ op: 'eq', left: { path: 'a' }, right: { literal: 1 } }, { a: 1 })).toBe(true);
      expect(evaluate({ op: 'eq', left: { path: 'a' }, right: { literal: 2 } }, { a: 1 })).toBe(false);
    });

    it('ne compares unequal scalars', () => {
      expect(evaluate({ op: 'ne', left: { path: 'a' }, right: { literal: 2 } }, { a: 1 })).toBe(true);
      expect(evaluate({ op: 'ne', left: { path: 'a' }, right: { literal: 1 } }, { a: 1 })).toBe(false);
    });

    it('orders numbers', () => {
      expect(evaluate({ op: 'lt', left: { literal: 1 }, right: { literal: 2 } }, {})).toBe(true);
      expect(evaluate({ op: 'lte', left: { literal: 2 }, right: { literal: 2 } }, {})).toBe(true);
      expect(evaluate({ op: 'gt', left: { literal: 3 }, right: { literal: 2 } }, {})).toBe(true);
      expect(evaluate({ op: 'gte', left: { literal: 2 }, right: { literal: 2 } }, {})).toBe(true);
    });

    it('orders strings lexicographically', () => {
      expect(evaluate({ op: 'lt', left: { literal: 'a' }, right: { literal: 'b' } }, {})).toBe(true);
      expect(evaluate({ op: 'gt', left: { literal: 'b' }, right: { literal: 'a' } }, {})).toBe(true);
    });

    it('returns false when ordering mismatched types', () => {
      expect(evaluate({ op: 'lt', left: { literal: 1 }, right: { literal: 'a' } }, {})).toBe(false);
    });

    it('returns false when either side is MISSING', () => {
      expect(evaluate({ op: 'eq', left: { path: 'missing' }, right: { literal: 1 } }, {})).toBe(false);
      expect(evaluate({ op: 'lt', left: { path: 'missing' }, right: { literal: 1 } }, {})).toBe(false);
    });
  });

  describe('membership ops', () => {
    it('in matches a member', () => {
      expect(evaluate({ op: 'in', value: { path: 'a' }, set: [1, 2, 3] }, { a: 2 })).toBe(true);
      expect(evaluate({ op: 'in', value: { path: 'a' }, set: [1, 2, 3] }, { a: 4 })).toBe(false);
    });

    it('notIn negates membership', () => {
      expect(evaluate({ op: 'notIn', value: { path: 'a' }, set: [1, 2, 3] }, { a: 4 })).toBe(true);
      expect(evaluate({ op: 'notIn', value: { path: 'a' }, set: [1, 2, 3] }, { a: 2 })).toBe(false);
    });

    it('uses strict equality (no coercion)', () => {
      expect(evaluate({ op: 'in', value: { path: 'a' }, set: ['1'] }, { a: 1 })).toBe(false);
    });

    it('treats MISSING as not-in: false for in, true for notIn', () => {
      expect(evaluate({ op: 'in', value: { path: 'missing' }, set: [1] }, {})).toBe(false);
      expect(evaluate({ op: 'notIn', value: { path: 'missing' }, set: [1] }, {})).toBe(true);
    });
  });

  describe('existence ops', () => {
    it('exists is true for a present value, false for missing', () => {
      expect(evaluate({ op: 'exists', path: 'a' }, { a: 1 })).toBe(true);
      expect(evaluate({ op: 'exists', path: 'a' }, {})).toBe(false);
    });

    it('exists treats a present null as existing', () => {
      expect(evaluate({ op: 'exists', path: 'a' }, { a: null })).toBe(true);
    });

    it('notExists is the negation of exists', () => {
      expect(evaluate({ op: 'notExists', path: 'a' }, {})).toBe(true);
      expect(evaluate({ op: 'notExists', path: 'a' }, { a: 1 })).toBe(false);
    });
  });

  describe('truthiness ops', () => {
    it('truthy is true for truthy values', () => {
      expect(evaluate({ op: 'truthy', value: { path: 'a' } }, { a: 1 })).toBe(true);
      expect(evaluate({ op: 'truthy', value: { path: 'a' } }, { a: 0 })).toBe(false);
    });

    it('falsy is true for falsy values', () => {
      expect(evaluate({ op: 'falsy', value: { path: 'a' } }, { a: 0 })).toBe(true);
      expect(evaluate({ op: 'falsy', value: { path: 'a' } }, { a: 1 })).toBe(false);
    });

    it('treats MISSING as not truthy', () => {
      expect(evaluate({ op: 'truthy', value: { path: 'missing' } }, {})).toBe(false);
      expect(evaluate({ op: 'falsy', value: { path: 'missing' } }, {})).toBe(true);
    });
  });

  describe('boolean composition', () => {
    it('and requires all args', () => {
      const pred: Predicate = {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'a' }, right: { literal: 1 } },
          { op: 'eq', left: { path: 'b' }, right: { literal: 2 } },
        ],
      };
      expect(evaluate(pred, { a: 1, b: 2 })).toBe(true);
      expect(evaluate(pred, { a: 1, b: 3 })).toBe(false);
    });

    it('or requires any arg', () => {
      const pred: Predicate = {
        op: 'or',
        args: [
          { op: 'eq', left: { path: 'a' }, right: { literal: 1 } },
          { op: 'eq', left: { path: 'b' }, right: { literal: 2 } },
        ],
      };
      expect(evaluate(pred, { a: 9, b: 2 })).toBe(true);
      expect(evaluate(pred, { a: 9, b: 9 })).toBe(false);
    });

    it('not inverts', () => {
      expect(evaluate({ op: 'not', arg: { op: 'truthy', value: { literal: true } } }, {})).toBe(false);
      expect(evaluate({ op: 'not', arg: { op: 'truthy', value: { literal: false } } }, {})).toBe(true);
    });

    it('resolves nested composites', () => {
      const pred: Predicate = {
        op: 'and',
        args: [
          {
            op: 'or',
            args: [
              { op: 'exists', path: 'a' },
              { op: 'exists', path: 'b' },
            ],
          },
          { op: 'not', arg: { op: 'exists', path: 'c' } },
        ],
      };
      expect(evaluate(pred, { a: 1 })).toBe(true);
      expect(evaluate(pred, { a: 1, c: 1 })).toBe(false);
    });
  });
});

describe('predicateSchema', () => {
  it('accepts a valid comparison predicate', () => {
    expect(predicateSchema.safeParse({ op: 'eq', left: { path: 'a' }, right: { literal: 1 } }).success).toBe(true);
  });

  it('accepts a valid membership predicate', () => {
    expect(predicateSchema.safeParse({ op: 'in', value: { path: 'a' }, set: [1, 2] }).success).toBe(true);
  });

  it('accepts nested boolean composition', () => {
    const pred = {
      op: 'and',
      args: [
        { op: 'exists', path: 'a' },
        { op: 'not', arg: { op: 'falsy', value: { literal: false } } },
      ],
    };
    expect(predicateSchema.safeParse(pred).success).toBe(true);
  });

  it('rejects an unknown op', () => {
    expect(predicateSchema.safeParse({ op: 'nope', left: { literal: 1 }, right: { literal: 1 } }).success).toBe(false);
  });

  it('rejects extra keys (strict)', () => {
    expect(
      predicateSchema.safeParse({ op: 'eq', left: { path: 'a' }, right: { literal: 1 }, extra: true }).success,
    ).toBe(false);
  });

  it('rejects an empty membership set', () => {
    expect(predicateSchema.safeParse({ op: 'in', value: { path: 'a' }, set: [] }).success).toBe(false);
  });

  it('rejects an empty exists path', () => {
    expect(predicateSchema.safeParse({ op: 'exists', path: '' }).success).toBe(false);
  });

  it('rejects a path ref with extra keys', () => {
    expect(
      predicateSchema.safeParse({ op: 'eq', left: { path: 'a', literal: 1 }, right: { literal: 1 } }).success,
    ).toBe(false);
  });
});

describe('collectInvalidPredicatePaths', () => {
  it('returns no invalid paths when all roots are known', () => {
    const pred: Predicate = { op: 'eq', left: { path: 'ctx.a' }, right: { literal: 1 } };
    expect(collectInvalidPredicatePaths(pred, ['ctx'])).toEqual([]);
  });

  it('flags paths with unknown roots', () => {
    const pred: Predicate = { op: 'eq', left: { path: 'nope.a' }, right: { literal: 1 } };
    expect(collectInvalidPredicatePaths(pred, ['ctx'])).toEqual(['nope.a']);
  });

  it('ignores literal refs', () => {
    const pred: Predicate = { op: 'eq', left: { literal: 1 }, right: { literal: 2 } };
    expect(collectInvalidPredicatePaths(pred, ['ctx'])).toEqual([]);
  });

  it('normalizes template paths before checking the root', () => {
    const pred: Predicate = { op: 'exists', path: '${ctx.a}' };
    expect(collectInvalidPredicatePaths(pred, ['ctx'])).toEqual([]);
  });

  it('flags an empty/unnormalizable path', () => {
    const pred: Predicate = { op: 'exists', path: '${}' };
    expect(collectInvalidPredicatePaths(pred, ['ctx'])).toEqual(['${}']);
  });

  it('checks a bare root with no dot', () => {
    const pred: Predicate = { op: 'exists', path: 'ctx' };
    expect(collectInvalidPredicatePaths(pred, ['ctx'])).toEqual([]);
    expect(collectInvalidPredicatePaths({ op: 'exists', path: 'other' }, ['ctx'])).toEqual(['other']);
  });

  it('recurses through composites and membership/truthy refs', () => {
    const pred: Predicate = {
      op: 'and',
      args: [
        { op: 'or', args: [{ op: 'exists', path: 'bad1' }] },
        { op: 'not', arg: { op: 'truthy', value: { path: 'bad2' } } },
        { op: 'in', value: { path: 'bad3' }, set: [1] },
      ],
    };
    expect(collectInvalidPredicatePaths(pred, ['ctx'])).toEqual(['bad1', 'bad2', 'bad3']);
  });
});

describe('derivePredicateLabel', () => {
  it('renders comparison ops', () => {
    expect(derivePredicateLabel({ op: 'eq', left: { path: 'a' }, right: { literal: 1 } })).toBe('a == 1');
    expect(derivePredicateLabel({ op: 'ne', left: { path: 'a' }, right: { literal: 1 } })).toBe('a != 1');
    expect(derivePredicateLabel({ op: 'lt', left: { path: 'a' }, right: { literal: 1 } })).toBe('a < 1');
    expect(derivePredicateLabel({ op: 'gte', left: { path: 'a' }, right: { literal: 1 } })).toBe('a >= 1');
  });

  it('renders existence and truthiness ops', () => {
    expect(derivePredicateLabel({ op: 'exists', path: 'a' })).toBe('a exists');
    expect(derivePredicateLabel({ op: 'notExists', path: 'a' })).toBe('a missing');
    expect(derivePredicateLabel({ op: 'truthy', value: { path: 'a' } })).toBe('a is truthy');
    expect(derivePredicateLabel({ op: 'falsy', value: { path: 'a' } })).toBe('a is falsy');
  });

  it('renders membership ops with JSON sets', () => {
    expect(derivePredicateLabel({ op: 'in', value: { path: 'a' }, set: [1, 2] })).toBe('a in [1,2]');
    expect(derivePredicateLabel({ op: 'notIn', value: { path: 'a' }, set: ['x'] })).toBe('a not in ["x"]');
  });

  it('parenthesizes nested composites for precedence', () => {
    const pred: Predicate = {
      op: 'or',
      args: [
        {
          op: 'and',
          args: [
            { op: 'exists', path: 'a' },
            { op: 'exists', path: 'b' },
          ],
        },
        { op: 'not', arg: { op: 'exists', path: 'c' } },
      ],
    };
    expect(derivePredicateLabel(pred)).toBe('(a exists AND b exists) OR (NOT c exists)');
  });

  it('escapes string literals via JSON.stringify', () => {
    expect(derivePredicateLabel({ op: 'eq', left: { path: 'a' }, right: { literal: 'hi' } })).toBe('a == "hi"');
  });

  it('escapes paths with unusual characters', () => {
    expect(derivePredicateLabel({ op: 'exists', path: 'a b' })).toBe('"a b" exists');
  });

  it('leaves plain identifier/dot/template paths unescaped', () => {
    expect(derivePredicateLabel({ op: 'exists', path: 'a.b.c' })).toBe('a.b.c exists');
  });

  it('truncates long output with an ellipsis', () => {
    const label = derivePredicateLabel({ op: 'eq', left: { path: 'a' }, right: { literal: 'x'.repeat(200) } }, 20);
    expect(label.length).toBe(20);
    expect(label.endsWith('…')).toBe(true);
  });
});
