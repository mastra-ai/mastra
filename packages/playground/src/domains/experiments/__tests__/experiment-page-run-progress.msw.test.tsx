import type { DatasetExperiment } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { queuedExperiment, runningExperiment, runningExperimentWithoutStart } from './fixtures/experiment-run-progress';
import { renamedPostgresWithMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import { emptyUsageBreakdown } from '@/domains/experiments/components/__tests__/fixtures/experiment-usage';
import { RUNNING_MESSAGES } from '@/domains/experiments/components/experiment-run-messages';
import ExperimentPage from '@/pages/experiments/experiment';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const renderExperimentRoute = () => {
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

// What the polled dataset-scoped lookup returns; tests move it forward to follow the run.
let liveExperiment: DatasetExperiment = runningExperiment;
let resultRequests = 0;
let metricRequests = 0;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // 1m 5s after the fixture's startedAt, so the elapsed timer is deterministic.
  vi.setSystemTime(new Date('2026-07-21T00:01:05.000Z'));
  liveExperiment = runningExperiment;
  resultRequests = 0;
  metricRequests = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(renamedPostgresWithMetrics)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () => {
      metricRequests += 1;
      return HttpResponse.json({ value: null });
    }),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => HttpResponse.json(emptyUsageBreakdown)),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(newerExperimentsPage)),
    http.get(`${TEST_BASE_URL}/api/experiments/${EXPERIMENT_ID}`, () => HttpResponse.json(runningExperiment)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () =>
      HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments`, () => HttpResponse.json(experimentsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}`, () =>
      HttpResponse.json(liveExperiment),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, () => {
      resultRequests += 1;
      return HttpResponse.json(resultsResponse);
    }),
    http.get(`${TEST_BASE_URL}/api/scores/run/${EXPERIMENT_ID}`, () => HttpResponse.json(emptyScoresResponse)),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advancePoll = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });

describe('Experiment page — run progress', () => {
  describe('when the run is in progress', () => {
    it('shows how many items finished out of the total', async () => {
      renderExperimentRoute();

      expect(await screen.findByRole('heading', { name: 'Experiment in progress' })).toBeTruthy();
      expect(screen.getByText('2 / 3 items finished')).toBeTruthy();
    });

    it('shows how long the experiment has been running', async () => {
      renderExperimentRoute();

      expect(await screen.findByText('1m 5s elapsed')).toBeTruthy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(screen.getByText('1m 7s elapsed')).toBeTruthy();
    });

    it('rotates through what the run is busy with', async () => {
      const shownMessage = () => RUNNING_MESSAGES.find(message => screen.queryByText(message));
      renderExperimentRoute();

      await screen.findByText('2 / 3 items finished');
      const first = shownMessage();
      expect(first).toBeDefined();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      const next = shownMessage();
      expect(next).toBeDefined();
      expect(next).not.toBe(first);
    });

    it('holds back the partial KPIs and results', async () => {
      renderExperimentRoute();

      await screen.findByText('2 / 3 items finished');
      await advancePoll();

      expect(screen.queryByText('Run duration')).toBeNull();
      expect(screen.queryByText('item-2')).toBeNull();
      expect(resultRequests).toBe(0);
      expect(metricRequests).toBe(0);
    });
  });

  describe('when the run is queued', () => {
    it('shows that nothing has finished yet', async () => {
      liveExperiment = queuedExperiment;
      renderExperimentRoute();

      expect(await screen.findByRole('heading', { name: 'Experiment queued' })).toBeTruthy();
      expect(screen.getByText('0 / 3 items finished')).toBeTruthy();
    });

    it('says it is waiting to start', async () => {
      liveExperiment = queuedExperiment;
      renderExperimentRoute();

      expect(await screen.findByText('Waiting to start…')).toBeTruthy();
    });
  });

  describe('when the start time is unknown', () => {
    it('leaves the elapsed timer out', async () => {
      liveExperiment = runningExperimentWithoutStart;
      renderExperimentRoute();

      await screen.findByText('2 / 3 items finished');

      expect(screen.queryByText(/elapsed$/)).toBeNull();
    });
  });

  describe('when the run completes', () => {
    it('swaps the progress for the KPIs and results', async () => {
      renderExperimentRoute();
      await screen.findByText('2 / 3 items finished');

      liveExperiment = experiment;
      await advancePoll();

      expect(await screen.findByText('item-2')).toBeTruthy();
      expect(screen.getByText('Run duration')).toBeTruthy();
      expect(screen.queryByText('2 / 3 items finished')).toBeNull();
    });
  });
});
