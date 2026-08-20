import { createSampleScore } from '@internal/storage-test-utils';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { recordScorerFailure, recordScorerSampled, recordScorerTriggered, resetScorerHealth } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import type { ScoresStorage, StoragePagination } from '@mastra/core/storage';
import { InMemoryStore } from '@mastra/core/storage';
import { createWorkflow } from '@mastra/core/workflows';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
vi.mock('@mastra/core/evals/scoreThreads', () => ({
  scoreThreads: vi.fn().mockResolvedValue({ scoredCount: 0, failedCount: 0, results: [] }),
}));

import {
  LIST_SCORERS_ROUTE,
  LIST_SCORES_BY_RUN_ID_ROUTE,
  LIST_SCORES_BY_ENTITY_ID_ROUTE,
  LIST_SCORES_ROUTE,
  AGGREGATE_SCORES_ROUTE,
  SAVE_SCORE_ROUTE,
  SCORE_THREADS_ROUTE,
  SCORER_HEALTH_ROUTE,
  SCORES_METADATA_KEYS_ROUTE,
} from './scores';
import { createTestServerContext } from './test-utils';

function createPagination(args: Partial<StoragePagination>): StoragePagination {
  return {
    page: 0,
    perPage: 10,
    ...args,
  };
}

describe('Scores Handlers', () => {
  let mockStorage: InMemoryStore;
  let scoresStore: ScoresStorage;
  let mastra: Mastra;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStorage = new InMemoryStore();
    await mockStorage.init();
    scoresStore = (await mockStorage.getStore('scores'))!;

    mastra = new Mastra({
      logger: false,
      storage: mockStorage,
      workflows: {
        'test-workflow': createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          description: 'test-workflow',
        }).commit(),
      },
      agents: {
        'test-agent': new Agent({
          id: 'test-agent',
          name: 'test-agent',
          instructions: 'test-agent',
          model: {} as any,
        }),
      },
    });
  });

  describe('listScorersHandler', () => {
    it('should return empty object', async () => {
      const result = await LIST_SCORERS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        requestContext: new RequestContext(),
      });
      expect(result).toEqual({});
    });
  });

  describe('listScoresByRunIdHandler', () => {
    it('should get scores by run ID successfully', async () => {
      const mockScores = [createSampleScore({ scorerId: 'test-1-scorer' })];

      await scoresStore.saveScore(mockScores[0]);

      const pagination = createPagination({ page: 0, perPage: 10 });

      const result = await LIST_SCORES_BY_RUN_ID_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        runId: mockScores?.[0]?.runId,
        page: pagination.page,
        perPage: pagination.perPage as number,
      });

      expect(result.scores).toHaveLength(1);

      expect(result.pagination).toEqual({
        total: 1,
        page: 0,
        perPage: 10,
        hasMore: false,
      });
    });

    it('should handle storage errors gracefully', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });
      const error = new Error('Storage error');

      scoresStore.listScoresByRunId = vi.fn().mockRejectedValue(error);

      await expect(
        LIST_SCORES_BY_RUN_ID_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          runId: 'test-run-1',
          page: pagination.page,
          perPage: pagination.perPage as number,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should handle API errors with status codes', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });
      const apiError = {
        message: 'Not found',
        status: 404,
      };

      scoresStore.listScoresByRunId = vi.fn().mockRejectedValue(apiError);

      await expect(
        LIST_SCORES_BY_RUN_ID_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          runId: 'test-run-1',
          page: pagination.page,
          perPage: pagination.perPage as number,
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('listScoresByEntityIdHandler', () => {
    it('should get scores by entity ID successfully', async () => {
      const mockScores = [createSampleScore({ entityType: 'AGENT', entityId: 'test-agent', scorerId: 'foo-scorer' })];
      const pagination = createPagination({ page: 0, perPage: 10 });

      await scoresStore.saveScore(mockScores[0]);

      const result = await LIST_SCORES_BY_ENTITY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        entityId: 'test-agent',
        entityType: 'AGENT',
        page: pagination.page,
        perPage: pagination.perPage as number,
      });

      expect(result.scores).toHaveLength(1);

      expect(result.pagination).toEqual({
        total: 1,
        page: 0,
        perPage: 10,
        hasMore: false,
      });
    });

    it('should handle storage errors gracefully', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });
      const error = new Error('Storage error');

      scoresStore.listScoresByEntityId = vi.fn().mockRejectedValue(error);

      await expect(
        LIST_SCORES_BY_ENTITY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          entityId: 'test-agent',
          entityType: 'agent',
          page: pagination.page,
          perPage: pagination.perPage as number,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should handle API errors with status codes', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });
      const apiError = {
        message: 'Entity not found',
        status: 404,
      };

      scoresStore.listScoresByEntityId = vi.fn().mockRejectedValue(apiError);

      await expect(
        LIST_SCORES_BY_ENTITY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          entityId: 'test-agent',
          entityType: 'agent',
          page: pagination.page,
          perPage: pagination.perPage as number,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should work with different entity types', async () => {
      const mockScores = [
        createSampleScore({ entityType: 'WORKFLOW', entityId: 'test-workflow', scorerId: 'foo-scorer' }),
      ];
      const pagination = createPagination({ page: 0, perPage: 10 });

      await scoresStore.saveScore(mockScores[0]);

      const result = await LIST_SCORES_BY_ENTITY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        entityId: 'test-workflow',
        entityType: 'WORKFLOW',
        page: pagination.page,
        perPage: pagination.perPage as number,
      });

      expect(result.scores).toHaveLength(1);
      expect(result.pagination).toEqual({
        total: 1,
        page: 0,
        perPage: 10,
        hasMore: false,
      });
    });
  });

  describe('listScoresHandler (unified)', () => {
    it('filters by metadata key/value', async () => {
      await scoresStore.saveScore(
        createSampleScore({ scorerId: 's1', metadata: { deployment: 'v42', cohort: 'oncology' } }),
      );
      await scoresStore.saveScore(createSampleScore({ scorerId: 's1', metadata: { deployment: 'v41' } }));

      const result = await LIST_SCORES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        metadata: JSON.stringify({ deployment: 'v42' }),
        page: 0,
        perPage: 10,
      });

      expect(result.scores).toHaveLength(1);
      expect((result.scores[0] as any).metadata).toMatchObject({ deployment: 'v42' });
    });

    it('filters by scorerIds and threadId', async () => {
      await scoresStore.saveScore(createSampleScore({ scorerId: 'a', threadId: 'thread-1' }));
      await scoresStore.saveScore(createSampleScore({ scorerId: 'b', threadId: 'thread-1' }));
      await scoresStore.saveScore(createSampleScore({ scorerId: 'a', threadId: 'thread-2' }));

      const result = await LIST_SCORES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        scorerIds: 'a',
        threadId: 'thread-1',
        page: 0,
        perPage: 10,
      });

      expect(result.scores).toHaveLength(1);
      expect((result.scores[0] as any).scorerId).toBe('a');
      expect((result.scores[0] as any).threadId).toBe('thread-1');
    });

    it('handles storage errors gracefully', async () => {
      scoresStore.listScores = vi.fn().mockRejectedValue(new Error('Storage error'));

      await expect(
        LIST_SCORES_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          page: 0,
          perPage: 10,
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('aggregateScoresHandler', () => {
    it('aggregates grouped by metadata key', async () => {
      await scoresStore.saveScore(createSampleScore({ scorerId: 's1', score: 1, metadata: { cohort: 'a' } }));
      await scoresStore.saveScore(createSampleScore({ scorerId: 's1', score: 0.5, metadata: { cohort: 'a' } }));
      await scoresStore.saveScore(createSampleScore({ scorerId: 's1', score: 0, metadata: { cohort: 'b' } }));

      const result = await AGGREGATE_SCORES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        groupBy: 'metadata:cohort',
      });

      expect(result.rows).toHaveLength(2);
      const rowA = result.rows.find(r => r.groups?.[0] === 'a')!;
      expect(rowA.count).toBe(2);
      expect(rowA.avg).toBeCloseTo(0.75);
      const rowB = result.rows.find(r => r.groups?.[0] === 'b')!;
      expect(rowB.count).toBe(1);
      expect(rowB.avg).toBe(0);
    });

    it('rejects invalid groupBy dimensions', async () => {
      await expect(
        AGGREGATE_SCORES_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          groupBy: 'nonsense',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('applies passThreshold to passRate', async () => {
      await scoresStore.saveScore(createSampleScore({ scorerId: 's1', score: 0.9 }));
      await scoresStore.saveScore(createSampleScore({ scorerId: 's1', score: 0.4 }));

      const result = await AGGREGATE_SCORES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        passThreshold: 0.5,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].passRate).toBeCloseTo(0.5);
    });
  });

  describe('scoreThreadsHandler', () => {
    it('should start thread scoring (fire-and-forget) for a valid scorer', async () => {
      const { scoreThreads } = vi.mocked(await import('@mastra/core/evals/scoreThreads'));
      vi.spyOn(mastra, 'getScorerById').mockReturnValue({
        config: { id: 'test-scorer', name: 'test-scorer' },
      } as any);

      const result = await SCORE_THREADS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        scorerName: 'test-scorer',
        targets: [{ threadId: 'thread-1' }, { threadId: 'thread-2' }],
      } as any);

      expect(result).toEqual({
        status: 'success',
        message: 'Scoring started for 2 threads',
        threadCount: 2,
      });
      expect(scoreThreads).toHaveBeenCalledWith({
        scorerId: 'test-scorer',
        targets: [{ threadId: 'thread-1' }, { threadId: 'thread-2' }],
        mastra,
      });
    });

    it('should throw 404 when scorer is not found', async () => {
      vi.spyOn(mastra, 'getScorerById').mockReturnValue(null as any);

      await expect(
        SCORE_THREADS_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          scorerName: 'missing-scorer',
          targets: [{ threadId: 'thread-1' }],
        } as any),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('saveScoreHandler', () => {
    it('should save score successfully', async () => {
      const score = createSampleScore({ scorerId: 'new-score-1' });
      const savedScore = { score };

      const result = await SAVE_SCORE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        score,
      });

      expect(result).toEqual(savedScore);
    });

    it('should handle storage errors gracefully', async () => {
      const score = createSampleScore({ scorerId: 'new-score-1' });
      const error = new Error('Storage error');

      scoresStore.saveScore = vi.fn().mockRejectedValue(error);

      await expect(
        SAVE_SCORE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          score,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should handle API errors with status codes', async () => {
      const score = createSampleScore({ scorerId: 'new-score-1' });
      const apiError = {
        message: 'Validation error',
        status: 400,
      };

      scoresStore.saveScore = vi.fn().mockRejectedValue(apiError);

      await expect(
        SAVE_SCORE_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          score,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should handle score with all optional fields', async () => {
      const score = createSampleScore({ scorerId: 'test-1-scorer' });

      const savedScore = { score };

      const result = await SAVE_SCORE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        score,
      });

      expect(result).toEqual(savedScore);
    });
  });

  describe('SCORER_HEALTH_ROUTE', () => {
    it('returns zeroed counters for a scorer with no runs', async () => {
      resetScorerHealth();
      const result = await SCORER_HEALTH_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        scorerId: 'fresh-scorer',
      });
      expect(result).toEqual({ scorerId: 'fresh-scorer', triggered: 0, sampled: 0, saved: 0, failed: 0 });
    });

    it('surfaces failure counts and last error', async () => {
      resetScorerHealth();
      recordScorerTriggered('flaky-scorer');
      recordScorerSampled('flaky-scorer');
      recordScorerFailure('flaky-scorer', new Error('judge exploded'));

      const result = await SCORER_HEALTH_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        scorerId: 'flaky-scorer',
      });
      expect(result).toMatchObject({
        triggered: 1,
        sampled: 1,
        saved: 0,
        failed: 1,
        lastErrorMessage: 'judge exploded',
      });
    });
  });

  describe('SCORES_METADATA_KEYS_ROUTE', () => {
    it('returns distinct sorted metadata keys from recent scores', async () => {
      await scoresStore.saveScore(
        createSampleScore({ scorerId: 'scorer-a', metadata: { deployment: 'v42', cohort: 'oncology' } }),
      );
      await scoresStore.saveScore(createSampleScore({ scorerId: 'scorer-b', metadata: { deployment: 'v43' } }));

      const result = await SCORES_METADATA_KEYS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
      });
      expect(result).toEqual({ keys: ['cohort', 'deployment'] });
    });

    it('returns empty keys when there are no scores', async () => {
      const result = await SCORES_METADATA_KEYS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
      });
      expect(result).toEqual({ keys: [] });
    });
  });
});
