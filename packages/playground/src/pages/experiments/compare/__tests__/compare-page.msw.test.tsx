import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import CompareExperimentsPage from '..';
import {
  sameDatasetA,
  sameDatasetB,
  otherDataset,
  moreSameDataset,
  emptyComparison,
  emptyResults,
  emptyScores,
  comparisonOf,
} from './fixtures/page';
import { storageWithoutMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import { buildDataset } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { buildListExperimentsResponse } from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { noScorers } from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const allExperiments = [sameDatasetA, sameDatasetB, otherDataset, ...moreSameDataset];

beforeEach(() => {
  server.use(
    // Named in the header.
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId`, ({ params }) =>
      HttpResponse.json(buildDataset({ id: String(params.datasetId), name: 'Support tickets' })),
    ),
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
    // The comparison's trace drawer stays mounted (closed) and loads the scorer registry.
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    // Metrics off: per-item usage is covered by the comparison layout test.
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithoutMetrics)),
  );
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderPage(query: string) {
  return renderWithProviders(
    <TestLinkProvider>
      <LocationProbe />
      <CompareExperimentsPage />
    </TestLinkProvider>,
    { router: { initialEntries: [`/experiments/compare${query}`] } },
  );
}

/** Answers the compare request with one row for every requested experiment, and records the request body. */
function useEchoComparison() {
  const requests: Array<{ experimentIds: string[]; baselineId?: string }> = [];
  server.use(
    http.post(`${TEST_BASE_URL}/api/datasets/:datasetId/compare`, async ({ request }) => {
      const body = (await request.json()) as { experimentIds: string[]; baselineId?: string };
      requests.push(body);
      return HttpResponse.json(comparisonOf(body.experimentIds, body.baselineId ?? body.experimentIds[0]));
    }),
  );
  return requests;
}

const breadcrumb = () => screen.getByRole('navigation', { name: 'Breadcrumb' });

describe('CompareExperimentsPage', () => {
  describe('when the dataset loads', () => {
    it('shows the compared dataset in the header, linking to it', async () => {
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');

      const link = await screen.findByRole('link', { name: 'Open dataset Support tickets' });
      expect(link.getAttribute('href')).toBe('/datasets/dataset-1');
    });

    it('offers a metrics picker in the header', async () => {
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');

      fireEvent.click(await screen.findByRole('button', { name: 'Metrics' }));

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
    });

    it('keeps the dataset out of the breadcrumb', async () => {
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');

      await screen.findByRole('link', { name: 'Open dataset Support tickets' });
      expect(within(breadcrumb()).queryByText('Support tickets')).toBeNull();
    });
  });

  describe('when the dataset cannot be loaded', () => {
    it('names the dataset by its id in the header', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/datasets/:datasetId`, () =>
          HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
        ),
      );
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');

      const link = await screen.findByRole('link', { name: 'Open dataset dataset-1' });
      expect(link.getAttribute('href')).toBe('/datasets/dataset-1');
    });
  });

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

  describe('when the URL has a baseline and two contenders', () => {
    it('renders a column per experiment', async () => {
      useEchoComparison();
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b&contender=exp-d');

      expect(await screen.findByRole('columnheader', { name: 'Baseline' })).toBeDefined();
      expect(screen.getByRole('columnheader', { name: 'Contender 1' })).toBeDefined();
      expect(screen.getByRole('columnheader', { name: 'Contender 2' })).toBeDefined();
    });
  });

  describe('when the user sets a contender as the baseline', () => {
    it('moves that contender to the baseline and the old baseline first among contenders', async () => {
      useEchoComparison();
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b&contender=exp-d');

      const header = await screen.findByRole('columnheader', { name: 'Contender 2' });
      fireEvent.click(within(header).getByRole('button', { name: 'Set as baseline' }));

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe(
          '?dataset=dataset-1&baseline=exp-d&contender=exp-a&contender=exp-b',
        ),
      );
    });

    it('compares against the new baseline', async () => {
      const requests = useEchoComparison();
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b');

      const header = await screen.findByRole('columnheader', { name: 'Contender 1' });
      fireEvent.click(within(header).getByRole('button', { name: 'Set as baseline' }));

      await waitFor(() => expect(requests.at(-1)).toEqual({ experimentIds: ['exp-b', 'exp-a'], baselineId: 'exp-b' }));
    });
  });

  describe('when the URL repeats experiment ids', () => {
    it('compares each experiment once', async () => {
      const requests = useEchoComparison();
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b&contender=exp-a&contender=exp-b');

      await waitFor(() => expect(requests[0]).toEqual({ experimentIds: ['exp-a', 'exp-b'], baselineId: 'exp-a' }));
    });
  });

  describe('when the URL lists more than nine contenders', () => {
    it('keeps the first nine contenders', async () => {
      const requests = useEchoComparison();
      const contenders = ['b', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map(suffix => `exp-${suffix}`);
      renderPage(`?dataset=dataset-1&baseline=exp-a${contenders.map(id => `&contender=${id}`).join('')}`);

      await waitFor(() =>
        expect(requests[0]).toEqual({ experimentIds: ['exp-a', ...contenders.slice(0, 9)], baselineId: 'exp-a' }),
      );
    });
  });

  describe('when a contender belongs to another dataset', () => {
    it('refuses to compare', async () => {
      renderPage('?dataset=dataset-1&baseline=exp-a&contender=exp-b&contender=exp-c');
      expect(await screen.findByText(/must belong to the same dataset/i)).toBeDefined();
      expect(screen.queryByText('Experiments comparison')).toBeNull();
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
    it('asks for two to ten experiments when a parameter is missing', async () => {
      renderPage('?dataset=dataset-1&baseline=exp-a');
      expect(await screen.findByText(/select two to ten experiments to compare/i)).toBeDefined();
    });

    it('offers no metrics picker', async () => {
      renderPage('?dataset=dataset-1&baseline=exp-a');

      await screen.findByText(/select two to ten experiments to compare/i);
      expect(screen.queryByRole('button', { name: 'Metrics' })).toBeNull();
    });

    it('waits for complete parameters before requesting experiment metadata', async () => {
      let metadataRequests = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, () => {
          metadataRequests += 1;
          return HttpResponse.json(sameDatasetA);
        }),
      );
      const { queryClient } = renderPage('?dataset=dataset-1&baseline=exp-a');

      await screen.findByText(/select two to ten experiments to compare/i);
      await waitForMutationsIdle(queryClient);

      expect(metadataRequests).toBe(0);
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
