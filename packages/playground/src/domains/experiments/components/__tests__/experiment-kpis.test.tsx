import type { DatasetExperiment } from '@mastra/client-js';
import type { ExperimentMetrics } from '@mastra/react/hooks/experiments';
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentKpis, type ExperimentKpisProps } from '../experiment-kpis';
import { experiments } from './fixtures/experiments';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

// Completed run: 10:00 → 10:05, 10 items.
const completedExperiment: DatasetExperiment = experiments[0];

const runningExperiment: DatasetExperiment = {
  ...experiments[0],
  id: 'running-experiment',
  status: 'running',
  succeededCount: 3,
  failedCount: 1,
  completedAt: null,
};

const fullMetrics: ExperimentMetrics = {
  totalTokens: 12400,
  estimatedCost: 0.0123,
  costUnit: 'USD',
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

  it('shows the overall average, item count and duration of a completed run', async () => {
    const { queryClient } = renderKpis(completedExperiment);

    expect(await screen.findByText('0.833')).toBeDefined();
    expect(screen.getByText('across all scorers')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('all processed')).toBeDefined();
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

  it('reports errored items on a completed run', async () => {
    const { queryClient } = renderKpis({ ...completedExperiment, failedCount: 2 });

    expect(await screen.findByText('2 errored')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('shows progress so far while the run is active', async () => {
    const { queryClient } = renderKpis(runningExperiment);

    expect(await screen.findByText('4/10')).toBeDefined();
    expect(screen.getByText('processed so far')).toBeDefined();
    expect(screen.getByText('Running…')).toBeDefined();
    expect(await screen.findByText('across all scorers so far')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('shows Tokens and Latency only when metrics are enabled', async () => {
    const { queryClient, unmount } = renderKpis(completedExperiment, {
      data: fullMetrics,
      isLoading: false,
      isEnabled: true,
    });

    expect(await screen.findByText('Tokens')).toBeDefined();
    expect(screen.getByText('12.4K')).toBeDefined();
    expect(screen.getByText('$0.01')).toBeDefined();
    expect(screen.getByText('Latency (avg)')).toBeDefined();
    expect(screen.getByText('1.85s')).toBeDefined();

    await waitForMutationsIdle(queryClient);
    unmount();

    const disabled = renderKpis(completedExperiment, { data: fullMetrics, isLoading: false, isEnabled: false });
    expect(await screen.findByText('Avg score')).toBeDefined();
    expect(screen.queryByText('Tokens')).toBeNull();
    expect(screen.queryByText('Latency (avg)')).toBeNull();

    await waitForMutationsIdle(disabled.queryClient);
  });
});
