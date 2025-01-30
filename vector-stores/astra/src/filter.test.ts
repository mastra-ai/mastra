import { describe, it, expect, beforeEach } from 'vitest';

import { AstraFilterTranslator } from './filter';

describe('AstraFilterTranslator', () => {
  let translator: AstraFilterTranslator;

  beforeEach(() => {
    translator = new AstraFilterTranslator();
  });

  describe('translate', () => {
    // Basic cases
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

    it('handles logical operators', () => {
      const filter = {
        $or: [{ status: 'active' }, { age: { $gt: 25 } }],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('normalizes dates', () => {
      const date = new Date('2024-01-01');
      const filter = { timestamp: { $gt: date } };
      expect(translator.translate(filter)).toEqual({
        timestamp: { $gt: date.toISOString() },
      });
    });

    it('handles nested objects', () => {
      const filter = {
        'user.profile.age': { $gt: 25 },
        'user.status': 'active',
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

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

    it('handles empty filters', () => {
      expect(translator.translate({})).toEqual({});
      expect(translator.translate(null as any)).toEqual({});
      expect(translator.translate(undefined as any)).toEqual({});
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

    it('handles $exists operator', () => {
      const filter = {
        field: { $exists: true },
        missing: { $exists: false },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles $nor operator', () => {
      const filter = {
        $nor: [{ price: { $lt: 100 } }, { status: 'inactive' }],
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

    it('handles nested array operators', () => {
      const filter = {
        $and: [{ tags: { $all: ['tag1', 'tag2'] } }, { 'nested.array': { $in: [1, 2, 3] } }],
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

    it('handles complex nested structures', () => {
      const filter = {
        $or: [
          {
            $and: [{ field1: { $exists: true } }, { field2: { $in: ['a', 'b'] } }],
          },
          {
            $nor: [{ field3: { $gt: 100 } }, { field4: { $all: ['x', 'y'] } }],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles mixed array and comparison operators', () => {
      const filter = {
        tags: { $all: ['tag1', 'tag2'] },
        $or: [{ price: { $gt: 100 } }, { categories: { $in: ['A'] } }],
        status: { $ne: 'inactive' },
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

    it('handles null values correctly', () => {
      const filter = {
        field: null,
        other: { $eq: null },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles regex text search', () => {
      const filter = {
        name: { $regex: 'test' },
        description: { $regex: '^hello' },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles case-insensitive regex', () => {
      const filter = {
        name: { $regex: 'test', $options: 'i' },
        description: { $regex: '^hello' },
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

    it('throws on unsupported combinations', () => {
      const filter = {
        field: { $gt: 100, $lt: 200 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });
  });

  describe('operator validation', () => {
    it('throws error for invalid operator values', () => {
      const filter = { tags: { $all: 'not-an-array' } };
      expect(() => translator.translate(filter)).toThrow();
    });

    it('validates array operator values', () => {
      expect(() =>
        translator.translate({
          tags: { $in: null },
        }),
      ).toThrow();

      expect(() =>
        translator.translate({
          tags: { $all: 'not-an-array' },
        }),
      ).toThrow();
    });

    it('validates numeric values for comparison operators', () => {
      const filter = {
        price: { $gt: 'not-a-number' },
      };
      expect(() => translator.translate(filter)).toThrow();
    });

    it('validates value types', () => {
      expect(() =>
        translator.translate({
          date: { $gt: 'not-a-date' },
        }),
      ).toThrow();

      expect(() =>
        translator.translate({
          number: { $lt: 'not-a-number' },
        }),
      ).toThrow();
    });

    // Array Operators
    it('validates array operators', () => {
      const invalidValues = [123, 'string', true, { key: 'value' }, null, undefined];
      for (const op of ['$in', '$nin', '$all']) {
        for (const val of invalidValues) {
          expect(() =>
            translator.translate({
              field: { [op]: val },
            }),
          ).toThrow();
        }
      }

      // Invalid array elements
      expect(() =>
        translator.translate({
          field: { $in: [undefined, null] },
        }),
      ).toThrow();
    });

    // Element Operators
    it('validates element operators', () => {
      const invalidValues = [123, 'string', [], {}, null, undefined];
      for (const val of invalidValues) {
        expect(() =>
          translator.translate({
            field: { $exists: val },
          }),
        ).toThrow();
      }
    });

    // Comparison Operators
    it('validates comparison operators', () => {
      // Basic equality can accept any non-undefined value
      const eqOps = ['$eq', '$ne'];
      for (const op of eqOps) {
        expect(() =>
          translator.translate({
            field: { [op]: undefined },
          }),
        ).toThrow();
      }

      // Numeric comparisons require numbers or dates
      const numOps = ['$gt', '$gte', '$lt', '$lte'];
      const invalidNumericValues = ['not-a-number', true, [], {}, null, undefined];
      for (const op of numOps) {
        for (const val of invalidNumericValues) {
          expect(() =>
            translator.translate({
              field: { [op]: val },
            }),
          ).toThrow();
        }
      }
    });

    // Text Search Operators
    it('validates regex operators', () => {
      const invalidValues = [123, true, [], {}, null, undefined];
      for (const val of invalidValues) {
        expect(() =>
          translator.translate({
            field: { $regex: val },
          }),
        ).toThrow();
      }
    });

    it('validates regex options', () => {
      expect(() =>
        translator.translate({
          field: {
            $regex: 'pattern',
            $options: 'i',
          },
        }),
      ).not.toThrow();
    });

    it('not supported regex options', () => {
      expect(() =>
        translator.translate({
          field: {
            $regex: 'pattern',
            $options: 'm', // 'm' is not supported
          },
        }),
      ).toThrow();
    });

    it('invalid regex options type', () => {
      expect(() =>
        translator.translate({
          field: {
            $regex: 'pattern',
            $options: true, // must be string
          },
        }),
      ).toThrow();
    });

    // Multiple Invalid Values
    it('validates multiple invalid values', () => {
      expect(() =>
        translator.translate({
          field1: { $in: 'not-array' },
          field2: { $exists: 'not-boolean' },
          field3: { $gt: 'not-number' },
          field4: { $regex: {} },
        }),
      ).toThrow();
    });
  });

  describe('regex validation', () => {
    it('validates basic regex patterns', () => {
      // Valid cases
      const validCases = [
        { field: { $regex: 'pattern' } },
        { field: { $regex: 'pattern', $options: 'i' } },
        { field: { $regex: /pattern/ } },
        { field: { $regex: new RegExp('pattern') } },
      ];

      validCases.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });

      // Invalid cases
      const invalidCases = [
        { field: { $regex: 123 } },
        { field: { $regex: true } },
        { field: { $regex: [] } },
        { field: { $regex: {} } },
        { field: { $regex: 'pattern', $options: 'x' } }, // unsupported option
        { field: { $regex: 'pattern', $options: 123 } }, // invalid options type
      ];

      invalidCases.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow();
      });
    });

    it('handles multiple regex conditions', () => {
      const filter = {
        title: { $regex: 'pattern1', $options: 'i' },
        description: { $regex: 'pattern2' },
        $or: [{ tag: { $regex: 'pattern3', $options: 'i' } }, { category: { $regex: 'pattern4' } }],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });
  });

  describe('isSupportedFilter', () => {
    it('validates supported operators', () => {
      const filter = {
        field: 'value',
        age: { $gt: 25 },
        $or: [{ status: 'active' }, { tags: { $in: ['tag1'] } }],
      };
      expect(translator.isSupportedFilter(filter)).toBe(true);
    });

    it('identifies unsupported operators', () => {
      const filter = {
        field: { $unsupported: 'value' },
      } as any;
      expect(translator.isSupportedFilter(filter)).toBe(false);
    });
  });
});
