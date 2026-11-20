// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TraceScoresListView } from '../trace-scores-list-view';
import { TraceScoresTabView } from '../trace-scores-tab-view';
import { buildScore, scoresResponse } from './fixtures/trace-scores';
import { recordRequests } from '@/test/record-requests';
import { renderWithProviders } from '@/test/render';

const twoScores = scoresResponse([
  buildScore({ id: 'score-1', score: 0.8567 }),
  buildScore({ id: 'score-2', scorerId: 'toxicity', scorer: {}, score: 0 }),
]);

describe('TraceScoresListView', () => {
  describe('when the scores come from the props', () => {
    it('lists each scorer against its formatted score', () => {
      renderWithProviders(<TraceScoresListView scores={twoScores} onScoreSelect={() => {}} onPageChange={() => {}} />);

      expect(screen.getAllByRole('term').map(term => term.textContent)).toEqual(['Answer relevancy', 'toxicity']);
      expect(screen.getAllByRole('definition').map(value => value.textContent)).toEqual(['0.86', '0.00']);
    });

    it('sends no request to the Mastra server', async () => {
      const requests = recordRequests();
      const { queryClient } = renderWithProviders(
        <TraceScoresListView scores={twoScores} onScoreSelect={() => {}} onPageChange={() => {}} />,
      );

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(requests).toEqual([]);
    });

    it('opens the score that was clicked', () => {
      const onScoreSelect = vi.fn<(scoreId: string) => void>();
      renderWithProviders(
        <TraceScoresListView scores={twoScores} onScoreSelect={onScoreSelect} onPageChange={() => {}} />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open Answer relevancy score' }));

      expect(onScoreSelect).toHaveBeenCalledWith('score-1');
    });
  });

  describe('when the host has more scores to page through', () => {
    it('asks the host for the next page', () => {
      const onPageChange = vi.fn<(page: number) => void>();
      renderWithProviders(
        <TraceScoresListView
          scores={scoresResponse([buildScore({})], true)}
          onScoreSelect={() => {}}
          onPageChange={onPageChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(onPageChange).toHaveBeenCalledWith(1);
    });
  });

  describe('when the scores are still loading', () => {
    it('shows no empty state yet', () => {
      renderWithProviders(<TraceScoresListView isLoading onScoreSelect={() => {}} onPageChange={() => {}} />);

      expect(screen.queryByText('No scores yet. Score this trace to see results here.')).toBeNull();
    });
  });

  describe('when the span has no scores', () => {
    it('says there is nothing yet', () => {
      renderWithProviders(
        <TraceScoresListView scores={scoresResponse([])} onScoreSelect={() => {}} onPageChange={() => {}} />,
      );

      expect(screen.getByText('No scores yet. Score this trace to see results here.')).toBeTruthy();
    });
  });
});

describe('TraceScoresTabView', () => {
  describe('when the scores come from the props', () => {
    it('shows one card per scoring', () => {
      renderWithProviders(<TraceScoresTabView scores={twoScores} onScoreSelect={() => {}} onPageChange={() => {}} />);

      expect(screen.getAllByRole('button', { name: /^Score / })).toHaveLength(2);
      expect(screen.getByText('Answer relevancy')).toBeTruthy();
    });

    it('opens the score that was clicked', () => {
      const onScoreSelect = vi.fn<(scoreId: string) => void>();
      renderWithProviders(
        <TraceScoresTabView
          scores={scoresResponse([buildScore({ id: 'score-42' })])}
          onScoreSelect={onScoreSelect}
          onPageChange={() => {}}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /^Score / }));

      expect(onScoreSelect).toHaveBeenCalledWith('score-42');
    });
  });

  describe('when the host has more scores to page through', () => {
    it('asks the host for the next page', () => {
      const onPageChange = vi.fn<(page: number) => void>();
      renderWithProviders(
        <TraceScoresTabView
          scores={scoresResponse([buildScore({})], true)}
          onScoreSelect={() => {}}
          onPageChange={onPageChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(onPageChange).toHaveBeenCalledWith(1);
    });
  });

  describe('when the span has no scores', () => {
    it('says there is nothing yet', () => {
      renderWithProviders(
        <TraceScoresTabView scores={scoresResponse([])} onScoreSelect={() => {}} onPageChange={() => {}} />,
      );

      expect(screen.getByText('No scores yet')).toBeTruthy();
    });
  });
});
