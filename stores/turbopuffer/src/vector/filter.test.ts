import type { Filter } from '@turbopuffer/turbopuffer/resources/custom';
import { beforeEach, describe, expect, it } from 'vitest';
import { TurbopufferFilterTranslator } from './filter';
import type { TurbopufferVectorFilter } from './filter';

describe('TurbopufferFilterTranslator', () => {
  let translate: (filter?: TurbopufferVectorFilter) => Filter | undefined;

  beforeEach(() => {
    const translator = new TurbopufferFilterTranslator();
    translate = translator.translate.bind(translator);
  });

  // Basic Filter Operations
  describe('basic operations', () => {
    it('handles empty filters', () => {
      expect(translate({})).toEqual(undefined);
      expect(translate(undefined)).toEqual(undefined);
      expect(translate(null)).toEqual(undefined);
    });

    it('allows implicit equality', () => {
      const filter: TurbopufferVectorFilter = { field: 'value' };
      expect(translate(filter)).toEqual(['And', [['field', 'Eq', 'value']]]);
    });

    it('allows multiple top-level fields', () => {
      const filter: TurbopufferVectorFilter = {
        field1: 'value1',
        field2: 'value2',
      };
      expect(translate(filter)).toEqual([
        'And',
        [
          ['field1', 'Eq', 'value1'],
          ['field2', 'Eq', 'value2'],
        ],
      ]);
    });

    it('handles numeric values', () => {
      const filter: TurbopufferVectorFilter = { age: 30 };
      expect(translate(filter)).toEqual(['And', [['age', 'Eq', 30]]]);
    });

    it('handles boolean values', () => {
      const filter: TurbopufferVectorFilter = { active: true };
      expect(translate(filter)).toEqual(['And', [['active', 'Eq', true]]]);
    });

    it('normalizes date values', () => {
      const date = new Date('2024-01-01');
      const dateStr = date.toISOString();
      const filter: TurbopufferVectorFilter = { timestamp: date };
      expect(translate(filter)).toEqual(['And', [['timestamp', 'Eq', dateStr]]]);
    });
  });

  // Comparison Operators
  describe('comparison operators', () => {
    it('handles $eq operator', () => {
      const filter: TurbopufferVectorFilter = { field: { $eq: 'value' } };
      expect(translate(filter)).toEqual(['And', [['field', 'Eq', 'value']]]);
    });

    it('handles $ne operator', () => {
      const filter: TurbopufferVectorFilter = { field: { $ne: 'value' } };
      expect(translate(filter)).toEqual(['And', [['field', 'NotEq', 'value']]]);
    });

    it('handles $gt operator', () => {
      const filter: TurbopufferVectorFilter = { field: { $gt: 10 } };
      expect(translate(filter)).toEqual(['And', [['field', 'Gt', 10]]]);
    });

    it('handles $gte operator', () => {
      const filter: TurbopufferVectorFilter = { field: { $gte: 10 } };
      expect(translate(filter)).toEqual(['And', [['field', 'Gte', 10]]]);
    });

    it('handles $lt operator', () => {
      const filter: TurbopufferVectorFilter = { field: { $lt: 10 } };
      expect(translate(filter)).toEqual(['And', [['field', 'Lt', 10]]]);
    });

    it('handles $lte operator', () => {
      const filter: TurbopufferVectorFilter = { field: { $lte: 10 } };
      expect(translate(filter)).toEqual(['And', [['field', 'Lte', 10]]]);
    });

    it('handles multiple operators on same field', () => {
      const filter: TurbopufferVectorFilter = {
        price: { $gt: 100, $lt: 200 },
      };
      expect(translate(filter)).toEqual([
        'And',
        [
          ['price', 'Gt', 100],
          ['price', 'Lt', 200],
        ],
      ]);
    });
  });

  // Array Operators
  describe('array operators', () => {
    it('handles arrays as $in operator', () => {
      const filter: TurbopufferVectorFilter = { tags: ['tag1', 'tag2'] };
      expect(translate(filter)).toEqual(['And', [['tags', 'In', ['tag1', 'tag2']]]]);
    });

    it('handles $in operator', () => {
      const filter: TurbopufferVectorFilter = { tags: { $in: ['tag1', 'tag2'] } };
      expect(translate(filter)).toEqual(['And', [['tags', 'In', ['tag1', 'tag2']]]]);
    });

    it('handles $nin operator', () => {
      const filter: TurbopufferVectorFilter = { tags: { $nin: ['tag1', 'tag2'] } };
      expect(translate(filter)).toEqual(['And', [['tags', 'NotIn', ['tag1', 'tag2']]]]);
    });

    it('simulates $all using AND conditions', () => {
      const filter: TurbopufferVectorFilter = { tags: { $all: ['tag1', 'tag2'] } };
      expect(translate(filter)).toEqual([
        'And',
        [
          ['tags', 'In', ['tag1']],
          ['tags', 'In', ['tag2']],
        ],
      ]);
    });
  });

  // Logical Operators
  describe('logical operators', () => {
    it('handles $and operator', () => {
      const filter: TurbopufferVectorFilter = {
        $and: [{ field1: 'value1' }, { field2: 'value2' }],
      };
      expect(translate(filter)).toEqual([
        'And',
        [
          ['field1', 'Eq', 'value1'],
          ['field2', 'Eq', 'value2'],
        ],
      ]);
    });

    it('handles $or operator', () => {
      const filter: TurbopufferVectorFilter = {
        $or: [{ field1: 'value1' }, { field2: 'value2' }],
      };
      expect(translate(filter)).toEqual([
        'Or',
        [
          ['field1', 'Eq', 'value1'],
          ['field2', 'Eq', 'value2'],
        ],
      ]);
    });

    it('handles nested logical operators', () => {
      const filter: TurbopufferVectorFilter = {
        $and: [
          { status: 'active' },
          {
            $or: [{ category: 'A' }, { category: 'B' }],
          },
        ],
      };
      expect(translate(filter)).toEqual([
        'And',
        [
          ['status', 'Eq', 'active'],
          [
            'Or',
            [
              ['category', 'Eq', 'A'],
              ['category', 'Eq', 'B'],
            ],
          ],
        ],
      ]);
    });

    it('handles complex nested conditions', () => {
      const filter: TurbopufferVectorFilter = {
        $or: [
          { age: { $gt: 25 } },
          {
            $and: [{ status: 'active' }, { role: 'admin' }],
          },
        ],
      };
      expect(translate(filter)).toEqual([
        'Or',
        [
          ['age', 'Gt', 25],
          [
            'And',
            [
              ['status', 'Eq', 'active'],
              ['role', 'Eq', 'admin'],
            ],
          ],
        ],
      ]);
    });
  });

  // Element Operators
  describe('element operators', () => {
    it('handles $exists operator with true', () => {
      const filter: TurbopufferVectorFilter = { field: { $exists: true } };
      expect(translate(filter)).toEqual(['And', [['field', 'NotEq', null]]]);
    });

    it('handles $exists operator with false', () => {
      const filter: TurbopufferVectorFilter = { field: { $exists: false } };
      expect(translate(filter)).toEqual(['And', [['field', 'Eq', null]]]);
    });
  });

  // Nested Objects
  describe('nested objects', () => {
    it('flattens nested objects to dot notation', () => {
      const filter = {
        user: {
          profile: {
            age: { $gt: 25 },
          },
        },
      };
      expect(translate(filter)).toEqual(['And', [['user.profile.age', 'Gt', 25]]]);
    });

    it('handles multiple levels of nesting', () => {
      const filter = {
        'user.profile.settings': {
          theme: 'dark',
          notifications: true,
        },
      };
      expect(translate(filter)).toEqual([
        'And',
        [
          ['user.profile.settings.theme', 'Eq', 'dark'],
          ['user.profile.settings.notifications', 'Eq', true],
        ],
      ]);
    });
  });

  // Error Cases
  describe('error cases', () => {
    it('throws error for unsupported operators', () => {
      const filter = { field: { $regex: 'pattern' } };
      expect(() => translate(filter)).toThrow(/Unsupported operator/);
    });

    it('throws error for empty $all array', () => {
      const filter = { tags: { $all: [] } };
      expect(() => translate(filter)).toThrow('$all operator requires a non-empty array');
    });
  });

  // Mixed logical and field operators at the same level
  describe('mixed logical and field operators', () => {
    it('ANDs a leading $or with a sibling field', () => {
      const filter = {
        $or: [{ status: 'active' }, { featured: true }],
        tenantId: 'tenant-a',
      } as TurbopufferVectorFilter;

      expect(translate(filter)).toEqual([
        'And',
        [
          [
            'Or',
            [
              ['status', 'Eq', 'active'],
              ['featured', 'Eq', true],
            ],
          ],
          ['tenantId', 'Eq', 'tenant-a'],
        ],
      ]);
    });

    it('ANDs a trailing $or with a leading sibling field', () => {
      const filter = {
        tenantId: 'tenant-a',
        $or: [{ status: 'active' }, { featured: true }],
      } as TurbopufferVectorFilter;

      expect(translate(filter)).toEqual([
        'And',
        [
          ['tenantId', 'Eq', 'tenant-a'],
          [
            'Or',
            [
              ['status', 'Eq', 'active'],
              ['featured', 'Eq', true],
            ],
          ],
        ],
      ]);
    });

    it('ANDs $and with sibling fields', () => {
      const filter = {
        $and: [{ price: { $gte: 10 } }, { price: { $lte: 100 } }],
        category: 'books',
      } as TurbopufferVectorFilter;

      expect(translate(filter)).toEqual([
        'And',
        [
          [
            'And',
            [
              ['price', 'Gte', 10],
              ['price', 'Lte', 100],
            ],
          ],
          ['category', 'Eq', 'books'],
        ],
      ]);
    });

    it('ANDs several logical operators with several sibling fields', () => {
      const filter = {
        $or: [{ status: 'active' }, { featured: true }],
        $and: [{ price: { $gt: 0 } }],
        tenantId: 'tenant-a',
        category: 'books',
      } as TurbopufferVectorFilter;

      expect(translate(filter)).toEqual([
        'And',
        [
          [
            'Or',
            [
              ['status', 'Eq', 'active'],
              ['featured', 'Eq', true],
            ],
          ],
          ['And', [['price', 'Gt', 0]]],
          ['tenantId', 'Eq', 'tenant-a'],
          ['category', 'Eq', 'books'],
        ],
      ]);
    });

    it('ANDs a mixed object nested inside $and operands', () => {
      const filter = {
        $and: [{ $or: [{ status: 'active' }, { featured: true }], tenantId: 'tenant-a' }, { category: 'books' }],
      } as TurbopufferVectorFilter;

      expect(translate(filter)).toEqual([
        'And',
        [
          [
            'And',
            [
              [
                'Or',
                [
                  ['status', 'Eq', 'active'],
                  ['featured', 'Eq', true],
                ],
              ],
              ['tenantId', 'Eq', 'tenant-a'],
            ],
          ],
          ['category', 'Eq', 'books'],
        ],
      ]);
    });

    it('ANDs a mixed object nested inside $or operands', () => {
      const filter = {
        $or: [{ tenantId: 'tenant-a', $and: [{ price: { $gt: 0 } }] }, { category: 'books' }],
      } as TurbopufferVectorFilter;

      expect(translate(filter)).toEqual([
        'Or',
        [
          [
            'And',
            [
              ['tenantId', 'Eq', 'tenant-a'],
              ['And', [['price', 'Gt', 0]]],
            ],
          ],
          ['category', 'Eq', 'books'],
        ],
      ]);
    });
  });
});
