import type { ScoringEntityType, ScoringSource } from '@mastra/core/scores';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

describe('Scores Methods', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any, options: { isStream?: boolean } = {}) => {
    if (options.isStream) {
      let contentType = 'text/event-stream';
      let responseBody: ReadableStream;

      if (data instanceof ReadableStream) {
        responseBody = data;
        contentType = 'audio/mp3';
      } else {
        responseBody = new ReadableStream({
          start(controller) {
            if (typeof data === 'string') {
              controller.enqueue(new TextEncoder().encode(data));
            } else if (typeof data === 'object' && data !== null) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
            } else {
              controller.enqueue(new TextEncoder().encode(String(data)));
            }
            controller.close();
          },
        });
      }

      const headers = new Headers();
      if (contentType === 'audio/mp3') {
        headers.set('Transfer-Encoding', 'chunked');
      }
      headers.set('Content-Type', contentType);

      (global.fetch as any).mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      );
    } else {
      const response = new Response(undefined, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });
      response.json = () => Promise.resolve(data);
      (global.fetch as any).mockResolvedValueOnce(response);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  describe('getScorers()', () => {
    it('should fetch all available scorers', async () => {
      const mockResponse = {
        scorers: [
          { id: 'scorer-1', name: 'Test Scorer 1', description: 'A test scorer' },
          { id: 'scorer-2', name: 'Test Scorer 2', description: 'Another test scorer' },
        ],
      };
      mockFetchResponse(mockResponse);

      const result = await client.getScorers();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/scorers`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('getScoresByRunId()', () => {
    it('should fetch scores by run ID without pagination', async () => {
      const mockResponse = {
        pagination: {
          total: 10,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
        scores: [
          {
            id: 'score-1',
            runId: 'run-123',
            scorer: { name: 'test-scorer' },
            result: { score: 0.8 },
            input: { messages: [] },
            output: { response: 'test' },
            source: 'LIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockFetchResponse({
        ...mockResponse,
        scores: mockResponse.scores.map(score => ({
          ...score,
          createdAt: score.createdAt.toISOString(),
          updatedAt: score.updatedAt.toISOString(),
        })),
      });

      const result = await client.getScoresByRunId({ runId: 'run-123' });

      expect(result).toEqual({
        ...mockResponse,
        scores: mockResponse.scores.map(score => ({
          ...score,
          createdAt: score.createdAt.toISOString(),
          updatedAt: score.updatedAt.toISOString(),
        })),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/run/run-123`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch scores by run ID with pagination', async () => {
      const mockResponse = {
        pagination: {
          total: 20,
          page: 1,
          perPage: 5,
          hasMore: true,
        },
        scores: [],
      };
      mockFetchResponse(mockResponse);

      const result = await client.getScoresByRunId({
        runId: 'run-123',
        page: 1,
        perPage: 5,
      });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/run/run-123?page=1&perPage=5`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('getScoresByEntityId()', () => {
    it('should fetch scores by entity ID and type without pagination', async () => {
      const mockResponse = {
        pagination: {
          total: 5,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
        scores: [
          {
            id: 'score-1',
            runId: 'run-123',
            entityId: 'agent-456',
            entityType: 'AGENT',
            scorer: { name: 'test-scorer' },
            result: { score: 0.9 },
            input: { messages: [] },
            output: { response: 'test' },
            source: 'LIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const mockResponseWithDates = mockResponse.scores.map(score => ({
        ...score,
        createdAt: score.createdAt.toISOString(),
        updatedAt: score.updatedAt.toISOString(),
      }));

      mockFetchResponse({
        ...mockResponse,
        scores: mockResponseWithDates,
      });

      const result = await client.getScoresByEntityId({
        entityId: 'agent-456',
        entityType: 'AGENT',
      });

      expect(result).toEqual({
        ...mockResponse,
        scores: mockResponseWithDates,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/entity/AGENT/agent-456`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch scores by entity ID and type with pagination', async () => {
      const mockResponse = {
        pagination: {
          total: 15,
          page: 2,
          perPage: 5,
          hasMore: true,
        },
        scores: [],
      };
      mockFetchResponse(mockResponse);

      const result = await client.getScoresByEntityId({
        entityId: 'workflow-789',
        entityType: 'WORKFLOW',
        page: 2,
        perPage: 5,
      });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/entity/WORKFLOW/workflow-789?page=2&perPage=5`,
        expect.objectContaining({
          body: undefined,
          headers: expect.objectContaining(clientOptions.headers),
          signal: undefined,
        }),
      );
    });
  });

  describe('saveScore()', () => {
    it('should save a score', async () => {
      const scoreData = {
        id: 'score-1',
        scorerId: 'test-scorer',
        runId: 'run-123',
        scorer: { name: 'test-scorer' },
        score: 0.85,
        input: [],
        output: { response: 'test response' },
        source: 'LIVE' as ScoringSource,
        entityId: 'agent-456',
        entityType: 'AGENT' as ScoringEntityType,
        entity: { id: 'agent-456', name: 'test-agent' },
        createdAt: new Date(),
        updatedAt: new Date(),
        runtimeContext: {
          model: {
            name: 'test-model',
            version: '1.0.0',
          },
        },
      };
      const mockResponse = {
        score: {
          ...scoreData,
          createdAt: scoreData.createdAt.toISOString(),
          updatedAt: scoreData.updatedAt.toISOString(),
        },
      };
      mockFetchResponse(mockResponse);

      const result = await client.saveScore({ score: scoreData });
      expect(result).toEqual({
        score: {
          ...scoreData,
          createdAt: scoreData.createdAt.toISOString(),
          updatedAt: scoreData.updatedAt.toISOString(),
        },
      });
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
          body: JSON.stringify({ score: scoreData }),
        }),
      );
    });
  });
});
