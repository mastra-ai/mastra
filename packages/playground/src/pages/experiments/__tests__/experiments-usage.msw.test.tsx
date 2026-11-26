import type { DatasetExperiment, GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import ExperimentsPage from '..';
import {
  renamedPostgresWithMetrics,
  storageWithoutMetrics,
} from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  buildListExperimentsResponse,
  emptyReviewSummary,
  experiments,
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/experiments';
import {
  experimentsDurationBreakdown,
  experimentsTokenBreakdown,
} from '@/domains/experiments/components/__tests__/fixtures/experiments-list-metrics';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const firstPageDataset = buildDataset({ id: 'dataset-1', name: 'Dataset One' });
// Not on the first page of `GET /datasets`: only reachable through the `datasetIds` filter.
const laterPageDataset = buildDataset({ id: 'dataset-later', name: 'Dataset From A Later Page' });

const measuredExperiment = experiments[0];
const runningExperiment: DatasetExperiment = {
  ...experiments[1],
  datasetId: laterPageDataset.id,
  status: 'running',
  completedAt: null,
};

function setupHandlers(capabilities: GetObservabilityCapabilitiesResponse) {
  const calls = { breakdowns: 0, datasetIdsQueries: [] as string[][] };

  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () =>
      HttpResponse.json(buildListExperimentsResponse([measuredExperiment, runningExperiment])),
    ),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, ({ request }) => {
      const datasetIds = new URL(request.url).searchParams.getAll('datasetIds');
      if (datasetIds.length === 0) return HttpResponse.json(buildListDatasetsResponse([firstPageDataset]));
      calls.datasetIdsQueries.push(datasetIds);
      return HttpResponse.json(
        buildListDatasetsResponse(
          [firstPageDataset, laterPageDataset].filter(dataset => datasetIds.includes(dataset.id)),
        ),
      );
    }),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
      calls.breakdowns += 1;
      const body = (await request.json()) as { groupBy: string[] };
      return HttpResponse.json(
        body.groupBy.includes('name') ? experimentsTokenBreakdown : experimentsDurationBreakdown,
      );
    }),
  );

  return calls;
}

function renderPage() {
  return renderWithProviders(
    <TestLinkProvider>
      <ExperimentsPage />
    </TestLinkProvider>,
    { router: { initialEntries: ['/experiments'] } },
  );
}

const findRow = (name: string) => screen.findByRole('link', { name: new RegExp(name) });

describe('Experiments page usage columns', () => {
  describe('when the observability store serves metrics', () => {
    it('shows the run duration, average agent duration, tokens and cost of each experiment', async () => {
      setupHandlers(renamedPostgresWithMetrics);
      renderPage();

      const row = await findRow('entity-extraction / model-a');
      expect(await within(row).findByText('12.4K')).toBeDefined();
      expect(within(row).getByText('5m')).toBeDefined();
      expect(within(row).getByText('2.5s')).toBeDefined();
      expect(within(row).getByText('$0.012')).toBeDefined();
    });

    it('fetches metrics for all listed experiments in one token and one duration breakdown', async () => {
      const calls = setupHandlers(renamedPostgresWithMetrics);
      renderPage();

      const row = await findRow('entity-extraction / model-a');
      await within(row).findByText('12.4K');
      expect(calls.breakdowns).toBe(2);
    });

    it('shows dashes for an experiment that is still running and has no metrics yet', async () => {
      setupHandlers(renamedPostgresWithMetrics);
      renderPage();

      await within(await findRow('entity-extraction / model-a')).findByText('12.4K');
      const row = await findRow('entity-extraction / model-b');
      // duration, avg duration, tokens, cost and review
      expect(within(row).getAllByText('—')).toHaveLength(5);
    });
  });

  describe('when the observability store does not serve metrics', () => {
    it('shows the run duration without the usage columns', async () => {
      const calls = setupHandlers(storageWithoutMetrics);
      renderPage();

      const row = await findRow('entity-extraction / model-a');
      expect(within(row).getByText('5m')).toBeDefined();
      expect(screen.getByText('Duration')).toBeDefined();
      expect(screen.queryByText('Avg duration')).toBeNull();
      expect(screen.queryByText('Tokens')).toBeNull();
      expect(screen.queryByText('Cost')).toBeNull();
      expect(calls.breakdowns).toBe(0);
    });
  });

  describe("when an experiment's dataset is not on the first page of datasets", () => {
    it('shows the dataset name resolved by id', async () => {
      const calls = setupHandlers(storageWithoutMetrics);
      renderPage();

      const row = await findRow('entity-extraction / model-b');
      expect(await within(row).findByText('Dataset From A Later Page')).toBeDefined();
      expect(calls.datasetIdsQueries).toEqual([['dataset-1', 'dataset-later']]);
    });
  });
});
