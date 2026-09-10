import type { DatasetExperiment, DatasetRecord, GetScorerResponse } from '@mastra/client-js';
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExperimentMetrics } from '../../hooks/use-experiment-metrics';
import { ExperimentRunMeta, type ExperimentRunMetaProps } from '../experiment-run-meta';
import { experiments } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

const scorer = (name: string): GetScorerResponse =>
  ({
    scorer: { config: { id: name, name, description: `${name} description` } },
    source: 'code',
    agentIds: [],
    workflowIds: [],
  }) as unknown as GetScorerResponse;

const scorers: Record<string, GetScorerResponse> = {
  'answer-relevancy': scorer('answer-relevancy'),
  toxicity: scorer('toxicity'),
};

const dataset: DatasetRecord = {
  id: 'dataset-1',
  name: 'Entity extraction dataset',
  version: 1,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

// Completed run: 10:00 → 10:05 gives a 5m duration; two scorers give the "+1" suffix.
const completedExperiment: DatasetExperiment = {
  ...experiments[0],
  scorerIds: ['answer-relevancy', 'toxicity'],
};

// Caller-driven run: no dataset, no scorers, still running.
const runningExperiment: DatasetExperiment = {
  ...experiments[0],
  id: 'running-experiment',
  status: 'running',
  datasetId: null as unknown as string,
  scorerIds: undefined,
  completedAt: null,
};

const renderBar = (experiment: DatasetExperiment, metrics?: ExperimentRunMetaProps['metrics']) =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentRunMeta experiment={experiment} metrics={metrics} />
    </TestLinkProvider>,
  );

const fullMetrics: ExperimentMetrics = {
  totalTokens: 12400,
  estimatedCost: 0.0123,
  costUnit: 'USD',
  avgAgentDurationMs: 1850,
  agentRuns: 42,
};

const nullMetrics: ExperimentMetrics = {
  totalTokens: null,
  estimatedCost: null,
  costUnit: null,
  avgAgentDurationMs: null,
  agentRuns: null,
};

describe('ExperimentRunMeta', () => {
  afterEach(cleanup);

  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/datasets/dataset-1`, () => HttpResponse.json(dataset)),
      http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(scorers)),
      // avg of 0.5, 1 and 1 is 0.833.
      http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
        HttpResponse.json({
          scores: [
            { entityId: 'item-1', scorerId: 'answer-relevancy', score: 0.5 },
            { entityId: 'item-2', scorerId: 'answer-relevancy', score: 1 },
            { entityId: 'item-2', scorerId: 'toxicity', score: 1 },
          ],
          pagination: { total: 3, page: 0, perPage: 100, hasMore: false },
        }),
      ),
    );
  });

  describe('for a completed experiment with a dataset and scorers', () => {
    it('shows the four row labels and no dataset row', async () => {
      const { queryClient } = renderBar(completedExperiment);

      expect(await screen.findByText('Avg score')).toBeDefined();
      expect(screen.getByText('Items')).toBeDefined();
      expect(screen.getByText('Started')).toBeDefined();
      expect(screen.getByText('Duration')).toBeDefined();
      // The dataset lives in the pipeline, not in the run meta.
      expect(screen.queryByText('Dataset')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('shows a neutral item count with no pass/fail verdict', async () => {
      const { queryClient } = renderBar(completedExperiment);

      const total = completedExperiment.totalItems;
      expect(await screen.findByText(`${total} item${total === 1 ? '' : 's'}`)).toBeDefined();
      expect(screen.queryByText('All passed')).toBeNull();
      expect(screen.queryByText('failed')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('shows an errored suffix only when items errored', async () => {
      const { queryClient } = renderBar({ ...completedExperiment, failedCount: 2 });

      expect(await screen.findByText('· 2 errored')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });

    it('shows the average of every score fetched for the run', async () => {
      const { queryClient } = renderBar(completedExperiment);

      expect(await screen.findByText('0.833')).toBeDefined();
      // A completed run has nothing left to score, so no "so far" qualifier.
      expect(screen.queryByText('· so far')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('shows the start time on one line, with the relative time as a tooltip', async () => {
      const { queryClient } = renderBar(completedExperiment);

      const started = await screen.findByTitle(/ago$/);
      expect(started.textContent).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} [AP]M$/);
      expect(screen.queryByText(/· .+ ago/)).toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('shows the formatted duration', async () => {
      const { queryClient } = renderBar(completedExperiment);

      expect(await screen.findByText('5m')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });

    it('does not link to the dataset', async () => {
      const { queryClient } = renderBar(completedExperiment);

      expect(await screen.findByText('Duration')).toBeDefined();
      expect(screen.queryByText('Entity extraction dataset')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('for a running caller-driven experiment', () => {
    it('shows Running… for the duration', async () => {
      const { queryClient } = renderBar(runningExperiment);

      expect(await screen.findByText('Running…')).toBeDefined();
    });

    it('qualifies the average as partial while items are still being scored', async () => {
      const { queryClient } = renderBar(runningExperiment);

      expect(await screen.findByText('· so far')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('metrics cells', () => {
    describe('given metrics are enabled', () => {
      it('when totals are present, then it shows a Tokens cell with a compact count and cost', async () => {
        const { queryClient } = renderBar(completedExperiment, {
          data: fullMetrics,
          isLoading: false,
          isEnabled: true,
        });

        expect(await screen.findByText('Tokens')).toBeDefined();
        expect(screen.getByText('12.4K')).toBeDefined();
        expect(screen.getByText('· $0.01')).toBeDefined();

        await waitForMutationsIdle(queryClient);
      });

      it('when avg duration is present, then it shows a "Latency (avg)" cell with the formatted duration', async () => {
        const { queryClient } = renderBar(completedExperiment, {
          data: fullMetrics,
          isLoading: false,
          isEnabled: true,
        });

        expect(await screen.findByText('Latency (avg)')).toBeDefined();
        expect(screen.getByText('1.9s')).toBeDefined();
        expect(screen.queryByText(/avg over/)).toBeNull();

        await waitForMutationsIdle(queryClient);
      });

      it('when values are null, then Tokens and Latency show "—"', async () => {
        const { queryClient } = renderBar(completedExperiment, {
          data: nullMetrics,
          isLoading: false,
          isEnabled: true,
        });

        expect(await screen.findByText('Tokens')).toBeDefined();
        expect(screen.getByText('Latency (avg)')).toBeDefined();
        // Avg score also renders "—" until scores load, so at least the two metric cells are dashes.
        expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);

        await waitForMutationsIdle(queryClient);
      });

      it('when the experiment is running, then Tokens shows the "· so far" suffix', async () => {
        const { queryClient } = renderBar(runningExperiment, { data: fullMetrics, isLoading: false, isEnabled: true });

        expect(await screen.findByText('12.4K')).toBeDefined();
        // Avg score shows one "· so far" as well; Tokens adds a second.
        await screen.findAllByText('· so far');
        expect(screen.getAllByText('· so far')).toHaveLength(2);

        await waitForMutationsIdle(queryClient);
      });
    });

    describe('given metrics are disabled', () => {
      it('when rendered, then Tokens and Latency cells are absent', async () => {
        const { queryClient } = renderBar(completedExperiment, { data: undefined, isLoading: false, isEnabled: false });

        expect(await screen.findByText('Duration')).toBeDefined();
        expect(screen.queryByText('Tokens')).toBeNull();
        expect(screen.queryByText('Latency (avg)')).toBeNull();

        await waitForMutationsIdle(queryClient);
      });
    });
  });
});
