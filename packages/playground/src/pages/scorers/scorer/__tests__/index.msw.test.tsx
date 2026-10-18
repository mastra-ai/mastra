import type { ClientScoreRowData, GetScorerResponse, ListScoresResponse } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import ScorerPage from '..';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const scorer: GetScorerResponse = {
  scorer: { config: { id: 'quality', description: 'Measures response quality' } },
  agentIds: [],
  agentNames: [],
  workflowIds: [],
  isRegistered: true,
  source: 'code',
};

const makeScore = (id: string, score: number, createdAt: string): ClientScoreRowData => ({
  id,
  scorerId: 'quality',
  entityId: 'agent-1',
  runId: `run-${id}`,
  output: 'output',
  score,
  scorer: { name: 'Quality' },
  source: 'LIVE',
  entity: { id: 'agent-1' },
  createdAt,
  updatedAt: createdAt,
});

const scoresResponse: ListScoresResponse = {
  pagination: { total: 3, page: 0, perPage: 10, hasMore: false },
  scores: [
    makeScore('score-mid', 0.5, '2026-08-25T10:00:00.000Z'),
    makeScore('score-high', 0.9, '2026-08-27T10:00:00.000Z'),
    makeScore('score-low', 0.1, '2026-08-26T10:00:00.000Z'),
  ],
};

const useScorerHandlers = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/scores/scorers/quality`, () => HttpResponse.json(scorer)),
    http.get(`${TEST_BASE_URL}/api/scores/scorer/quality`, () => HttpResponse.json(scoresResponse)),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json({})),
  );
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

const renderPage = (initialEntry = '/scorers/quality') =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/scorers/:scorerId" element={<ScorerPage />} />
      </Routes>
      <LocationProbe />
    </>,
    { router: { initialEntries: [initialEntry] } },
  );

const renderedScores = () =>
  Array.from(document.querySelectorAll('.data-list-row')).map(row => row.textContent?.match(/0\.\d/)?.[0]);

describe('ScorerPage', () => {
  describe('when scores are sorted from the Score column', () => {
    it('shows scores from lowest to highest', async () => {
      useScorerHandlers();
      renderPage();

      await screen.findByText('0.5');
      fireEvent.click(screen.getByRole('button', { name: 'Score, not sorted, sort ascending' }));

      await waitFor(() => expect(renderedScores()).toEqual(['0.1', '0.5', '0.9']));
      expect(screen.getByTestId('location').textContent).toBe('/scorers/quality?sort=score&dir=asc');
    });

    it('shows scores from highest to lowest when toggled again', async () => {
      useScorerHandlers();
      renderPage();

      await screen.findByText('0.5');
      const header = screen.getByRole('button', { name: 'Score, not sorted, sort ascending' });
      fireEvent.click(header);
      fireEvent.click(screen.getByRole('button', { name: 'Score, sorted ascending, sort descending' }));

      await waitFor(() => expect(renderedScores()).toEqual(['0.9', '0.5', '0.1']));
    });
  });

  describe('when scores are sorted from the Date column', () => {
    it('shows the oldest score first when sorted ascending', async () => {
      useScorerHandlers();
      renderPage();

      await screen.findByText('0.5');
      fireEvent.click(screen.getByRole('button', { name: 'Date, not sorted, sort ascending' }));

      await waitFor(() => expect(renderedScores()).toEqual(['0.5', '0.1', '0.9']));
    });

    it('restores the sort from the URL', async () => {
      useScorerHandlers();
      renderPage('/scorers/quality?sort=date&dir=desc');

      await waitFor(() => expect(renderedScores()).toEqual(['0.9', '0.1', '0.5']));
      expect(screen.getByRole('button', { name: 'Date, sorted descending, sort ascending' })).toBeTruthy();
    });
  });
});
