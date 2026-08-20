import type { ScoringEntityType, ScoringSource } from '@mastra/core/evals';
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

  describe('listScorers()', () => {
    it('should fetch all available scorers', async () => {
      mockSuccessfulResponse();

      await client.listScorers();
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/scorers`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('listScoresByRunId()', () => {
    it('should fetch scores by run ID without pagination', async () => {
      mockSuccessfulResponse();

      await client.listScoresByRunId({ runId: 'run-123' });

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

      await client.listScoresByRunId({
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

      await expect(client.listScoresByRunId({ runId: 'invalid-run' })).rejects.toThrow();
    });
  });

  describe('listScoresByEntityId()', () => {
    it('should fetch scores by entity ID and type without pagination', async () => {
      mockSuccessfulResponse();

      await client.listScoresByEntityId({
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

      await client.listScoresByEntityId({
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
        client.listScoresByEntityId({
          entityId: 'invalid-entity',
          entityType: 'AGENT',
        }),
      ).rejects.toThrow();
    });
  });

  describe('queryScores()', () => {
    it('should serialize unified filters into query params', async () => {
      mockSuccessfulResponse();

      await client.queryScores({
        scorerIds: ['s1', 's2'],
        entityType: 'AGENT',
        threadId: 'thread-1',
        minScore: 0.5,
        metadata: { deployment: 'v42' },
        page: 1,
        perPage: 20,
      });

      const url = new URL((global.fetch as any).mock.calls[0][0]);
      expect(url.pathname).toBe('/api/scores');
      expect(url.searchParams.get('scorerIds')).toBe('s1,s2');
      expect(url.searchParams.get('entityType')).toBe('AGENT');
      expect(url.searchParams.get('threadId')).toBe('thread-1');
      expect(url.searchParams.get('minScore')).toBe('0.5');
      expect(url.searchParams.get('metadata')).toBe(JSON.stringify({ deployment: 'v42' }));
      expect(url.searchParams.get('page')).toBe('1');
      expect(url.searchParams.get('perPage')).toBe('20');
    });

    it('should send no query string when no params provided', async () => {
      mockSuccessfulResponse();

      await client.queryScores();

      expect(global.fetch).toHaveBeenCalledWith(`${clientOptions.baseUrl}/api/scores`, expect.anything());
    });
  });

  describe('aggregateScores()', () => {
    it('should serialize bucket, groupBy, passThreshold and date filters', async () => {
      mockSuccessfulResponse();

      await client.aggregateScores({
        bucket: 'day',
        groupBy: ['scorerId', 'metadata:cohort'],
        passThreshold: 0.7,
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: new Date('2026-08-20T00:00:00.000Z'),
      });

      const url = new URL((global.fetch as any).mock.calls[0][0]);
      expect(url.pathname).toBe('/api/scores/aggregate');
      expect(url.searchParams.get('bucket')).toBe('day');
      expect(url.searchParams.get('groupBy')).toBe('scorerId,metadata:cohort');
      expect(url.searchParams.get('passThreshold')).toBe('0.7');
      expect(url.searchParams.get('startDate')).toBe('2026-08-01T00:00:00.000Z');
      expect(url.searchParams.get('endDate')).toBe('2026-08-20T00:00:00.000Z');
    });
  });

  describe('scoreThreads()', () => {
    it('should POST scorer name and thread targets to the thread scoring endpoint', async () => {
      mockSuccessfulResponse();

      await client.scoreThreads({
        scorerName: 'test-scorer',
        targets: [{ threadId: 'thread-1' }, { threadId: 'thread-2', resourceId: 'user-1' }],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/threads/score`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            scorerName: 'test-scorer',
            targets: [{ threadId: 'thread-1' }, { threadId: 'thread-2', resourceId: 'user-1' }],
          }),
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('getScorerHealth()', () => {
    it('should fetch health counters for a scorer', async () => {
      mockSuccessfulResponse();

      await client.getScorerHealth('my scorer');
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/scorers/my%20scorer/health`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('getScoresMetadataKeys()', () => {
    it('should fetch distinct metadata keys', async () => {
      mockSuccessfulResponse();

      await client.getScoresMetadataKeys();
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores/metadata-keys`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
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

    it('should save an EXTERNAL score with caller-supplied id and lineage', async () => {
      const scoreData = {
        id: 'ext-worker-run-42',
        scorerId: 'human-grader',
        runId: 'run-123',
        scorer: { name: 'human-grader' },
        score: 1,
        input: [],
        output: {},
        source: 'EXTERNAL' as ScoringSource,
        entityId: 'agent-456',
        entityType: 'AGENT' as ScoringEntityType,
        entity: { id: 'agent-456' },
        traceId: 'trace-1',
        threadId: 'thread-1',
        metadata: { grader: 'dr-smith', temporalWorkflowId: 'wf-9' },
      };
      mockSuccessfulResponse();

      await client.saveScore({ score: scoreData });
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/scores`,
        expect.objectContaining({
          method: 'POST',
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
