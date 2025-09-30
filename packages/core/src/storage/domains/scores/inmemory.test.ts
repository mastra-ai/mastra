import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import type { ScoreRowData } from '../../../scores/types';
import { ScoresInMemory } from './inmemory';

describe('ScoresInMemory.getScoresBySpan', () => {
  let scoresStorage: ScoresInMemory;
  let collection: Map<string, ScoreRowData>;

  const buildScore = (overrides: Partial<ScoreRowData> & { id: string }): ScoreRowData => {
    const now = new Date();
    return {
      id: overrides.id,
      traceId: overrides.traceId ?? 'trace-123',
      spanId: overrides.spanId ?? 'span-456',
      entityId: 'entity-1',
      entityType: 'type-1',
      scorerId: 'scorer-1',
      score: 0.5,
      source: 'manual',
      metadata: {},
      runId: 'run-1',
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
      ...overrides,
    };
  };

  const seed = (...scores: ScoreRowData[]) => scores.forEach(s => collection.set(s.id, s));

  beforeEach(() => {
    collection = new Map();
    scoresStorage = new ScoresInMemory({ collection });
  });

  afterEach(() => {
    collection.clear();
  });

  it('should return scores sorted by createdAt in descending order', async () => {
    // Arrange: Create multiple scores with different createdAt timestamps
    const score1 = buildScore({
      id: '1',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    });
    const score2 = buildScore({
      id: '2',
      createdAt: new Date('2023-02-01'),
      updatedAt: new Date('2023-02-01'),
    });
    const score3 = buildScore({
      id: '3',
      createdAt: new Date('2023-03-01'),
      updatedAt: new Date('2023-03-01'),
    });

    seed(score1, score2, score3);

    // Act: Retrieve scores with pagination
    const result = await scoresStorage.getScoresBySpan({
      traceId: 'trace-123',
      spanId: 'span-456',
      pagination: { page: 0, perPage: 10 },
    });

    // Assert: Verify scores are sorted by createdAt in descending order
    expect(result.scores).toHaveLength(3);
    for (let i = 0; i < result.scores.length - 1; i++) {
      expect(new Date(result.scores[i].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(result.scores[i + 1].createdAt).getTime(),
      );
    }
  });

  it('should only return scores that match both traceId and spanId', async () => {
    // Arrange: Create scores with different combinations of traceId and spanId
    const targetTraceId = 'trace-123';
    const targetSpanId = 'span-456';

    const matchingScore = buildScore({
      id: '1',
      traceId: targetTraceId,
      spanId: targetSpanId,
    });

    const onlyTraceMatches = buildScore({
      id: '2',
      traceId: targetTraceId,
      spanId: 'different-span',
    });

    const onlySpanMatches = buildScore({
      id: '3',
      traceId: 'different-trace',
      spanId: targetSpanId,
    });

    const neitherMatches = buildScore({
      id: '4',
      traceId: 'different-trace',
      spanId: 'different-span',
    });

    seed(matchingScore, onlyTraceMatches, onlySpanMatches, neitherMatches);

    // Act: Retrieve scores with specific traceId and spanId
    const result = await scoresStorage.getScoresBySpan({
      traceId: targetTraceId,
      spanId: targetSpanId,
      pagination: { page: 0, perPage: 10 },
    });

    // Assert: Verify only matching scores are returned
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0].traceId).toBe(targetTraceId);
    expect(result.scores[0].spanId).toBe(targetSpanId);
  });

  it('should return an empty scores array and correct pagination info when no scores match the provided traceId and spanId', async () => {
    // Arrange: Create scores with non-matching traceId/spanId
    const score1 = buildScore({
      id: '1',
      traceId: 'different-trace',
      spanId: 'different-span',
    });
    const score2 = buildScore({
      id: '2',
      traceId: 'another-trace',
      spanId: 'another-span',
    });

    seed(score1, score2);

    // Act: Retrieve scores with non-matching traceId/spanId
    const result = await scoresStorage.getScoresBySpan({
      traceId: 'test-trace',
      spanId: 'test-span',
      pagination: { page: 0, perPage: 10 },
    });

    // Assert: Verify empty results and pagination info
    expect(result.scores).toHaveLength(0);
    expect(result.pagination).toEqual({
      total: 0,
      page: 0,
      perPage: 10,
      hasMore: false,
    });
  });

  it('should correctly calculate hasMore pagination flag when there are more scores than the perPage limit', async () => {
    // Arrange: Create more scores than perPage limit
    const testTraceId = 'test-trace';
    const testSpanId = 'test-span';
    const perPage = 10;
    const totalScores = 15;

    const scores = Array.from({ length: totalScores }, (_, i) =>
      buildScore({
        id: `score-${i}`,
        traceId: testTraceId,
        spanId: testSpanId,
        createdAt: new Date(2023, 0, i + 1), // Different dates for consistent sorting
      }),
    );

    seed(...scores);

    // Act: Retrieve scores with pagination
    const result = await scoresStorage.getScoresBySpan({
      traceId: testTraceId,
      spanId: testSpanId,
      pagination: { page: 0, perPage },
    });

    // Assert: Verify pagination info and scores length
    expect(result.scores).toHaveLength(perPage);
    expect(result.pagination).toEqual({
      total: totalScores,
      page: 0,
      perPage,
      hasMore: true,
    });
  });

  it('should correctly calculate pagination info and slice scores for any page', async () => {
    // Arrange: Create 7 scores with same traceId/spanId and sequential dates
    const scores = Array.from({ length: 7 }, (_, i) =>
      buildScore({
        id: `id${i + 1}`,
        traceId: 'trace-1',
        spanId: 'span-1',
        createdAt: new Date(`2023-${String(i + 1).padStart(2, '0')}-01`),
      }),
    );

    seed(...scores);

    // Act: Request page 1 (second page) with perPage = 3
    const result = await scoresStorage.getScoresBySpan({
      traceId: 'trace-1',
      spanId: 'span-1',
      pagination: { page: 1, perPage: 3 },
    });

    // Assert: Verify correct slice and pagination info
    expect(result.scores.map(s => s.id)).toEqual(['id4', 'id3', 'id2']);
    expect(result.pagination).toEqual({
      total: 7,
      page: 1,
      perPage: 3,
      hasMore: true,
    });
  });
});
