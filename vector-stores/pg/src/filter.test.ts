import { describe, expect, it } from 'vitest';

import { PGFilterTranslator } from './filter';

describe('PGFilterTranslator', () => {
  const translator = new PGFilterTranslator();

  describe('translate', () => {
    it('handles empty filter', () => {
      expect(translator.translate({})).toEqual({});
    });

    it('translates primitive to $eq', () => {
      expect(translator.translate({ field: 'value' })).toEqual({
        field: { $eq: 'value' },
      });
    });

    it('translates array to $in', () => {
      expect(translator.translate({ field: ['a', 'b'] })).toEqual({
        field: { $in: ['a', 'b'] },
      });
    });

    it('preserves comparison operators', () => {
      const filter = {
        field1: { $eq: 'value' },
        field2: { $ne: 'value' },
        field3: { $gt: 5 },
        field4: { $gte: 5 },
        field5: { $lt: 5 },
        field6: { $lte: 5 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('translates regex to like/ilike', () => {
      expect(
        translator.translate({
          field1: { $regex: 'pattern' },
          field2: { $regex: { pattern: 'pattern', options: 'i' } },
        }),
      ).toEqual({
        field1: { $like: 'pattern' },
        field2: { $ilike: 'pattern' },
      });
    });

    it('handles nested paths', () => {
      expect(
        translator.translate({
          'nested.field': { $eq: 'value' },
        }),
      ).toEqual({
        'nested.field': { $eq: 'value' },
      });
    });

    it('handles logical operators', () => {
      const filter = {
        $and: [{ field1: { $eq: 'value1' } }, { field2: { $eq: 'value2' } }],
        $or: [{ field3: { $eq: 'value3' } }, { field4: { $eq: 'value4' } }],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles empty logical operators', () => {
      expect(
        translator.translate({
          $and: [],
          $or: [],
        }),
      ).toEqual({
        $and: [],
        $or: [],
      });
    });

    it('handles nested objects', () => {
      expect(
        translator.translate({
          nested: {
            field: 'value',
          },
        }),
      ).toEqual({
        'nested.field': { $eq: 'value' },
      });
    });
  });
});
