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
      expect(translator.translate(filter)).toEqual({
        field: { $eq: 'value' },
      });
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
      expect(translator.translate(filter)).toEqual({
        'user.profile.age': { $gt: 25 },
      });
    });

    it('handles arrays as $in operator', () => {
      const filter = { tags: ['tag1', 'tag2'] };
      expect(translator.translate(filter)).toEqual({
        tags: { $in: ['tag1', 'tag2'] },
      });
    });

    it.only('simulates $all using $and + $in', () => {
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
      expect(translator.translate(filter)).toEqual({
        timestamp: { $gt: date.toISOString() },
      });
    });

    it('throws error for unsupported $elemMatch', () => {
      const filter = {
        array: { $elemMatch: { field: 'value' } },
      };
      expect(() => translator.translate(filter)).toThrow();
    });
  });
});
