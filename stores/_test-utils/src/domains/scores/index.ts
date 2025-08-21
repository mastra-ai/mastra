import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { TABLE_SCORERS, type MastraStorage } from '@mastra/core/storage';
import { createSampleScore } from './data';

export function createScoresTest({ storage }: { storage: MastraStorage }) {
  describe('Score Operations', () => {
    beforeEach(async () => {
      await storage.clearTable({ tableName: TABLE_SCORERS });
    });

    it('should retrieve scores by scorer id', async () => {
      const scorerId = `scorer-${randomUUID()}`;

      // Create sample scores
      const score1 = createSampleScore({ scorerId });
      const score2 = createSampleScore({ scorerId });
      const score3 = createSampleScore({ scorerId });

      // Insert evals

      await storage.saveScore(score1);
      await storage.saveScore(score2);
      await storage.saveScore(score3);

      // Test getting all evals for the agent
      const allScoresByScorerId = await storage.getScoresByScorerId({ scorerId, pagination: { page: 0, perPage: 10 } });
      expect(allScoresByScorerId?.scores).toHaveLength(3);
      expect(allScoresByScorerId?.scores.map(e => e.runId)).toEqual(
        expect.arrayContaining([score1.runId, score2.runId, score3.runId]),
      );
      expect(allScoresByScorerId?.scores.map(s => s.scorer.id)).toEqual(
        expect.arrayContaining([score1.scorer.id, score2.scorer.id, score3.scorer.id]),
      );

      // Test getting scores for non-existent scorer
      const nonExistentScores = await storage.getScoresByScorerId({
        scorerId: 'non-existent-scorer',
        pagination: { page: 0, perPage: 10 },
      });
      expect(nonExistentScores?.scores).toHaveLength(0);
    });

    it('should retrieve scores by source', async () => {
      const scorerId = `scorer-${randomUUID()}`;
      const score1 = createSampleScore({ scorerId, source: 'TEST' });
      const score2 = createSampleScore({ scorerId, source: 'LIVE' });
      await storage.saveScore(score1);
      await storage.saveScore(score2);
      const scoresBySource = await storage.getScoresByScorerId({
        scorerId,
        pagination: { page: 0, perPage: 10 },
        source: 'TEST',
      });
      expect(scoresBySource?.scores).toHaveLength(1);
      expect(scoresBySource?.scores.map(s => s.source)).toEqual(['TEST']);
    });

    it('should save scorer', async () => {
      const scorerId = `scorer-${randomUUID()}`;
      const scorer = createSampleScore({ scorerId });
      await storage.saveScore(scorer);
      const result = await storage.getScoresByRunId({ runId: scorer.runId, pagination: { page: 0, perPage: 10 } });
      expect(result.scores).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(0);
      expect(result.pagination.perPage).toBe(10);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('getScoresByEntityId should return paginated scores with total count when returnPaginationResults is true', async () => {
      const scorer = createSampleScore({ scorerId: `scorer-${randomUUID()}` });
      await storage.saveScore(scorer);

      const result = await storage.getScoresByEntityId({
        entityId: scorer.entity!.id!,
        entityType: scorer.entityType!,
        pagination: { page: 0, perPage: 10 },
      });
      expect(result.scores).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(0);
      expect(result.pagination.perPage).toBe(10);
      expect(result.pagination.hasMore).toBe(false);
    });
  });
}
