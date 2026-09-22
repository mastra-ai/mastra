/**
 * Tests for packages/core/src/predicate/index.ts
 *
 * Comprehensive unit test suite covering:
 * - predicateSchema: Zod schema parsing and structural validation
 * - normalizePredicatePath: dotted and template-style path normalisation
 * - walk: non-throwing dot-path object graph traversal and prototype pollution safety
 * - createPredicateEvaluator: runtime evaluation of comparisons, membership,
 *   existence, truthiness, and boolean compositions
 * - collectInvalidPredicatePaths: static path root validation
 * - derivePredicateLabel: human-readable label generation with length bounds and escaping
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import {
  collectInvalidPredicatePaths,
  createPredicateEvaluator,
  derivePredicateLabel,
  MISSING,
  normalizePredicatePath,
  predicateSchema,
  walk,
} from './index';
import type { Predicate } from './index';

// ---------------------------------------------------------------------------
// predicateSchema
// ---------------------------------------------------------------------------

describe('predicateSchema', () => {
  it('parses valid comparison predicates with path and literal refs', () => {
    const comparisons: Predicate[] = [
      { op: 'eq', left: { path: 'user.age' }, right: { literal: 30 } },
      { op: 'ne', left: { path: 'user.status' }, right: { literal: 'inactive' } },
      { op: 'lt', left: { path: 'score' }, right: { literal: 100 } },
      { op: 'lte', left: { path: 'count' }, right: { literal: 50 } },
      { op: 'gt', left: { path: 'retryCount' }, right: { literal: 0 } },
      { op: 'gte', left: { path: 'balance' }, right: { literal: 0 } },
      { op: 'eq', left: { path: 'user.id' }, right: { path: 'order.userId' } },
      { op: 'eq', left: { literal: 'test' }, right: { literal: 'test' } },
      { op: 'eq', left: { path: 'user.deleted' }, right: { literal: null } },
    ];

    for (const pred of comparisons) {
      expect(predicateSchema.safeParse(pred).success).toBe(true);
    }
  });

  it('parses valid membership predicates (in, notIn)', () => {
    const validIn: Predicate = {
      op: 'in',
      value: { path: 'user.role' },
      set: ['admin', 'moderator', 'member'],
    };
    const validNotIn: Predicate = {
      op: 'notIn',
      value: { literal: 42 },
      set: [1, 2, 3, null, false],
    };

    expect(predicateSchema.safeParse(validIn).success).toBe(true);
    expect(predicateSchema.safeParse(validNotIn).success).toBe(true);
  });

  it('parses valid existence and truthiness predicates', () => {
    const existsPred: Predicate = { op: 'exists', path: 'user.profile.bio' };
    const notExistsPred: Predicate = { op: 'notExists', path: 'temp.flag' };
    const truthyPred: Predicate = { op: 'truthy', value: { path: 'flags.isEnabled' } };
    const falsyPred: Predicate = { op: 'falsy', value: { literal: 0 } };

    expect(predicateSchema.safeParse(existsPred).success).toBe(true);
    expect(predicateSchema.safeParse(notExistsPred).success).toBe(true);
    expect(predicateSchema.safeParse(truthyPred).success).toBe(true);
    expect(predicateSchema.safeParse(falsyPred).success).toBe(true);
  });

  it('parses recursive boolean compositions (and, or, not)', () => {
    const composite: Predicate = {
      op: 'and',
      args: [
        { op: 'exists', path: 'user.email' },
        {
          op: 'or',
          args: [
            { op: 'eq', left: { path: 'user.role' }, right: { literal: 'admin' } },
            {
              op: 'not',
              arg: { op: 'truthy', value: { path: 'user.isRestricted' } },
            },
          ],
        },
      ],
    };

    expect(predicateSchema.safeParse(composite).success).toBe(true);
  });

  it('rejects unknown operators', () => {
    const invalidOp = { op: 'contains', path: 'name', value: 'foo' };
    expect(predicateSchema.safeParse(invalidOp).success).toBe(false);
  });

  it('rejects extra unrecognized keys (strict schema enforcement)', () => {
    const extraKey = {
      op: 'exists',
      path: 'user.id',
      extraProperty: 123,
    };
    expect(predicateSchema.safeParse(extraKey).success).toBe(false);
  });

  it('rejects empty paths in pathRef and exists/notExists', () => {
    expect(
      predicateSchema.safeParse({
        op: 'eq',
        left: { path: '' },
        right: { literal: 1 },
      }).success,
    ).toBe(false);

    expect(predicateSchema.safeParse({ op: 'exists', path: '' }).success).toBe(false);
  });

  it('rejects empty set in membership predicates', () => {
    expect(
      predicateSchema.safeParse({
        op: 'in',
        value: { path: 'role' },
        set: [],
      }).success,
    ).toBe(false);
  });

  it('rejects empty args in and/or predicates', () => {
    expect(predicateSchema.safeParse({ op: 'and', args: [] }).success).toBe(false);
    expect(predicateSchema.safeParse({ op: 'or', args: [] }).success).toBe(false);
  });

  it('rejects non-object or malformed structures', () => {
    expect(predicateSchema.safeParse(null).success).toBe(false);
    expect(predicateSchema.safeParse(undefined).success).toBe(false);
    expect(predicateSchema.safeParse('exists: user.name').success).toBe(false);
    expect(predicateSchema.safeParse(42).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizePredicatePath
// ---------------------------------------------------------------------------

describe('normalizePredicatePath', () => {
  it('preserves clean dot paths', () => {
    expect(normalizePredicatePath('foo.bar')).toBe('foo.bar');
    expect(normalizePredicatePath('user.profile.name')).toBe('user.profile.name');
    expect(normalizePredicatePath('status')).toBe('status');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizePredicatePath('   foo.bar   ')).toBe('foo.bar');
    expect(normalizePredicatePath('\tuser.id\n')).toBe('user.id');
  });

  it('unwraps template placeholder syntax ${...}', () => {
    expect(normalizePredicatePath('${foo.bar}')).toBe('foo.bar');
    expect(normalizePredicatePath('${  user.profile.id  }')).toBe('user.profile.id');
    expect(normalizePredicatePath('  ${user.status}  ')).toBe('user.status');
  });

  it('returns MISSING sentinel for empty or whitespace-only paths', () => {
    expect(normalizePredicatePath('')).toBe(MISSING);
    expect(normalizePredicatePath('   ')).toBe(MISSING);
    expect(normalizePredicatePath('\t\n')).toBe(MISSING);
    expect(normalizePredicatePath('${   }')).toBe(MISSING);
  });

  it('returns raw string when placeholder syntax has empty inner expression (${})', () => {
    expect(normalizePredicatePath('${}')).toBe('${}');
  });
});

// ---------------------------------------------------------------------------
// walk
// ---------------------------------------------------------------------------

describe('walk', () => {
  const data = {
    user: {
      id: 'usr_123',
      age: 28,
      active: true,
      flags: {
        isBeta: false,
        score: 0,
        emptyName: '',
        deletedAt: null,
      },
      tags: ['ai', 'agent'],
    },
    topLevel: 'rootValue',
  };

  it('returns root object when path is empty string', () => {
    expect(walk(data, '')).toBe(data);
  });

  it('resolves top-level and nested properties', () => {
    expect(walk(data, 'topLevel')).toBe('rootValue');
    expect(walk(data, 'user.id')).toBe('usr_123');
    expect(walk(data, 'user.age')).toBe(28);
    expect(walk(data, 'user.active')).toBe(true);
    expect(walk(data, 'user.flags.score')).toBe(0);
    expect(walk(data, 'user.flags.emptyName')).toBe('');
    expect(walk(data, 'user.flags.isBeta')).toBe(false);
    expect(walk(data, 'user.flags.deletedAt')).toBe(null);
    expect(walk(data, 'user.tags')).toEqual(['ai', 'agent']);
  });

  it('returns MISSING when encountering non-existent properties', () => {
    expect(walk(data, 'unknown')).toBe(MISSING);
    expect(walk(data, 'user.unknown')).toBe(MISSING);
    expect(walk(data, 'user.flags.unknown')).toBe(MISSING);
  });

  it('returns MISSING when traversing through null or undefined segments', () => {
    expect(walk(data, 'user.flags.deletedAt.subField')).toBe(MISSING);
    expect(walk(data, 'missingKey.child')).toBe(MISSING);
  });

  it('returns MISSING when traversing through primitive values', () => {
    expect(walk(data, 'user.age.nested')).toBe(MISSING);
    expect(walk(data, 'user.id.nested')).toBe(MISSING);
    expect(walk(data, 'user.active.nested')).toBe(MISSING);
  });

  it('prevents prototype pollution by only matching own properties', () => {
    expect(walk(data, 'toString')).toBe(MISSING);
    expect(walk(data, 'valueOf')).toBe(MISSING);
    expect(walk(data, 'constructor')).toBe(MISSING);
    expect(walk(data, '__proto__')).toBe(MISSING);
    expect(walk(data, 'user.constructor')).toBe(MISSING);
  });

  it('returns MISSING when root is null or undefined with a non-empty path', () => {
    expect(walk(null, 'foo')).toBe(MISSING);
    expect(walk(undefined, 'foo')).toBe(MISSING);
  });
});

// ---------------------------------------------------------------------------
// createPredicateEvaluator
// ---------------------------------------------------------------------------

describe('createPredicateEvaluator', () => {
  const ctx = {
    user: {
      name: 'Alice',
      age: 30,
      role: 'admin',
      active: true,
      balance: 100.5,
      zeroCount: 0,
      emptyString: '',
      nullValue: null,
    },
    meta: {
      tier: 'premium',
      priority: 5,
    },
  };

  const evaluate = createPredicateEvaluator((path, c) => walk(c, path));

  describe('comparison operators (eq, ne, lt, lte, gt, gte)', () => {
    it('evaluates eq and ne for matching and non-matching scalars', () => {
      expect(evaluate({ op: 'eq', left: { path: 'user.age' }, right: { literal: 30 } }, ctx)).toBe(true);
      expect(evaluate({ op: 'eq', left: { path: 'user.age' }, right: { literal: 31 } }, ctx)).toBe(false);
      expect(evaluate({ op: 'eq', left: { path: 'user.age' }, right: { literal: '30' } }, ctx)).toBe(false);
      expect(evaluate({ op: 'eq', left: { path: 'user.nullValue' }, right: { literal: null } }, ctx)).toBe(true);

      expect(evaluate({ op: 'ne', left: { path: 'user.role' }, right: { literal: 'guest' } }, ctx)).toBe(true);
      expect(evaluate({ op: 'ne', left: { path: 'user.role' }, right: { literal: 'admin' } }, ctx)).toBe(false);
    });

    it('returns false for comparisons when any operand resolves to MISSING', () => {
      expect(evaluate({ op: 'eq', left: { path: 'user.unknown' }, right: { literal: 30 } }, ctx)).toBe(false);
      expect(evaluate({ op: 'ne', left: { path: 'user.unknown' }, right: { literal: 30 } }, ctx)).toBe(false);
      expect(evaluate({ op: 'lt', left: { path: 'user.unknown' }, right: { literal: 30 } }, ctx)).toBe(false);
      expect(evaluate({ op: 'gte', left: { path: 'user.unknown' }, right: { literal: 30 } }, ctx)).toBe(false);
    });

    it('evaluates numeric ordering (lt, lte, gt, gte)', () => {
      expect(evaluate({ op: 'lt', left: { path: 'user.age' }, right: { literal: 40 } }, ctx)).toBe(true);
      expect(evaluate({ op: 'lt', left: { path: 'user.age' }, right: { literal: 30 } }, ctx)).toBe(false);
      expect(evaluate({ op: 'lte', left: { path: 'user.age' }, right: { literal: 30 } }, ctx)).toBe(true);
      expect(evaluate({ op: 'gt', left: { path: 'user.balance' }, right: { literal: 100 } }, ctx)).toBe(true);
      expect(evaluate({ op: 'gt', left: { path: 'user.balance' }, right: { literal: 150 } }, ctx)).toBe(false);
      expect(evaluate({ op: 'gte', left: { path: 'user.balance' }, right: { literal: 100.5 } }, ctx)).toBe(true);
    });

    it('evaluates lexicographical string ordering', () => {
      expect(evaluate({ op: 'lt', left: { literal: 'alpha' }, right: { literal: 'beta' } }, ctx)).toBe(true);
      expect(evaluate({ op: 'gt', left: { path: 'user.name' }, right: { literal: 'Aaron' } }, ctx)).toBe(true);
      expect(evaluate({ op: 'lte', left: { literal: 'same' }, right: { literal: 'same' } }, ctx)).toBe(true);
    });

    it('returns false when comparing mismatched types with ordering operators', () => {
      expect(evaluate({ op: 'lt', left: { path: 'user.age' }, right: { literal: '40' } }, ctx)).toBe(false);
      expect(evaluate({ op: 'gt', left: { path: 'user.age' }, right: { literal: true } }, ctx)).toBe(false);
      expect(evaluate({ op: 'lte', left: { path: 'user.name' }, right: { literal: 10 } }, ctx)).toBe(false);
    });
  });

  describe('membership operators (in, notIn)', () => {
    it('evaluates in correctly for membership', () => {
      expect(evaluate({ op: 'in', value: { path: 'user.role' }, set: ['guest', 'admin'] }, ctx)).toBe(true);
      expect(evaluate({ op: 'in', value: { path: 'user.role' }, set: ['guest', 'user'] }, ctx)).toBe(false);
      expect(evaluate({ op: 'in', value: { path: 'user.nullValue' }, set: ['a', null] }, ctx)).toBe(true);
    });

    it('evaluates notIn correctly for exclusion', () => {
      expect(evaluate({ op: 'notIn', value: { path: 'user.role' }, set: ['guest', 'user'] }, ctx)).toBe(true);
      expect(evaluate({ op: 'notIn', value: { path: 'user.role' }, set: ['guest', 'admin'] }, ctx)).toBe(false);
    });

    it('handles MISSING gracefully for membership ops', () => {
      // Missing is never in any set
      expect(evaluate({ op: 'in', value: { path: 'missing.path' }, set: ['a', 'b'] }, ctx)).toBe(false);
      // Missing is always notIn any set
      expect(evaluate({ op: 'notIn', value: { path: 'missing.path' }, set: ['a', 'b'] }, ctx)).toBe(true);
    });
  });

  describe('existence operators (exists, notExists)', () => {
    it('evaluates exists true for all present values, including falsy and null', () => {
      expect(evaluate({ op: 'exists', path: 'user.name' }, ctx)).toBe(true);
      expect(evaluate({ op: 'exists', path: 'user.zeroCount' }, ctx)).toBe(true);
      expect(evaluate({ op: 'exists', path: 'user.emptyString' }, ctx)).toBe(true);
      expect(evaluate({ op: 'exists', path: 'user.nullValue' }, ctx)).toBe(true);
      expect(evaluate({ op: 'exists', path: 'nonExistent' }, ctx)).toBe(false);
    });

    it('evaluates notExists true only when value is MISSING', () => {
      expect(evaluate({ op: 'notExists', path: 'nonExistent' }, ctx)).toBe(true);
      expect(evaluate({ op: 'notExists', path: 'user.name' }, ctx)).toBe(false);
      expect(evaluate({ op: 'notExists', path: 'user.nullValue' }, ctx)).toBe(false);
      expect(evaluate({ op: 'notExists', path: 'user.zeroCount' }, ctx)).toBe(false);
    });
  });

  describe('truthiness operators (truthy, falsy)', () => {
    it('evaluates truthy for non-zero numbers, non-empty strings, and true', () => {
      expect(evaluate({ op: 'truthy', value: { path: 'user.name' } }, ctx)).toBe(true);
      expect(evaluate({ op: 'truthy', value: { path: 'user.age' } }, ctx)).toBe(true);
      expect(evaluate({ op: 'truthy', value: { path: 'user.active' } }, ctx)).toBe(true);

      expect(evaluate({ op: 'truthy', value: { path: 'user.zeroCount' } }, ctx)).toBe(false);
      expect(evaluate({ op: 'truthy', value: { path: 'user.emptyString' } }, ctx)).toBe(false);
      expect(evaluate({ op: 'truthy', value: { path: 'user.nullValue' } }, ctx)).toBe(false);
      expect(evaluate({ op: 'truthy', value: { path: 'nonExistent' } }, ctx)).toBe(false);
    });

    it('evaluates falsy for 0, empty string, null, and MISSING', () => {
      expect(evaluate({ op: 'falsy', value: { path: 'user.zeroCount' } }, ctx)).toBe(true);
      expect(evaluate({ op: 'falsy', value: { path: 'user.emptyString' } }, ctx)).toBe(true);
      expect(evaluate({ op: 'falsy', value: { path: 'user.nullValue' } }, ctx)).toBe(true);
      expect(evaluate({ op: 'falsy', value: { path: 'nonExistent' } }, ctx)).toBe(true);

      expect(evaluate({ op: 'falsy', value: { path: 'user.name' } }, ctx)).toBe(false);
      expect(evaluate({ op: 'falsy', value: { path: 'user.age' } }, ctx)).toBe(false);
      expect(evaluate({ op: 'falsy', value: { path: 'user.active' } }, ctx)).toBe(false);
    });
  });

  describe('boolean composition (and, or, not)', () => {
    it('evaluates and correctly and short-circuits', () => {
      const predTrue: Predicate = {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'user.name' }, right: { literal: 'Alice' } },
          { op: 'gt', left: { path: 'user.age' }, right: { literal: 20 } },
        ],
      };
      const predFalse: Predicate = {
        op: 'and',
        args: [
          { op: 'eq', left: { path: 'user.name' }, right: { literal: 'Alice' } },
          { op: 'eq', left: { path: 'user.age' }, right: { literal: 99 } },
        ],
      };

      expect(evaluate(predTrue, ctx)).toBe(true);
      expect(evaluate(predFalse, ctx)).toBe(false);
    });

    it('evaluates or correctly and short-circuits', () => {
      const predTrue: Predicate = {
        op: 'or',
        args: [
          { op: 'eq', left: { path: 'user.role' }, right: { literal: 'guest' } },
          { op: 'eq', left: { path: 'user.role' }, right: { literal: 'admin' } },
        ],
      };
      const predFalse: Predicate = {
        op: 'or',
        args: [
          { op: 'eq', left: { path: 'user.role' }, right: { literal: 'guest' } },
          { op: 'eq', left: { path: 'user.role' }, right: { literal: 'editor' } },
        ],
      };

      expect(evaluate(predTrue, ctx)).toBe(true);
      expect(evaluate(predFalse, ctx)).toBe(false);
    });

    it('evaluates not operator inversion', () => {
      expect(evaluate({ op: 'not', arg: { op: 'eq', left: { path: 'user.age' }, right: { literal: 30 } } }, ctx)).toBe(
        false,
      );
      expect(evaluate({ op: 'not', arg: { op: 'eq', left: { path: 'user.age' }, right: { literal: 99 } } }, ctx)).toBe(
        true,
      );
    });

    it('evaluates complex nested compositions', () => {
      const complex: Predicate = {
        op: 'and',
        args: [
          {
            op: 'or',
            args: [
              { op: 'eq', left: { path: 'meta.tier' }, right: { literal: 'premium' } },
              { op: 'gte', left: { path: 'meta.priority' }, right: { literal: 10 } },
            ],
          },
          {
            op: 'not',
            arg: { op: 'truthy', value: { path: 'user.zeroCount' } },
          },
        ],
      };

      expect(evaluate(complex, ctx)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// collectInvalidPredicatePaths
// ---------------------------------------------------------------------------

describe('collectInvalidPredicatePaths', () => {
  const allowedRoots = ['user', 'order', 'session'];

  it('returns empty array when all paths start with known roots', () => {
    const valid: Predicate = {
      op: 'and',
      args: [
        { op: 'eq', left: { path: 'user.id' }, right: { path: 'order.userId' } },
        { op: 'exists', path: 'session.token' },
        { op: 'in', value: { path: 'user.role' }, set: ['admin'] },
      ],
    };

    expect(collectInvalidPredicatePaths(valid, allowedRoots)).toEqual([]);
  });

  it('collects invalid paths that do not start with allowed roots', () => {
    const invalid: Predicate = {
      op: 'and',
      args: [
        { op: 'eq', left: { path: 'account.id' }, right: { path: 'order.id' } },
        { op: 'exists', path: 'unregisteredRoot.field' },
      ],
    };

    expect(collectInvalidPredicatePaths(invalid, allowedRoots)).toEqual([
      'account.id',
      'unregisteredRoot.field',
    ]);
  });

  it('handles template placeholder paths in validation', () => {
    const pred: Predicate = {
      op: 'or',
      args: [
        { op: 'exists', path: '${user.email}' },
        { op: 'exists', path: '${badRoot.email}' },
      ],
    };

    expect(collectInvalidPredicatePaths(pred, allowedRoots)).toEqual(['${badRoot.email}']);
  });

  it('collects empty path as invalid', () => {
    const pred: Predicate = {
      op: 'exists',
      path: '',
    };

    expect(collectInvalidPredicatePaths(pred, allowedRoots)).toEqual(['']);
  });

  it('collects invalid paths nested inside not, in, and truthiness operators', () => {
    const pred: Predicate = {
      op: 'not',
      arg: {
        op: 'or',
        args: [
          { op: 'truthy', value: { path: 'badScope1.flag' } },
          { op: 'notIn', value: { path: 'badScope2.code' }, set: [1, 2] },
        ],
      },
    };

    expect(collectInvalidPredicatePaths(pred, allowedRoots)).toEqual([
      'badScope1.flag',
      'badScope2.code',
    ]);
  });
});

// ---------------------------------------------------------------------------
// derivePredicateLabel
// ---------------------------------------------------------------------------

describe('derivePredicateLabel', () => {
  it('renders comparisons and membership with clean string formatting', () => {
    expect(
      derivePredicateLabel({ op: 'eq', left: { path: 'user.id' }, right: { literal: '123' } }),
    ).toBe('user.id == "123"');

    expect(
      derivePredicateLabel({ op: 'ne', left: { path: 'status' }, right: { literal: 'active' } }),
    ).toBe('status != "active"');

    expect(
      derivePredicateLabel({ op: 'lt', left: { path: 'count' }, right: { literal: 10 } }),
    ).toBe('count < 10');

    expect(
      derivePredicateLabel({ op: 'lte', left: { path: 'count' }, right: { literal: 10 } }),
    ).toBe('count <= 10');

    expect(
      derivePredicateLabel({ op: 'gt', left: { path: 'count' }, right: { literal: 10 } }),
    ).toBe('count > 10');

    expect(
      derivePredicateLabel({ op: 'gte', left: { path: 'count' }, right: { literal: 10 } }),
    ).toBe('count >= 10');

    expect(
      derivePredicateLabel({ op: 'in', value: { path: 'role' }, set: ['admin', 'guest'] }),
    ).toBe('role in ["admin","guest"]');

    expect(
      derivePredicateLabel({ op: 'notIn', value: { path: 'role' }, set: ['banned'] }),
    ).toBe('role not in ["banned"]');
  });

  it('renders existence and truthiness operations', () => {
    expect(derivePredicateLabel({ op: 'exists', path: 'user.email' })).toBe('user.email exists');
    expect(derivePredicateLabel({ op: 'notExists', path: 'user.deletedAt' })).toBe('user.deletedAt missing');
    expect(derivePredicateLabel({ op: 'truthy', value: { path: 'isVerified' } })).toBe('isVerified is truthy');
    expect(derivePredicateLabel({ op: 'falsy', value: { path: 'isRestricted' } })).toBe('isRestricted is falsy');
  });

  it('renders composite expressions with proper precedence parentheses', () => {
    const composite: Predicate = {
      op: 'and',
      args: [
        {
          op: 'or',
          args: [
            { op: 'eq', left: { path: 'a' }, right: { literal: 1 } },
            { op: 'eq', left: { path: 'b' }, right: { literal: 2 } },
          ],
        },
        { op: 'eq', left: { path: 'c' }, right: { literal: 3 } },
      ],
    };

    expect(derivePredicateLabel(composite)).toBe('(a == 1 OR b == 2) AND c == 3');
  });

  it('renders negation with NOT prefix and wrapped argument', () => {
    const notPred: Predicate = {
      op: 'not',
      arg: { op: 'eq', left: { path: 'status' }, right: { literal: 'pending' } },
    };

    expect(derivePredicateLabel(notPred)).toBe('NOT status == "pending"');
  });

  it('escapes paths with special characters via JSON.stringify', () => {
    const specialPath: Predicate = {
      op: 'exists',
      path: 'user name with spaces',
    };

    expect(derivePredicateLabel(specialPath)).toBe('"user name with spaces" exists');
  });

  it('truncates labels exceeding maxLength with an ellipsis character', () => {
    const longPred: Predicate = {
      op: 'eq',
      left: { path: 'a.very.long.path.that.will.definitely.exceed.a.small.length.budget' },
      right: { literal: 'arbitrary-long-value' },
    };

    const label = derivePredicateLabel(longPred, 35);
    expect(label.length).toBe(35);
    expect(label.endsWith('…')).toBe(true);
  });
});
