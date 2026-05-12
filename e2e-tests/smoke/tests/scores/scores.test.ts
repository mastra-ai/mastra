import { describe, it, expect } from 'vitest';
import { fetchJson, fetchApi } from '../utils.js';

const SCORE_RUN_ID = crypto.randomUUID();

/**
 * Build a minimal ScoreRowData payload for POST /scores.
 */
function makeScore(overrides: {
  scorerId: string;
  entityId: string;
  score: number;
  runId?: string;
  reason?: string;
}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    scorerId: overrides.scorerId,
    entityId: overrides.entityId,
    runId: overrides.runId ?? SCORE_RUN_ID,
    output: { text: 'test output' },
    score: overrides.score,
    reason: overrides.reason,
    scorer: { id: overrides.scorerId },
    source: 'TEST',
    entity: { id: overrides.entityId, type: 'AGENT' },
    entityType: 'AGENT',
    createdAt: now,
    updatedAt: now,
  };
}

// NOTE: Test order matters — POST /scores creates records that GET tests depend on.
describe('scores', () => {
  describe('GET /scores/scorers', () => {
    it('should list registered scorers', async () => {
      const { status, data } = await fetchJson<Record<string, any>>('/api/scores/scorers');

      expect(status).toBe(200);

      // Both scorers should be present by their ID
      expect(data).toHaveProperty('completeness');
      expect(data).toHaveProperty('length-check');

      // Verify completeness scorer shape
      expect(data['completeness']).toMatchObject({
        scorer: {
          config: {
            id: 'completeness',
            name: 'Completeness Scorer',
            description: 'Checks whether the output contains non-empty content',
          },
        },
        isRegistered: true,
        agentIds: expect.any(Array),
        agentNames: expect.any(Array),
        workflowIds: expect.any(Array),
      });

      // Verify length-check scorer shape
      expect(data['length-check']).toMatchObject({
        scorer: {
          config: {
            id: 'length-check',
            name: 'Length Check Scorer',
            description: 'Scores output based on character length (0-1 scale)',
          },
        },
        isRegistered: true,
      });
    });
  });

  describe('GET /scores/scorers/:scorerId', () => {
    it('should return scorer details by ID', async () => {
      const { status, data } = await fetchJson<any>('/api/scores/scorers/completeness');

      expect(status).toBe(200);
      expect(data).toMatchObject({
        scorer: {
          config: {
            id: 'completeness',
            name: 'Completeness Scorer',
            description: 'Checks whether the output contains non-empty content',
          },
        },
        isRegistered: true,
      });
    });

    it('should return null for non-existent scorer', async () => {
      const { status, data } = await fetchJson<any>('/api/scores/scorers/does-not-exist');

      expect(status).toBe(200);
      expect(data).toBeNull();
    });
  });

  describe('POST /scores', () => {
    it('should save a score record', async () => {
      const score = makeScore({
        scorerId: 'completeness',
        entityId: 'test-agent',
        score: 1,
        reason: 'Output was non-empty',
      });

      const { status, data } = await fetchJson<any>('/api/scores', {
        method: 'POST',
        body: JSON.stringify({ score }),
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({
        score: expect.objectContaining({
          scorerId: 'completeness',
          entityId: 'test-agent',
          score: 1,
          reason: 'Output was non-empty',
        }),
      });
    });

    it('should save a second score for the same run', async () => {
      const score = makeScore({
        scorerId: 'length-check',
        entityId: 'test-agent',
        score: 0.42,
      });

      const { status, data } = await fetchJson<any>('/api/scores', {
        method: 'POST',
        body: JSON.stringify({ score }),
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({
        score: expect.objectContaining({
          scorerId: 'length-check',
          score: 0.42,
        }),
      });
    });
  });

  describe('GET /scores/run/:runId', () => {
    it('should list scores for the run', async () => {
      const { status, data } = await fetchJson<any>(`/api/scores/run/${SCORE_RUN_ID}`);

      expect(status).toBe(200);
      expect(data.pagination).toMatchObject({
        total: 2,
        page: 0,
        perPage: 10,
        hasMore: false,
      });
      expect(data.scores).toHaveLength(2);

      const scorerIds = data.scores.map((s: any) => s.scorerId);
      expect(scorerIds).toContain('completeness');
      expect(scorerIds).toContain('length-check');
    });

    it('should return empty scores for unknown run', async () => {
      const { status, data } = await fetchJson<any>(`/api/scores/run/${crypto.randomUUID()}`);

      expect(status).toBe(200);
      expect(data.pagination.total).toBe(0);
      expect(data.scores).toHaveLength(0);
    });
  });

  describe('GET /scores/scorer/:scorerId', () => {
    it('should list scores by scorer ID', async () => {
      const { status, data } = await fetchJson<any>('/api/scores/scorer/completeness');

      expect(status).toBe(200);
      expect(data.pagination).toMatchObject({
        total: 1,
        page: 0,
        perPage: 10,
      });
      expect(data.scores).toHaveLength(1);
      expect(data.scores).toContainEqual(
        expect.objectContaining({
          scorerId: 'completeness',
          score: 1,
        }),
      );
    });

    it('should return empty scores for unknown scorer', async () => {
      const { status, data } = await fetchJson<any>('/api/scores/scorer/nonexistent');

      expect(status).toBe(200);
      expect(data.scores).toHaveLength(0);
    });
  });

  describe('GET /scores/entity/:entityType/:entityId', () => {
    it('should list scores by entity', async () => {
      const { status, data } = await fetchJson<any>('/api/scores/entity/AGENT/test-agent');

      expect(status).toBe(200);
      expect(data.pagination).toMatchObject({
        total: 2,
        page: 0,
        perPage: 10,
      });
      expect(data.scores).toHaveLength(2);

      // All scores should be for the test-agent entity
      for (const score of data.scores) {
        expect(score.entityId).toBe('test-agent');
      }
    });

    it('should return 404 for unknown entity', async () => {
      const res = await fetchApi('/api/scores/entity/AGENT/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
