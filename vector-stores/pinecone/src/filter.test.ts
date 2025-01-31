import { describe, it, expect, beforeEach } from 'vitest';

import { PineconeFilterTranslator } from './filter';

describe('PineconeFilterTranslator', () => {
  let translator: PineconeFilterTranslator;

  beforeEach(() => {
    translator = new PineconeFilterTranslator();
  });

  describe('translate', () => {
    it('handles empty filters', () => {
      expect(translator.translate({})).toEqual({});
      expect(translator.translate(null as any)).toEqual(null);
      expect(translator.translate(undefined as any)).toEqual(undefined);
    });

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

  describe('validate operators', () => {
    it('ensure all operator filters are supported', () => {
      const supportedFilters = [
        { field: { $eq: 'value' } },
        { field: { $ne: 'value' } },
        { field: { $gt: 'value' } },
        { field: { $gte: 'value' } },
        { field: { $lt: 'value' } },
        { field: { $lte: 'value' } },
        { field: { $in: ['value'] } },
        { field: { $and: [{ $eq: 'value' }] } },
        { field: { $or: [{ $eq: 'value' }] } },
        { field: { $all: [{ $eq: 'value' }] } },
      ];
      supportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });
    it('throws error for unsupported operators', () => {
      const unsupportedFilters = [
        { field: { $regex: 'pattern' } },
        { field: { $contains: 'value' } },
        { field: { $exists: true } },
        { field: { $elemMatch: { $gt: 5 } } },
        { field: { $nor: [{ $eq: 'value' }] } },
        { field: { $not: [{ $eq: 'value' }] } },
        { field: { $regex: 'pattern', $options: 'i' } },
        { field: { $nin: 'value' } },
      ];

      unsupportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
      });
    });
  });

  describe('handle invalid conditions', () => {
    it('throws error for empty $all array', () => {
      expect(() =>
        translator.translate({
          categories: { $all: [] },
        }),
      ).toThrow();
    });
    it('throws error for invalid operator values', () => {
      const filter = { tags: { $all: 'not-an-array' } };
      expect(() => translator.translate(filter)).toThrow();
    });
  });
  describe('PineconeFilterTranslator empty object handling', () => {
    let translator: PineconeFilterTranslator;

    beforeEach(() => {
      translator = new PineconeFilterTranslator();
    });

    it('preserves empty objects as exact match conditions', () => {
      const filter = {
        metadata: {},
        'user.profile': {},
      };

      expect(translator.translate(filter)).toEqual({
        $and: [{ metadata: {} }, { 'user.profile': {} }],
      });
    });

    it('handles empty objects in logical operators', () => {
      const filter = {
        $or: [{}, { status: 'active' }],
      };

      expect(translator.translate(filter)).toEqual({
        $or: [{}, { status: { $eq: 'active' } }],
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
      const filter = {
        metadata: { $eq: {} },
      };

      expect(translator.translate(filter)).toEqual({
        metadata: { $eq: {} },
      });
    });

    it('handles empty objects in array operators', () => {
      const filter = {
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
});
