import { describe, it, expect } from 'vitest';
import { listMessagesQuerySchema, listThreadsQuerySchema } from './memory';

/**
 * Regression tests for GitHub Issue #11761
 *
 * When the client sends query parameters with JSON objects like `orderBy`,
 * they are URL-encoded as JSON strings (e.g., '{"field":"createdAt","direction":"ASC"}').
 *
 * The schema validation must be able to parse these JSON strings back into objects.
 * All object-type query parameters (`orderBy`, `include`, `filter`) use z.preprocess
 * to handle JSON string parsing from query strings.
 */
describe('Memory Schema Query Parameter Parsing', () => {
  describe('listMessagesQuerySchema', () => {
    describe('orderBy parameter parsing', () => {
      it('should parse orderBy when passed as an object', () => {
        const result = listMessagesQuerySchema.safeParse({
          page: 0,
          perPage: 50,
          orderBy: { field: 'createdAt', direction: 'ASC' },
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ field: 'createdAt', direction: 'ASC' });
        }
      });

      /**
       * Regression test: Ensures orderBy JSON strings from URL query params are parsed correctly.
       *
       * When the client sends a request like:
       * GET /api/memory/threads/xxx/messages?orderBy=%7B%22field%22%3A%22createdAt%22%2C%22direction%22%3A%22ASC%22%7D
       *
       * The `orderBy` value arrives at the server as a string: '{"field":"createdAt","direction":"ASC"}'
       * The schema must parse this JSON string back into an object.
       */
      it('should parse orderBy when passed as a JSON string (from URL query params)', () => {
        // This is what happens when the client sends orderBy as a query parameter
        // The value is JSON.stringify'd by the client, then URL-encoded
        const jsonString = JSON.stringify({ field: 'createdAt', direction: 'ASC' });

        const result = listMessagesQuerySchema.safeParse({
          page: 0,
          perPage: 50,
          orderBy: jsonString, // This is a string, not an object
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ field: 'createdAt', direction: 'ASC' });
        }
      });

      it('should handle orderBy with only field specified as JSON string', () => {
        const jsonString = JSON.stringify({ field: 'createdAt' });

        const result = listMessagesQuerySchema.safeParse({
          page: 0,
          perPage: 50,
          orderBy: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ field: 'createdAt' });
        }
      });

      it('should handle orderBy with only direction specified as JSON string', () => {
        const jsonString = JSON.stringify({ direction: 'DESC' });

        const result = listMessagesQuerySchema.safeParse({
          page: 0,
          perPage: 50,
          orderBy: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ direction: 'DESC' });
        }
      });
    });

    describe('include parameter parsing (reference - this already works)', () => {
      it('should parse include when passed as a JSON string', () => {
        const includeArray = [{ id: 'msg-1', withPreviousMessages: 5 }];
        const jsonString = JSON.stringify(includeArray);

        const result = listMessagesQuerySchema.safeParse({
          page: 0,
          perPage: 50,
          include: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.include).toEqual(includeArray);
        }
      });
    });

    describe('filter parameter parsing (reference - this already works)', () => {
      it('should parse filter when passed as a JSON string', () => {
        const filterObj = {
          dateRange: {
            start: '2024-01-01T00:00:00.000Z',
            end: '2024-12-31T23:59:59.999Z',
          },
        };
        const jsonString = JSON.stringify(filterObj);

        const result = listMessagesQuerySchema.safeParse({
          page: 0,
          perPage: 50,
          filter: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filter).toBeDefined();
          expect(result.data.filter?.dateRange).toBeDefined();
        }
      });
    });
  });

  describe('listThreadsQuerySchema', () => {
    describe('orderBy parameter parsing', () => {
      it('should parse orderBy when passed as an object', () => {
        const result = listThreadsQuerySchema.safeParse({
          resourceId: 'test-resource',
          page: 0,
          perPage: 100,
          orderBy: { field: 'updatedAt', direction: 'DESC' },
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ field: 'updatedAt', direction: 'DESC' });
        }
      });

      /**
       * Regression test: Same as listMessagesQuerySchema - orderBy JSON strings must be parsed.
       */
      it('should parse orderBy when passed as a JSON string (from URL query params)', () => {
        const jsonString = JSON.stringify({ field: 'updatedAt', direction: 'DESC' });

        const result = listThreadsQuerySchema.safeParse({
          resourceId: 'test-resource',
          page: 0,
          perPage: 100,
          orderBy: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ field: 'updatedAt', direction: 'DESC' });
        }
      });

      it('should handle createdAt field in orderBy as JSON string', () => {
        const jsonString = JSON.stringify({ field: 'createdAt', direction: 'ASC' });

        const result = listThreadsQuerySchema.safeParse({
          resourceId: 'test-resource',
          page: 0,
          perPage: 100,
          orderBy: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ field: 'createdAt', direction: 'ASC' });
        }
      });
    });
  });
});
