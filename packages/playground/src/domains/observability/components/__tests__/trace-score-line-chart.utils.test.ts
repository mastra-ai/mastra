import type { ScoreRowData } from '@mastra/core/evals';
import { describe, expect, it } from 'vitest';
import { buildScoreChartData } from '../trace-score-line-chart.utils';

const makeScore = (overrides: {
  id: string;
  createdAt: string;
  score: number;
  scorer?: { id: string; name?: string };
}) =>
  ({
    id: overrides.id,
    createdAt: overrides.createdAt,
    score: overrides.score,
    scorer: overrides.scorer ?? { id: 'scorer-1', name: 'Relevance' },
  }) as unknown as ScoreRowData;

describe('buildScoreChartData', () => {
  describe('given no scores', () => {
    it('returns empty data and no scorer names', () => {
      expect(buildScoreChartData([])).toEqual({ data: [], scorerNames: [] });
    });
  });

  describe('given unsorted scores', () => {
    it('returns points in ascending time order', () => {
      const result = buildScoreChartData([
        makeScore({ id: 'b', createdAt: '2026-08-25T10:00:02.000Z', score: 0.8 }),
        makeScore({ id: 'a', createdAt: '2026-08-25T10:00:01.000Z', score: 0.4 }),
      ]);

      expect(result.data.map(point => point.Relevance)).toEqual([0.4, 0.8]);
    });
  });

  describe('given scores from two scorers', () => {
    it('keys each point by its own scorer only, in first-seen order', () => {
      const result = buildScoreChartData([
        makeScore({
          id: 'a',
          createdAt: '2026-08-25T10:00:01.000Z',
          score: 0.4,
          scorer: { id: 's1', name: 'Relevance' },
        }),
        makeScore({
          id: 'b',
          createdAt: '2026-08-25T10:00:02.000Z',
          score: 0.9,
          scorer: { id: 's2', name: 'Toxicity' },
        }),
      ]);

      expect(result.scorerNames).toEqual(['Relevance', 'Toxicity']);
      expect(result.data[0]).toMatchObject({ Relevance: 0.4 });
      expect(result.data[0]).not.toHaveProperty('Toxicity');
      expect(result.data[1]).toMatchObject({ Toxicity: 0.9 });
      expect(result.data[1]).not.toHaveProperty('Relevance');
    });
  });

  describe('given a scorer without a name', () => {
    it('falls back to the scorer id', () => {
      const result = buildScoreChartData([
        makeScore({ id: 'a', createdAt: '2026-08-25T10:00:01.000Z', score: 0.5, scorer: { id: 'scorer-id-only' } }),
      ]);

      expect(result.scorerNames).toEqual(['scorer-id-only']);
      expect(result.data[0]).toMatchObject({ 'scorer-id-only': 0.5 });
    });
  });

  it('labels each point with a formatted time', () => {
    const result = buildScoreChartData([makeScore({ id: 'a', createdAt: '2026-08-25T10:00:01.000Z', score: 0.5 })]);

    expect(typeof result.data[0]?.time).toBe('string');
    expect(result.data[0]?.time).not.toHaveLength(0);
  });
});
