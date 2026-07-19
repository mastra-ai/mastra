import { describe, expect, it } from 'vitest';
import type { SaveScorePayload } from '../../../evals/types';
import { InMemoryStore } from '../../mock';

function makeScore(scorerId: string, createdAt: Date, runId: string): SaveScorePayload {
  return {
    scorerId,
    runId,
    createdAt,
    scorer: { name: scorerId },
    source: 'TEST',
    entityId: 'entity-1',
    entityType: 'AGENT',
    score: 1,
    input: {},
    output: {},
  } as unknown as SaveScorePayload;
}

describe('ScoresInMemory listScoresByScorerId ordering', () => {
  it('returns scores newest-first (createdAt DESC), matching pg/libsql', async () => {
    const store = new InMemoryStore();
    const scores = (await store.getStore('scores'))!;
    const scorerId = 'scorer-1';

    // Saved oldest -> newest (insertion order is ascending by createdAt).
    await scores.saveScore(makeScore(scorerId, new Date('2026-01-01T00:00:00.000Z'), 'run-old'));
    await scores.saveScore(makeScore(scorerId, new Date('2026-01-02T00:00:00.000Z'), 'run-mid'));
    await scores.saveScore(makeScore(scorerId, new Date('2026-01-03T00:00:00.000Z'), 'run-new'));

    const { scores: page } = await scores.listScoresByScorerId({
      scorerId,
      pagination: { page: 0, perPage: 10 },
    });

    const runIds = page.map(s => s.runId);
    expect(runIds).toEqual(['run-new', 'run-mid', 'run-old']);
  });

  it('respects DESC order across pagination (first page is the newest)', async () => {
    const store = new InMemoryStore();
    const scores = (await store.getStore('scores'))!;
    const scorerId = 'scorer-1';

    await scores.saveScore(makeScore(scorerId, new Date('2026-01-01T00:00:00.000Z'), 'run-old'));
    await scores.saveScore(makeScore(scorerId, new Date('2026-01-02T00:00:00.000Z'), 'run-mid'));
    await scores.saveScore(makeScore(scorerId, new Date('2026-01-03T00:00:00.000Z'), 'run-new'));

    const { scores: firstPage } = await scores.listScoresByScorerId({
      scorerId,
      pagination: { page: 0, perPage: 2 },
    });

    expect(firstPage.map(s => s.runId)).toEqual(['run-new', 'run-mid']);
  });
});
