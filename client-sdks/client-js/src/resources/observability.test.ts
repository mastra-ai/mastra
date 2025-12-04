import type { SpanType } from '@mastra/core/observability';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

describe('Observability Methods', () => {
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

  describe('getTrace()', () => {
    it('should fetch a specific trace by ID', async () => {
      mockSuccessfulResponse();

      await client.getTrace('trace-123');

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces/trace-123`,
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

  describe('getTraces()', () => {
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

    it('should fetch traces with pagination parameters', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        pagination: {
          page: 2,
          perPage: 10,
        },
      });

      // page and perPage are simple scalars at root level
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces?page=2&perPage=10`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch traces with spanType filter', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        filters: {
          spanType: 'agent_run' as SpanType,
        },
      });

      // Flattened: spanType at root level (not nested under filters)
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces?spanType=agent_run`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch traces with entity filters', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        filters: {
          entityId: 'entity-123',
          entityType: 'agent',
        },
      });

      // Flattened: entityId and entityType at root level
      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain('/api/observability/traces?');
      expect(url).toContain('entityId=entity-123');
      expect(url).toContain('entityType=agent');
    });

    it('should fetch traces with startedAt date range filter using Date objects', async () => {
      mockSuccessfulResponse();

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      await client.getTraces({
        filters: {
          startedAt: {
            start: startDate,
            end: endDate,
          },
        },
      });

      // Nested: startedAt uses bracket notation (startedAt[start]=...)
      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain('/api/observability/traces?');
      expect(url).toContain('startedAt%5Bstart%5D=');
      expect(url).toContain('startedAt%5Bend%5D=');
    });

    it('should fetch traces with endedAt date range filter', async () => {
      mockSuccessfulResponse();

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      await client.getTraces({
        filters: {
          endedAt: {
            start: startDate,
            end: endDate,
          },
        },
      });

      // Nested: endedAt uses bracket notation (endedAt[start]=...)
      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain('/api/observability/traces?');
      expect(url).toContain('endedAt%5Bstart%5D=');
      expect(url).toContain('endedAt%5Bend%5D=');
    });

    it('should fetch traces with partial startedAt filter', async () => {
      mockSuccessfulResponse();

      const startDate = new Date('2024-01-01T00:00:00Z');

      await client.getTraces({
        filters: {
          startedAt: {
            start: startDate,
          },
        },
      });

      // Nested: only start date in bracket notation
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/observability\/traces\?startedAt%5Bstart%5D=/),
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch traces with orderBy parameter', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        orderBy: {
          field: 'startedAt',
          direction: 'DESC',
        },
      });

      // Nested: orderBy uses bracket notation
      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain('/api/observability/traces?');
      expect(url).toContain('orderBy%5Bfield%5D=startedAt');
      expect(url).toContain('orderBy%5Bdirection%5D=DESC');
    });

    it('should fetch traces with all filters combined', async () => {
      mockSuccessfulResponse();

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      await client.getTraces({
        pagination: {
          page: 1,
          perPage: 5,
        },
        filters: {
          spanType: 'agent_run' as SpanType,
          entityId: 'entity-123',
          entityType: 'agent',
          startedAt: {
            start: startDate,
            end: endDate,
          },
        },
        orderBy: {
          field: 'startedAt',
          direction: 'DESC',
        },
      });

      // Flattened format: scalars at root, nested objects use brackets
      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain('/api/observability/traces?');
      // Pagination - simple scalars
      expect(url).toContain('page=1');
      expect(url).toContain('perPage=5');
      // Simple filters - at root level (flattened)
      expect(url).toContain('spanType=agent_run');
      expect(url).toContain('entityId=entity-123');
      expect(url).toContain('entityType=agent');
      // Nested filters - bracket notation
      expect(url).toContain('startedAt%5Bstart%5D=');
      expect(url).toContain('startedAt%5Bend%5D=');
      // orderBy - bracket notation
      expect(url).toContain('orderBy%5Bfield%5D=startedAt');
      expect(url).toContain('orderBy%5Bdirection%5D=DESC');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getTraces({})).rejects.toThrow();
    });
  });

  describe('listScoresBySpan()', () => {
    it('should fetch scores by trace ID and span ID without pagination', async () => {
      mockSuccessfulResponse();

      await client.listScoresBySpan({
        traceId: 'trace-123',
        spanId: 'span-456',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces/trace-123/span-456/scores`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch scores by trace ID and span ID with pagination', async () => {
      mockSuccessfulResponse();

      await client.listScoresBySpan({
        traceId: 'trace-123',
        spanId: 'span-456',
        page: 2,
        perPage: 10,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces/trace-123/span-456/scores?page=2&perPage=10`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should properly encode trace ID and span ID in URL', async () => {
      mockSuccessfulResponse();

      await client.listScoresBySpan({
        traceId: 'trace with spaces',
        spanId: 'span/with/slashes',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces/trace%20with%20spaces/span%2Fwith%2Fslashes/scores`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.listScoresBySpan({
          traceId: 'invalid-trace',
          spanId: 'invalid-span',
        }),
      ).rejects.toThrow();
    });
  });

  describe('score()', () => {
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
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
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
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify({
            scorerName: 'test-scorer',
            targets: [{ traceId: 'trace-123' }, { traceId: 'trace-456', spanId: 'span-789' }],
          }),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.score({
          scorerName: 'invalid-scorer',
          targets: [{ traceId: 'trace-123' }],
        }),
      ).rejects.toThrow();
    });
  });
});
