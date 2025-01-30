import { describe, it, expect, beforeEach } from 'vitest';

import { VectorizeFilterTranslator } from './filter';

describe('VectorizeFilterTranslator', () => {
  let translator: VectorizeFilterTranslator;

  beforeEach(() => {
    translator = new VectorizeFilterTranslator();
  });

  describe('translate', () => {
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

    // Error cases
    it('throws error for unsupported operators', () => {
      const unsupportedFilters = [
        { field: { $regex: 'pattern' } },
        { field: { $exists: true } },
        { field: { $elemMatch: { $gt: 5 } } },
      ];

      unsupportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
      });
    });

    it('validates value types', () => {
      const invalidFilters = [
        { field: { $gt: 'not a number' } },
        { field: { $lt: true } },
        { field: { $in: 'not an array' } },
      ];

      invalidFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow();
      });
    });
  });
});
