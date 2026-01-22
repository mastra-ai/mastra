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
describe('Memory Schema Query Parsing', () => {
  describe('listMessagesQuerySchema', () => {
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
});
