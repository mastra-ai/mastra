import type { DatasetExperiment } from '@mastra/client-js';
import type { ExperimentMetrics } from '@mastra/react/hooks/experiments';
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentKpis } from '../experiment-kpis';
import type { ExperimentKpisProps } from '../experiment-kpis';
import { experimentTotalsBreakdown } from './fixtures/experiment-usage';
import { experiments } from './fixtures/experiments';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

// Completed run: 10:00 → 10:05, 10 items.
const completedExperiment: DatasetExperiment = experiments[0];

// Cost and tokens come from the per-item usage breakdown; the KPIs only read the average duration here.
const fullMetrics: ExperimentMetrics = {
  totalTokens: null,
  estimatedCost: null,
  costUnit: null,
  avgAgentDurationMs: 1850,
  agentRuns: 42,
};

const scoresResponse = (scores: Array<{ entityId: string; scorerId: string; score: number }>) =>
  HttpResponse.json({ scores, pagination: { total: scores.length, page: 0, perPage: 100, hasMore: false } });

const renderKpis = (experiment: DatasetExperiment, metrics?: ExperimentKpisProps['metrics']) =>
  renderWithProviders(<ExperimentKpis experiment={experiment} metrics={metrics} />);

describe('ExperimentKpis', () => {
  afterEach(cleanup);

  beforeEach(() => {
    server.use(
      // avg of 0.5, 1 and 1 across both scorers is 0.833.
      http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
        scoresResponse([
          { entityId: 'item-1', scorerId: 'answer-relevancy', score: 0.5 },
          { entityId: 'item-2', scorerId: 'answer-relevancy', score: 1 },
          { entityId: 'item-2', scorerId: 'toxicity', score: 1 },
        ]),
      ),
    );
  });

  it('shows the overall average and wall-clock duration of a completed run', async () => {
    const { queryClient } = renderKpis(completedExperiment);

    expect(await screen.findByText('0.833')).toBeDefined();
    expect(screen.getByText('across all scorers')).toBeDefined();
    expect(screen.getByText('Run duration')).toBeDefined();
    expect(screen.getByText('5m')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('shows a single avg score card, without per-scorer breakdown', async () => {
    const { queryClient } = renderKpis(completedExperiment);

    expect(await screen.findByText('0.833')).toBeDefined();
    expect(screen.getAllByText('Avg score')).toHaveLength(1);
    expect(screen.queryByText('0.750')).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('leaves the item count to the breadcrumb', async () => {
    const { queryClient } = renderKpis(completedExperiment);

    expect(await screen.findByText('0.833')).toBeDefined();
    expect(screen.queryByText('Items')).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  describe('when metrics are enabled', () => {
    beforeEach(() => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () =>
          HttpResponse.json(experimentTotalsBreakdown),
        ),
      );
    });

    const renderWithMetrics = (experiment = completedExperiment) =>
      renderKpis(experiment, { data: fullMetrics, isLoading: false, isEnabled: true });

    it('shows the total cost in fractional cents', async () => {
      const { queryClient } = renderWithMetrics();

      expect(await screen.findByText('$0.012')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });

    it('shows the average duration per item under the run duration', async () => {
      const { queryClient } = renderWithMetrics();

      expect(await screen.findByText('1.85s avg per item')).toBeDefined();
      expect(screen.queryByText('Avg duration')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('shows the total token count', async () => {
      const { queryClient } = renderWithMetrics();

      expect(await screen.findByText('12,400')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });

    it('splits the total tokens into input and output', async () => {
      const { queryClient } = renderWithMetrics();

      expect(await screen.findByText('9,900 in · 2,500 out')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });

    it('leads with cost, duration and tokens', async () => {
      const { queryClient } = renderWithMetrics();

      await screen.findByText('Total cost');
      const labels = ['Total cost', 'Run duration', 'Total tokens', 'Avg score'].map(label => screen.getByText(label));
      for (let i = 1; i < labels.length; i++) {
        expect(labels[i - 1].compareDocumentPosition(labels[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when metrics are enabled and the run is still in progress', () => {
    const breakdownRequests: Request[] = [];

    beforeEach(() => {
      breakdownRequests.length = 0;
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, ({ request }) => {
          breakdownRequests.push(request);
          return HttpResponse.json(experimentTotalsBreakdown);
        }),
      );
    });

    const runningExperiment: DatasetExperiment = { ...completedExperiment, status: 'running', completedAt: null };

    it('keeps the cost and token cards loading without fetching usage', async () => {
      const { queryClient } = renderKpis(runningExperiment, { data: fullMetrics, isLoading: false, isEnabled: true });

      expect(await screen.findByText('Total cost')).toBeDefined();
      expect(screen.getByText('Total tokens')).toBeDefined();
      expect(screen.queryByText('estimated')).toBeNull();
      expect(screen.queryByText('input + output')).toBeNull();
      expect(breakdownRequests).toHaveLength(0);

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when metrics are disabled', () => {
    const renderWithoutMetrics = () =>
      renderKpis(completedExperiment, { data: fullMetrics, isLoading: false, isEnabled: false });

    it('hides the cost and token cards', async () => {
      const { queryClient } = renderWithoutMetrics();

      expect(await screen.findByText('Avg score')).toBeDefined();
      expect(screen.queryByText('Total cost')).toBeNull();
      expect(screen.queryByText('Total tokens')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('shows when the run started under the run duration', async () => {
      const { queryClient } = renderWithoutMetrics();

      expect(await screen.findByText(/^started /)).toBeDefined();
      expect(screen.queryByText(/avg per item/)).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });
});
