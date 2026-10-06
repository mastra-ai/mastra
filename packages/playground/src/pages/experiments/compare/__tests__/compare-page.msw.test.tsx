import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import CompareExperimentsPage from '..';
import { sameDatasetA, sameDatasetB, otherDataset, emptyComparison, emptyResults, emptyScores } from './fixtures/page';
import { buildListExperimentsResponse } from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const allExperiments = [sameDatasetA, sameDatasetB, otherDataset];

beforeEach(() => {
  server.use(
    // The comparison itself is covered by its own layout test; keep it inert here.
    http.post(`${TEST_BASE_URL}/api/datasets/:datasetId/compare`, () => HttpResponse.json(emptyComparison)),
    // Mirrors the server: 404 when the experiment does not belong to the dataset.
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, ({ params }) => {
      const exp = allExperiments.find(e => e.id === params.experimentId);
      if (!exp || exp.datasetId !== params.datasetId) {
        return HttpResponse.json({ error: `Experiment not found: ${params.experimentId}` }, { status: 404 });
      }
      return HttpResponse.json(exp);
    }),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId/results`, () =>
      HttpResponse.json(emptyResults),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () => HttpResponse.json(emptyScores)),
  );
});

function renderPage(query: string) {
  return renderWithProviders(<CompareExperimentsPage />, {
    router: { initialEntries: [`/experiments/compare${query}`] },
  });
}

describe('CompareExperimentsPage', () => {
  describe('when both experiments belong to the dataset', () => {
    it('renders the comparison for two experiments of the dataset', async () => {
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');
      expect(await screen.findByText('Experiments comparison')).toBeDefined();
    });
  });

  describe('when the global experiment list does not contain the compared experiments', () => {
    it('resolves experiments that are not in the first page of the global list', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(buildListExperimentsResponse([]))),
      );
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');
      expect(await screen.findByText('Experiments comparison')).toBeDefined();
    });
  });

  describe('when an experiment belongs to another dataset', () => {
    it('refuses to compare when an experiment belongs to another dataset', async () => {
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-c');
      expect(await screen.findByText(/must belong to the same dataset/i)).toBeDefined();
      expect(screen.queryByText('Experiments comparison')).toBeNull();
    });
  });

  describe('when experiment storage fails', () => {
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
  });

  describe('when a comparison parameter is missing', () => {
    it('asks for two experiments when a parameter is missing', async () => {
      renderPage('?dataset=dataset-1&baseline=exp-a');
      expect(await screen.findByText(/select two experiments to compare/i)).toBeDefined();
    });
  });
});

describe('CompareExperimentsPage query loading', () => {
  describe('when experiment metadata is still loading', () => {
    it('starts comparison, results, and scores requests before metadata resolves', async () => {
      let release = () => {};
      const held = new Promise<void>(resolve => {
        release = resolve;
      });
      const requested = new Set<string>();
      server.use(
        http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, async ({ params }) => {
          await held;
          return HttpResponse.json(params.experimentId === 'exp-a' ? sameDatasetA : sameDatasetB);
        }),
        http.post(`${TEST_BASE_URL}/api/datasets/:datasetId/compare`, () => {
          requested.add('comparison');
          return HttpResponse.json(emptyComparison);
        }),
        http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId/results`, ({ params }) => {
          requested.add(`results:${params.experimentId}`);
          return HttpResponse.json(emptyResults);
        }),
        http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, ({ params }) => {
          requested.add(`scores:${params.experimentId}`);
          return HttpResponse.json(emptyScores);
        }),
      );
      try {
        renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');
        await waitFor(() =>
          expect(requested).toEqual(
            new Set(['comparison', 'results:exp-a', 'results:exp-b', 'scores:exp-a', 'scores:exp-b']),
          ),
        );
      } finally {
        release();
      }
    });
  });
});
