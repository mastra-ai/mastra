import { describe, it, expect, beforeEach } from 'vitest';

import type { ChromaVectorFilter } from './filter';
import { ChromaFilterTranslator } from './filter';

describe('ChromaFilterTranslator', () => {
  let translator: ChromaFilterTranslator;

  beforeEach(() => {
    translator = new ChromaFilterTranslator();
  });

  // Basic Filter Operations
  describe('basic operations', () => {
    it('handles empty filters', () => {
      expect(translator.translate({})).toEqual({});
      expect(translator.translate(null)).toEqual(null);
      expect(translator.translate(undefined)).toEqual(undefined);
    });

    it('retains implicit equality', () => {
      const filter: ChromaVectorFilter = { field: 'value' };
      expect(translator.translate(filter)).toEqual({ field: 'value' });
    });

    it('converts multiple top-level fields to $and', () => {
      const filter: ChromaVectorFilter = {
        field1: 'value1',
        field2: 'value2',
      };
      expect(translator.translate(filter)).toEqual({
        $and: [{ field1: 'value1' }, { field2: 'value2' }],
      });
    });

    it('handles multiple operators on same field', () => {
      const filter: ChromaVectorFilter = {
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

    it('normalizes date values', () => {
      const date = new Date('2024-01-01');
      const filter: ChromaVectorFilter = { timestamp: { $gt: date } };
      expect(translator.translate(filter)).toEqual({ timestamp: { $gt: date.toISOString() } });
    });
  });

  // Array Operations
  describe('array operations', () => {
    it('handles arrays as $in operator', () => {
      const filter: ChromaVectorFilter = { tags: ['tag1', 'tag2'] };
      expect(translator.translate(filter)).toEqual({ tags: { $in: ['tag1', 'tag2'] } });
    });

    it('handles empty array values', () => {
      // $in with empty array is valid in Pinecone
      expect(translator.translate({ tags: { $in: [] } })).toEqual({ tags: { $in: [] } });
    });

    it('handles arrays as direct values', () => {
      // Direct array value should be converted to $in
      const filter: ChromaVectorFilter = { field: ['value1', 'value2'] };
      expect(translator.translate(filter)).toEqual({
        field: { $in: ['value1', 'value2'] },
      });

      // Empty direct array
      const filter2 = { field: [] };
      expect(translator.translate(filter2)).toEqual({ field: { $in: [] } });
    });

    describe('$in operator variations', () => {
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
  });

  // Logical Operators
  describe('logical operators', () => {
    it('handles logical operators', () => {
      const filter: ChromaVectorFilter = {
        $or: [{ status: { $eq: 'active' } }, { age: { $gt: 25 } }],
      };
      expect(translator.translate(filter)).toEqual({
        $or: [{ status: { $eq: 'active' } }, { age: { $gt: 25 } }],
      });
    });

    it('handles nested logical operators', () => {
      const filter: ChromaVectorFilter = {
        $and: [
          { status: { $eq: 'active' } },
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

    it('handles nested arrays in logical operators', () => {
      expect(
        translator.translate({
          $and: [{ field1: { $in: ['a', 'b'] } }, { field2: { $in: ['c', 'd'] } }],
        }),
      ).toEqual({
        $and: [
          { field1: { $in: ['a', 'b'] } },
          {
            field2: { $in: ['c', 'd'] },
          },
        ],
      });
    });

    it('handles complex nested conditions', () => {
      const filter: ChromaVectorFilter = {
        $or: [
          { age: { $gt: 25 } },
          {
            status: { $eq: 'active' },
            theme: 'dark',
          },
        ],
      };
      expect(translator.translate(filter)).toEqual({
        $or: [
          { age: { $gt: 25 } },
          {
            $and: [{ status: { $eq: 'active' } }, { theme: 'dark' }],
          },
        ],
      });
    });
  });

  // Nested Objects and Fields
  describe('nested objects and fields', () => {
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

    it('preserves empty objects as exact match conditions', () => {
      const filter: ChromaVectorFilter = {
        metadata: {},
        'user.profile': {},
      };

      expect(translator.translate(filter)).toEqual({
        $and: [{ metadata: {} }, { 'user.profile': {} }],
      });
    });

    it('handles empty objects in logical operators', () => {
      const filter: ChromaVectorFilter = {
        $or: [{}, { status: 'active' }],
      };

      expect(translator.translate(filter)).toEqual({
        $or: [{}, { status: 'active' }],
      });
    });

    it('preserves empty objects in nested structures', () => {
      const filter = {
        user: {
          profile: {
            settings: {},
          },
        },
      };

      expect(translator.translate(filter)).toEqual({
        'user.profile.settings': {},
      });
    });

    it('handles empty objects in comparison operators', () => {
      const filter: ChromaVectorFilter = {
        metadata: { $eq: {} },
      };

      expect(translator.translate(filter)).toEqual({
        metadata: { $eq: {} },
      });
    });

    it('handles empty objects in array operators', () => {
      const filter: ChromaVectorFilter = {
        tags: { $in: [{}] },
      };

      expect(translator.translate(filter)).toEqual({
        tags: { $in: [{}] },
      });
    });

    it('handles multiple empty nested fields', () => {
      const filter = {
        metadata: {},
        settings: {},
        config: { nested: {} },
      };

      expect(translator.translate(filter)).toEqual({
        $and: [{ metadata: {} }, { settings: {} }, { 'config.nested': {} }],
      });
    });
  });

  // Operator Validation
  describe('operator validation', () => {
    describe('logical operator validation', () => {
      it('allows $and and $or at root level', () => {
        const validFilters = [
          {
            $and: [{ field1: 'value1' }, { field2: 'value2' }],
          },
          {
            $or: [{ field1: 'value1' }, { field2: 'value2' }],
          },
          {
            $and: [{ field1: 'value1' }],
            $or: [{ field2: 'value2' }],
          },
        ];

        validFilters.forEach(filter => {
          expect(() => translator.translate(filter)).not.toThrow();
        });
      });

      it('allows nested $and and $or within other logical operators', () => {
        const validFilters = [
          {
            $and: [
              { field1: 'value1' },
              {
                $or: [{ field2: 'value2' }, { field3: 'value3' }],
              },
            ],
          },
          {
            $or: [
              { field1: 'value1' },
              {
                $and: [{ field2: 'value2' }, { field3: 'value3' }],
              },
            ],
          },
        ];

        validFilters.forEach(filter => {
          expect(() => translator.translate(filter)).not.toThrow();
        });
      });

      it('throws error for logical operators in field-level conditions', () => {
        const invalidFilters = [
          {
            field: {
              $and: [{ $eq: 'value1' }, { $eq: 'value2' }],
            },
          },
          {
            field: {
              $or: [{ $eq: 'value1' }, { $eq: 'value2' }],
            },
          },
          {
            nested: {
              field: {
                $and: [{ $eq: 'value1' }, { $eq: 'value2' }],
              },
            },
          },
        ];

        invalidFilters.forEach(filter => {
          expect(() => translator.translate(filter)).toThrow(/cannot be used at field level/);
        });
      });

      it('throws error for direct operators in logical operator arrays', () => {
        const invalidFilters = [
          {
            $and: [{ $eq: 'value' }, { $gt: 100 }],
          },
          {
            $or: [{ $in: ['value1', 'value2'] }],
          },
          {
            $and: [{ field1: 'value1' }, { $or: [{ $eq: 'value2' }] }],
          },
        ];

        invalidFilters.forEach(filter => {
          expect(() => translator.translate(filter)).toThrow(/must contain field conditions/);
        });
      });

      it('throws error for unsupported logical operators', () => {
        const invalidFilters: any = [
          {
            $not: { field: 'value' },
          },
          {
            $nor: [{ field: 'value' }],
          },
          {
            $and: [{ field1: 'value1' }, { $nor: [{ field2: 'value2' }] }],
          },
          {
            field: { $not: { $eq: 'value' } },
          },
        ];

        // @ts-expect-error
        invalidFilters.forEach(filter => {
          expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
        });
      });
    });

    it('ensure all operator filters are supported', () => {
      const supportedFilters = [
        { field: { $eq: 'value' } },
        { field: { $ne: 'value' } },
        { field: { $gt: 'value' } },
        { field: { $gte: 'value' } },
        { field: { $lt: 'value' } },
        { field: { $lte: 'value' } },
        { field: { $in: ['value'] } },
        { $and: [{ field: { $eq: 'value' } }] },
        { $or: [{ field: { $eq: 'value' } }] },
      ];
      supportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });

    it('throws error for unsupported operators', () => {
      const unsupportedFilters: any = [
        { field: { $regex: 'pattern' } },
        { field: { $contains: 'value' } },
        { field: { $exists: true } },
        { field: { $elemMatch: { $gt: 5 } } },
        { field: { $nor: [{ $eq: 'value' }] } },
        { field: { $not: [{ $eq: 'value' }] } },
        { field: { $regex: 'pattern', $options: 'i' } },
        { field: { $all: [{ $eq: 'value' }] } },
      ];

      // @ts-expect-error
      unsupportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
      });
    });

    it('throws error for regex operators', () => {
      const filter = { field: /pattern/i };
      expect(() => translator.translate(filter)).toThrow();
    });
    it('throws error for non-logical operators at top level', () => {
      const invalidFilters: any = [{ $gt: 100 }, { $in: ['value1', 'value2'] }, { $eq: true }];

      // @ts-expect-error
      invalidFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Invalid top-level operator/);
      });
    });

    it('allows logical operators at top level', () => {
      const validFilters = [{ $and: [{ field: 'value' }] }, { $or: [{ field: 'value' }] }];

      validFilters.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });
  });
});
