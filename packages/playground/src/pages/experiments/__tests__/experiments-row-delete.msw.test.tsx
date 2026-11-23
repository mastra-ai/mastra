import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import ExperimentsPage from '..';
import { storageWithoutMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  buildListExperimentsResponse,
  emptyReviewSummary,
  experiments,
} from '@/domains/experiments/components/__tests__/fixtures/experiments';
import {
  agents,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const dataset = buildDataset({ id: 'dataset-1', name: 'Dataset One' });

const runA: DatasetExperiment = {
  ...experiments[0],
  id: 'exp-a',
  datasetId: 'dataset-1',
  name: 'run a',
  targetType: 'agent',
  targetId: 'agent-1',
};
const runB: DatasetExperiment = { ...experiments[1], id: 'exp-b', datasetId: 'dataset-1', name: 'run b' };

/** What the server still stores; DELETE removes from it so refetches reflect the deletion. */
let stored: DatasetExperiment[];
let deleteRequests: string[];

beforeEach(() => {
  stored = [runA, runB];
  deleteRequests = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithoutMetrics)),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(buildListExperimentsResponse(stored))),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([dataset]))),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId`, () => HttpResponse.json(dataset)),
  );
});

async function renderLoadedPage() {
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentsPage />
    </TestLinkProvider>,
    { router: { initialEntries: ['/experiments'] } },
  );
  await screen.findByText('run a');
}

async function confirmRowDeletion() {
  fireEvent.click(screen.getByRole('button', { name: 'Delete experiment run a' }));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
}

describe('Experiments page — rows', () => {
  describe('when the target agent is registered', () => {
    it('names the target from the agents registry', async () => {
      await renderLoadedPage();

      expect(await screen.findByText('Support Agent')).toBeDefined();
    });
  });

  describe('when a row deletion is confirmed', () => {
    beforeEach(() => {
      server.use(
        http.delete(`${TEST_BASE_URL}/api/experiments/:experimentId`, ({ params }) => {
          deleteRequests.push(String(params.experimentId));
          stored = stored.filter(experiment => experiment.id !== params.experimentId);
          return HttpResponse.json({ success: true });
        }),
      );
    });

    it('deletes the experiment through the top-level route', async () => {
      await renderLoadedPage();

      await confirmRowDeletion();

      await waitFor(() => expect(deleteRequests).toEqual(['exp-a']));
    });

    it('removes the experiment from the list', async () => {
      await renderLoadedPage();

      await confirmRowDeletion();

      await waitFor(() => expect(screen.queryByText('run a')).toBeNull());
      expect(screen.getByText('run b')).toBeDefined();
    });
  });

  describe('when the row deletion fails', () => {
    beforeEach(() => {
      server.use(
        http.delete(`${TEST_BASE_URL}/api/experiments/:experimentId`, ({ params }) => {
          deleteRequests.push(String(params.experimentId));
          return HttpResponse.json({ error: 'boom' }, { status: 500 });
        }),
      );
    });

    it('keeps the experiment and the confirmation open', async () => {
      await renderLoadedPage();

      await confirmRowDeletion();

      await waitFor(() => expect(deleteRequests).toEqual(['exp-a']));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined());
      expect(screen.getByRole('alertdialog')).toBeDefined();
      expect(screen.getByText('run a')).toBeDefined();
    });
  });
});
