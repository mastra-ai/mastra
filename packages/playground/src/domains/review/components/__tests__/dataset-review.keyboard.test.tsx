import type { DatasetExperiment, DatasetExperimentResult, DatasetRecord } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { DatasetReview } from '../dataset-review';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';

const dataset: DatasetRecord = {
  id: 'ds-1',
  name: 'Dataset One',
  version: 1,
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:00:00.000Z'),
};

const experiment: DatasetExperiment = {
  id: 'exp-1',
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
  totalItems: 3,
  succeededCount: 3,
  failedCount: 0,
  skippedCount: 0,
  startedAt: new Date('2026-08-25T10:00:00.000Z'),
  completedAt: new Date('2026-08-25T10:05:00.000Z'),
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:05:00.000Z'),
};

const makeResult = (id: string, input: string): DatasetExperimentResult => ({
  id,
  experimentId: 'exp-1',
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

const results = [makeResult('r-1', 'first input'), makeResult('r-2', 'second input'), makeResult('r-3', 'third input')];

const setupHandlers = (reviewResults = results) => {
  server.use(
    http.get('*/api/datasets/ds-1', () => HttpResponse.json(dataset)),
    http.get('*/api/datasets/:datasetId/experiments', () =>
      HttpResponse.json({ experiments: [experiment], pagination: { total: 1, page: 0, perPage: 100, hasMore: false } }),
    ),
    http.get('*/api/datasets/:datasetId/experiments/:experimentId/results', () =>
      HttpResponse.json({
        results: reviewResults,
        pagination: { total: reviewResults.length, page: 0, perPage: 100, hasMore: false },
      }),
    ),
  );
};

const renderReview = async () => {
  setupHandlers();
  const utils = renderWithProviders(<DatasetReview datasetId="ds-1" />);

  await waitFor(() => expect(screen.getByText(/first input/)).toBeTruthy());
  return utils;
};

describe('DatasetReview keyboard navigation', () => {
  describe('when review items are loaded', () => {
    it('applies a roving tabindex across review rows', async () => {
      await renderReview();
      const rows = interactiveRows();
      expect(rows).toHaveLength(3);
      expectRovingTabindex(rows);
    });

    it('moves focus with Arrow/Home/End keys', async () => {
      await renderReview();
      expectArrowNavigation(interactiveRows());
    });
  });

  describe('when the review queue is empty', () => {
    it('hides the Filter action', async () => {
      setupHandlers([]);
      renderWithProviders(<DatasetReview datasetId="ds-1" />);

      expect(await screen.findByText('No items to review')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
    });
  });
});
