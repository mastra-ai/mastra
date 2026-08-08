import { describe, it, expect } from 'vitest';
import { createCombinedPaginationSchema, createPagePaginationSchema } from './common';

/**
 * Regression tests for GitHub Issue #21006
 *
 * `page` and `perPage` were declared as bare `z.coerce.number()`, which only
 * rejects values that coerce to `NaN`. Negative, fractional, and unsafe-integer
 * values therefore passed request validation and were rejected much later by the
 * storage layer, which throws a plain `Error`. `handleError` cannot derive a
 * status from a plain `Error`, so a malformed client request surfaced as a 500
 * instead of a 400.
 *
 * Rejecting them here keeps them a 400: the route framework turns a
 * query-schema `ZodError` into a 400 with field-level issues.
 */
describe('pagination query schemas', () => {
  describe('createPagePaginationSchema', () => {
    const schema = createPagePaginationSchema(100);

    it.each([
      ['negative page', { page: '-1' }],
      ['fractional page', { page: '1.5' }],
      ['page beyond the safe integer range', { page: '99999999999999999999' }],
      ['negative perPage', { perPage: '-5' }],
      ['fractional perPage', { perPage: '2.5' }],
      ['non-numeric page', { page: 'abc' }],
    ])('rejects %s', (_label, input) => {
      expect(schema.safeParse(input).success).toBe(false);
    });

    it('reports the offending field so the 400 body is actionable', () => {
      const result = schema.safeParse({ page: '-1' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['page']);
      }
    });

    it('still accepts perPage: 0, which storage uses as the include-only fast path', () => {
      const result = schema.safeParse({ perPage: '0' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.perPage).toBe(0);
      }
    });

    it('accepts valid coerced pagination', () => {
      const result = schema.safeParse({ page: '2', perPage: '25' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 2, perPage: 25 });
      }
    });

    it('keeps the existing defaults when the params are omitted', () => {
      const result = schema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 0, perPage: 100 });
      }
    });

    it('leaves perPage undefined when the factory is built without a default', () => {
      const result = createPagePaginationSchema().safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(0);
        expect(result.data.perPage).toBeUndefined();
      }
    });
  });

  describe('createCombinedPaginationSchema', () => {
    const schema = createCombinedPaginationSchema();

    it.each([
      ['negative page', { page: '-1' }],
      ['fractional perPage', { perPage: '2.5' }],
      ['negative offset', { offset: '-10' }],
      ['fractional limit', { limit: '1.5' }],
    ])('rejects %s', (_label, input) => {
      expect(schema.safeParse(input).success).toBe(false);
    });

    it('accepts the deprecated limit/offset pair', () => {
      const result = schema.safeParse({ limit: '10', offset: '20' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ limit: 10, offset: 20 });
      }
    });

    it('leaves every field optional', () => {
      const result = schema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });
  });
});
