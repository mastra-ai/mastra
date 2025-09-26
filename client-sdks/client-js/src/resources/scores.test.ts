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

  describe('getScorers()', () => {
    it('should fetch all available scorers', async () => {
      mockSuccessfulResponse();

      await client.getScorers();
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
      mockSuccessfulResponse();

      await client.getScoresByRunId({ runId: 'run-123' });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/run/run-123`,
        expect.objectContaining({
          body: undefined,
          headers: expect.objectContaining(clientOptions.headers),
          signal: undefined,
        }),
      );
    });

    it('should fetch scores by run ID with pagination', async () => {
      mockSuccessfulResponse();

      await client.getScoresByRunId({
        runId: 'run-123',
        page: 1,
        perPage: 5,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/run/run-123?page=1&perPage=5`,
        expect.objectContaining({
          body: undefined,
          headers: expect.objectContaining(clientOptions.headers),
          signal: undefined,
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(client.getScoresByRunId({ runId: 'invalid-run' })).rejects.toThrow();
    });
  });

  describe('getScoresByEntityId()', () => {
    it('should fetch scores by entity ID and type without pagination', async () => {
      mockSuccessfulResponse();

      await client.getScoresByEntityId({
        entityId: 'agent-456',
        entityType: 'AGENT',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/entity/AGENT/agent-456`,
        expect.objectContaining({
          body: undefined,
          headers: expect.objectContaining(clientOptions.headers),
          signal: undefined,
        }),
      );
    });

    it('should fetch scores by entity ID and type with pagination', async () => {
      mockSuccessfulResponse();

      await client.getScoresByEntityId({
        entityId: 'workflow-789',
        entityType: 'WORKFLOW',
        page: 2,
        perPage: 5,
      });
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/entity/WORKFLOW/workflow-789?page=2&perPage=5`,
        expect.objectContaining({
          body: undefined,
          headers: expect.objectContaining(clientOptions.headers),
          signal: undefined,
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getScoresByEntityId({
          entityId: 'invalid-entity',
          entityType: 'AGENT',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getScoresBySpan()', () => {
    it('should construct correct URL and make GET request', async () => {
      mockSuccessfulResponse();

      await client.getScoresBySpan({
        traceId: 'trace-123',
        spanId: 'span-456',
      });

      // Test that correct request is made
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/span/trace-123/span-456`,
        expect.objectContaining({
          body: undefined,
          headers: expect.objectContaining(clientOptions.headers),
          signal: undefined,
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

      await expect(
        client.getScoresBySpan({
          traceId: 'invalid-trace',
          spanId: 'invalid-span',
        }),
      ).rejects.toThrow();
    });

    it('should properly encode special characters in trace and span IDs', async () => {
      mockSuccessfulResponse();

      await client.getScoresBySpan({
        traceId: 'trace/with/slashes',
        spanId: 'span-with-dashes',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/span/trace%2Fwith%2Fslashes/span-with-dashes`,
        expect.any(Object),
      );
    });

    it('should construct correct URL with pagination parameters', async () => {
      mockSuccessfulResponse();

      await client.getScoresBySpan({
        traceId: 'trace-456',
        spanId: 'span-789',
        page: 1,
        perPage: 5,
      });

      // Test that correct URL with query params is constructed
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/span/trace-456/span-789?page=1&perPage=5`,
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
      };
      mockSuccessfulResponse();

      await client.saveScore({ score: scoreData });
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining(clientOptions.headers),
          body: JSON.stringify({ score: scoreData }),
        }),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const errorResponse = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      (global.fetch as any).mockResolvedValueOnce(errorResponse);

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
      };

      await expect(client.saveScore({ score: scoreData })).rejects.toThrow();
    });
  });
});
