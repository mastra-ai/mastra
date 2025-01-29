import { describe, it, expect, beforeEach } from 'vitest';

import { AstraFilterTranslator } from './';

describe('AstraFilterTranslator', () => {
  let translator: AstraFilterTranslator;

  beforeEach(() => {
    translator = new AstraFilterTranslator();
  });

  describe('translate', () => {
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

    it('throws error for invalid operator values', () => {
      const filter = { tags: { $all: 'not-an-array' } };
      expect(() => translator.translate(filter)).toThrow();
    });

    it('handles empty filters', () => {
      expect(translator.translate({})).toEqual({});
      expect(translator.translate(null as any)).toEqual({});
      expect(translator.translate(undefined as any)).toEqual({});
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
