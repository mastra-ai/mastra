import type { DatasetExperiment } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
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
  usageBreakdownByExperimentId,
} from './fixtures/comparison';
import {
  renamedPostgresWithMetrics,
  storageWithoutMetrics,
} from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import { buildDataset } from '@/domains/datasets/components/__tests__/fixtures/datasets';
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
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () =>
      HttpResponse.json(buildDataset({ id: DATASET_ID, name: 'Support tickets', version: 2 })),
    ),
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
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithoutMetrics)),
  );
});

/** Turns metrics on and answers each experiment's usage breakdown, optionally holding it until `release` resolves. */
const useMetricsUsage = (release?: Promise<void>) => {
  const requestedExperimentIds: string[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(renamedPostgresWithMetrics)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
      const body = (await request.json()) as { filters?: { experimentId?: string } };
      const experimentId = body.filters?.experimentId ?? '';
      requestedExperimentIds.push(experimentId);
      await release;
      return HttpResponse.json(usageBreakdownByExperimentId[experimentId] ?? { groups: [] });
    }),
  );
  return requestedExperimentIds;
};

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

    it('shows the item input and ground truth by default', async () => {
      renderComparison();
      const row = await findItemRow('item-a');

      const input = await within(row).findByRole('region', { name: 'Input' });
      expect(within(input).getByText(/What is the capital of France/)).toBeTruthy();

      const groundTruth = within(row).getByRole('region', { name: 'Ground truth' });
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

  describe('when scores are known', () => {
    it('shows the delta once, on the contender, without the scorer reason', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Contender 1')).getByRole('link', { name: 'Open accuracy' })).toBeTruthy();
      });
      expect(within(sideOf('item-a', 'Baseline')).queryByText('Missing the country')).toBeNull();
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
        expect(within(sideOf('item-a', 'Contender 1')).getByText('0.40', { exact: false })).toBeTruthy();
      });
      // +0.10 on accuracy and -0.10 on relevancy.
      expect(within(sideOf('item-a', 'Contender 2')).getByText('+0.10')).toBeTruthy();
      expect(within(sideOf('item-a', 'Contender 2')).getByText('-0.10')).toBeTruthy();
      expect(within(sideOf('item-a', 'Baseline')).queryByText('0.40')).toBeNull();
      expect(within(sideOf('item-a', 'Baseline')).queryByText('0.10', { exact: false })).toBeNull();
    });
  });

  describe('when observability storage supports metrics and usage is pending', () => {
    it('keeps the page spinner up instead of the table', async () => {
      const requestedExperimentIds = useMetricsUsage(new Promise(() => {}));
      renderComparison();

      await waitFor(() => expect(requestedExperimentIds).toHaveLength(2));
      expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
      expect(screen.queryByRole('columnheader', { name: 'Items' })).toBeNull();
    });
  });

  describe('when observability storage supports metrics and usage resolves', () => {
    it('renders the comparison table', async () => {
      useMetricsUsage();
      renderComparison();

      expect(await screen.findByRole('columnheader', { name: 'Items' })).toBeTruthy();
      expect(await findItemRow('item-a')).toBeTruthy();
    });

    it('shows each experiment total cost, with the contender difference against the baseline', async () => {
      useMetricsUsage();
      renderComparison();

      const baseline = await screen.findByRole('columnheader', { name: 'Baseline' });
      await waitFor(() => expect(within(baseline).getByText('Total cost')).toBeTruthy());
      expect(within(baseline).getByText('$0.0015')).toBeTruthy();

      const contender = screen.getByRole('columnheader', { name: 'Contender 1' });
      expect(within(contender).getByText('$0.003')).toBeTruthy();
      expect(within(contender).getByText('+$0.0015')).toBeTruthy();
    });

    it('shows each item cost, with the contender difference against the baseline', async () => {
      useMetricsUsage();
      renderComparison();

      await findItemRow('item-a');
      const contender = sideOf('item-a', 'Contender 1');
      await waitFor(() => expect(within(contender).getByText('Cost')).toBeTruthy());
      expect(within(contender).getByText('$0.003')).toBeTruthy();
      expect(within(contender).getByText('+$0.0015')).toBeTruthy();
    });

    it('shows each experiment total tokens, with the contender difference against the baseline', async () => {
      useMetricsUsage();
      renderComparison();

      const baseline = await screen.findByRole('columnheader', { name: 'Baseline' });
      await waitFor(() => expect(within(baseline).getByText('Total tokens')).toBeTruthy());
      expect(within(baseline).getByText('150')).toBeTruthy();

      const contender = screen.getByRole('columnheader', { name: 'Contender 1' });
      expect(within(contender).getByText('200')).toBeTruthy();
      expect(within(contender).getByText('+50')).toBeTruthy();
    });

    it('shows each item tokens, with the contender difference against the baseline', async () => {
      useMetricsUsage();
      renderComparison();

      await findItemRow('item-a');
      const contender = sideOf('item-a', 'Contender 1');
      await waitFor(() => expect(within(contender).getByText('Tokens')).toBeTruthy());
      expect(within(contender).getByText('200')).toBeTruthy();
      expect(within(contender).getByText('+50')).toBeTruthy();
    });
  });

  describe('when observability storage does not support metrics', () => {
    it('leaves the cost and the tokens out of the headers and the items', async () => {
      renderComparison();

      await waitFor(() => expect(within(sideOf('item-a', 'Baseline')).getByText(/"Paris"/)).toBeTruthy());
      expect(screen.queryByText('Total cost')).toBeNull();
      expect(screen.queryByText('Cost')).toBeNull();
      expect(screen.queryByText('Total tokens')).toBeNull();
      expect(screen.queryByText('Tokens')).toBeNull();
    });
  });

  describe('when observability storage supports metrics and the results are still loading', () => {
    it('requests the usage of every experiment without waiting for the results', async () => {
      server.use(
        http.get(`${experimentsBase}/${BASELINE_ID}/results`, () => new Promise(() => {})),
        http.get(`${experimentsBase}/${CONTENDER_ID}/results`, () => new Promise(() => {})),
      );
      const requestedExperimentIds = useMetricsUsage();
      renderComparison();

      await waitFor(() => expect(requestedExperimentIds.sort()).toEqual([BASELINE_ID, CONTENDER_ID].sort()));
    });
  });

  describe('when the dataset loads', () => {
    it('names the dataset in the Items header, linking to it', async () => {
      renderComparison();

      const items = await screen.findByRole('columnheader', { name: 'Items' });
      const link = await within(items).findByRole('link', { name: 'Open dataset Support tickets' });
      expect(link.getAttribute('href')).toBe(`/datasets/${DATASET_ID}`);
    });

    it('leaves the dataset version out of the Items header, since each experiment may run on its own', async () => {
      renderComparison();

      const items = await screen.findByRole('columnheader', { name: 'Items' });
      await within(items).findByRole('link', { name: 'Open dataset Support tickets' });
      expect(within(items).queryByText(/^v\d+$/)).toBeNull();
    });
  });

  describe('when the dataset cannot be loaded', () => {
    it('still links to the dataset, named by its id', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () =>
          HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
        ),
      );
      renderComparison();

      const items = await screen.findByRole('columnheader', { name: 'Items' });
      const link = await within(items).findByRole('link', { name: `Open dataset ${DATASET_ID}` });
      expect(link.getAttribute('href')).toBe(`/datasets/${DATASET_ID}`);
    });
  });

  describe('when the experiments ran on different dataset versions', () => {
    it('shows each experiment the version it ran on, linked to the dataset at that version', async () => {
      renderComparison();

      const baseline = await screen.findByRole('columnheader', { name: 'Baseline' });
      const contender = screen.getByRole('columnheader', { name: 'Contender 1' });
      expect(within(baseline).getByRole('link', { name: 'Open dataset v1' }).getAttribute('href')).toBe(
        `/datasets/${DATASET_ID}?version=1`,
      );
      expect(within(contender).getByRole('link', { name: 'Open dataset v2' }).getAttribute('href')).toBe(
        `/datasets/${DATASET_ID}?version=2`,
      );
    });
  });

  describe('when an experiment has no dataset version', () => {
    it('shows no dataset version on its header', async () => {
      server.use(
        http.get(`${experimentsBase}/${BASELINE_ID}`, () =>
          HttpResponse.json({ ...makeExperiment(BASELINE_ID, 1), datasetVersion: null }),
        ),
      );
      renderComparison();

      const baseline = await screen.findByRole('columnheader', { name: 'Baseline' });
      expect(within(baseline).queryByRole('link', { name: /^Open dataset v/ })).toBeNull();
    });
  });

  describe('when a contender has a different dataset version than the baseline', () => {
    it('flags the version on that contender header only', async () => {
      useThreeWayComparison();
      renderComparison([CONTENDER_ID, CHALLENGER_ID]);

      const contender = await screen.findByRole('columnheader', { name: 'Contender 1' });
      await waitFor(() => {
        expect(within(contender).getByText(/differs from baseline/)).toBeTruthy();
      });
      expect(
        within(screen.getByRole('columnheader', { name: 'Baseline' })).queryByText(/differs from baseline/),
      ).toBeNull();
      expect(
        within(screen.getByRole('columnheader', { name: 'Contender 2' })).queryByText(/differs from baseline/),
      ).toBeNull();
    });
  });
});
