/**
 * Legacy API Tests for Observability Client
 * ==========================================
 *
 * These tests document the OLD API contract from the main branch.
 * They ensure backward compatibility for existing client implementations.
 *
 * Key differences from new API:
 * - `getTraces()` uses `TracesPaginatedArg` type with different structure
 * - `name` filter instead of `entityName`
 * - `dateRange` in pagination instead of `startedAt`/`endedAt` in filters
 * - Query params built manually instead of using `toQueryParams` utility
 *
 * These tests verify the expected URL query string format for the old API.
 */

import type { SpanType } from '@mastra/core/observability';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

describe('Legacy Observability API - Client Backward Compatibility', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockSuccessfulResponse = () => {
    const response = new Response(undefined, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });
    response.json = () => Promise.resolve({});
    (global.fetch as any).mockResolvedValueOnce(response);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  describe('Legacy getTraces() query parameter format', () => {
    /**
     * OLD: Empty params should work
     */
    it('should fetch traces without any parameters', async () => {
      mockSuccessfulResponse();

      await client.getTraces({});

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    /**
     * OLD: ?page=2&perPage=10
     */
    it('should fetch traces with pagination parameters', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        pagination: {
          page: 2,
          perPage: 10,
        },
      });

      // Should include page and perPage as query params
      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('perPage=10');
    });

    /**
     * OLD FORMAT: ?name=test-trace
     * This is the key backward compatibility test - the old API used "name" filter
     */
    it('should fetch traces with legacy "name" filter', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        filters: {
          name: 'test-trace',
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces?name=test-trace`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    /**
     * OLD: ?spanType=agent_run
     */
    it('should fetch traces with spanType filter', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        filters: {
          spanType: 'agent_run' as SpanType,
        },
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0] as string;
      expect(url).toContain('spanType=agent_run');
    });

    /**
     * OLD: ?entityId=entity-123&entityType=agent
     */
    it('should fetch traces with entity filters', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        filters: {
          entityId: 'entity-123',
          entityType: 'agent',
        },
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0] as string;
      expect(url).toContain('entityId=entity-123');
      expect(url).toContain('entityType=agent');
    });

    /**
     * OLD FORMAT: ?dateRange={"start":"2024-01-01T00:00:00.000Z","end":"2024-01-31T23:59:59.000Z"}
     * This is another key backward compatibility test - dateRange was in pagination, not filters
     */
    it('should fetch traces with legacy dateRange in pagination', async () => {
      mockSuccessfulResponse();

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      await client.getTraces({
        pagination: {
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0] as string;
      const expectedDateRange = JSON.stringify({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });
      expect(url).toContain(`dateRange=${encodeURIComponent(expectedDateRange)}`);
    });

    /**
     * OLD FORMAT: Combined legacy parameters
     * ?page=1&perPage=5&name=test-trace&spanType=agent_run&entityId=entity-123&entityType=agent&dateRange={...}
     */
    it('should fetch traces with all legacy filters combined', async () => {
      mockSuccessfulResponse();

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      await client.getTraces({
        pagination: {
          page: 1,
          perPage: 5,
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
        filters: {
          name: 'test-trace',
          spanType: 'agent_run' as SpanType,
          entityId: 'entity-123',
          entityType: 'agent',
        },
      });

      const expectedDateRange = JSON.stringify({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0] as string;
      expect(url).toContain('page=1');
      expect(url).toContain('perPage=5');
      expect(url).toContain('name=test-trace');
      expect(url).toContain('spanType=agent_run');
      expect(url).toContain('entityId=entity-123');
      expect(url).toContain('entityType=agent');
      expect(url).toContain(`dateRange=${encodeURIComponent(expectedDateRange)}`);
    });
  });

  describe('getTrace() - unchanged between versions', () => {
    it('should fetch a specific trace by ID', async () => {
      mockSuccessfulResponse();

      await client.getTrace('trace-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/observability/traces/trace-123'),
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getTrace('invalid-trace')).rejects.toThrow();
    });
  });

  describe('listScoresBySpan() - unchanged between versions', () => {
    it('should fetch scores by trace ID and span ID without pagination', async () => {
      mockSuccessfulResponse();

      await client.listScoresBySpan({
        traceId: 'trace-123',
        spanId: 'span-456',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/observability/traces/trace-123/span-456/scores'),
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch scores with pagination', async () => {
      mockSuccessfulResponse();

      await client.listScoresBySpan({
        traceId: 'trace-123',
        spanId: 'span-456',
        page: 2,
        perPage: 10,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('perPage=10');
    });

    it('should properly encode trace ID and span ID in URL', async () => {
      mockSuccessfulResponse();

      await client.listScoresBySpan({
        traceId: 'trace with spaces',
        spanId: 'span/with/slashes',
      });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('trace%20with%20spaces'), expect.any(Object));
    });
  });

  describe('score() - unchanged between versions', () => {
    it('should score traces with single target', async () => {
      mockSuccessfulResponse();

      await client.score({
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces/score`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            scorerName: 'test-scorer',
            targets: [{ traceId: 'trace-123' }],
          }),
        }),
      );
    });

    it('should score traces with multiple targets including span IDs', async () => {
      mockSuccessfulResponse();

      await client.score({
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }, { traceId: 'trace-456', spanId: 'span-789' }],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces/score`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            scorerName: 'test-scorer',
            targets: [{ traceId: 'trace-123' }, { traceId: 'trace-456', spanId: 'span-789' }],
          }),
        }),
      );
    });
  });
});
