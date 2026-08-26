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
    );
  });

  describe('for a completed experiment with a dataset and scorers', () => {
    it('shows the four cell labels', async () => {
      const { queryClient } = renderBar(completedExperiment);

      expect(await screen.findByText('Results')).toBeDefined();
      expect(screen.getByText('Started')).toBeDefined();
      expect(screen.getByText('Duration')).toBeDefined();
      expect(screen.getByText('Dataset')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });

    it('shows All passed when every item succeeds', async () => {
      const { queryClient } = renderBar(completedExperiment);

      expect(await screen.findByText('All passed')).toBeDefined();
      expect(screen.queryByText('failed')).toBeNull();

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

    it('links to the dataset by name with an item count', async () => {
      const { queryClient } = renderBar(completedExperiment);

      const link = await screen.findByText('Entity extraction dataset');
      expect(link.closest('a')?.getAttribute('href')).toBe('/datasets/dataset-1');
      expect(screen.getByText('· 10 items')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('for a running caller-driven experiment', () => {
    it('shows Running… for the duration and a dash for the dataset', async () => {
      const { queryClient } = renderBar(runningExperiment);

      expect(await screen.findByText('Running…')).toBeDefined();
      // The Dataset cell falls back to a dash.
      expect(screen.getAllByText('—')).toHaveLength(1);

      await waitForMutationsIdle(queryClient);
    });
  });
});
