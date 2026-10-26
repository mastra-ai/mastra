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
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const dataset = buildDataset({ id: 'dataset-1', name: 'Dataset One' });

const runA: DatasetExperiment = { ...experiments[0], id: 'exp-a', datasetId: 'dataset-1', name: 'run a' };
const runB: DatasetExperiment = { ...experiments[1], id: 'exp-b', datasetId: 'dataset-1', name: 'run b' };
const runC: DatasetExperiment = { ...experiments[2], id: 'exp-c', datasetId: 'dataset-1', name: 'run c' };

/** What the server still stores; DELETE removes from it so refetches reflect the deletion. */
let stored: DatasetExperiment[];
let deleteRequests: string[];

function deleteSucceeds() {
  server.use(
    http.delete(`${TEST_BASE_URL}/api/experiments/:experimentId`, ({ params }) => {
      deleteRequests.push(String(params.experimentId));
      stored = stored.filter(experiment => experiment.id !== params.experimentId);
      return HttpResponse.json({ success: true });
    }),
  );
}

beforeEach(() => {
  stored = [runA, runB, runC];
  deleteRequests = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithoutMetrics)),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
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

function select(...ids: string[]) {
  for (const id of ids) {
    fireEvent.click(screen.getByRole('checkbox', { name: `Select experiment ${id}` }));
  }
}

function getDeleteButton() {
  return screen.getByRole('button', { name: /^delete$/i });
}

async function openConfirmation() {
  fireEvent.click(getDeleteButton());
  return screen.findByRole('alertdialog');
}

async function confirmDeletion() {
  const dialog = await openConfirmation();
  fireEvent.click(within(dialog).getByRole('button', { name: /^delete experiments?$/i }));
  return dialog;
}

describe('Experiments page — bulk delete', () => {
  describe('when no experiment is selected', () => {
    it('disables Delete', async () => {
      await renderLoadedPage();

      expect(getDeleteButton().hasAttribute('disabled')).toBe(true);
    });
  });

  describe('when experiments are selected', () => {
    beforeEach(() => deleteSucceeds());

    it('asks for confirmation naming how many experiments will be deleted', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');

      const dialog = await openConfirmation();

      expect(within(dialog).getByRole('heading', { name: 'Delete 2 experiments' })).toBeDefined();
    });

    it('deletes every selected experiment once confirmed', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');

      await confirmDeletion();

      await waitFor(() => expect([...deleteRequests].sort()).toEqual(['exp-a', 'exp-b']));
    });

    it('removes the deleted experiments from the list', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');

      await confirmDeletion();

      await waitFor(() => expect(screen.queryByText('run a')).toBeNull());
      expect(screen.queryByText('run b')).toBeNull();
      expect(screen.getByText('run c')).toBeDefined();
    });

    it('closes the confirmation and clears the selection', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');

      await confirmDeletion();

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(screen.getByRole('button', { name: '0 selected' })).toBeDefined();
    });

    it('deletes nothing when cancelled', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');

      const dialog = await openConfirmation();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(deleteRequests).toEqual([]);
      expect(screen.getByText('run a')).toBeDefined();
    });
  });

  describe('when one of the deletions fails', () => {
    beforeEach(() => {
      server.use(
        http.delete(`${TEST_BASE_URL}/api/experiments/:experimentId`, ({ params }) => {
          deleteRequests.push(String(params.experimentId));
          if (params.experimentId === 'exp-a') return HttpResponse.json({ error: 'boom' }, { status: 500 });
          stored = stored.filter(experiment => experiment.id !== params.experimentId);
          return HttpResponse.json({ success: true });
        }),
      );
    });

    it('keeps the confirmation open so the failed one can be retried', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');

      const dialog = await confirmDeletion();

      await waitFor(() => expect(screen.queryByText('run b')).toBeNull());
      expect(within(dialog).getByRole('heading', { name: 'Delete 1 experiment' })).toBeDefined();
    });

    it('keeps only the experiment that failed to delete selected', async () => {
      await renderLoadedPage();
      select('exp-a', 'exp-b');

      const dialog = await confirmDeletion();
      await waitFor(() => expect(screen.queryByText('run b')).toBeNull());
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(screen.getByRole('checkbox', { name: 'Select experiment exp-a' }).getAttribute('aria-checked')).toBe(
        'true',
      );
      expect(screen.getByText('1 selected')).toBeDefined();
    });
  });
});
