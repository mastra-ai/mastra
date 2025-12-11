import { SpanType, EntityType } from '@mastra/core/observability';
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

    it('should URL-encode trace IDs with special characters', async () => {
      mockSuccessfulResponse();

      await client.getTrace('trace/with/slashes');

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces/trace%2Fwith%2Fslashes`,
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

  /**
   * Legacy getTraces() API tests
   * Uses the old parameter structure for backward compatibility:
   * - pagination: { page, perPage, dateRange }
   * - filters: { name, spanType, entityId, entityType }
   * @deprecated Use listTraces() for new code
   */
  describe('getTraces() - Legacy API', () => {
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
          spanType: SpanType.AGENT_RUN,
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('spanType=agent_run');
    });

    it('should fetch traces with entity filters', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        filters: {
          entityId: 'entity-123',
          entityType: 'agent',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('entityId=entity-123');
      expect(url).toContain('entityType=agent');
    });

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

      const expectedDateRange = JSON.stringify({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain(`dateRange=${encodeURIComponent(expectedDateRange)}`);
    });

    it('should fetch traces with all legacy parameters combined', async () => {
      mockSuccessfulResponse();

      const startDate = new Date('2024-01-01T00:00:00Z');

      await client.getTraces({
        pagination: {
          page: 1,
          perPage: 5,
          dateRange: { start: startDate },
        },
        filters: {
          spanType: SpanType.AGENT_RUN,
          entityId: 'entity-123',
          entityType: 'agent',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;

      expect(url).toContain('page=1');
      expect(url).toContain('perPage=5');
      expect(url).toContain('spanType=agent_run');
      expect(url).toContain('entityId=entity-123');
      expect(url).toContain('entityType=agent');
      expect(url).toContain('dateRange=');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getTraces({})).rejects.toThrow();
    });
  });

  /**
   * New listTraces() API tests
   * Uses the new parameter structure with improved filtering:
   * - pagination: { page, perPage }
   * - filters: { startedAt, endedAt, spanType, entityId, entityType, entityName, userId }
   * - orderBy: { field, direction }
   */
  describe('listTraces() - New API', () => {
    it('should fetch traces without any parameters', async () => {
      mockSuccessfulResponse();

      await client.listTraces();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch traces with pagination parameters', async () => {
      mockSuccessfulResponse();

      await client.listTraces({
        pagination: {
          page: 2,
          perPage: 10,
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('perPage=10');
    });

    it('should fetch traces with spanType filter', async () => {
      mockSuccessfulResponse();

      await client.listTraces({
        filters: {
          spanType: SpanType.AGENT_RUN,
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('spanType=agent_run');
    });

    it('should fetch traces with entity filters', async () => {
      mockSuccessfulResponse();

      await client.listTraces({
        filters: {
          entityId: 'entity-123',
          entityType: EntityType.AGENT,
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('entityId=entity-123');
      expect(url).toContain('entityType=agent');
    });

    it('should fetch traces with date range filter (startedAt)', async () => {
      mockSuccessfulResponse();

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      await client.listTraces({
        filters: {
          startedAt: {
            start: startDate,
            end: endDate,
          },
        },
      });

      const expectedDateRange = JSON.stringify({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain(`startedAt=${encodeURIComponent(expectedDateRange)}`);
    });

    it('should fetch traces with orderBy parameters', async () => {
      mockSuccessfulResponse();

      await client.listTraces({
        orderBy: {
          field: 'startedAt',
          direction: 'DESC',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('field=startedAt');
      expect(url).toContain('direction=DESC');
    });

    it('should fetch traces with userId filter', async () => {
      mockSuccessfulResponse();

      await client.listTraces({
        filters: {
          userId: 'user-456',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('userId=user-456');
    });

    it('should fetch traces with all parameters combined', async () => {
      mockSuccessfulResponse();

      await client.listTraces({
        pagination: { page: 1, perPage: 5 },
        filters: {
          spanType: SpanType.AGENT_RUN,
          entityId: 'entity-123',
          entityType: EntityType.AGENT,
          userId: 'user-456',
        },
        orderBy: { field: 'startedAt', direction: 'DESC' },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;

      expect(url).toContain('page=1');
      expect(url).toContain('perPage=5');
      expect(url).toContain('spanType=agent_run');
      expect(url).toContain('entityId=entity-123');
      expect(url).toContain('entityType=agent');
      expect(url).toContain('userId=user-456');
      expect(url).toContain('field=startedAt');
      expect(url).toContain('direction=DESC');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.listTraces()).rejects.toThrow();
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
