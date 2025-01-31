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
      expect(translator.translate(null as any)).toEqual(null);
      expect(translator.translate(undefined as any)).toEqual(undefined);
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

    // Test nested empty objects
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

    // Test mixed operator and empty object cases
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

    // Test deeply nested operators
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
        { field: { $nin: ['value'] } },
        { field: { $regex: 'value' } },
        { field: { $exists: true } },
        { field: { $and: [{ $eq: 'value' }] } },
        { field: { $nor: [{ $eq: 'value' }] } },
        { field: { $or: [{ $eq: 'value' }] } },
        { field: { $not: [{ $eq: 'value' }] } },
        { field: { $all: [{ $eq: 'value' }] } },
        { field: { $elemMatch: { $gt: 5 } } },
      ];
      supportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });

    it('throws error for unsupported operators', () => {
      const unsupportedFilters = [{ field: { $contains: 'value' } }];
      unsupportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
      });
    });
  });
});
