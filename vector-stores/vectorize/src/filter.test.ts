import { describe, it, expect, beforeEach } from 'vitest';

import { VectorizeFilterTranslator } from './filter';

describe('VectorizeFilterTranslator', () => {
  let translator: VectorizeFilterTranslator;

  beforeEach(() => {
    translator = new VectorizeFilterTranslator();
  });

  describe('translate', () => {
    it('handles empty filters', () => {
      expect(translator.translate({})).toEqual({});
      expect(translator.translate(null as any)).toEqual(null);
      expect(translator.translate(undefined as any)).toEqual(undefined);
    });

    // Basic cases
    it('converts implicit equality to explicit $eq', () => {
      const filter = { field: 'value' };
      expect(translator.translate(filter)).toEqual({
        field: { $eq: 'value' },
      });
    });

    it('handles comparison operators', () => {
      const filter = {
        age: { $gt: 25 },
        price: { $lte: 100 },
        status: { $ne: 'inactive' },
        quantity: { $gte: 10 },
        rating: { $lt: 5 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles $in operator', () => {
      const filter = {
        tags: { $in: ['important', 'urgent'] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles $nin operator', () => {
      const filter = {
        status: { $nin: ['deleted', 'archived'] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles null values', () => {
      const filter = {
        field: null,
        other: { $eq: null },
      };
      expect(translator.translate(filter)).toEqual({
        field: { $eq: null },
        other: { $eq: null },
      });
    });

    it('handles empty objects', () => {
      const filter = { field: {} };
      expect(translator.translate(filter)).toEqual({ field: {} });
    });

    it('flattens nested objects to dot notation', () => {
      const filter = {
        user: {
          profile: {
            age: { $gt: 25 },
          },
        },
      };
      expect(translator.translate(filter)).toEqual({
        'user.profile.age': { $gt: 25 },
      });
    });

    it('normalizes date values', () => {
      const date = new Date('2024-01-01');
      const filter = { timestamp: { $gt: date } };
      expect(translator.translate(filter)).toEqual({
        timestamp: { $gt: date.toISOString() },
      });
    });

    it('handles multiple operators on same field', () => {
      const filter = {
        price: { $gt: 100, $lt: 200 },
        quantity: { $gte: 10, $lte: 20 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles arrays of mixed types', () => {
      const filter = {
        field: { $in: [123, 'string', true] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles empty arrays in $in and $nin', () => {
      const filter = {
        field1: { $in: [] },
        field2: { $nin: [] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles deeply nested null values', () => {
      const filter = {
        user: {
          profile: {
            lastLogin: null,
            settings: { theme: { $eq: null } },
          },
        },
      };
      expect(translator.translate(filter)).toEqual({
        'user.profile.lastLogin': { $eq: null },
        'user.profile.settings.theme': { $eq: null },
      });
    });

    it('preserves order of multiple operators', () => {
      const filter = {
        field: {
          $gt: 0,
          $lt: 10,
        },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('preserves order of range operators', () => {
      // Valid range operator combinations
      const filters = [
        { field: { $gt: 0, $lt: 10 } },
        { field: { $gte: 0, $lte: 10 } },
        { field: { $gt: 0, $lte: 10 } },
        { field: { $gte: 0, $lt: 10 } },
      ];

      filters.forEach(filter => {
        expect(translator.translate(filter)).toEqual(filter);
      });
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
      ];
      supportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });
    it('throws error for unsupported operators', () => {
      const unsupportedFilters = [
        { field: { $regex: 'pattern' } },
        { field: { $exists: true } },
        { field: { $elemMatch: { $gt: 5 } } },
        { field: { $nor: [{ $eq: 'value' }] } },
        { field: { $not: [{ $eq: 'value' }] } },
        { field: { $regex: 'pattern', $options: 'i' } },
        { field: { $and: [{ $eq: 'value' }] } },
        { field: { $or: [{ $eq: 'value' }] } },
        { field: { $all: [{ $eq: 'value' }] } },
        { field: { $contains: 'value' } },
      ];

      unsupportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
      });
    });
    it('throws error for regex operators', () => {
      const filter = { field: /pattern/i };
      expect(() => translator.translate(filter)).toThrow();
    });
    it('throws error for non-logical operators at top level', () => {
      const invalidFilters = [{ $gt: 100 }, { $in: ['value1', 'value2'] }, { $eq: true }];

      invalidFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Invalid top-level operator/);
      });
    });
  });
});
