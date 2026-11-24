import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DATASET_ID,
  EXPERIMENT_ID,
  emptyMetricAggregate,
  emptyScoresResponse,
  experiment,
  experimentResultScoresResponse,
  experimentUsageBreakdown,
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
  resultsResponse,
} from './fixtures/experiment-item-route';
import {
  storageWithoutMetrics,
  renamedPostgresWithMetrics,
} from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import ExperimentPage from '@/pages/experiments/experiment';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const renderExperimentPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/experiments/:experimentId', element: <ExperimentPage /> }], {
    initialEntries: [`/experiments/${EXPERIMENT_ID}`],
  });

  render(
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(cleanup);

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(renamedPostgresWithMetrics)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () => HttpResponse.json(emptyMetricAggregate)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () =>
      HttpResponse.json(experimentUsageBreakdown),
    ),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments/${EXPERIMENT_ID}`, () => HttpResponse.json(experiment)),
    // The crumbs fall back to ids when the dataset can't be read.
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () =>
      HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}`, () =>
      HttpResponse.json(experiment),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, () =>
      HttpResponse.json(resultsResponse),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/${EXPERIMENT_ID}`, () =>
      HttpResponse.json(experimentResultScoresResponse),
    ),
  );
});

describe('Experiment page — usage and scores', () => {
  describe('when the observability store serves metrics', () => {
    it('totals the run cost and tokens in the KPIs', async () => {
      renderExperimentPage();

      // The split and the cost detail only render once the usage has loaded.
      expect(await screen.findByText('1,200 in')).toBeDefined();
      expect(screen.getByText('300 out')).toBeDefined();
      expect(screen.getByText('estimated')).toBeDefined();
    });

    it('shows the cost and tokens of each result', async () => {
      renderExperimentPage();

      expect((await screen.findByTestId('result-tokens-res-1')).textContent).toBe('1,500');
      expect(screen.getByTestId('result-cost-res-1').textContent).toBe('$0.002');
    });
  });

  describe('when the experiment loads after the metrics capabilities', () => {
    it('waits for its status before polling usage, then totals it', async () => {
      let releaseExperiment = () => {};
      const experimentLoaded = new Promise<void>(resolve => {
        releaseExperiment = resolve;
      });
      const breakdownRequests: string[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/experiments/${EXPERIMENT_ID}`, async () => {
          await experimentLoaded;
          return HttpResponse.json(experiment);
        }),
        http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}`, async () => {
          await experimentLoaded;
          return HttpResponse.json(experiment);
        }),
        http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, ({ request }) => {
          breakdownRequests.push(request.url);
          return HttpResponse.json(experimentUsageBreakdown);
        }),
      );
      renderExperimentPage();

      // Empty polls before the status is known would use up the retries meant for after the run.
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(breakdownRequests).toHaveLength(0);

      releaseExperiment();
      expect(await screen.findByText('1,200 in')).toBeDefined();
    });
  });

  describe('when the observability store cannot serve metrics', () => {
    beforeEach(() => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithoutMetrics)),
      );
    });

    it('hides the cost and token columns', async () => {
      renderExperimentPage();

      expect(await screen.findByTestId('result-duration-res-1')).toBeDefined();
      expect(screen.queryByTestId('result-cost-res-1')).toBeNull();
      expect(screen.queryByText('Total cost')).toBeNull();
    });
  });

  describe('when the run has scores', () => {
    it('averages them in the KPIs', async () => {
      renderExperimentPage();

      expect(await screen.findByText('across all scorers')).toBeDefined();
      // The KPI and the one scored item.
      expect(screen.getAllByText('0.900')).toHaveLength(2);
    });

    it('adds a column for the scorer', async () => {
      renderExperimentPage();

      expect(await screen.findByText('experiment-scorer')).toBeDefined();
    });
  });

  describe('when the run has no scores', () => {
    beforeEach(() => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/scores/run/${EXPERIMENT_ID}`, () => HttpResponse.json(emptyScoresResponse)),
      );
    });

    it('shows no average score', async () => {
      renderExperimentPage();

      expect(await screen.findByText('no scores')).toBeDefined();
    });
  });
});
