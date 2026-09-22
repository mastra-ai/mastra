import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DATASET_ID,
  EXPERIMENT_ID,
  emptyScoresResponse,
  experiment,
  experimentsResponse,
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
  resultsResponse,
} from './fixtures/experiment-item-route';
import { renamedPostgresWithMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import ExperimentPage from '@/pages/experiments/experiment';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

const renderExperimentRoute = (initialPath = `/experiments/${EXPERIMENT_ID}`) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/experiments/:experimentId',
        element: (
          <>
            <ExperimentPage />
            <LocationProbe />
          </>
        ),
        children: [{ path: 'items/:itemId', element: null }],
      },
    ],
    { initialEntries: [initialPath] },
  );

  render(
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

let resultRequests: URL[] = [];

beforeEach(() => {
  resultRequests = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(renamedPostgresWithMetrics)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () => HttpResponse.json({ value: null })),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(experimentsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () =>
      HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments`, () => HttpResponse.json(experimentsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}`, () =>
      HttpResponse.json(experiment),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, ({ request }) => {
      resultRequests.push(new URL(request.url));
      return HttpResponse.json(resultsResponse);
    }),
    http.get(`${TEST_BASE_URL}/api/scores/run/${EXPERIMENT_ID}`, () => HttpResponse.json(emptyScoresResponse)),
  );
});

describe('Experiment page — results sorted from the Created column', () => {
  it('does not ask the server for a sort by default', async () => {
    renderExperimentRoute();
    await screen.findByText('item-2');

    expect(resultRequests[0].searchParams.get('orderBy[field]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Created, not sorted, sort ascending' })).not.toBeNull();
  });

  it('asks the server for oldest-started first and writes it to the URL', async () => {
    renderExperimentRoute();
    await screen.findByText('item-2');

    fireEvent.click(screen.getByRole('button', { name: 'Created, not sorted, sort ascending' }));

    await waitFor(() => expect(resultRequests.at(-1)?.searchParams.get('orderBy[field]')).toBe('startedAt'));
    expect(resultRequests.at(-1)?.searchParams.get('orderBy[direction]')).toBe('ASC');
    expect(screen.getByTestId('location').textContent).toBe(`/experiments/${EXPERIMENT_ID}?sort=startedAt&dir=asc`);
  });

  it('restores the sort from the URL', async () => {
    renderExperimentRoute(`/experiments/${EXPERIMENT_ID}?sort=startedAt&dir=desc`);
    await screen.findByText('item-2');

    expect(resultRequests[0].searchParams.get('orderBy[field]')).toBe('startedAt');
    expect(resultRequests[0].searchParams.get('orderBy[direction]')).toBe('DESC');
    expect(screen.getByRole('button', { name: 'Created, sorted descending, sort ascending' })).not.toBeNull();
  });
});
