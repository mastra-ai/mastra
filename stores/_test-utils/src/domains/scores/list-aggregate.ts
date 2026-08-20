import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSampleScore } from './data';
import type { MastraStorage, ScoresStorage } from '@mastra/core/storage';

/**
 * Shared suite for the unified `listScores` / `aggregateScores` API.
 * Only registered for adapters that implement `listScores` natively
 * (capability `unifiedScoreListing`). Assertions are hand-computed so the
 * native SQL path is verified against the same fixtures the in-memory
 * base-class composition is tested with in @mastra/core.
 */
export function createListAggregateScoresTest({ storage }: { storage: MastraStorage }) {
  let scores: ScoresStorage;

  beforeAll(async () => {
    const store = await storage.getStore('scores');
    if (!store) throw new Error('Scores storage not found');
    scores = store;
  });

  describe('Unified listScores / aggregateScores', () => {
    beforeEach(async () => {
      await scores.dangerouslyClearAll();
    });

    async function seed() {
      const scorerA = `scorer-a-${randomUUID()}`;
      const scorerB = `scorer-b-${randomUUID()}`;
      const traceId = `trace-${randomUUID()}`;
      const threadId = `thread-${randomUUID()}`;

      await scores.saveScore(
        createSampleScore({
          scorerId: scorerA,
          entityId: 'agent-1',
          entityType: 'AGENT',
          traceId,
          spanId: `span-${randomUUID()}`,
          threadId,
          score: 0.9,
          source: 'LIVE',
          metadata: { deployment: 'v42', cohort: 'oncology', passing: true, attempt: 1 },
        }),
      );
      await scores.saveScore(
        createSampleScore({
          scorerId: scorerA,
          entityId: 'agent-1',
          entityType: 'AGENT',
          score: 0.4,
          source: 'LIVE',
          metadata: { deployment: 'v42', cohort: 'cardiology', passing: false, attempt: 2 },
        }),
      );
      await scores.saveScore(
        createSampleScore({
          scorerId: scorerB,
          entityId: 'wf-1',
          entityType: 'WORKFLOW',
          score: 0.6,
          source: 'TEST',
          metadata: { deployment: 'v41', cohort: 'oncology', nested: { model: 'claude-sonnet-4-5' } },
        }),
      );

      return { scorerA, scorerB, traceId, threadId };
    }

    const page = { page: 0, perPage: 10 };

    it('filters by scorerIds, entityId/type, traceId, threadId, and source', async () => {
      const { scorerA, scorerB, traceId, threadId } = await seed();

      const byScorer = await scores.listScores({ filter: { scorerIds: [scorerA] }, pagination: page });
      expect(byScorer.scores).toHaveLength(2);
      expect(byScorer.scores.every(s => s.scorerId === scorerA)).toBe(true);

      const byBothScorers = await scores.listScores({ filter: { scorerIds: [scorerA, scorerB] }, pagination: page });
      expect(byBothScorers.pagination.total).toBe(3);

      const byEntity = await scores.listScores({
        filter: { entityId: 'wf-1', entityType: 'WORKFLOW' },
        pagination: page,
      });
      expect(byEntity.scores).toHaveLength(1);
      expect(byEntity.scores[0]?.scorerId).toBe(scorerB);

      const byTrace = await scores.listScores({ filter: { traceId }, pagination: page });
      expect(byTrace.scores).toHaveLength(1);

      const byThread = await scores.listScores({ filter: { threadId }, pagination: page });
      expect(byThread.scores).toHaveLength(1);
      expect(byThread.scores[0]?.threadId).toBe(threadId);

      const bySource = await scores.listScores({
        filter: { scorerIds: [scorerA, scorerB], source: 'TEST' },
        pagination: page,
      });
      expect(bySource.scores).toHaveLength(1);
      expect(bySource.scores[0]?.source).toBe('TEST');
    });

    it('filters by score range and date range', async () => {
      const { scorerA, scorerB } = await seed();
      const all = { scorerIds: [scorerA, scorerB] };

      const mid = await scores.listScores({ filter: { ...all, minScore: 0.5, maxScore: 0.8 }, pagination: page });
      expect(mid.scores).toHaveLength(1);
      expect(mid.scores[0]?.score).toBeCloseTo(0.6);

      const now = new Date();
      const past = new Date(now.getTime() - 60_000);
      const future = new Date(now.getTime() + 60_000);

      const inWindow = await scores.listScores({
        filter: { ...all, startDate: past, endDate: future },
        pagination: page,
      });
      expect(inWindow.pagination.total).toBe(3);

      const beforeWindow = await scores.listScores({ filter: { ...all, endDate: past }, pagination: page });
      expect(beforeWindow.scores).toHaveLength(0);

      const afterWindow = await scores.listScores({ filter: { ...all, startDate: future }, pagination: page });
      expect(afterWindow.scores).toHaveLength(0);
    });

    it('filters by metadata: exact match, AND across keys, non-string values, nested objects, missing key', async () => {
      const { scorerA, scorerB } = await seed();
      const all = { scorerIds: [scorerA, scorerB] };

      const byString = await scores.listScores({
        filter: { ...all, metadata: { deployment: 'v42' } },
        pagination: page,
      });
      expect(byString.scores).toHaveLength(2);

      const byTwoKeys = await scores.listScores({
        filter: { ...all, metadata: { deployment: 'v42', cohort: 'oncology' } },
        pagination: page,
      });
      expect(byTwoKeys.scores).toHaveLength(1);
      expect((byTwoKeys.scores[0]?.metadata as any)?.cohort).toBe('oncology');

      const byBoolean = await scores.listScores({ filter: { ...all, metadata: { passing: true } }, pagination: page });
      expect(byBoolean.scores).toHaveLength(1);

      const byNumber = await scores.listScores({ filter: { ...all, metadata: { attempt: 2 } }, pagination: page });
      expect(byNumber.scores).toHaveLength(1);
      expect(byNumber.scores[0]?.score).toBeCloseTo(0.4);

      const byNested = await scores.listScores({
        filter: { ...all, metadata: { nested: { model: 'claude-sonnet-4-5' } } },
        pagination: page,
      });
      expect(byNested.scores).toHaveLength(1);
      expect(byNested.scores[0]?.scorerId).toBe(scorerB);

      const missingKey = await scores.listScores({
        filter: { ...all, metadata: { doesNotExist: 'x' } },
        pagination: page,
      });
      expect(missingKey.scores).toHaveLength(0);

      // Value mismatch on an existing key
      const mismatch = await scores.listScores({
        filter: { ...all, metadata: { deployment: 'v999' } },
        pagination: page,
      });
      expect(mismatch.scores).toHaveLength(0);
    });

    it('paginates with stable ordering, no dupes or gaps', async () => {
      const scorerId = `scorer-${randomUUID()}`;
      for (let i = 0; i < 5; i++) {
        await scores.saveScore(createSampleScore({ scorerId, score: i / 10 }));
      }

      const seen = new Set<string>();
      for (let p = 0; p < 3; p++) {
        const result = await scores.listScores({
          filter: { scorerIds: [scorerId] },
          pagination: { page: p, perPage: 2 },
        });
        expect(result.pagination.total).toBe(5);
        expect(result.pagination.hasMore).toBe(p < 2);
        for (const s of result.scores) {
          expect(seen.has(s.id)).toBe(false);
          seen.add(s.id);
        }
      }
      expect(seen.size).toBe(5);
    });

    it('respects tenancy filters in list and aggregate', async () => {
      const scorerId = `scorer-${randomUUID()}`;
      await scores.saveScore(createSampleScore({ scorerId, organizationId: 'org-1', projectId: 'proj-1', score: 1 }));
      await scores.saveScore(createSampleScore({ scorerId, organizationId: 'org-2', projectId: 'proj-2', score: 0 }));

      const org1 = await scores.listScores({
        filter: { scorerIds: [scorerId] },
        pagination: page,
        filters: { organizationId: 'org-1' },
      });
      expect(org1.scores).toHaveLength(1);
      expect(org1.scores[0]?.organizationId).toBe('org-1');

      const agg = await scores.aggregateScores({
        filter: { scorerIds: [scorerId] },
        filters: { organizationId: 'org-2' },
      });
      expect(agg.rows).toHaveLength(1);
      expect(agg.rows[0]?.count).toBe(1);
      expect(agg.rows[0]?.avg).toBeCloseTo(0);
    });

    it('aggregates avg/p50/p95/count/passRate and groups by metadata key', async () => {
      const { scorerA, scorerB } = await seed();
      const all = { scorerIds: [scorerA, scorerB] };

      const overall = await scores.aggregateScores({ filter: all, passThreshold: 0.5 });
      expect(overall.rows).toHaveLength(1);
      const row = overall.rows[0]!;
      expect(row.count).toBe(3);
      expect(row.avg).toBeCloseTo((0.9 + 0.4 + 0.6) / 3);
      expect(row.p50).toBeCloseTo(0.6);
      expect(row.passRate).toBeCloseTo(2 / 3);

      const byCohort = await scores.aggregateScores({ filter: all, groupBy: ['metadata:cohort'] });
      const cohorts = new Map(byCohort.rows.map(r => [r.groups?.[0] ?? null, r]));
      expect(cohorts.get('oncology')?.count).toBe(2);
      expect(cohorts.get('oncology')?.avg).toBeCloseTo(0.75);
      expect(cohorts.get('cardiology')?.count).toBe(1);
    });

    it('upserts idempotently on caller-supplied id (external ingestion)', async () => {
      const scorerId = `scorer-${randomUUID()}`;
      const id = `external-${randomUUID()}`;

      const first = await scores.saveScore(
        createSampleScore({
          scorerId,
          score: 0.3,
          source: 'EXTERNAL',
          metadata: { grader: 'human-1', temporalRunId: 'wf-123' },
          id,
        }),
      );
      expect(first.score.id).toBe(id);

      // Re-post the same caller-supplied id with an updated score → converges to one row.
      await scores.saveScore(
        createSampleScore({
          scorerId,
          score: 0.7,
          source: 'EXTERNAL',
          metadata: { grader: 'human-1', temporalRunId: 'wf-123' },
          id,
        }),
      );

      const listed = await scores.listScores({ filter: { scorerIds: [scorerId] }, pagination: page });
      expect(listed.pagination.total).toBe(1);
      expect(listed.scores[0]?.id).toBe(id);
      expect(listed.scores[0]?.score).toBeCloseTo(0.7);
      expect(listed.scores[0]?.source).toBe('EXTERNAL');

      const byId = await scores.getScoreById({ id });
      expect(byId?.score).toBeCloseTo(0.7);
      // Original createdAt preserved on upsert.
      expect(new Date(byId!.createdAt).getTime()).toBe(new Date(first.score.createdAt).getTime());
    });
  });
}
