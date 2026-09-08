import type { DatasetExperiment, DatasetRecord, GetScorerResponse } from '@mastra/client-js';
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentMetaBar } from '../experiment-meta-bar';
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

const renderBar = (experiment: DatasetExperiment) =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentMetaBar experiment={experiment} />
    </TestLinkProvider>,
  );

describe('ExperimentMetaBar', () => {
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
    it('shows the four cell labels and no dataset cell', async () => {
      const { queryClient } = renderBar(completedExperiment);

      expect(await screen.findByText('Avg score')).toBeDefined();
      expect(screen.getByText('Items')).toBeDefined();
      expect(screen.getByText('Started')).toBeDefined();
      expect(screen.getByText('Duration')).toBeDefined();
      // The dataset now lives in the page title, not in the meta bar.
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

    it('shows the start time with a relative suffix', async () => {
      const { queryClient } = renderBar(completedExperiment);

      expect(await screen.findByText(/· .+ ago/)).toBeDefined();

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
});
