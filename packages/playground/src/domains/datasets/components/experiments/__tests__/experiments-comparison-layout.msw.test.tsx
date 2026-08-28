import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { DatasetExperimentsComparison } from '../dataset-experiments-comparison';
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
import { expectArrowNavigation, interactiveRows } from '@/test/keyboard';
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
    <DatasetExperimentsComparison datasetId={DATASET_ID} experimentIdA={BASELINE_ID} experimentIdB={CONTENDER_ID} />,
    { router: true },
  );

const baselineColumn = () => screen.getByRole('region', { name: 'Baseline' });
const contenderColumn = () => screen.getByRole('region', { name: 'Contender' });
const itemsColumn = () => screen.getByRole('region', { name: 'Items' });
const findItemsColumn = () => screen.findByRole('region', { name: 'Items' });

describe('experiments comparison three column layout', () => {
  describe('when the comparison loads', () => {
    it('renders the Items, Baseline and Contender columns with the first item selected', async () => {
      renderComparison();

      expect(await screen.findByRole('region', { name: 'Items' })).toBeTruthy();
      expect(baselineColumn()).toBeTruthy();
      expect(contenderColumn()).toBeTruthy();

      await waitFor(() => {
        expect(within(baselineColumn()).getByText(/"Paris"/)).toBeTruthy();
      });
      expect(within(contenderColumn()).getByText(/"Paris, France"/)).toBeTruthy();
    });
  });

  describe('when the user selects another item', () => {
    it('shows that item output on both sides', async () => {
      renderComparison();

      fireEvent.click(await within(await findItemsColumn()).findByText('item-b'));

      await waitFor(() => {
        expect(within(baselineColumn()).getByText(/"Frank Herbert"/)).toBeTruthy();
      });
    });
  });

  describe('when the item is missing from the contender experiment', () => {
    it('shows an explicit empty state on the contender side only', async () => {
      renderComparison();

      fireEvent.click(await within(await findItemsColumn()).findByText('item-c'));

      await waitFor(() => {
        expect(within(contenderColumn()).getByText('Not present in this experiment')).toBeTruthy();
      });
      expect(within(baselineColumn()).getByText(/"42"/)).toBeTruthy();
    });
  });

  describe('when a result carries metadata', () => {
    it('renders the metadata section only on the side that has it', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(baselineColumn()).getByText('Metadata')).toBeTruthy();
      });
      expect(within(contenderColumn()).queryByText('Metadata')).toBeNull();
    });
  });

  describe('when scores carry a reason', () => {
    it('shows the reason on each side and the delta once, on the contender', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(baselineColumn()).getByText('Missing the country')).toBeTruthy();
      });
      expect(within(contenderColumn()).getByText('Complete answer')).toBeTruthy();
      expect(within(contenderColumn()).getByText('0.40', { exact: false })).toBeTruthy();
      expect(within(baselineColumn()).queryByText('0.40', { exact: false })).toBeNull();
    });
  });

  describe('when a result errored', () => {
    it('renders the error notice instead of the output', async () => {
      renderComparison();

      fireEvent.click(await within(await findItemsColumn()).findByText('item-b'));

      await waitFor(() => {
        expect(within(contenderColumn()).getByText('Agent run failed: rate limited')).toBeTruthy();
      });
    });
  });

  describe('when the result queries are still in flight', () => {
    it('keeps the Items column mounted while the sides load', async () => {
      server.use(
        http.get(`${experimentsBase}/${BASELINE_ID}/results`, () => new Promise(() => {})),
        http.get(`${experimentsBase}/${CONTENDER_ID}/results`, () => new Promise(() => {})),
      );

      renderComparison();

      expect(await within(await findItemsColumn()).findByText('item-a')).toBeTruthy();
      expect(within(baselineColumn()).getByRole('status')).toBeTruthy();
    });
  });

  describe('when navigating the items column with the keyboard', () => {
    it('moves the selection to the next item', async () => {
      renderComparison();

      await within(await findItemsColumn()).findByText('item-a');
      const rows = interactiveRows(itemsColumn());

      expect(rows.length).toBeGreaterThan(1);
      expectArrowNavigation(rows);
    });
  });
});
