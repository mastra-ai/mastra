import type { VectorFilter } from '@mastra/core/vector/filter';
import type { Filters } from '@turbopuffer/turbopuffer';
import { beforeEach, describe, expect, it } from 'vitest';
import { TurbopufferFilterTranslator } from './filter';

describe('TurbopufferFilterTranslator', () => {
  let translate: (filter?: VectorFilter) => Filters | undefined;

  beforeEach(() => {
    const translator = new TurbopufferFilterTranslator();
    translate = translator.translate.bind(translator);
  });

  // Basic Filter Operations
  describe('basic operations', () => {
    it('handles empty filters', () => {
      expect(translate({})).toEqual(undefined);
      expect(translate(undefined)).toEqual(undefined);
      expect(translate(null as any)).toEqual(undefined);
    });

    it('allows implicit equality', () => {
      const filter = { field: 'value' };
      expect(translate(filter)).toEqual(['And', [['field', 'Eq', 'value']]]);
    });

    it('allows multiple top-level fields', () => {
      const filter = {
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
      const filter = { age: 30 };
      expect(translate(filter)).toEqual(['And', [['age', 'Eq', 30]]]);
    });

    it('handles boolean values', () => {
      const filter = { active: true };
      expect(translate(filter)).toEqual(['And', [['active', 'Eq', true]]]);
    });

    it('normalizes date values', () => {
      const date = new Date('2024-01-01');
      const dateStr = date.toISOString();
      const filter = { timestamp: date };
      expect(translate(filter)).toEqual(['And', [['timestamp', 'Eq', dateStr]]]);
    });
  });

  // Comparison Operators
  describe('comparison operators', () => {
    it('handles $eq operator', () => {
      const filter = { field: { $eq: 'value' } };
      expect(translate(filter)).toEqual(['And', [['field', 'Eq', 'value']]]);
    });

    it('handles $ne operator', () => {
      const filter = { field: { $ne: 'value' } };
      expect(translate(filter)).toEqual(['And', [['field', 'NotEq', 'value']]]);
    });

    it('handles $gt operator', () => {
      const filter = { field: { $gt: 10 } };
      expect(translate(filter)).toEqual(['And', [['field', 'Gt', 10]]]);
    });

    it('handles $gte operator', () => {
      const filter = { field: { $gte: 10 } };
      expect(translate(filter)).toEqual(['And', [['field', 'Gte', 10]]]);
    });

    it('handles $lt operator', () => {
      const filter = { field: { $lt: 10 } };
      expect(translate(filter)).toEqual(['And', [['field', 'Lt', 10]]]);
    });

    it('handles $lte operator', () => {
      const filter = { field: { $lte: 10 } };
      expect(translate(filter)).toEqual(['And', [['field', 'Lte', 10]]]);
    });

    it('handles multiple operators on same field', () => {
      const filter = {
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
      const filter = { tags: ['tag1', 'tag2'] };
      expect(translate(filter)).toEqual(['And', [['tags', 'In', ['tag1', 'tag2']]]]);
    });

    it('handles $in operator', () => {
      const filter = { tags: { $in: ['tag1', 'tag2'] } };
      expect(translate(filter)).toEqual(['And', [['tags', 'In', ['tag1', 'tag2']]]]);
    });

    it('handles $nin operator', () => {
      const filter = { tags: { $nin: ['tag1', 'tag2'] } };
      expect(translate(filter)).toEqual(['And', [['tags', 'NotIn', ['tag1', 'tag2']]]]);
    });

    it('simulates $all using AND conditions', () => {
      const filter = { tags: { $all: ['tag1', 'tag2'] } };
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
      const filter = {
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
      const filter = {
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
      const filter = {
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
      const filter = {
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
      const filter = { field: { $exists: true } };
      expect(translate(filter)).toEqual(['And', [['field', 'NotEq', null]]]);
    });

    it('handles $exists operator with false', () => {
      const filter = { field: { $exists: false } };
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
});
