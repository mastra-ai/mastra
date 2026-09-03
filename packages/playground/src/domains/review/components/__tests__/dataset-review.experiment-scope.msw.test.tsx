import type { DatasetExperiment, DatasetExperimentResult, DatasetRecord } from '@mastra/client-js';
import { screen } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it } from 'vitest';

import { DatasetReview } from '../dataset-review';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';

const dataset: DatasetRecord = {
  id: 'ds-1',
  name: 'Dataset One',
  version: 1,
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:00:00.000Z'),
};

const makeExperiment = (id: string): DatasetExperiment => ({
  id,
  datasetId: 'ds-1',
  datasetVersion: 1,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'chef-agent',
  provenance: null,
  runnerAttestation: null,
  experimentSetId: null,
  comparisonId: null,
  variantId: null,
  trialIndex: 0,
  status: 'completed',
  totalItems: 1,
  succeededCount: 1,
  failedCount: 0,
  skippedCount: 0,
  startedAt: new Date('2026-08-25T10:00:00.000Z'),
  completedAt: new Date('2026-08-25T10:05:00.000Z'),
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:05:00.000Z'),
});

const makeResult = (id: string, experimentId: string, input: string): DatasetExperimentResult => ({
  id,
  experimentId,
  itemId: `item-${id}`,
  itemDatasetVersion: 1,
  input,
  output: `output for ${input}`,
  groundTruth: null,
  error: null,
  startedAt: new Date('2026-08-25T10:00:00.000Z'),
  completedAt: new Date('2026-08-25T10:01:00.000Z'),
  retryCount: 0,
  traceId: null,
  status: 'needs-review',
  tags: [],
  scores: [],
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
});

const resultsByExperiment: Record<string, DatasetExperimentResult[]> = {
  'exp-1': [makeResult('r-1', 'exp-1', 'exp one input')],
  'exp-2': [makeResult('r-2', 'exp-2', 'exp two input')],
};

// Experiment results resolve slowly so the component mounts before the review
// queue is known — the deep-link case (`/experiments/:id?review=`) on a cold cache.
const setupHandlers = () => {
  server.use(
    http.get('*/api/datasets/ds-1', () => HttpResponse.json(dataset)),
    http.get('*/api/datasets/:datasetId/experiments', () =>
      HttpResponse.json({
        experiments: [makeExperiment('exp-1'), makeExperiment('exp-2')],
        pagination: { total: 2, page: 0, perPage: 100, hasMore: false },
      }),
    ),
    http.get('*/api/datasets/:datasetId/experiments/:experimentId/results', async ({ params }) => {
      await delay(50);
      const results = resultsByExperiment[String(params.experimentId)] ?? [];
      return HttpResponse.json({
        results,
        pagination: { total: results.length, page: 0, perPage: 100, hasMore: false },
      });
    }),
  );
};

describe('DatasetReview scoped to an experiment', () => {
  describe('when mounted before the review queue has loaded', () => {
    it('shows that experiment’s review items once they arrive', async () => {
      setupHandlers();
      renderWithProviders(<DatasetReview datasetId="ds-1" experimentId="exp-2" />);

      expect(await screen.findByText(/exp two input/)).toBeTruthy();
      expect(screen.queryByText(/exp one input/)).toBeNull();
    });
  });
});
