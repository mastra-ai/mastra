import { describe, it, expect } from 'vitest';
import { normalizeQueryParams } from '../server-adapter/index';
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
describe('Memory Schema Query Parsing', () => {
  describe('listMessagesQuerySchema', () => {
    it('should allow omitted optional query params', () => {
      const result = listMessagesQuerySchema.safeParse({
        page: 0,
        perPage: 20,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderBy).toBeUndefined();
        expect(result.data.include).toBeUndefined();
        expect(result.data.filter).toBeUndefined();
        expect(result.data.includeSystemReminders).toBeUndefined();
      }
    });

    describe('orderBy parameter parsing', () => {
      it('should parse orderBy when passed as an object', () => {
        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          page: 0,
          perPage: 100,
          orderBy: { field: 'createdAt', direction: 'ASC' },
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ field: 'createdAt', direction: 'ASC' });
        }
      });

      /**
       * Regression test for #11761: orderBy was failing when passed as a JSON string from URL query params.
       *
       * Example URL: /memory/threads/abc/messages?orderBy={"field":"createdAt","direction":"ASC"}
       */
      it('should parse orderBy when passed as a JSON string (from URL query params)', () => {
        const jsonString = JSON.stringify({ field: 'createdAt', direction: 'ASC' });

        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          page: 0,
          perPage: 100,
          orderBy: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ field: 'createdAt', direction: 'ASC' });
        }
      });

      it('should handle createdAt field in orderBy as JSON string (messages only support createdAt)', () => {
        const jsonString = JSON.stringify({ field: 'createdAt', direction: 'DESC' });

        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          page: 0,
          perPage: 100,
          orderBy: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.orderBy).toEqual({ field: 'createdAt', direction: 'DESC' });
        }
      });
    });

    describe('include parameter parsing', () => {
      it('should parse include when passed as an array of objects', () => {
        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          page: 0,
          perPage: 100,
          include: [
            { id: 'msg-1', withPreviousMessages: 5 },
            { id: 'msg-2', withNextMessages: 3 },
          ],
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.include).toEqual([
            { id: 'msg-1', withPreviousMessages: 5 },
            { id: 'msg-2', withNextMessages: 3 },
          ]);
        }
      });

      /**
       * Regression test for #11761: include was failing when passed as a JSON string from URL query params.
       *
       * Example URL: /memory/threads/abc/messages?include=[{"role":"user","withPreviousMessages":5}]
       */
      it('should parse include when passed as a JSON string (from URL query params)', () => {
        const jsonString = JSON.stringify([
          { id: 'msg-1', withPreviousMessages: 5 },
          { id: 'msg-2', withNextMessages: 3 },
        ]);

        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          page: 0,
          perPage: 100,
          include: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.include).toEqual([
            { id: 'msg-1', withPreviousMessages: 5 },
            { id: 'msg-2', withNextMessages: 3 },
          ]);
        }
      });
    });

    describe('filter parameter parsing', () => {
      it('should parse filter when passed as an object', () => {
        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          page: 0,
          perPage: 100,
          filter: { roles: ['user', 'assistant'] },
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filter).toEqual({ roles: ['user', 'assistant'] });
        }
      });

      /**
       * Regression test for #11761: filter was failing when passed as a JSON string from URL query params.
       *
       * Example URL: /memory/threads/abc/messages?filter={"roles":["user","assistant"]}
       */
      it('should parse filter when passed as a JSON string (from URL query params)', () => {
        const jsonString = JSON.stringify({ roles: ['user', 'assistant'] });

        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          page: 0,
          perPage: 100,
          filter: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filter).toEqual({ roles: ['user', 'assistant'] });
        }
      });

      it('should reject malformed JSON in include parameter', () => {
        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          resourceId: 'test-resource',
          page: 0,
          perPage: 10,
          include: '{invalid}',
        });

        expect(result.success).toBe(false);
      });

      it('should reject incomplete JSON in include parameter', () => {
        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          resourceId: 'test-resource',
          page: 0,
          perPage: 10,
          include: '[incomplete',
        });

        expect(result.success).toBe(false);
      });

      it('should reject empty string in include parameter', () => {
        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          resourceId: 'test-resource',
          page: 0,
          perPage: 10,
          include: '',
        });

        expect(result.success).toBe(false);
      });

      it('should reject malformed JSON in filter parameter', () => {
        const result = listMessagesQuerySchema.safeParse({
          threadId: 'test-thread',
          resourceId: 'test-resource',
          page: 0,
          perPage: 10,
          filter: '{"dateRange":invalid}',
        });

        expect(result.success).toBe(false);
      });

      it('should parse filter with endExclusive flag for cursor pagination', () => {
        const filterObj = {
          dateRange: {
            end: '2024-03-09T13:10:42.748Z',
            endExclusive: true,
          },
        };
        const jsonString = JSON.stringify(filterObj);

        const result = listMessagesQuerySchema.safeParse({
          page: 0,
          perPage: 20,
          filter: jsonString,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filter).toBeDefined();
          expect(result.data.filter?.dateRange).toBeDefined();
          expect(result.data.filter?.dateRange?.endExclusive).toBe(true);
        }
      });

      it('should parse filter with both startExclusive and endExclusive flags', () => {
        const filterObj = {
          dateRange: {
            start: '2024-01-01T00:00:00.000Z',
            end: '2024-12-31T23:59:59.999Z',
            startExclusive: true,
            endExclusive: true,
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
          expect(result.data.filter?.dateRange?.startExclusive).toBe(true);
          expect(result.data.filter?.dateRange?.endExclusive).toBe(true);
        }
      });
    });
  });

  describe('listThreadsQuerySchema', () => {
    it('should allow omitted optional query params', () => {
      const result = listThreadsQuerySchema.safeParse({
        page: 0,
        perPage: 100,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toBeUndefined();
        expect(result.data.orderBy).toBeUndefined();
      }
    });

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

    describe('optional resourceId parameter', () => {
      it('should allow listing all threads without resourceId filter', () => {
        const result = listThreadsQuerySchema.safeParse({
          page: 0,
          perPage: 100,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.resourceId).toBeUndefined();
        }
      });

      it('should accept resourceId when provided', () => {
        const result = listThreadsQuerySchema.safeParse({
          resourceId: 'test-resource',
          page: 0,
          perPage: 100,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.resourceId).toBe('test-resource');
        }
      });
    });

    describe('metadata parameter parsing', () => {
      it('should parse metadata when passed as an object', () => {
        const result = listThreadsQuerySchema.safeParse({
          metadata: { category: 'support', priority: 'high' },
          page: 0,
          perPage: 100,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.metadata).toEqual({ category: 'support', priority: 'high' });
        }
      });

      it('should parse metadata when passed as a JSON string (from URL query params)', () => {
        const jsonString = JSON.stringify({ category: 'support', priority: 'high' });

        const result = listThreadsQuerySchema.safeParse({
          metadata: jsonString,
          page: 0,
          perPage: 100,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.metadata).toEqual({ category: 'support', priority: 'high' });
        }
      });

      it('should allow combining resourceId with metadata filter', () => {
        const result = listThreadsQuerySchema.safeParse({
          resourceId: 'user-123',
          metadata: { status: 'active' },
          page: 0,
          perPage: 100,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.resourceId).toBe('user-123');
          expect(result.data.metadata).toEqual({ status: 'active' });
        }
      });
    });

    describe('metadata parameter parsing (negative cases)', () => {
      it('should reject malformed JSON in metadata parameter', () => {
        const result = listThreadsQuerySchema.safeParse({
          page: 0,
          perPage: 100,
          metadata: '{invalid}',
        });

        expect(result.success).toBe(false);
      });

      it('should reject incomplete JSON in metadata parameter', () => {
        const result = listThreadsQuerySchema.safeParse({
          page: 0,
          perPage: 100,
          metadata: '{"key":incomplete',
        });

        expect(result.success).toBe(false);
      });

      it('should reject empty string in metadata parameter', () => {
        const result = listThreadsQuerySchema.safeParse({
          page: 0,
          perPage: 100,
          metadata: '',
        });

        expect(result.success).toBe(false);
      });
    });
  });

  /**
   * Regression tests for GitHub Issue #12816
   *
   * When users send sort direction parameters via common REST API patterns
   * (bracket notation or flat params), the orderBy should be correctly parsed.
   * Currently, bracket notation like `orderBy[field]=createdAt&orderBy[direction]=DESC`
   * is silently dropped because normalizeQueryParams doesn't reconstruct nested objects.
   */
  describe('Issue #12816: Sort direction parameters', () => {
    describe('normalizeQueryParams should handle bracket notation for orderBy', () => {
      it('should reconstruct nested object from bracket notation query params', () => {
        // Simulates what Hono's request.queries() returns for:
        // ?orderBy[field]=createdAt&orderBy[direction]=DESC
        // Hono returns bracket-notation keys as flat entries
        const honoQueries: Record<string, string[]> = {
          page: ['0'],
          perPage: ['10'],
          'orderBy[field]': ['createdAt'],
          'orderBy[direction]': ['DESC'],
        };

        const normalized = normalizeQueryParams(honoQueries);

        // After normalization, we need orderBy to be parseable by the schema.
        // Currently this produces { "orderBy[field]": "createdAt", "orderBy[direction]": "DESC" }
        // which means the schema never sees an "orderBy" key at all.
        const result = listMessagesQuerySchema.safeParse(normalized);

        expect(result.success).toBe(true);
        if (result.success) {
          // This is the key assertion: orderBy should contain the direction
          expect(result.data.orderBy).toEqual({ field: 'createdAt', direction: 'DESC' });
        }
      });
    });
  });

  /**
   * Regression tests for the 1.31.0 / 1.31.1 follow-up to PR #15969.
   *
   * PR #15969 changed `z.preprocess(fn, inner.optional())` to
   * `z.preprocess(fn, inner).optional()` to fix omitted-key validation under
   * Zod 4.4.0+. That fix worked for omitted params, but it broke clients that
   * pass non-JSON "bare-string" query values (e.g. `?orderBy=updatedAt`,
   * which the JSON.parse preprocess collapses to undefined). The outer
   * `.optional()` no longer triggers when the input is a defined string, so
   * the inner object schema then receives `undefined` and fails with
   * `expected object, received undefined`.
   *
   * The correct fix keeps optionality both inside and outside the preprocess:
   * `z.preprocess(fn, inner.optional()).optional()`. Bare-string values
   * silently resolve to `undefined`, matching the pre-1.31.0 behavior, while
   * omitted keys and valid JSON values continue to work.
   */
  describe('bare-string query params (post-#15969 regression)', () => {
    it('listThreadsQuerySchema should accept ?orderBy=updatedAt&sortDirection=DESC bare-string params', () => {
      const result = listThreadsQuerySchema.safeParse({
        orderBy: 'updatedAt',
        sortDirection: 'DESC',
        page: '0',
        perPage: '100',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Bare-string orderBy isn't a JSON object, so it silently resolves to undefined
        // (matching pre-1.31.0 behavior). The handler's storage fallback handles ordering.
        expect(result.data.orderBy).toBeUndefined();
      }
    });

    it('listMessagesQuerySchema should accept bare-string orderBy without throwing', () => {
      const result = listMessagesQuerySchema.safeParse({
        orderBy: 'createdAt',
        sortDirection: 'DESC',
        page: '0',
        perPage: '40',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderBy).toBeUndefined();
      }
    });

    it('listThreadsQuerySchema should still reject malformed JSON in metadata', () => {
      // metadata's preprocess intentionally returns the original string on parse
      // failure so that bad JSON surfaces a clear validation error to the client.
      const result = listThreadsQuerySchema.safeParse({
        metadata: '{not-json',
        page: '0',
        perPage: '100',
      });

      expect(result.success).toBe(false);
    });

    it('listMessagesQuerySchema should still reject malformed JSON in include', () => {
      const result = listMessagesQuerySchema.safeParse({
        include: '[not-json',
        page: '0',
        perPage: '40',
      });

      expect(result.success).toBe(false);
    });
  });
});
