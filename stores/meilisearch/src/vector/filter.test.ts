import { describe, expect, it } from 'vitest';
import { MeilisearchFilterTranslator, MEILISEARCH_MATCH_NONE } from './filter';

const translate = (filter: any) => new MeilisearchFilterTranslator().translate(filter);

describe('MeilisearchFilterTranslator', () => {
  describe('empty / no-op filters', () => {
    it('returns undefined for empty/nullish filters', () => {
      expect(translate(undefined)).toBeUndefined();
      expect(translate(null)).toBeUndefined();
      expect(translate({})).toBeUndefined();
    });

    it('treats empty $and as match-all and empty $or as match-none', () => {
      expect(translate({ $and: [] })).toBeUndefined();
      expect(translate({ $or: [] })).toBe(MEILISEARCH_MATCH_NONE);
    });

    it('treats empty $nor as match-all', () => {
      expect(translate({ $nor: [] })).toBeUndefined();
    });
  });

  describe('equality', () => {
    it('prefixes fields with metadata. and quotes strings', () => {
      expect(translate({ category: 'electronics' })).toBe('metadata.category = "electronics"');
    });

    it('does not double-prefix metadata. fields', () => {
      expect(translate({ 'metadata.thread_id': 't1' })).toBe('metadata.thread_id = "t1"');
    });

    it('formats numbers and booleans without quotes', () => {
      expect(translate({ price: 10 })).toBe('metadata.price = 10');
      expect(translate({ available: true })).toBe('metadata.available = true');
    });

    it('maps null equality to IS NULL', () => {
      expect(translate({ price: { $eq: null } })).toBe('metadata.price IS NULL');
      expect(translate({ price: { $ne: null } })).toBe('metadata.price IS NOT NULL');
    });
  });

  describe('comparison', () => {
    it('maps numeric operators', () => {
      expect(translate({ price: { $gt: 50 } })).toBe('metadata.price > 50');
      expect(translate({ price: { $gte: 50 } })).toBe('metadata.price >= 50');
      expect(translate({ price: { $lt: 50 } })).toBe('metadata.price < 50');
      expect(translate({ price: { $lte: 50 } })).toBe('metadata.price <= 50');
    });

    it('combines a range into AND', () => {
      expect(translate({ price: { $gte: 20, $lte: 80 } })).toBe('(metadata.price >= 20) AND (metadata.price <= 80)');
    });

    it('throws for non-scalar comparison values', () => {
      expect(() => translate({ price: { $gt: [10, 20] } })).toThrow();
    });
  });

  describe('arrays', () => {
    it('maps $in and $nin', () => {
      expect(translate({ category: { $in: ['a', 'b'] } })).toBe('metadata.category IN ["a", "b"]');
      expect(translate({ category: { $nin: ['a', 'b'] } })).toBe('NOT (metadata.category IN ["a", "b"])');
    });

    it('simulates $all via AND of equalities', () => {
      expect(translate({ tags: { $all: ['premium', 'sale'] } })).toBe(
        '(metadata.tags = "premium") AND (metadata.tags = "sale")',
      );
    });

    it('empty $in -> match-none, empty $nin -> match-all', () => {
      expect(translate({ category: { $in: [] } })).toBe(MEILISEARCH_MATCH_NONE);
      expect(translate({ category: { $nin: [] } })).toBeUndefined();
    });
  });

  describe('existence', () => {
    it('maps $exists', () => {
      expect(translate({ description: { $exists: true } })).toBe('metadata.description EXISTS');
      expect(translate({ description: { $exists: false } })).toBe('NOT (metadata.description EXISTS)');
    });
  });

  describe('logical', () => {
    it('maps $and / $or', () => {
      expect(translate({ $and: [{ category: 'a' }, { price: { $gt: 1 } }] })).toBe(
        '(metadata.category = "a") AND (metadata.price > 1)',
      );
      expect(translate({ $or: [{ category: 'a' }, { category: 'b' }] })).toBe(
        '(metadata.category = "a") OR (metadata.category = "b")',
      );
    });

    it('maps implicit AND over multiple fields', () => {
      expect(translate({ category: 'a', price: { $gte: 5 } })).toBe(
        '(metadata.category = "a") AND (metadata.price >= 5)',
      );
    });

    it('maps top-level $not and $nor', () => {
      expect(translate({ $not: { category: 'a' } })).toBe('NOT (metadata.category = "a")');
      expect(translate({ $nor: [{ category: 'a' }, { category: 'b' }] })).toBe(
        'NOT ((metadata.category = "a") OR (metadata.category = "b"))',
      );
    });

    it('maps field-level $not with nested operators (double negation), guarded by EXISTS', () => {
      // A bare NOT(...) in Meilisearch also matches documents missing the field
      // (the inner predicate is false for them). Negating a positive predicate
      // should only match documents that have the field, so we AND in EXISTS.
      expect(translate({ category: { $not: { $ne: 'electronics' } } })).toBe(
        '(metadata.category EXISTS) AND (NOT (metadata.category != "electronics"))',
      );
      expect(translate({ price: { $not: { $gt: 50 } } })).toBe(
        '(metadata.price EXISTS) AND (NOT (metadata.price > 50))',
      );
    });

    it('does not add an EXISTS guard when $not wraps $exists', () => {
      // Guarding existence-negation with EXISTS would be self-contradictory.
      expect(translate({ description: { $not: { $exists: true } } })).toBe('NOT (metadata.description EXISTS)');
    });
  });

  describe('validation', () => {
    it('rejects unsupported operators', () => {
      expect(() => translate({ value: { $invalidOperator: 10 } })).toThrow(/unsupported|invalid|unknown/i);
    });

    it('rejects regex (unsupported by Meilisearch)', () => {
      expect(() => translate({ name: { $regex: '^Product' } })).toThrow();
    });
  });
});
