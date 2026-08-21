import { assert, describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../mock';
import type { CreateScoreRecord } from './scores';

function makeScore(scoreId: string, metadata?: Record<string, unknown>): CreateScoreRecord {
  return {
    scoreId,
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    traceId: `trace-${scoreId}`,
    scorerId: 'relevance',
    score: 0.5,
    metadata,
  };
}

describe('ObservabilityInMemory score metadata filtering', () => {
  it('returns only scores whose metadata matches all provided keys', async () => {
    const observability = new InMemoryStore().stores.observability;
    assert(observability);
    await observability.batchCreateScores({
      scores: [
        makeScore('score-a', { env: 'prod', region: 'us' }),
        makeScore('score-b', { env: 'dev', region: 'us' }),
        makeScore('score-c'),
      ],
    });

    const result = await observability.listScores({
      filters: { metadata: { env: 'prod', region: 'us' } },
    });

    expect(result.scores.map(score => score.scoreId)).toEqual(['score-a']);
  });

  it('excludes scores without metadata when a metadata filter is provided', async () => {
    const observability = new InMemoryStore().stores.observability;
    assert(observability);
    await observability.batchCreateScores({
      scores: [makeScore('score-a'), makeScore('score-b', { env: 'prod' })],
    });

    const result = await observability.listScores({
      filters: { metadata: { env: 'prod' } },
    });

    expect(result.scores.map(score => score.scoreId)).toEqual(['score-b']);
  });

  it('matches non-string metadata values with exact equality', async () => {
    const observability = new InMemoryStore().stores.observability;
    assert(observability);
    await observability.batchCreateScores({
      scores: [makeScore('score-a', { attempt: 2, flagged: true }), makeScore('score-b', { attempt: '2' })],
    });

    const result = await observability.listScores({
      filters: { metadata: { attempt: 2 } },
    });

    expect(result.scores.map(score => score.scoreId)).toEqual(['score-a']);
  });

  it('treats an empty metadata filter as a no-op', async () => {
    const observability = new InMemoryStore().stores.observability;
    assert(observability);
    await observability.batchCreateScores({
      scores: [makeScore('score-a', { env: 'prod' }), makeScore('score-b')],
    });

    const result = await observability.listScores({
      filters: { metadata: {} },
    });

    expect(result.scores.map(score => score.scoreId).sort()).toEqual(['score-a', 'score-b']);
  });
});
