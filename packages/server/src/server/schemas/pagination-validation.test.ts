import { describe, expect, it } from 'vitest';
import { createCombinedPaginationSchema, createPagePaginationSchema } from './common';
import { listThreadsQuerySchema } from './memory';

/**
 * Regression tests for GitHub Issue #21006
 *
 * `page` and `perPage` were `z.coerce.number()` with no integer or lower
 * bound, so negative, fractional and unsafe-integer values passed request
 * validation and reached storage. Storage rejects them by throwing a plain
 * `Error`, which carries no HTTP status, so `handleError` fell back to 500 —
 * reporting a malformed client request as a server fault.
 *
 * These values must be rejected at the schema, because the route framework
 * turns a query-schema `ZodError` into a 400 with field-level issues.
 */
describe('pagination query validation (#21006)', () => {
  const schema = createPagePaginationSchema(100);

  describe.each([
    ['negative page', { page: -1 }],
    ['fractional page', { page: 1.5 }],
    ['unsafe-integer page', { page: 1e20 }],
    ['negative perPage', { perPage: -5 }],
    ['fractional perPage', { perPage: 2.5 }],
  ])('rejects %s', (_label, query) => {
    it('at the page/perPage factory', () => {
      expect(schema.safeParse(query).success).toBe(false);
    });

    it('at the combined limit/offset factory', () => {
      expect(createCombinedPaginationSchema().safeParse(query).success).toBe(false);
    });
  });

  it('rejects the exact query from the report on the real route schema', () => {
    // GET /api/memory/threads?resourceId=test&page=-1 — query strings arrive as
    // strings, which is the form coercion was hiding the bad value behind.
    const result = listThreadsQuerySchema.safeParse({ resourceId: 'test', page: '-1' });

    expect(result.success).toBe(false);
    // Field-level, so the 400 body tells the client which parameter was wrong.
    expect(result.error!.issues.some(issue => issue.path.includes('page'))).toBe(true);
  });

  it('still rejects non-numeric values', () => {
    expect(schema.safeParse({ page: 'abc' }).success).toBe(false);
  });

  describe('values that must stay valid', () => {
    it('accepts perPage: 0 — the include-only storage fast path', () => {
      const result = schema.safeParse({ perPage: 0 });

      expect(result.success).toBe(true);
      expect(result.data!.perPage).toBe(0);
    });

    it('accepts page: 0 and ordinary pagination', () => {
      const result = schema.safeParse({ page: 2, perPage: 50 });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ page: 2, perPage: 50 });
    });

    it('coerces numeric strings, as query strings always deliver them', () => {
      const result = schema.safeParse({ page: '3', perPage: '25' });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ page: 3, perPage: 25 });
    });

    it('keeps defaults when the params are omitted', () => {
      const result = schema.safeParse({});

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ page: 0, perPage: 100 });
    });

    it('leaves combined-schema params undefined when omitted, so the limit/offset back-compat path still distinguishes absent from 0', () => {
      const result = createCombinedPaginationSchema().safeParse({});

      expect(result.success).toBe(true);
      expect(result.data!.page).toBeUndefined();
      expect(result.data!.perPage).toBeUndefined();
      expect(result.data!.limit).toBeUndefined();
      expect(result.data!.offset).toBeUndefined();
    });

    it('accepts valid limit/offset', () => {
      const result = createCombinedPaginationSchema().safeParse({ limit: 10, offset: 0 });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ limit: 10, offset: 0 });
    });
  });
});
