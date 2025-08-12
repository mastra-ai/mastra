import { createSampleScore } from '@internal/storage-test-utils';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { StoragePagination } from '@mastra/core/storage';
import { InMemoryStore } from '@mastra/core/storage';
import { createWorkflow } from '@mastra/core/workflows';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import { getScorersHandler, getScoresByRunIdHandler, getScoresByEntityIdHandler, saveScoreHandler } from './scores';

function createPagination(args: Partial<StoragePagination>): StoragePagination {
  return {
    page: 0,
    perPage: 10,
    ...args,
  };
}

describe('Scores Handlers', () => {
  let mockStorage: InMemoryStore;
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = new InMemoryStore();

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
          name: 'test-agent',
          instructions: 'test-agent',
          model: {} as any,
        }),
      },
    });
  });

  describe('getScorersHandler', () => {
    it('should return empty object', async () => {
      const result = await getScorersHandler({
        mastra,
        runtimeContext: new RuntimeContext(),
      });
      expect(result).toEqual({});
    });
  });

  describe('getScoresByRunIdHandler', () => {
    it('should get scores by run ID successfully', async () => {
      const mockScores = [createSampleScore({ scorerId: 'test-1-scorer' })];

      await mockStorage.saveScore(mockScores[0]);

      const pagination = createPagination({ page: 0, perPage: 10 });

      const result = await getScoresByRunIdHandler({
        mastra,
        runId: mockScores?.[0]?.runId,
        pagination,
      });

      if ('scores' in result) {
        expect(result.scores).toHaveLength(1);
      }

      if ('pagination' in result) {
        expect(result.pagination).toEqual({
          total: 1,
          page: 0,
          perPage: 10,
          hasMore: false,
        });
      }
    });

    it('should return empty array when storage method is not available', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });

      // Create mastra instance without storage
      const mastraWithoutStorage = new Mastra({
        logger: false,
      });

      const result = await getScoresByRunIdHandler({
        mastra: mastraWithoutStorage,
        runId: 'test-run-1',
        pagination,
      });

      expect(result).toEqual([]);
    });

    it('should handle storage errors gracefully', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });
      const error = new Error('Storage error');

      mockStorage.getScoresByRunId = vi.fn().mockRejectedValue(error);

      await expect(
        getScoresByRunIdHandler({
          mastra,
          runId: 'test-run-1',
          pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should handle API errors with status codes', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });
      const apiError = {
        message: 'Not found',
        status: 404,
      };

      mockStorage.getScoresByRunId = vi.fn().mockRejectedValue(apiError);

      await expect(
        getScoresByRunIdHandler({
          mastra,
          runId: 'test-run-1',
          pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('getScoresByEntityIdHandler', () => {
    it('should get scores by entity ID successfully', async () => {
      const mockScores = [createSampleScore({ entityType: 'AGENT', entityId: 'test-agent', scorerId: 'foo-scorer' })];
      const pagination = createPagination({ page: 0, perPage: 10 });

      await mockStorage.saveScore(mockScores[0]);

      const result = await getScoresByEntityIdHandler({
        mastra,
        entityId: 'test-agent',
        entityType: 'AGENT',
        pagination,
      });

      if ('scores' in result) {
        expect(result.scores).toHaveLength(1);
      }

      if ('pagination' in result) {
        expect(result.pagination).toEqual({
          total: 1,
          page: 0,
          perPage: 10,
          hasMore: false,
        });
      }
    });

    it('should return empty array when storage method is not available', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });

      // Create mastra instance without storage
      const mastraWithoutStorage = new Mastra({
        logger: false,
      });

      const result = await getScoresByEntityIdHandler({
        mastra: mastraWithoutStorage,
        entityId: 'test-agent',
        entityType: 'agent',
        pagination,
      });

      expect(result).toEqual([]);
    });

    it('should handle storage errors gracefully', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });
      const error = new Error('Storage error');

      mockStorage.getScoresByEntityId = vi.fn().mockRejectedValue(error);

      await expect(
        getScoresByEntityIdHandler({
          mastra,
          entityId: 'test-agent',
          entityType: 'agent',
          pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should handle API errors with status codes', async () => {
      const pagination = createPagination({ page: 0, perPage: 10 });
      const apiError = {
        message: 'Entity not found',
        status: 404,
      };

      mockStorage.getScoresByEntityId = vi.fn().mockRejectedValue(apiError);

      await expect(
        getScoresByEntityIdHandler({
          mastra,
          entityId: 'test-agent',
          entityType: 'agent',
          pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should work with different entity types', async () => {
      const mockScores = [
        createSampleScore({ entityType: 'WORKFLOW', entityId: 'test-workflow', scorerId: 'foo-scorer' }),
      ];
      const pagination = createPagination({ page: 0, perPage: 10 });

      await mockStorage.saveScore(mockScores[0]);

      const result = await getScoresByEntityIdHandler({
        mastra,
        entityId: 'test-workflow',
        entityType: 'WORKFLOW',
        pagination,
      });

      if ('scores' in result) {
        expect(result.scores).toHaveLength(1);
      }

      if ('pagination' in result) {
        expect(result.pagination).toEqual({
          total: 1,
          page: 0,
          perPage: 10,
          hasMore: false,
        });
      }
    });
  });

  describe('saveScoreHandler', () => {
    it('should save score successfully', async () => {
      const score = createSampleScore({ scorerId: 'new-score-1' });
      const savedScore = { score };

      const result = await saveScoreHandler({
        mastra,
        score,
      });

      expect(result).toEqual(savedScore);
    });

    it('should return empty array when storage method is not available', async () => {
      const score = createSampleScore({ scorerId: 'new-score-1' });

      // Create mastra instance without storage
      const mastraWithoutStorage = new Mastra({
        logger: false,
      });

      const result = await saveScoreHandler({
        mastra: mastraWithoutStorage,
        score,
      });

      expect(result).toEqual([]);
    });

    it('should handle storage errors gracefully', async () => {
      const score = createSampleScore({ scorerId: 'new-score-1' });
      const error = new Error('Storage error');

      mockStorage.saveScore = vi.fn().mockRejectedValue(error);

      await expect(
        saveScoreHandler({
          mastra,
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

      mockStorage.saveScore = vi.fn().mockRejectedValue(apiError);

      await expect(
        saveScoreHandler({
          mastra,
          score,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should handle score with all optional fields', async () => {
      const score = createSampleScore({ scorerId: 'test-1-scorer' });

      const savedScore = { score };

      const result = await saveScoreHandler({
        mastra,
        score,
      });

      expect(result).toEqual(savedScore);
    });
  });
});
