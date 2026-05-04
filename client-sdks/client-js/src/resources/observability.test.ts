import { EntityType, SpanType } from '@mastra/core/observability';
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

  describe('getTraceLight()', () => {
    it('should fetch a lightweight trace by ID', async () => {
      mockSuccessfulResponse();

      await client.getTraceLight('trace-123');

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces/trace-123/light`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getTraceLight('invalid-trace')).rejects.toThrow();
    });
  });

  describe('getSpan()', () => {
    it('should fetch a specific span by trace ID and span ID', async () => {
      mockSuccessfulResponse();

      await client.getSpan('trace-123', 'span-456');

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces/trace-123/spans/span-456`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getSpan('trace-123', 'invalid-span')).rejects.toThrow();
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

    it('should fetch traces with name filter', async () => {
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

    it('should fetch traces with spanType filter', async () => {
      mockSuccessfulResponse();

      await client.getTraces({
        filters: {
          spanType: 'agent_run' as SpanType,
        },
      });

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

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces?entityId=entity-123&entityType=agent`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch traces with date range filter using Date objects', async () => {
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

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces?dateRange=${encodeURIComponent(expectedDateRange)}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch traces with date range filter using string dates', async () => {
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

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces?dateRange=${encodeURIComponent(expectedDateRange)}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch traces with all filters combined', async () => {
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

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/traces?page=1&perPage=5&name=test-trace&spanType=agent_run&entityId=entity-123&entityType=agent&dateRange=${encodeURIComponent(expectedDateRange)}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
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

  // ==========================================================================
  // Logs
  // ==========================================================================

  describe('listLogsVNext()', () => {
    it('should fetch logs without any parameters', async () => {
      mockSuccessfulResponse();

      await client.listLogsVNext();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/logs`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch logs with filter parameters', async () => {
      mockSuccessfulResponse();

      await client.listLogsVNext({
        filters: {
          level: 'error',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('level=error');
    });

    it('should fetch logs with pagination parameters', async () => {
      mockSuccessfulResponse();

      await client.listLogsVNext({
        pagination: {
          page: 3,
          perPage: 25,
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('page=3');
      expect(url).toContain('perPage=25');
    });

    it('should fetch logs with orderBy parameters', async () => {
      mockSuccessfulResponse();

      await client.listLogsVNext({
        orderBy: {
          field: 'createdAt',
          direction: 'DESC',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('field=createdAt');
      expect(url).toContain('direction=DESC');
    });

    it('should fetch logs with all parameters combined', async () => {
      mockSuccessfulResponse();

      await client.listLogsVNext({
        filters: {
          level: 'error',
        },
        pagination: {
          page: 1,
          perPage: 10,
        },
        orderBy: {
          field: 'createdAt',
          direction: 'ASC',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('level=error');
      expect(url).toContain('page=1');
      expect(url).toContain('perPage=10');
      expect(url).toContain('field=createdAt');
      expect(url).toContain('direction=ASC');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.listLogsVNext()).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Scores (observability storage)
  // ==========================================================================

  describe('listScores()', () => {
    it('should fetch scores without any parameters', async () => {
      mockSuccessfulResponse();

      await client.listScores();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/scores`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch scores with filter parameters', async () => {
      mockSuccessfulResponse();

      await client.listScores({
        filters: {
          scorerId: 'accuracy-scorer',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('scorerId=accuracy-scorer');
    });

    it('should fetch scores with pagination parameters', async () => {
      mockSuccessfulResponse();

      await client.listScores({
        pagination: {
          page: 2,
          perPage: 20,
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('perPage=20');
    });

    it('should fetch scores with orderBy parameters', async () => {
      mockSuccessfulResponse();

      await client.listScores({
        orderBy: {
          field: 'timestamp',
          direction: 'DESC',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('field=timestamp');
      expect(url).toContain('direction=DESC');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.listScores()).rejects.toThrow();
    });
  });

  describe('createScore()', () => {
    it('should create a score with correct POST request', async () => {
      mockSuccessfulResponse();

      const score = {
        traceId: 'trace-123',
        spanId: 'span-456',
        scorerId: 'accuracy-scorer',
        score: 0.95,
        reason: 'High accuracy',
      };

      await client.createScore({ score });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/scores`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify({ score }),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.createScore({
          score: {
            traceId: 'trace-123',
            scorerId: 'accuracy-scorer',
            score: 0.95,
          },
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Feedback
  // ==========================================================================

  describe('listFeedback()', () => {
    it('should fetch feedback without any parameters', async () => {
      mockSuccessfulResponse();

      await client.listFeedback();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/feedback`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch feedback with filter parameters', async () => {
      mockSuccessfulResponse();

      await client.listFeedback({
        filters: {
          traceId: 'trace-123',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('traceId=trace-123');
    });

    it('should fetch feedback with pagination parameters', async () => {
      mockSuccessfulResponse();

      await client.listFeedback({
        pagination: {
          page: 2,
          perPage: 15,
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('perPage=15');
    });

    it('should fetch feedback with orderBy parameters', async () => {
      mockSuccessfulResponse();

      await client.listFeedback({
        orderBy: {
          field: 'timestamp',
          direction: 'ASC',
        },
      });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('field=timestamp');
      expect(url).toContain('direction=ASC');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.listFeedback()).rejects.toThrow();
    });
  });

  describe('createFeedback()', () => {
    it('should create feedback with correct POST request', async () => {
      mockSuccessfulResponse();

      const feedback = {
        traceId: 'trace-123',
        spanId: 'span-456',
        source: 'user',
        feedbackType: 'thumbs',
        value: 1,
        comment: 'Great response',
      };

      await client.createFeedback({ feedback });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/feedback`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify({ feedback }),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.createFeedback({
          feedback: {
            traceId: 'trace-123',
            source: 'user',
            feedbackType: 'thumbs',
            value: 1,
            comment: 'Great response',
          },
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Scores OLAP
  // ==========================================================================

  describe('getScoreAggregate()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        scorerId: 'relevance',
        scoreSource: 'manual',
        aggregation: 'avg' as const,
        filters: { entityType: EntityType.AGENT },
      };

      await client.getScoreAggregate(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/scores/aggregate`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getScoreAggregate({
          scorerId: 'relevance',
          aggregation: 'avg',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getScoreBreakdown()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        scorerId: 'relevance',
        aggregation: 'avg' as const,
        groupBy: ['experimentId'],
      };

      await client.getScoreBreakdown(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/scores/breakdown`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getScoreBreakdown({
          scorerId: 'relevance',
          aggregation: 'avg',
          groupBy: ['experimentId'],
        }),
      ).rejects.toThrow();
    });
  });

  describe('getScoreTimeSeries()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        scorerId: 'relevance',
        aggregation: 'avg' as const,
        interval: '1h' as const,
      };

      await client.getScoreTimeSeries(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/scores/timeseries`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getScoreTimeSeries({
          scorerId: 'relevance',
          aggregation: 'avg',
          interval: '1h',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getScorePercentiles()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        scorerId: 'relevance',
        percentiles: [0.5, 0.9, 0.99],
        interval: '1h' as const,
      };

      await client.getScorePercentiles(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/scores/percentiles`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getScorePercentiles({
          scorerId: 'relevance',
          percentiles: [0.5, 0.9, 0.99],
          interval: '1h',
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Feedback OLAP
  // ==========================================================================

  describe('getFeedbackAggregate()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        feedbackType: 'rating',
        feedbackSource: 'user',
        aggregation: 'avg' as const,
        filters: { entityType: EntityType.AGENT },
      };

      await client.getFeedbackAggregate(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/feedback/aggregate`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getFeedbackAggregate({
          feedbackType: 'rating',
          aggregation: 'avg',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getFeedbackBreakdown()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        feedbackType: 'rating',
        aggregation: 'avg' as const,
        groupBy: ['experimentId'],
      };

      await client.getFeedbackBreakdown(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/feedback/breakdown`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getFeedbackBreakdown({
          feedbackType: 'rating',
          aggregation: 'avg',
          groupBy: ['experimentId'],
        }),
      ).rejects.toThrow();
    });
  });

  describe('getFeedbackTimeSeries()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        feedbackType: 'rating',
        aggregation: 'avg' as const,
        interval: '1h' as const,
      };

      await client.getFeedbackTimeSeries(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/feedback/timeseries`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getFeedbackTimeSeries({
          feedbackType: 'rating',
          aggregation: 'avg',
          interval: '1h',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getFeedbackPercentiles()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        feedbackType: 'rating',
        percentiles: [0.5, 0.9, 0.99],
        interval: '1h' as const,
      };

      await client.getFeedbackPercentiles(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/feedback/percentiles`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getFeedbackPercentiles({
          feedbackType: 'rating',
          percentiles: [0.5, 0.9, 0.99],
          interval: '1h',
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Metrics OLAP
  // ==========================================================================

  describe('getMetricAggregate()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        name: ['latency'],
        aggregation: 'avg' as const,
        filters: { entityType: EntityType.AGENT },
      };

      await client.getMetricAggregate(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/metrics/aggregate`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getMetricAggregate({
          name: ['latency'],
          aggregation: 'avg',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getMetricBreakdown()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        name: ['latency'],
        aggregation: 'avg' as const,
        groupBy: ['entityType'],
      };

      await client.getMetricBreakdown(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/metrics/breakdown`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getMetricBreakdown({
          name: ['latency'],
          aggregation: 'avg',
          groupBy: ['entityType'],
        }),
      ).rejects.toThrow();
    });
  });

  describe('getMetricTimeSeries()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        name: ['latency'],
        aggregation: 'avg' as const,
        interval: '1h' as const,
      };

      await client.getMetricTimeSeries(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/metrics/timeseries`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getMetricTimeSeries({
          name: ['latency'],
          aggregation: 'avg',
          interval: '1h',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getMetricPercentiles()', () => {
    it('should send correct POST request with params', async () => {
      mockSuccessfulResponse();

      const params = {
        name: 'latency',
        percentiles: [0.5, 0.9, 0.99],
        interval: '1h' as const,
      };

      await client.getMetricPercentiles(params);

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/metrics/percentiles`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            ...clientOptions.headers,
            'content-type': 'application/json',
          }),
          body: JSON.stringify(params),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getMetricPercentiles({
          name: 'latency',
          percentiles: [0.5, 0.9, 0.99],
          interval: '1h',
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Discovery
  // ==========================================================================

  describe('getMetricNames()', () => {
    it('should fetch metric names without any parameters', async () => {
      mockSuccessfulResponse();

      await client.getMetricNames();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/discovery/metric-names`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch metric names with params', async () => {
      mockSuccessfulResponse();

      await client.getMetricNames({ prefix: 'latency' });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('prefix=latency');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getMetricNames()).rejects.toThrow();
    });
  });

  describe('getMetricLabelKeys()', () => {
    it('should fetch metric label keys with params', async () => {
      mockSuccessfulResponse();

      await client.getMetricLabelKeys({ metricName: 'latency' });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain(`${clientOptions.baseUrl}/api/observability/discovery/metric-label-keys`);
      expect(url).toContain('metricName=latency');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getMetricLabelKeys({ metricName: 'latency' })).rejects.toThrow();
    });
  });

  describe('getMetricLabelValues()', () => {
    it('should fetch metric label values with params', async () => {
      mockSuccessfulResponse();

      await client.getMetricLabelValues({ metricName: 'latency', labelKey: 'env' });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain(`${clientOptions.baseUrl}/api/observability/discovery/metric-label-values`);
      expect(url).toContain('metricName=latency');
      expect(url).toContain('labelKey=env');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getMetricLabelValues({ metricName: 'latency', labelKey: 'env' })).rejects.toThrow();
    });
  });

  describe('getEntityTypes()', () => {
    it('should fetch entity types without any parameters', async () => {
      mockSuccessfulResponse();

      await client.getEntityTypes();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/discovery/entity-types`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getEntityTypes()).rejects.toThrow();
    });
  });

  describe('getEntityNames()', () => {
    it('should fetch entity names without any parameters', async () => {
      mockSuccessfulResponse();

      await client.getEntityNames();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/discovery/entity-names`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch entity names with params', async () => {
      mockSuccessfulResponse();

      await client.getEntityNames({ entityType: 'agent' });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('entityType=agent');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getEntityNames()).rejects.toThrow();
    });
  });

  describe('getServiceNames()', () => {
    it('should fetch service names without any parameters', async () => {
      mockSuccessfulResponse();

      await client.getServiceNames();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/discovery/service-names`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getServiceNames()).rejects.toThrow();
    });
  });

  describe('getEnvironments()', () => {
    it('should fetch environments without any parameters', async () => {
      mockSuccessfulResponse();

      await client.getEnvironments();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/discovery/environments`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getEnvironments()).rejects.toThrow();
    });
  });

  describe('getTags()', () => {
    it('should fetch tags without any parameters', async () => {
      mockSuccessfulResponse();

      await client.getTags();

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/observability/discovery/tags`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch tags with params', async () => {
      mockSuccessfulResponse();

      await client.getTags({ entityType: 'agent' });

      const call = (global.fetch as any).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('entityType=agent');
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getTags()).rejects.toThrow();
    });
  });
});
