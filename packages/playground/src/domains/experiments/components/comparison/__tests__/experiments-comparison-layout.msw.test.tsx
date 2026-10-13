import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExperimentsComparison } from '../experiments-comparison';
import {
  BASELINE_ID,
  CHALLENGER_ID,
  CONTENDER_ID,
  DATASET_ID,
  baselineResults,
  baselineScoreRows,
  challengerResults,
  challengerScoreRows,
  comparisonResponse,
  contenderResults,
  contenderScoreRows,
  threeWayComparisonResponse,
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

const renderComparison = (contenderIds: string[] = [CONTENDER_ID]) =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentsComparison datasetId={DATASET_ID} baselineId={BASELINE_ID} contenderIds={contenderIds} />
    </TestLinkProvider>,
    { router: true },
  );

const useThreeWayComparison = () =>
  server.use(
    http.post(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/compare`, () =>
      HttpResponse.json(threeWayComparisonResponse),
    ),
    http.get(`${experimentsBase}/${CHALLENGER_ID}`, () => HttpResponse.json(makeExperiment(CHALLENGER_ID, 1))),
    http.get(`${experimentsBase}/${CHALLENGER_ID}/results`, () =>
      HttpResponse.json(resultsResponse(challengerResults)),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/${CHALLENGER_ID}`, () =>
      HttpResponse.json(scoresResponse(challengerScoreRows)),
    ),
  );

type SideName = 'Baseline' | 'Contender 1' | 'Contender 2';

const itemRow = (itemId: string) => screen.getByRole('row', { name: itemId });
const findItemRow = (itemId: string) => screen.findByRole('row', { name: itemId });
const sideOf = (itemId: string, side: SideName) => within(itemRow(itemId)).getByRole('cell', { name: side });

describe('experiments comparison table', () => {
  describe('when the comparison loads', () => {
    it('renders the Items, Baseline and Contender 1 column headers', async () => {
      renderComparison();

      expect(await screen.findByRole('columnheader', { name: 'Items' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Baseline' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Contender 1' })).toBeTruthy();
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
      expect(within(sideOf('item-a', 'Contender 1')).getByText(/"Paris, France"/)).toBeTruthy();
      expect(within(sideOf('item-b', 'Baseline')).getByText(/"Frank Herbert"/)).toBeTruthy();
    });
  });

  describe('when the item is missing from the contender experiment', () => {
    it('shows an explicit empty state on the contender side only', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-c', 'Contender 1')).getByText('Not present in this experiment')).toBeTruthy();
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
      expect(within(sideOf('item-a', 'Contender 1')).queryByText('Metadata')).toBeNull();
    });
  });

  describe('when scores carry a reason', () => {
    it('shows the reason on each side and the delta once, on the contender', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Baseline')).getByText('Missing the country')).toBeTruthy();
      });
      expect(within(sideOf('item-a', 'Contender 1')).getByText('Complete answer')).toBeTruthy();
      expect(within(sideOf('item-a', 'Contender 1')).getByText('0.40', { exact: false })).toBeTruthy();
      expect(within(sideOf('item-a', 'Baseline')).queryByText('0.40', { exact: false })).toBeNull();
    });
  });

  describe('when a result errored', () => {
    it('renders the error notice instead of the output', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-b', 'Contender 1')).getByText('Agent run failed: rate limited')).toBeTruthy();
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

  describe('when comparing three experiments', () => {
    it('renders one column header per experiment', async () => {
      useThreeWayComparison();
      renderComparison([CONTENDER_ID, CHALLENGER_ID]);

      expect(await screen.findByRole('columnheader', { name: 'Baseline' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Contender 1' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Contender 2' })).toBeTruthy();
    });

    it('renders a cell per experiment on every row', async () => {
      useThreeWayComparison();
      renderComparison([CONTENDER_ID, CHALLENGER_ID]);

      const row = await findItemRow('item-a');

      // Items cell plus one cell per experiment.
      expect(within(row).getAllByRole('cell')).toHaveLength(4);
    });

    it('shows each contender its own delta against the baseline', async () => {
      useThreeWayComparison();
      renderComparison([CONTENDER_ID, CHALLENGER_ID]);

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Contender 2')).getByText('Close enough')).toBeTruthy();
      });
      expect(within(sideOf('item-a', 'Contender 1')).getByText('0.40', { exact: false })).toBeTruthy();
      // +0.10 on accuracy and -0.10 on relevancy.
      expect(within(sideOf('item-a', 'Contender 2')).getAllByText('0.10')).toHaveLength(2);
      expect(within(sideOf('item-a', 'Baseline')).queryByText('0.40')).toBeNull();
      expect(within(sideOf('item-a', 'Baseline')).queryByText('0.10')).toBeNull();
    });
  });

  describe('when a contender has a different dataset version than the baseline', () => {
    it('flags the version on that contender header only', async () => {
      useThreeWayComparison();
      renderComparison([CONTENDER_ID, CHALLENGER_ID]);

      const contender = await screen.findByRole('columnheader', { name: 'Contender 1' });
      await waitFor(() => {
        expect(within(contender).getByText(/different dataset version/)).toBeTruthy();
      });
      expect(
        within(screen.getByRole('columnheader', { name: 'Baseline' })).queryByText(/different dataset version/),
      ).toBeNull();
      expect(
        within(screen.getByRole('columnheader', { name: 'Contender 2' })).queryByText(/different dataset version/),
      ).toBeNull();
    });
  });
});
