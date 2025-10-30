import { describe, it, expect, beforeEach } from 'vitest';
import type { S3VectorsFilter } from './filter';
import { S3VectorsFilterTranslator } from './filter';

describe('S3VectorsFilterTranslator', () => {
  let translator: S3VectorsFilterTranslator;

  beforeEach(() => {
    translator = new S3VectorsFilterTranslator();
  });

  // Basic Filter Operations
  describe('basic operations', () => {
    it('handles simple equality with primitives (canonicalizes to explicit $and)', () => {
      const filter: S3VectorsFilter = { field: 'value', score: 42, active: true };
      expect(translator.translate(filter)).toEqual({
        $and: [{ field: 'value' }, { score: 42 }, { active: true }],
      });
    });

    it('handles comparison operators with numbers (canonicalizes to explicit $and)', () => {
      const filter: S3VectorsFilter = {
        age: { $gt: 25 },
        score: { $lte: 100 },
      };
      expect(translator.translate(filter)).toEqual({
        $and: [{ age: { $gt: 25 } }, { score: { $lte: 100 } }],
      });
    });

    it('handles valid multiple operators on same field (canonicalizes to explicit $and when multiple fields present)', () => {
      const filter: S3VectorsFilter = {
        price: { $gte: 10, $lte: 50 },
        quantity: { $gt: 0, $lt: 100 },
      };
      expect(translator.translate(filter)).toEqual({
        $and: [{ price: { $gte: 10, $lte: 50 } }, { quantity: { $gt: 0, $lt: 100 } }],
      });
    });

    it('rejects null/undefined equality', () => {
      expect(() => translator.translate({ field: null } as any)).toThrow(/does not support null\/undefined/i);
      expect(() => translator.translate({ other: undefined } as any)).toThrow(/does not support null\/undefined/i);
    });

    it('rejects non-number values for numeric comparisons', () => {
      expect(() => translator.translate({ age: { $gt: '25' as any } } as any)).toThrow(/must be a number/);
      expect(() => translator.translate({ age: { $lt: true as any } } as any)).toThrow(/must be a number/);
    });

    it('handles boolean values correctly (canonicalizes to explicit $and)', () => {
      const filter: S3VectorsFilter = {
        active: true,
        deleted: false,
        status: { $ne: false },
      };
      expect(translator.translate(filter)).toEqual({
        $and: [{ active: true }, { deleted: false }, { status: { $ne: false } }],
      });
    });

    it('rejects non-primitive equality (Date/Object/Array)', () => {
      expect(() => translator.translate({ createdAt: new Date() } as any)).toThrow(/Only string, number, or boolean/i);
      expect(() => translator.translate({ meta: { a: 1 } } as any)).toThrow();
      expect(() => translator.translate({ arr: ['a', 'b'] } as any)).toThrow(/Array equality is not supported/i);
    });

    it('normalizes -0 to 0 for equality', () => {
      const out = translator.translate({ x: -0 as any });
      expect(out).toEqual({ x: 0 });
    });
  });

  // Array Operations
  describe('array operations', () => {
    it('handles $in/$nin with primitive values (canonicalizes to explicit $and)', () => {
      const filter: S3VectorsFilter = {
        genre: { $in: ['comedy', 'documentary'] },
        flag: { $nin: [true] },
        code: { $in: [1, 2, 3] },
      };
      expect(translator.translate(filter)).toEqual({
        $and: [{ genre: { $in: ['comedy', 'documentary'] } }, { flag: { $nin: [true] } }, { code: { $in: [1, 2, 3] } }],
      });
    });

    it('rejects empty array values for $in/$nin', () => {
      expect(() => translator.translate({ tags: { $in: [] } } as any)).toThrow(/non-empty array/);
      expect(() => translator.translate({ categories: { $nin: [] } } as any)).toThrow(/non-empty array/);
    });

    it('rejects non-primitive elements in $in/$nin', () => {
      expect(() => translator.translate({ f: { $in: [1, { a: 1 } as any] } } as any)).toThrow(
        /string, number, or boolean/,
      );
      expect(() => translator.translate({ f: { $nin: [[1, 2] as any] } } as any)).toThrow(/string, number, or boolean/);
    });

    it('rejects direct array equality', () => {
      expect(() => translator.translate({ tags: ['a', 'b'] } as any)).toThrow(/Array equality is not supported/);
    });
  });

  // Logical Operators
  describe('logical operators', () => {
    it('handles $and/$or operators', () => {
      const filter: S3VectorsFilter = {
        $or: [{ status: 'active' }, { age: { $gt: 25 } }],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('canonicalizes implicit AND nested inside $or elements', () => {
      const filter: S3VectorsFilter = {
        $or: [
          { status: 'active', age: { $gt: 25 } }, // implicit AND
          { score: { $lte: 100 } },
        ],
      };
      expect(translator.translate(filter)).toEqual({
        $or: [
          {
            $and: [{ status: 'active' }, { age: { $gt: 25 } }],
          },
          { score: { $lte: 100 } },
        ],
      });
    });

    it('handles nested logical operators', () => {
      const filter: S3VectorsFilter = {
        $and: [
          { status: 'active' },
          {
            $or: [{ category: { $in: ['A', 'B'] } }, { $and: [{ price: { $gte: 100 } }, { stock: { $lte: 50 } }] }],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('rejects empty conditions in logical operators', () => {
      expect(() => translator.translate({ $and: [] } as any)).toThrow(/non-empty array/);
      expect(() => translator.translate({ $or: [] } as any)).toThrow(/non-empty array/);
    });

    it('throws error for direct operators in logical operator arrays', () => {
      expect(() =>
        translator.translate({
          $and: [{ $eq: 'value' }, { $gt: 100 }],
        } as any),
      ).toThrow(/Logical operators must contain field conditions/);

      expect(() =>
        translator.translate({
          $or: [{ $in: ['value1', 'value2'] }],
        } as any),
      ).toThrow(/Logical operators must contain field conditions/);
    });

    it('throws error for logical operators nested in non-logical contexts', () => {
      expect(() =>
        translator.translate({
          field: {
            $gt: {
              $or: [{ subfield: 'value1' }, { subfield: 'value2' }],
            },
          },
        } as any),
      ).toThrow();

      expect(() =>
        translator.translate({
          field: {
            $in: [
              {
                $and: [{ subfield: 'value1' }, { subfield: 'value2' }],
              } as any,
            ],
          },
        } as any),
      ).toThrow();
    });

    it('disallows unsupported logical operators $not/$nor', () => {
      expect(() => translator.translate({ $not: { field: 'value' } } as any)).toThrow('Unsupported operator: $not');
      expect(() => translator.translate({ $nor: [{ field: 'value' }] } as any)).toThrow('Unsupported operator: $nor');
    });

    it('allows multiple logical operators at root level', () => {
      expect(() =>
        translator.translate({
          $and: [{ field1: { $gt: 10 } }],
          $or: [{ field2: { $lt: 20 } }],
        }),
      ).not.toThrow();
    });

    it('allows logical operators at root level', () => {
      const validFilters: Array<S3VectorsFilter> = [{ $and: [{ field: 'value' }] }, { $or: [{ field: 'value' }] }];
      validFilters.forEach(f => expect(() => translator.translate(f)).not.toThrow());
    });
  });

  // Nested Objects and Fields
  describe('nested objects and fields', () => {
    it('handles dotted field paths (canonicalizes to explicit $and)', () => {
      const filter: S3VectorsFilter = {
        'user.profile.age': { $gt: 25 },
        'user.status': 'active',
      };
      expect(translator.translate(filter)).toEqual({
        $and: [{ 'user.profile.age': { $gt: 25 } }, { 'user.status': 'active' }],
      });
    });

    it('handles deeply dotted field paths (canonicalizes to explicit $and)', () => {
      const filter: S3VectorsFilter = {
        'user.profile.address.city': { $eq: 'New York' },
        'deep.nested.field': { $gt: 100 },
      };
      expect(translator.translate(filter)).toEqual({
        $and: [{ 'user.profile.address.city': { $eq: 'New York' } }, { 'deep.nested.field': { $gt: 100 } }],
      });
    });
  });

  // Special Cases
  describe('special cases', () => {
    it('handles empty filters', () => {
      expect(translator.translate({} as any)).toEqual({});
      expect(translator.translate(null as any)).toEqual(null);
      expect(translator.translate(undefined as any)).toEqual(undefined);
    });

    it('accepts Date values for numeric comparisons (normalized to epoch ms)', () => {
      const date = new Date('2024-01-01');
      const out = translator.translate({ timestamp: { $gt: date } } as any);
      expect(out).toEqual({ timestamp: { $gt: date.getTime() } });
    });

    it('validates $exists boolean type', () => {
      const ok: S3VectorsFilter = { field: { $exists: true } };
      expect(translator.translate(ok)).toEqual(ok);
      expect(() => translator.translate({ field: { $exists: 'true' as any } } as any)).toThrow(/must be a boolean/);
    });
  });

  describe('operator validation', () => {
    it('ensures all supported operator filters are accepted', () => {
      const supported: S3VectorsFilter[] = [
        // Basic comparison operators
        { field: { $eq: 'value' } },
        { field: { $ne: 'value' } },
        { field: { $gt: 1 } },
        { field: { $gte: 2 } },
        { field: { $lt: 3 } },
        { field: { $lte: 4 } },

        // Array operators
        { field: { $in: ['value'] } },
        { field: { $nin: [1, 2] } },

        // Existence
        { field: { $exists: true } },

        // Logical operators
        { $and: [{ field1: 'value1' }, { field2: { $gte: 10 } }] },
        { $or: [{ field1: { $ne: 'value1' } }, { field2: false }] },
      ];

      supported.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });

    it('throws on unsupported operators', () => {
      expect(() => translator.translate({ field: { $regex: '^a' } } as any)).toThrow('Unsupported operator: $regex');
      expect(() => translator.translate({ field: { $all: ['a'] } } as any)).toThrow('Unsupported operator: $all');
      expect(() => translator.translate({ field: { $elemMatch: { $gt: 5 } } } as any)).toThrow(
        'Unsupported operator: $elemMatch',
      );
      expect(() => translator.translate({ field: { $size: 1 } } as any)).toThrow('Unsupported operator: $size');
      expect(() => translator.translate({ $not: { field: 'value' } } as any)).toThrow('Unsupported operator: $not');
      expect(() => translator.translate({ $nor: [{ field: 'value' }] } as any)).toThrow('Unsupported operator: $nor');
    });

    it('throws error for non-logical operators at top level', () => {
      const invalid: any[] = [{ $gt: 100 }, { $in: ['value1', 'value2'] }, { $exists: true }];
      invalid.forEach(filter => {
        expect(() => translator.translate(filter as any)).toThrow(/Invalid top-level operator/);
      });
    });

    it('allows logical operators at top level', () => {
      const valid = [{ $and: [{ field: 'value' }] }, { $or: [{ field: 'value' }] }];
      valid.forEach(filter => {
        expect(() => translator.translate(filter as any)).not.toThrow();
      });
    });
  });
});
