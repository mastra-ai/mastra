import { describe, it, expect, beforeEach } from 'vitest';

import { AstraFilterTranslator } from './filter';

describe('AstraFilterTranslator', () => {
  let translator: AstraFilterTranslator;

  beforeEach(() => {
    translator = new AstraFilterTranslator();
  });

  // Basic Filter Operations
  describe('basic operations', () => {
    it('handles simple equality', () => {
      const filter = { field: 'value' };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles comparison operators', () => {
      const filter = {
        age: { $gt: 25 },
        score: { $lte: 100 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles valid multiple operators on same field', () => {
      const filter = {
        price: { $gt: 100, $lt: 200 },
        quantity: { $gte: 10, $lte: 20 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles null values correctly', () => {
      const filter = {
        field: null,
        other: { $eq: null },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('throws on unsupported combinations', () => {
      const filter = {
        field: { $gt: 100, $lt: 200 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });
  });

  // Array Operations
  describe('array operations', () => {
    it('handles array operators', () => {
      const filter = {
        tags: { $all: ['tag1', 'tag2'] },
        categories: { $in: ['A', 'B'] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles elemMatch operator', () => {
      const filter = {
        items: {
          $elemMatch: {
            qty: { $gt: 20 },
            price: { $lt: 50 },
          },
        },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles empty array values', () => {
      const filter = {
        tags: { $in: [] },
        categories: { $all: [] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles nested array operators', () => {
      const filter = {
        $and: [{ tags: { $all: ['tag1', 'tag2'] } }, { 'nested.array': { $in: [1, 2, 3] } }],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });
  });

  // Logical Operators
  describe('logical operators', () => {
    it('handles logical operators', () => {
      const filter = {
        $or: [{ status: 'active' }, { age: { $gt: 25 } }],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles nested logical operators', () => {
      const filter = {
        $and: [
          { status: 'active' },
          { $or: [{ category: { $in: ['A', 'B'] } }, { $and: [{ price: { $gt: 100 } }, { stock: { $lt: 50 } }] }] },
        ],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles $nor operator', () => {
      const filter = {
        $nor: [{ price: { $lt: 100 } }, { status: 'inactive' }],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles empty conditions in logical operators', () => {
      const filter = {
        $and: [],
        $or: [{}],
        field: 'value',
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('allows multiple logical operators at root level with complex conditions', () => {
      expect(() =>
        translator.translate({
          $and: [{ field1: { $gt: 10 } }],
          $or: [{ field2: { $lt: 20 } }],
          $nor: [{ field3: { $in: ['a', 'b'] } }],
          field4: { $not: { $eq: 'value' } },
        }),
      ).not.toThrow();
    });

    it('allows logical operators at root level', () => {
      expect(() =>
        translator.translate({
          $and: [{ field1: 'value1' }, { field2: 'value2' }],
          $or: [{ field3: 'value3' }, { field4: 'value4' }],
          $nor: [{ field5: 'value5' }, { field6: 'value6' }],
        }),
      ).not.toThrow();
    });

    it('allows logical operators nested within other logical operators', () => {
      expect(() =>
        translator.translate({
          $and: [
            {
              $or: [{ field1: 'value1' }, { field2: 'value2' }],
            },
            {
              $nor: [{ field3: 'value3' }, { field4: 'value4' }],
            },
          ],
        }),
      ).not.toThrow();
    });
  });

  // Logical Operator Validation
  describe('logical operator validation', () => {
    it('throws error for direct operators in logical operator arrays', () => {
      expect(() =>
        translator.translate({
          $and: [{ $eq: 'value' }, { $gt: 100 }],
        }),
      ).toThrow(/Logical operators must contain field conditions/);

      expect(() =>
        translator.translate({
          $or: [{ $in: ['value1', 'value2'] }],
        }),
      ).toThrow(/Logical operators must contain field conditions/);
    });

    it('throws error for deeply nested logical operators in non-logical contexts', () => {
      expect(() =>
        translator.translate({
          field: {
            $gt: {
              $or: [{ subfield: 'value1' }, { subfield: 'value2' }],
            },
          },
        }),
      ).toThrow();

      expect(() =>
        translator.translate({
          field: {
            $in: [
              {
                $and: [{ subfield: 'value1' }, { subfield: 'value2' }],
              },
            ],
          },
        }),
      ).toThrow();
    });

    it('throws error for logical operators nested in non-logical contexts', () => {
      expect(() =>
        translator.translate({
          field: {
            $elemMatch: {
              $or: [{ subfield: 'value1' }, { subfield: 'value2' }],
            },
          },
        }),
      ).toThrow();

      expect(() =>
        translator.translate({
          field: {
            $not: {
              $and: [{ subfield: 'value1' }, { subfield: 'value2' }],
            },
          },
        }),
      ).not.toThrow(); // $not is allowed to contain logical operators
    });

    it('throws error for $not if not an object', () => {
      expect(() => translator.translate({ $not: 'value' })).toThrow();
      expect(() => translator.translate({ $not: [{ field: 'value' }] })).toThrow();
    });

    it('throws error for $not if empty', () => {
      expect(() => translator.translate({ $not: {} })).toThrow();
    });
  });

  // Nested Objects and Fields
  describe('nested objects and fields', () => {
    it('handles nested objects', () => {
      const filter = {
        'user.profile.age': { $gt: 25 },
        'user.status': 'active',
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles deeply nested field paths', () => {
      const filter = {
        'user.profile.address.city': { $eq: 'New York' },
        'deep.nested.field': { $gt: 100 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('preserves nested empty objects', () => {
      const filter = {
        status: 'active',
        metadata: {},
        user: {
          profile: {},
          settings: { theme: null },
        },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles mix of operators and empty objects', () => {
      const filter = {
        tags: { $in: ['a', 'b'] },
        metadata: {},
        nested: {
          field: { $eq: 'value' },
          empty: {},
        },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles deeply nested operators', () => {
      const filter = {
        user: {
          profile: {
            preferences: {
              theme: { $in: ['dark', 'light'] },
            },
          },
        },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });
  });

  // Regex Support
  describe('regex support', () => {
    it('passes through regex literals', () => {
      const filter = { field: /pattern/i };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('passes through regex object form', () => {
      const filter = { field: { $regex: 'pattern', $options: 'i' } };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('passes through start/end anchors', () => {
      const filter = {
        start: { $regex: '^begin' },
        end: { $regex: 'end$' },
        exact: { $regex: '^exact$' },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('passes through regex patterns', () => {
      const filter = { field: { $regex: 'pat.*ern' } };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles case-insensitive regex', () => {
      const filter = {
        name: { $regex: 'test', $options: 'i' },
        description: { $regex: '^hello' },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });
  });

  // Special Cases
  describe('special cases', () => {
    it('handles empty filters', () => {
      expect(translator.translate({})).toEqual({});
      expect(translator.translate(null as any)).toEqual(null);
      expect(translator.translate(undefined as any)).toEqual(undefined);
    });

    it('normalizes dates', () => {
      const date = new Date('2024-01-01');
      const filter = { timestamp: { $gt: date } };
      expect(translator.translate(filter)).toEqual({
        timestamp: { $gt: date.toISOString() },
      });
    });

    it('allows $not in field-level conditions', () => {
      expect(() =>
        translator.translate({
          field1: { $not: { $eq: 'value1' } },
          field2: { $not: { $in: ['value2', 'value3'] } },
          field3: { $not: { $regex: 'pattern' } },
        }),
      ).not.toThrow();
    });
  });
});
