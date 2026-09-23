import type { DatasetExperiment } from '@mastra/client-js';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import CompareExperimentsPage from '..';
import {
  buildListExperimentsResponse,
  experiments,
} from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { comparisonResponse } from '@/domains/experiments/components/comparison/__tests__/fixtures/comparison';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const sameDatasetA: DatasetExperiment = { ...experiments[0], id: 'exp-a', datasetId: 'dataset-1' };
const sameDatasetB: DatasetExperiment = { ...experiments[1], id: 'exp-b', datasetId: 'dataset-1' };
const otherDataset: DatasetExperiment = { ...experiments[2], id: 'exp-c', datasetId: 'dataset-2' };
const allExperiments = [sameDatasetA, sameDatasetB, otherDataset];

beforeEach(() => {
  server.use(
    // The comparison itself is covered by its own layout test; keep it inert here.
    http.post(`${TEST_BASE_URL}/api/datasets/:datasetId/compare`, () => HttpResponse.json(comparisonResponse)),
    // Mirrors the server: 404 when the experiment does not belong to the dataset.
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, ({ params }) => {
      const exp = allExperiments.find(e => e.id === params.experimentId);
      if (!exp || exp.datasetId !== params.datasetId) {
        return HttpResponse.json({ error: `Experiment not found: ${params.experimentId}` }, { status: 404 });
      }
      return HttpResponse.json(exp);
    }),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId/results`, () =>
      HttpResponse.json({ results: [], total: 0, page: 0, perPage: 100, hasMore: false }),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
      HttpResponse.json({ scores: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
    ),
  );
});

function renderPage(query: string) {
  return renderWithProviders(<CompareExperimentsPage />, {
    router: { initialEntries: [`/experiments/compare${query}`] },
  });
}

describe('CompareExperimentsPage', () => {
  it('renders the comparison for two experiments of the dataset', async () => {
    renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');
    expect(await screen.findByText('Experiments comparison')).toBeDefined();
  });

  it('resolves experiments that are not in the first page of the global list', async () => {
    server.use(http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(buildListExperimentsResponse([]))));
    renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');
    expect(await screen.findByText('Experiments comparison')).toBeDefined();
  });

  it('refuses to compare when an experiment belongs to another dataset', async () => {
    renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-c');
    expect(await screen.findByText(/must belong to the same dataset/i)).toBeDefined();
    expect(screen.queryByText('Experiments comparison')).toBeNull();
  });

  it('shows an error state when an experiment fails to load for another reason', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, ({ params }) =>
        params.experimentId === 'exp-b'
          ? HttpResponse.json({ error: 'Storage unavailable' }, { status: 500 })
          : HttpResponse.json(sameDatasetA),
      ),
    );
    renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');
    expect(await screen.findByText('Failed to load experiments')).toBeDefined();
    expect(screen.queryByText(/must belong to the same dataset/i)).toBeNull();
  });

  it('asks for two experiments when a parameter is missing', async () => {
    renderPage('?dataset=dataset-1&baseline=exp-a');
    expect(await screen.findByText(/select two experiments to compare/i)).toBeDefined();
  });
});
