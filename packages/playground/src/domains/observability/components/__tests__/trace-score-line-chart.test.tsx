import type { ListScoresResponse, ScoreRowData } from '@mastra/core/evals';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TraceScoreLineChart } from '../trace-score-line-chart';

const makeScore = (overrides: { id: string; createdAt: string; score: number; scorerName: string }) =>
  ({
    id: overrides.id,
    createdAt: overrides.createdAt,
    score: overrides.score,
    scorer: { id: `${overrides.scorerName}-id`, name: overrides.scorerName },
  }) as unknown as ScoreRowData;

const makeScoresData = (scores: ScoreRowData[]): ListScoresResponse =>
  ({
    scores,
    pagination: { total: scores.length, page: 0, perPage: 10, hasMore: false },
  }) as unknown as ListScoresResponse;

describe('TraceScoreLineChart', () => {
  describe('when there are at least two scores', () => {
    it('renders a legend entry per scorer with its average', () => {
      render(
        <TraceScoreLineChart
          scoresData={makeScoresData([
            makeScore({ id: 'a', createdAt: '2026-08-25T10:00:01.000Z', score: 0.4, scorerName: 'Relevance' }),
            makeScore({ id: 'b', createdAt: '2026-08-25T10:00:02.000Z', score: 0.8, scorerName: 'Relevance' }),
            makeScore({ id: 'c', createdAt: '2026-08-25T10:00:03.000Z', score: 1, scorerName: 'Toxicity' }),
          ])}
        />,
      );

      expect(screen.getByText('Relevance')).toBeTruthy();
      expect(screen.getByText('Toxicity')).toBeTruthy();
      expect(screen.getByText('0.60')).toBeTruthy();
      expect(screen.getByText('1.00')).toBeTruthy();
    });
  });

  describe('when there is no score data', () => {
    it('renders nothing for undefined data', () => {
      const { container } = render(<TraceScoreLineChart scoresData={undefined} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders nothing for an empty score list', () => {
      const { container } = render(<TraceScoreLineChart scoresData={makeScoresData([])} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('when there is a single score', () => {
    it('still renders the chart with its legend', () => {
      render(
        <TraceScoreLineChart
          scoresData={makeScoresData([
            makeScore({ id: 'a', createdAt: '2026-08-25T10:00:01.000Z', score: 0.4, scorerName: 'Relevance' }),
          ])}
        />,
      );
      expect(screen.getByText('Relevance')).toBeTruthy();
      expect(screen.getByText('0.40')).toBeTruthy();
    });
  });
});
