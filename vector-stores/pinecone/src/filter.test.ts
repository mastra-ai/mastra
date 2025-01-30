import { describe, it, expect, beforeEach } from 'vitest';

import { PineconeFilterTranslator } from './filter';

describe('PineconeFilterTranslator', () => {
  let translator: PineconeFilterTranslator;

  beforeEach(() => {
    translator = new PineconeFilterTranslator();
  });

  describe('translate', () => {
    it('converts implicit equality to explicit $eq', () => {
      const filter = { field: 'value' };
      expect(translator.translate(filter)).toEqual({ field: { $eq: 'value' } });
    });

    it('converts multiple top-level fields to $and', () => {
      const filter = {
        field1: 'value1',
        field2: 'value2',
      };
      expect(translator.translate(filter)).toEqual({
        $and: [{ field1: { $eq: 'value1' } }, { field2: { $eq: 'value2' } }],
      });
    });

    it('flattens nested objects to dot notation', () => {
      const filter = {
        user: {
          profile: {
            age: { $gt: 25 },
          },
        },
      };
      expect(translator.translate(filter)).toEqual({ 'user.profile.age': { $gt: 25 } });
    });

    it('handles arrays as $in operator', () => {
      const filter = { tags: ['tag1', 'tag2'] };
      expect(translator.translate(filter)).toEqual({ tags: { $in: ['tag1', 'tag2'] } });
    });

    it('simulates $all using $and + $in', () => {
      const filter = { tags: { $all: ['tag1', 'tag2'] } };
      expect(translator.translate(filter)).toEqual({
        $and: [{ tags: { $in: ['tag1'] } }, { tags: { $in: ['tag2'] } }],
      });
    });

    it('handles complex nested conditions', () => {
      const filter = {
        $or: [
          { age: { $gt: 25 } },
          {
            status: 'active',
            'user.preferences.theme': 'dark',
          },
        ],
      };
      expect(translator.translate(filter)).toEqual({
        $or: [
          { age: { $gt: 25 } },
          {
            $and: [{ status: { $eq: 'active' } }, { 'user.preferences.theme': { $eq: 'dark' } }],
          },
        ],
      });
    });

    it('normalizes date values', () => {
      const date = new Date('2024-01-01');
      const filter = { timestamp: { $gt: date } };
      expect(translator.translate(filter)).toEqual({ timestamp: { $gt: date.toISOString() } });
    });

    it('handles logical operators', () => {
      const filter = {
        $or: [{ status: 'active' }, { age: { $gt: 25 } }],
      };
      expect(translator.translate(filter)).toEqual({
        $or: [{ status: { $eq: 'active' } }, { age: { $gt: 25 } }],
      });
    });

    it('handles nested logical operators', () => {
      const filter = {
        $and: [
          { status: 'active' },
          {
            $or: [{ category: { $in: ['A', 'B'] } }, { $and: [{ price: { $gt: 100 } }, { stock: { $lt: 50 } }] }],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual({
        $and: [
          { status: { $eq: 'active' } },
          {
            $or: [{ category: { $in: ['A', 'B'] } }, { $and: [{ price: { $gt: 100 } }, { stock: { $lt: 50 } }] }],
          },
        ],
      });
    });

    it('handles empty array values', () => {
      // $in with empty array is valid in Pinecone
      expect(translator.translate({ tags: { $in: [] } })).toEqual({ tags: { $in: [] } });
    });

    it('handles multiple operators on same field', () => {
      const filter = {
        price: { $gt: 100, $lt: 200 },
        quantity: { $gte: 10, $lte: 20 },
      };
      expect(translator.translate(filter)).toEqual({
        $and: [
          { price: { $gt: 100 } },
          { price: { $lt: 200 } },
          { quantity: { $gte: 10 } },
          { quantity: { $lte: 20 } },
        ],
      });
    });

    describe('array handling', () => {
      it('handles $in with various values', () => {
        // Empty array
        expect(translator.translate({ field: { $in: [] } })).toEqual({ field: { $in: [] } });

        // Single value
        expect(translator.translate({ field: { $in: ['value'] } })).toEqual({ field: { $in: ['value'] } });

        // Multiple values
        expect(translator.translate({ field: { $in: [1, 'two', true] } })).toEqual({
          field: { $in: [1, 'two', true] },
        });

        // With dates
        const date = new Date('2024-01-01');
        expect(translator.translate({ field: { $in: [date.toISOString()] } })).toEqual({
          field: { $in: [date.toISOString()] },
        });
      });
    });

    it('handles $all operator simulation', () => {
      // Single value - converts to $in
      expect(translator.translate({ field: { $all: ['value'] } })).toEqual({ $and: [{ field: { $in: ['value'] } }] });

      // Multiple values
      expect(translator.translate({ field: { $all: ['value1', 'value2'] } })).toEqual({
        $and: [{ field: { $in: ['value1'] } }, { field: { $in: ['value2'] } }],
      });

      // With dates
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');
      expect(translator.translate({ field: { $all: [date1, date2] } })).toEqual({
        $and: [{ field: { $in: [date1.toISOString()] } }, { field: { $in: [date2.toISOString()] } }],
      });
    });

    it('handles arrays as direct values', () => {
      // Direct array value should be converted to $in
      expect(translator.translate({ field: ['value1', 'value2'] })).toEqual({ field: { $in: ['value1', 'value2'] } });

      // Empty direct array
      expect(translator.translate({ field: [] })).toEqual({ field: { $in: [] } });
    });
  });

  it('handles nested arrays in logical operators', () => {
    expect(
      translator.translate({
        $and: [{ field1: { $in: ['a', 'b'] } }, { field2: { $all: ['c', 'd'] } }],
      }),
    ).toEqual({
      $and: [
        { field1: { $in: ['a', 'b'] } },
        {
          $and: [{ field2: { $in: ['c'] } }, { field2: { $in: ['d'] } }],
        },
      ],
    });
  });

  describe('handle invalid conditions', () => {
    it('throws error for null values', () => {
      const filtersWithNull = [{ field: null }, { other: { $eq: null } }];

      filtersWithNull.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow('Null values are not supported');
      });
    });
    it('throws error for unsupported $elemMatch', () => {
      const filter = {
        array: { $elemMatch: { field: 'value' } },
      };
      expect(() => translator.translate(filter)).toThrow();
    });

    it('throws error for empty $all array', () => {
      expect(() =>
        translator.translate({
          categories: { $all: [] },
        }),
      ).toThrow('Empty $all array is not supported');
    });
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

  // Multiple Invalid Values
  it('validates multiple invalid values', () => {
    expect(() =>
      translator.translate({
        field1: { $in: 'not-array' },
        field2: { $exists: 'not-boolean' },
        field3: { $gt: 'not-number' },
      }),
    ).toThrow();
  });
  it('throws for invalid array values', () => {
    // null/undefined in arrays
    expect(() =>
      translator.translate({
        field: { $in: [null] },
      }),
    ).toThrow();

    expect(() =>
      translator.translate({
        field: { $in: [undefined] },
      }),
    ).toThrow();

    // Invalid $all values
    expect(() =>
      translator.translate({
        field: { $all: 'not-an-array' },
      }),
    ).toThrow();
  });
});
