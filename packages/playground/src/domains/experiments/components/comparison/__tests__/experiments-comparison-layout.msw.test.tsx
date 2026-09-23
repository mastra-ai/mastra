import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExperimentsComparison } from '../experiments-comparison';
import {
  BASELINE_ID,
  CONTENDER_ID,
  DATASET_ID,
  baselineResults,
  baselineScoreRows,
  comparisonResponse,
  contenderResults,
  contenderScoreRows,
} from './fixtures/comparison';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '@/test/render';

const makeExperiment = (id: string, datasetVersion: number): DatasetExperiment => ({
  id,
  datasetId: DATASET_ID,
  datasetVersion,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'agent-1',
  name: id,
  status: 'completed',
  totalItems: 3,
  succeededCount: 3,
  failedCount: 0,
  startedAt: '2026-08-01T10:00:00.000Z',
  completedAt: '2026-08-01T10:05:00.000Z',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:05:00.000Z',
});

const resultsResponse = (results: unknown[]) => ({
  results,
  pagination: { total: results.length, page: 0, perPage: 100, hasMore: false },
});

const scoresResponse = (scores: unknown[]) => ({
  scores,
  pagination: { total: scores.length, page: 0, perPage: 100, hasMore: false },
});

const experimentsBase = `${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments`;

beforeEach(() => {
  server.use(
    http.post(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/compare`, () => HttpResponse.json(comparisonResponse)),
    http.get(`${experimentsBase}/${BASELINE_ID}`, () => HttpResponse.json(makeExperiment(BASELINE_ID, 1))),
    http.get(`${experimentsBase}/${CONTENDER_ID}`, () => HttpResponse.json(makeExperiment(CONTENDER_ID, 2))),
    http.get(`${experimentsBase}/${BASELINE_ID}/results`, () => HttpResponse.json(resultsResponse(baselineResults))),
    http.get(`${experimentsBase}/${CONTENDER_ID}/results`, () => HttpResponse.json(resultsResponse(contenderResults))),
    http.get(`${TEST_BASE_URL}/api/scores/run/${BASELINE_ID}`, () =>
      HttpResponse.json(scoresResponse(baselineScoreRows)),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/${CONTENDER_ID}`, () =>
      HttpResponse.json(scoresResponse(contenderScoreRows)),
    ),
  );
});

const renderComparison = () =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentsComparison datasetId={DATASET_ID} experimentIdA={BASELINE_ID} experimentIdB={CONTENDER_ID} />
    </TestLinkProvider>,
    { router: true },
  );

const itemRow = (itemId: string) => screen.getByRole('row', { name: itemId });
const findItemRow = (itemId: string) => screen.findByRole('row', { name: itemId });
const sideOf = (itemId: string, side: 'Baseline' | 'Contender') =>
  within(itemRow(itemId)).getByRole('cell', { name: side });

describe('experiments comparison table', () => {
  describe('when the comparison loads', () => {
    it('renders the Items, Baseline and Contender column headers', async () => {
      renderComparison();

      expect(await screen.findByRole('columnheader', { name: 'Items' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Baseline' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Contender' })).toBeTruthy();
    });

    it('renders every item as its own row, without any selection', async () => {
      renderComparison();

      expect(await findItemRow('item-a')).toBeTruthy();
      expect(itemRow('item-b')).toBeTruthy();
      expect(itemRow('item-c')).toBeTruthy();
    });

    it('links each item id to its page in the dataset', async () => {
      renderComparison();

      const link = await within(await findItemRow('item-a')).findByRole('link', { name: 'Open item item-a' });

      expect(link.getAttribute('href')).toBe('/datasets/dataset-1/items/item-a');
      expect(link.getAttribute('target')).toBeNull();
    });

    it('reveals the item input and ground truth without leaving the page', async () => {
      renderComparison();
      const row = await findItemRow('item-a');

      expect(within(row).queryByRole('region', { name: 'Input' })).toBeNull();

      fireEvent.click(within(row).getByRole('button', { name: 'Input' }));
      const input = await within(row).findByRole('region', { name: 'Input' });
      expect(within(input).getByText(/What is the capital of France/)).toBeTruthy();

      fireEvent.click(within(row).getByRole('button', { name: 'Ground truth' }));
      const groundTruth = await within(row).findByRole('region', { name: 'Ground truth' });
      expect(within(groundTruth).getByText(/Paris/)).toBeTruthy();
    });

    it('shows both sides of every row at once', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Baseline')).getByText(/"Paris"/)).toBeTruthy();
      });
      expect(within(sideOf('item-a', 'Contender')).getByText(/"Paris, France"/)).toBeTruthy();
      expect(within(sideOf('item-b', 'Baseline')).getByText(/"Frank Herbert"/)).toBeTruthy();
    });
  });

  describe('when the item is missing from the contender experiment', () => {
    it('shows an explicit empty state on the contender side only', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-c', 'Contender')).getByText('Not present in this experiment')).toBeTruthy();
      });
      expect(within(sideOf('item-c', 'Baseline')).getByText(/"42"/)).toBeTruthy();
    });
  });

  describe('when a result carries metadata', () => {
    it('renders the metadata section only on the side that has it', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Baseline')).getByText('Metadata')).toBeTruthy();
      });
      expect(within(sideOf('item-a', 'Contender')).queryByText('Metadata')).toBeNull();
    });
  });

  describe('when scores carry a reason', () => {
    it('shows the reason on each side and the delta once, on the contender', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Baseline')).getByText('Missing the country')).toBeTruthy();
      });
      expect(within(sideOf('item-a', 'Contender')).getByText('Complete answer')).toBeTruthy();
      expect(within(sideOf('item-a', 'Contender')).getByText('0.40', { exact: false })).toBeTruthy();
      expect(within(sideOf('item-a', 'Baseline')).queryByText('0.40', { exact: false })).toBeNull();
    });
  });

  describe('when a result errored', () => {
    it('renders the error notice instead of the output', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-b', 'Contender')).getByText('Agent run failed: rate limited')).toBeTruthy();
      });
    });
  });

  describe('when the result queries are still in flight', () => {
    it('keeps the item rows mounted while the sides load', async () => {
      server.use(
        http.get(`${experimentsBase}/${BASELINE_ID}/results`, () => new Promise(() => {})),
        http.get(`${experimentsBase}/${CONTENDER_ID}/results`, () => new Promise(() => {})),
      );

      renderComparison();

      expect(await findItemRow('item-a')).toBeTruthy();
      expect(within(sideOf('item-a', 'Baseline')).getByRole('status')).toBeTruthy();
    });
  });
});
