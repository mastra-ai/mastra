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
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(buildListExperimentsResponse(allExperiments))),
    // The comparison itself is covered by its own layout test; keep it inert here.
    http.post(`${TEST_BASE_URL}/api/datasets/:datasetId/compare`, () => HttpResponse.json(comparisonResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, ({ params }) =>
      HttpResponse.json(allExperiments.find(exp => exp.id === params.experimentId)),
    ),
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
  it('renders the comparison when both experiments belong to the same dataset', async () => {
    renderPage('?baseline=exp-a&contender=exp-b');
    expect(await screen.findByText('Experiments comparison')).toBeDefined();
  });

  it('refuses to compare experiments from different datasets', async () => {
    renderPage('?baseline=exp-a&contender=exp-c');
    expect(await screen.findByText(/must belong to the same dataset/i)).toBeDefined();
    expect(screen.queryByText('Experiments comparison')).toBeNull();
  });

  it('asks for two experiments when one of the ids is unknown', async () => {
    renderPage('?baseline=exp-a&contender=missing');
    expect(await screen.findByText(/select two experiments to compare/i)).toBeDefined();
  });
});
