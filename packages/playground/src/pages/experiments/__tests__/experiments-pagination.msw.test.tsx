import type { DatasetExperiment } from '@mastra/client-js';
import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import ExperimentsPage from '..';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { emptyReviewSummary, experiments } from '@/domains/experiments/components/__tests__/fixtures/experiments';
import {
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { EXPERIMENTS_PER_PAGE } from '@/domains/experiments/hooks/use-infinite-experiments';
import { useMockIntersectionObserver } from '@/test/intersection-observer';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const [modelA, modelB] = experiments;

/** Serves `pages[n]` for `?page=n` on the global list and records the pages requested. */
function setupHandlers(pages: DatasetExperiment[][]) {
  const requestedPages: string[] = [];

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([]))),
    http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => {
      const page = new URL(request.url).searchParams.get('page') ?? '';
      requestedPages.push(page);
      const index = Number(page);
      return HttpResponse.json({
        experiments: pages[index] ?? [],
        pagination: {
          total: pages.flat().length,
          page: index,
          perPage: EXPERIMENTS_PER_PAGE,
          hasMore: index < pages.length - 1,
        },
      });
    }),
  );

  return requestedPages;
}

function renderPage() {
  return renderWithProviders(
    <TestLinkProvider>
      <ExperimentsPage />
    </TestLinkProvider>,
    { router: { initialEntries: ['/experiments'] } },
  );
}

describe('Experiments page — infinite scroll', () => {
  const { intersect } = useMockIntersectionObserver();

  describe('Given the server has two pages of experiments', () => {
    it('when the page loads, then only the first page is shown and a load-more sentinel is rendered', async () => {
      const requestedPages = setupHandlers([[modelA], [modelB]]);
      renderPage();

      expect(await screen.findByText('entity-extraction / model-a')).toBeDefined();
      expect(screen.queryByText('entity-extraction / model-b')).toBeNull();
      expect(requestedPages).toEqual(['0']);
    });

    it('when the sentinel scrolls into view, then the second page is requested and appended', async () => {
      const requestedPages = setupHandlers([[modelA], [modelB]]);
      renderPage();
      await screen.findByText('entity-extraction / model-a');

      act(() => intersect(true));

      expect(await screen.findByText('entity-extraction / model-b')).toBeDefined();
      expect(screen.getByText('entity-extraction / model-a')).toBeDefined();
      expect(requestedPages).toEqual(['0', '1']);
    });
  });

  describe('Given the server has a single page', () => {
    it('when the sentinel scrolls into view, then no extra page is requested', async () => {
      const requestedPages = setupHandlers([[modelA]]);
      renderPage();
      await screen.findByText('entity-extraction / model-a');

      act(() => intersect(true));

      await waitFor(() => expect(requestedPages).toEqual(['0']));
    });
  });
});
