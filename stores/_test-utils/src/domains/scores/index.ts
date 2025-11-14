import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { createSampleScore } from './data';
import type { ScoreRowData } from '@mastra/core/evals';
import { TABLE_SCORERS, type MastraStorage } from '@mastra/core/storage';

// Helper function for creating test scores
async function createScores(
  storage: MastraStorage,
  configs: Array<{
    count: number;
    scorerId: string;
    traceId: string;
    spanId: string;
  }>,
): Promise<ScoreRowData[]> {
  const allScores: ScoreRowData[] = [];

  for (const config of configs) {
    for (let i = 0; i < config.count; i++) {
      const score = createSampleScore({
        scorerId: config.scorerId,
        traceId: config.traceId,
        spanId: config.spanId,
      });
      allScores.push(score);
      await storage.saveScore(score);
    }
  }

  return allScores;
}

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
      const allScoresByScorerId = await storage.listScoresByScorerId({
        scorerId,
        pagination: { page: 0, perPage: 10 },
      });
      expect(allScoresByScorerId?.scores).toHaveLength(3);
      expect(allScoresByScorerId?.scores.map(e => e.runId)).toEqual(
        expect.arrayContaining([score1.runId, score2.runId, score3.runId]),
      );
      expect(allScoresByScorerId?.scores.map(s => s.scorer.id)).toEqual(
        expect.arrayContaining([score1.scorer.id, score2.scorer.id, score3.scorer.id]),
      );

      // Test getting scores for non-existent scorer
      const nonExistentScores = await storage.listScoresByScorerId({
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
      const scoresBySource = await storage.listScoresByScorerId({
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
      const result = await storage.listScoresByRunId({ runId: scorer.runId, pagination: { page: 0, perPage: 10 } });
      expect(result.scores).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(0);
      expect(result.pagination.perPage).toBe(10);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('listScoresByEntityId should return paginated scores with total count when returnPaginationResults is true', async () => {
      const scorer = createSampleScore({ scorerId: `scorer-${randomUUID()}` });
      await storage.saveScore(scorer);

      const result = await storage.listScoresByEntityId({
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

    if (storage.supports.listScoresBySpan) {
      it('should retrieve scores by trace and span id', async () => {
        const scorerId = `scorer-${randomUUID()}`;
        const traceId = randomUUID();
        const spanId = randomUUID();

        const score = createSampleScore({ scorerId, traceId, spanId });
        await storage.saveScore(score);

        const result = await storage.listScoresBySpan({
          traceId,
          spanId,
          pagination: { page: 0, perPage: 10 },
        });

        expect(result.scores.length).toBe(1);
        expect(result.scores[0]?.traceId).toBe(traceId);
        expect(result.scores[0]?.spanId).toBe(spanId);
        expect(result.pagination.total).toBe(1);
        expect(result.pagination.hasMore).toBe(false);
      });

      it('should retrieve multiple scores by trace and span id', async () => {
        const scorerId = `scorer-${randomUUID()}`;
        const traceId = randomUUID();
        const spanId = randomUUID();

        // Create multiple scores for the same trace/span
        const score1 = createSampleScore({ scorerId, traceId, spanId });
        const score2 = createSampleScore({ scorerId, traceId, spanId });
        const score3 = createSampleScore({ scorerId, traceId, spanId });

        await storage.saveScore(score1);
        await storage.saveScore(score2);
        await storage.saveScore(score3);

        const result = await storage.listScoresBySpan({
          traceId,
          spanId,
          pagination: { page: 0, perPage: 10 },
        });

        expect(result.scores.every(s => s.traceId === traceId)).toBe(true);
        expect(result.scores.every(s => s.spanId === spanId)).toBe(true);
        expect(result.scores.length).toBe(3);
        expect(result.pagination.total).toBe(3);
        expect(result.pagination.hasMore).toBe(false);
      });

      it('should handle first page pagination correctly', async () => {
        const scorerId = `scorer-${randomUUID()}`;
        const traceId = randomUUID();
        const spanId = randomUUID();

        await createScores(storage, [
          { count: 5, scorerId, traceId, spanId }, // target scores
          { count: 1, scorerId, traceId: randomUUID(), spanId }, // different trace
          { count: 1, scorerId, traceId, spanId: randomUUID() }, // different span
          { count: 1, scorerId, traceId: randomUUID(), spanId: randomUUID() }, // both different
        ]);

        const firstPage = await storage.listScoresBySpan({
          traceId,
          spanId,
          pagination: { page: 0, perPage: 2 },
        });

        expect(firstPage.scores.length).toBe(2);
        expect(firstPage.pagination.total).toBe(5);
        expect(firstPage.pagination.page).toBe(0);
        expect(firstPage.pagination.perPage).toBe(2);
        expect(firstPage.pagination.hasMore).toBe(true);

        expect(firstPage.scores.every(s => s.traceId === traceId && s.spanId === spanId)).toBe(true);
      });

      it('should handle middle page pagination correctly', async () => {
        const scorerId = `scorer-${randomUUID()}`;
        const traceId = randomUUID();
        const spanId = randomUUID();

        const allScores = await createScores(storage, [
          { count: 5, scorerId, traceId, spanId }, // target scores
          { count: 1, scorerId, traceId: randomUUID(), spanId }, // different trace
          { count: 1, scorerId, traceId, spanId: randomUUID() }, // different span
          { count: 1, scorerId, traceId: randomUUID(), spanId: randomUUID() }, // both different
        ]);

        const secondPage = await storage.listScoresBySpan({
          traceId,
          spanId,
          pagination: { page: 1, perPage: 2 },
        });

        expect(secondPage.scores.length).toBe(2);
        expect(secondPage.pagination.total).toBe(5);
        expect(secondPage.pagination.page).toBe(1);
        expect(secondPage.pagination.perPage).toBe(2);
        expect(secondPage.pagination.hasMore).toBe(true);

        expect(secondPage.scores.every(s => s.traceId === traceId && s.spanId === spanId)).toBe(true);
      });

      it('should handle last page pagination', async () => {
        const scorerId = `scorer-${randomUUID()}`;
        const traceId = randomUUID();
        const spanId = randomUUID();

        const otherTraceId1 = randomUUID();
        const otherTraceId2 = randomUUID();
        const otherSpanId1 = randomUUID();
        const otherSpanId2 = randomUUID();

        await createScores(storage, [
          { count: 5, scorerId, traceId, spanId }, // target scores
          { count: 1, scorerId, traceId: otherTraceId1, spanId }, // different trace, same span
          { count: 1, scorerId, traceId, spanId: otherSpanId1 }, // same trace, different span
          { count: 1, scorerId, traceId: otherTraceId2, spanId: otherSpanId2 }, // both different
          { count: 1, scorerId, traceId: otherTraceId1, spanId }, // different trace, same span (again)
          { count: 1, scorerId, traceId, spanId: otherSpanId2 }, // same trace, different span (again)
        ]);

        const firstPage = await storage.listScoresBySpan({
          traceId,
          spanId,
          pagination: { page: 0, perPage: 2 },
        });

        const secondPage = await storage.listScoresBySpan({
          traceId,
          spanId,
          pagination: { page: 1, perPage: 2 },
        });

        const lastPage = await storage.listScoresBySpan({
          traceId,
          spanId,
          pagination: { page: 2, perPage: 2 },
        });

        expect(lastPage.scores.length).toBe(1);
        expect(lastPage.pagination.total).toBe(5);
        expect(lastPage.pagination.page).toBe(2);
        expect(lastPage.pagination.perPage).toBe(2);
        expect(lastPage.pagination.hasMore).toBe(false);

        const allPages = [firstPage, secondPage, lastPage];
        for (const page of allPages) {
          expect(page.scores.every(s => s.traceId === traceId && s.spanId === spanId)).toBe(true);
        }
      });
    }
  });
}
