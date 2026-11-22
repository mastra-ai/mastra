import type { DatasetExperiment } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DATASET_ID,
  EXPERIMENT_ID,
  emptyMetricAggregate,
  emptyScoresResponse,
  experiment,
  experimentDeletedResponse,
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
  resultsResponse,
} from './fixtures/experiment-item-route';
import { renamedPostgresWithMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import { emptyUsageBreakdown } from '@/domains/experiments/components/__tests__/fixtures/experiment-usage';
import ExperimentPage from '@/pages/experiments/experiment';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

let current: DatasetExperiment = experiment;
const requests: string[] = [];

const renderExperimentPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/experiments', element: <h1>Experiments list</h1> },
      { path: '/experiments/:experimentId', element: <ExperimentPage /> },
    ],
    { initialEntries: [`/experiments/${EXPERIMENT_ID}`] },
  );

  render(
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const openActionsMenu = async () =>
  fireEvent.click(await screen.findByRole('button', { name: 'Experiment actions menu' }));

afterEach(cleanup);

beforeEach(() => {
  current = experiment;
  requests.length = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(renamedPostgresWithMetrics)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () => HttpResponse.json(emptyMetricAggregate)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => HttpResponse.json(emptyUsageBreakdown)),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments/${EXPERIMENT_ID}`, () => HttpResponse.json(current)),
    http.delete(`${TEST_BASE_URL}/api/experiments/${EXPERIMENT_ID}`, () => {
      requests.push('DELETE experiment');
      return HttpResponse.json(experimentDeletedResponse);
    }),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () =>
      HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}`, () =>
      HttpResponse.json(current),
    ),
    http.patch(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}`, async ({ request }) => {
      const body = await request.json();
      requests.push(`PATCH ${JSON.stringify(body)}`);
      current = { ...current, name: 'Renamed run' };
      return HttpResponse.json(current);
    }),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, () =>
      HttpResponse.json(resultsResponse),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/${EXPERIMENT_ID}`, () => HttpResponse.json(emptyScoresResponse)),
  );
});

describe('Experiment page — header actions', () => {
  it('offers to rerun the experiment', async () => {
    renderExperimentPage();

    expect(await screen.findByRole('button', { name: /rerun/i })).toBeDefined();
  });

  describe('when the experiment is renamed from the actions menu', () => {
    it('saves the new name on its dataset', async () => {
      renderExperimentPage();

      await openActionsMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /rename experiment/i }));
      const dialog = await screen.findByRole('dialog', { name: /rename experiment/i });
      fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'Renamed run' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(requests).toEqual(['PATCH {"name":"Renamed run","description":""}']));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });

  describe('when the experiment is deleted from the actions menu', () => {
    it('deletes it and returns to the experiments list', async () => {
      renderExperimentPage();

      await openActionsMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /delete experiment/i }));
      const dialog = await screen.findByRole('alertdialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /delete/i }));

      expect(await screen.findByRole('heading', { name: 'Experiments list' })).toBeDefined();
      expect(requests).toEqual(['DELETE experiment']);
    });
  });
});
