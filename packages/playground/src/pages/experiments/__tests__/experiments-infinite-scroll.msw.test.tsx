import type { DatasetExperiment } from '@mastra/client-js';
import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExperimentsPage from '..';
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
import { EXPERIMENTS_LIST_PAGE_SIZE } from '@/domains/experiments/hooks/use-infinite-experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

/** Lets a test scroll the end-of-list sentinel "into view" by hand. */
class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null;
  readonly rootMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  readonly observed: Element[] = [];
  readonly disconnect = vi.fn();
  readonly unobserve = vi.fn();
  readonly takeRecords = vi.fn(() => []);

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.root = options?.root ?? null;
    MockIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  intersect(element: Element) {
    this.callback([{ isIntersecting: true, target: element } as IntersectionObserverEntry], this);
  }
}

const scrollToEndOfList = () =>
  act(() => {
    for (const observer of MockIntersectionObserver.instances) {
      for (const element of observer.observed) observer.intersect(element);
    }
  });

const dataset = buildDataset({ id: 'dataset-1', name: 'Dataset One' });

/** Two pages: the first holds `experiments[0]` and reports more, the second holds `experiments[1]`. */
const pages: DatasetExperiment[][] = [[experiments[0]], [experiments[1]]];

function setupHandlers() {
  const requestedPages: string[] = [];

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([dataset]))),
    http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => {
      const url = new URL(request.url);
      requestedPages.push(`${url.searchParams.get('page')}:${url.searchParams.get('perPage')}`);
      const page = Number(url.searchParams.get('page'));
      const response = buildListExperimentsResponse(pages[page] ?? []);
      return HttpResponse.json({
        ...response,
        pagination: { ...response.pagination, page, hasMore: page < pages.length - 1 },
      });
    }),
  );

  return requestedPages;
}

const renderPage = () =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentsPage />
    </TestLinkProvider>,
    { router: { initialEntries: ['/experiments'] } },
  );

describe('Experiments page — infinite scroll', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  it('loads the next page when the end of the list scrolls into view', async () => {
    const requestedPages = setupHandlers();
    renderPage();

    expect(await screen.findByText('entity-extraction / model-a')).toBeDefined();
    expect(screen.queryByText('entity-extraction / model-b')).toBeNull();
    expect(requestedPages).toEqual([`0:${EXPERIMENTS_LIST_PAGE_SIZE}`]);

    await scrollToEndOfList();

    expect(await screen.findByText('entity-extraction / model-b')).toBeDefined();
    expect(screen.getByText('entity-extraction / model-a')).toBeDefined();
    expect(requestedPages).toEqual([`0:${EXPERIMENTS_LIST_PAGE_SIZE}`, `1:${EXPERIMENTS_LIST_PAGE_SIZE}`]);
  });

  it('stops requesting once the server reports no more pages', async () => {
    const requestedPages = setupHandlers();
    renderPage();

    await screen.findByText('entity-extraction / model-a');
    await scrollToEndOfList();
    await screen.findByText('entity-extraction / model-b');

    await scrollToEndOfList();

    await waitFor(() => expect(requestedPages).toHaveLength(2));
  });
});
