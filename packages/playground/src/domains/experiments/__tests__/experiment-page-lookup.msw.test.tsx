import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
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
import { newerExperimentsPage } from './fixtures/experiment-lookup';
import { renamedPostgresWithMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import ExperimentPage from '@/pages/experiments/experiment';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const renderExperimentRoute = (experimentId = EXPERIMENT_ID) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/experiments/:experimentId', element: <ExperimentPage /> }], {
    initialEntries: [`/experiments/${experimentId}`],
  });

  render(
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(renamedPostgresWithMetrics)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () => HttpResponse.json({ value: null })),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(newerExperimentsPage)),
    http.get(`${TEST_BASE_URL}/api/experiments/${EXPERIMENT_ID}`, () => HttpResponse.json(experiment)),
    http.get(`${TEST_BASE_URL}/api/experiments/:experimentId`, () =>
      HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () =>
      HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments`, () => HttpResponse.json(experimentsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}`, () =>
      HttpResponse.json(experiment),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, () =>
      HttpResponse.json(resultsResponse),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/${EXPERIMENT_ID}`, () => HttpResponse.json(emptyScoresResponse)),
  );
});

describe('Experiment page — resolving the experiment by id', () => {
  it('opens an experiment that is not on the first page of the experiments list', async () => {
    renderExperimentRoute();

    expect(await screen.findByText('item-2')).not.toBeNull();
    expect(screen.queryByText('Experiment not found')).toBeNull();
  });

  it('shows not found when the experiment does not exist', async () => {
    renderExperimentRoute('exp-missing');

    expect(await screen.findByText('Experiment not found')).not.toBeNull();
  });
});
