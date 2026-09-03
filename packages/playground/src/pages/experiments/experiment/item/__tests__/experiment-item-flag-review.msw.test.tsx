import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ExperimentItemPage from '..';
import { ExperimentItemPanelProvider } from '@/domains/experiments/context/experiment-item-panel-context';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const buildResult = (status: DatasetExperimentResult['status']): DatasetExperimentResult => ({
  id: 'result-1',
  experimentId: 'exp-1',
  itemId: 'item-1',
  itemDatasetVersion: 1,
  input: 'What is the capital of France?',
  output: 'Paris',
  groundTruth: null,
  error: null,
  startedAt: '2026-08-25T10:00:00.000Z',
  completedAt: '2026-08-25T10:00:01.000Z',
  retryCount: 0,
  traceId: null,
  status,
  tags: null,
  scores: [],
  createdAt: '2026-08-25T10:00:00.000Z',
});

const patchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

beforeEach(() => {
  patchCalls.length = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
      HttpResponse.json({ scores: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
    ),
    http.patch(
      `${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId/results/:resultId`,
      async ({ request }) => {
        patchCalls.push({
          url: new URL(request.url).pathname,
          body: (await request.json()) as Record<string, unknown>,
        });
        return HttpResponse.json({ ...buildResult('needs-review') });
      },
    ),
  );
});

afterEach(cleanup);

function renderItemPage(results: DatasetExperimentResult[]) {
  return renderWithProviders(
    <TestLinkProvider>
      <Routes>
        <Route
          path="/experiments/:experimentId/items/:itemId"
          element={
            <ExperimentItemPanelProvider
              experimentId="exp-1"
              datasetId="ds-1"
              experimentStatus="completed"
              results={results}
              isLoadingResults={false}
            >
              <ExperimentItemPage />
            </ExperimentItemPanelProvider>
          }
        />
      </Routes>
    </TestLinkProvider>,
    { router: { initialEntries: ['/experiments/exp-1/items/item-1'] } },
  );
}

describe('experiment item page — flag for review', () => {
  it('flags the result for review from the item view', async () => {
    renderItemPage([buildResult('pending')]);

    const flagButton = await screen.findByRole('button', { name: /flag for review/i });
    // Lives in the panel header (same container as the heading), as the primary action.
    const heading = screen.getByRole('heading', { name: /result # result-1/i });
    expect(heading.parentElement?.contains(flagButton)).toBe(true);
    fireEvent.click(flagButton);

    await waitFor(() => expect(patchCalls).toHaveLength(1));
    expect(patchCalls[0].url).toBe('/api/datasets/ds-1/experiments/exp-1/results/result-1');
    expect(patchCalls[0].body).toMatchObject({ status: 'needs-review' });
  });

  it('offers Review instead of Flag when the result already needs review', async () => {
    renderItemPage([buildResult('needs-review')]);

    expect(await screen.findByRole('button', { name: /^review$/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /flag for review/i })).toBeNull();
  });
});
