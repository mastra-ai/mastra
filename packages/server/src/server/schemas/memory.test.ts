import { describe, it, expect } from 'vitest';
import { normalizeQueryParams } from '../server-adapter/index';
import { awaitBufferStatusResponseSchema, listMessagesQuerySchema, listThreadsQuerySchema } from './memory';

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
   * Regression tests for legacy bare-string `orderBy` query parameters used by
   * `@mastra/client-js` < 1.18 (e.g. mobile clients pinned to 1.4.x).
   *
   * Prior to v1.31.0 (PR #15969) the inner object of the `orderBy` preprocess
   * was `.optional()`, so the legacy shape was silently coerced to "no
   * ordering". #15969 moved the `.optional()` outside the preprocess, which
   * regressed those callers into a hard 400 with
   * `expected object, received undefined`.
   *
   * The fix is two-part:
   *   1. Restore `inner.optional()` so non-JSON `orderBy` values don't trip
   *      Zod's invalid_type.
   *   2. Add a back-compat preprocess on `listThreadsQuerySchema` that fuses
   *      `?orderBy=<field>&sortDirection=<dir>` into the current
   *      `{ orderBy: { field, direction } }` shape, so legacy clients keep
   *      their ordering intent instead of silently losing it.
   */
  describe('Legacy bare-string orderBy compatibility (client-js < 1.18)', () => {
    it('listThreadsQuerySchema fuses bare-string orderBy + sortDirection into the object shape', () => {
      // Exact regression report: ?orderBy=updatedAt&sortDirection=DESC.
      const result = listThreadsQuerySchema.safeParse({
        page: 0,
        perPage: 100,
        orderBy: 'updatedAt',
        sortDirection: 'DESC',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderBy).toEqual({ field: 'updatedAt', direction: 'DESC' });
      }
    });

    it('listThreadsQuerySchema accepts bare-string orderBy without sortDirection', () => {
      const result = listThreadsQuerySchema.safeParse({
        page: 0,
        perPage: 100,
        orderBy: 'createdAt',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderBy).toEqual({ field: 'createdAt' });
      }
    });

    it('listThreadsQuerySchema drops the legacy sortDirection key from the parsed output', () => {
      const result = listThreadsQuerySchema.safeParse({
        page: 0,
        perPage: 100,
        orderBy: 'updatedAt',
        sortDirection: 'ASC',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('sortDirection');
      }
    });

    it('listThreadsQuerySchema still accepts the current JSON-stringified orderBy shape', () => {
      const result = listThreadsQuerySchema.safeParse({
        page: 0,
        perPage: 100,
        orderBy: JSON.stringify({ field: 'updatedAt', direction: 'DESC' }),
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderBy).toEqual({ field: 'updatedAt', direction: 'DESC' });
      }
    });

    it('listThreadsQuerySchema still accepts the current object orderBy shape (post bracket-notation reconstruction)', () => {
      const result = listThreadsQuerySchema.safeParse({
        page: 0,
        perPage: 100,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderBy).toEqual({ field: 'updatedAt', direction: 'DESC' });
      }
    });

    it('listMessagesQuerySchema accepts a bare-string orderBy (treated as no ordering)', () => {
      // listMessagesQuerySchema has no legacy compat shim because client-js < 1.18
      // already JSON.stringify'd orderBy for messages. Bare strings just fall
      // through to "no ordering" so we don't 400 unexpected callers.
      const result = listMessagesQuerySchema.safeParse({
        page: 0,
        perPage: 40,
        orderBy: 'createdAt',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderBy).toBeUndefined();
      }
    });

    it('listThreadsQuerySchema still rejects a JSON-object orderBy with an unknown field', () => {
      const result = listThreadsQuerySchema.safeParse({
        page: 0,
        perPage: 100,
        orderBy: JSON.stringify({ field: 'bogus', direction: 'DESC' }),
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('Observational Memory buffer status schema', () => {
  it('preserves buffered observation chunks with extraction fields', () => {
    const result = awaitBufferStatusResponseSchema.safeParse({
      record: {
        id: 'record-1',
        scope: 'thread',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        activeObservations: '',
        bufferedObservations: '',
        bufferedObservationChunks: [
          {
            id: 'chunk-1',
            cycleId: 'cycle-1',
            observations: 'observed facts',
            tokenCount: 12,
            messageIds: ['message-1'],
            messageTokens: 20,
            suggestedContinuation: 'continue',
            currentTask: 'task',
            threadTitle: 'title',
            extractedValues: { priority: 'high' },
            extractionFailures: [{ slug: 'status', error: 'missing value' }],
          },
        ],
        originType: 'observation',
        generationCount: 1,
        totalTokensObserved: 20,
        observationTokenCount: 12,
        pendingMessageTokens: 0,
        isObserving: false,
        isReflecting: false,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.record?.bufferedObservationChunks?.[0]?.extractedValues).toEqual({ priority: 'high' });
      expect(result.data.record?.bufferedObservationChunks?.[0]?.extractionFailures).toEqual([
        { slug: 'status', error: 'missing value' },
      ]);
    }
  });
});
