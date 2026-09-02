import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InboxPage from './index';
import { traceASpans } from '@/domains/traces/components/__tests__/fixtures/thread-traces';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const FEEDBACK_URL = `${TEST_BASE_URL}/api/observability/feedback`;

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

const makeFeedback = (index: number, reviewStatus: 'needs-review' | 'reviewed' = 'needs-review') => ({
  feedbackId: `feedback-${index}`,
  timestamp: '2026-09-01T12:00:00.000Z',
  traceId: `trace-${index}`,
  feedbackSource: 'user',
  feedbackType: 'comment',
  value: `Feedback ${index}`,
  reviewStatus,
});

const seedHandlers = () => {
  const feedbackRequests: URL[] = [];
  const reviewRequests: { feedbackId: string; body: unknown }[] = [];
  let reviewedIds = new Set<string>();

  server.use(
    http.get(FEEDBACK_URL, ({ request }) => {
      const url = new URL(request.url);
      feedbackRequests.push(url);
      const page = Number(url.searchParams.get('page') ?? '0');
      const status = url.searchParams.get('reviewStatus');

      const all = Array.from({ length: 25 }, (_, i) =>
        makeFeedback(i, reviewedIds.has(`feedback-${i}`) ? 'reviewed' : 'needs-review'),
      );
      const filtered = status ? all.filter(f => f.reviewStatus === status) : all;
      const feedback = filtered.slice(page * 20, page * 20 + 20);
      return HttpResponse.json({
        feedback,
        pagination: { total: filtered.length, page, perPage: 20, hasMore: page * 20 + 20 < filtered.length },
      });
    }),
    http.patch(`${FEEDBACK_URL}/:feedbackId/review-status`, async ({ params, request }) => {
      const feedbackId = String(params.feedbackId);
      const body = await request.json();
      reviewRequests.push({ feedbackId, body });
      reviewedIds = new Set([...reviewedIds, feedbackId]);
      return HttpResponse.json({ ...makeFeedback(0, 'reviewed'), feedbackId });
    }),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(traceASpans)),
    http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? '0');
      return HttpResponse.json({
        experiments: page === 0 ? [{ id: 'experiment-1', datasetId: 'dataset-1' }] : [],
        pagination: { total: 1, page, perPage: 100, hasMore: page === 0 },
      });
    }),
    http.get(`${TEST_BASE_URL}/api/datasets/dataset-1/experiments/experiment-1/results`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? '0');
      const pages = [
        [
          {
            id: 'result-1',
            itemId: 'item-1',
            experimentId: 'experiment-1',
            status: 'needs-review',
            traceId: 'trace-a',
          },
          { id: 'result-3', itemId: 'item-3', experimentId: 'experiment-1', status: 'complete' },
        ],
        [{ id: 'result-2', itemId: 'item-2', experimentId: 'experiment-1', status: 'needs-review' }],
      ];
      return HttpResponse.json({
        results: pages[page] ?? [],
        pagination: { total: 3, page, perPage: 100, hasMore: page < pages.length - 1 },
      });
    }),
  );

  return { feedbackRequests, reviewRequests };
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

const renderInbox = (initialEntry = '/inbox') =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </>,
    { router: { initialEntries: [initialEntry] } },
  );

describe('InboxPage', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders both tabs with review counts', async () => {
    seedHandlers();
    renderInbox();

    const feedbackTab = await screen.findByRole('tab', { name: /feedback/i });
    await waitFor(() => expect(within(feedbackTab).getByText('25')).toBeTruthy());

    const datasetTab = screen.getByRole('tab', { name: /dataset items/i });
    await waitFor(() => expect(within(datasetTab).getByText('2')).toBeTruthy());
  });

  it('only requests feedback that needs review', async () => {
    const { feedbackRequests } = seedHandlers();
    renderInbox();

    await screen.findByText('Feedback 0');
    expect(feedbackRequests[0].searchParams.get('reviewStatus')).toBe('needs-review');
    expect(screen.queryByText('Needs review')).toBeNull();
  });

  it('marks a feedback item reviewed and removes it from the inbox', async () => {
    const { reviewRequests } = seedHandlers();
    renderInbox();

    const row = (await screen.findByText('Feedback 0')).closest('.data-list-row')!;
    fireEvent.click(within(row).getByRole('button', { name: /mark reviewed/i }));

    await waitFor(() =>
      expect(reviewRequests).toEqual([{ feedbackId: 'feedback-0', body: { reviewStatus: 'reviewed' } }]),
    );
    await waitFor(() => expect(screen.queryByText('Feedback 0')).toBeNull());
  });

  it('loads the next feedback page when the list sentinel intersects inside the list viewport', async () => {
    const { feedbackRequests } = seedHandlers();
    renderInbox();

    await screen.findByText('Feedback 19');
    expect(screen.queryByText('Feedback 20')).toBeNull();

    const observer = MockIntersectionObserver.instances.find(instance => instance.observed.length > 0);
    expect(observer).toBeDefined();
    expect(observer!.root).toBeInstanceOf(HTMLElement);
    expect((observer!.root as HTMLElement).contains(observer!.observed[0])).toBe(true);

    act(() => observer!.intersect(observer!.observed[0]));

    await screen.findByText('Feedback 20');
    expect(feedbackRequests.some(url => url.searchParams.get('page') === '1')).toBe(true);
  });

  it('opens the trace side panel when a feedback row is clicked, and marks it reviewed from the panel', async () => {
    const { reviewRequests } = seedHandlers();
    renderInbox();

    const row = (await screen.findByText('Feedback 3')).closest('.data-list-row')!;
    fireEvent.click(within(row).getByRole('button', { name: /Feedback 3/ }));

    // Stays on the inbox; the selection is reflected in the URL and a review bar appears.
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('feedbackId=feedback-3'));
    expect(screen.getByTestId('location').textContent).toContain('/inbox');
    expect(screen.getByTestId('location').textContent).toContain('traceId=trace-3');
    const markButton = await screen.findByRole('button', { name: /mark as reviewed/i });

    fireEvent.click(markButton);

    await waitFor(() =>
      expect(reviewRequests).toEqual([{ feedbackId: 'feedback-3', body: { reviewStatus: 'reviewed' } }]),
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: /mark as reviewed/i })).toBeNull());
    await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('feedbackId='));
  });

  it('filters feedback rows through the list search', async () => {
    seedHandlers();
    renderInbox();

    await screen.findByText('Feedback 3');
    fireEvent.change(screen.getByLabelText('Filter feedback'), { target: { value: 'Feedback 7' } });

    await waitFor(() => expect(screen.queryByText('Feedback 3')).toBeNull());
    expect(screen.getByText('Feedback 7')).toBeTruthy();
  });

  it('lists dataset items needing review on the dataset tab', async () => {
    seedHandlers();
    renderInbox('/inbox?tab=dataset');

    expect(await screen.findByText('item-1')).toBeTruthy();
    expect(screen.getByText('item-2')).toBeTruthy();
    expect(screen.queryByText('item-3')).toBeNull();
  });

  it('shows a global empty state with links to experiments and traces when both lists are empty', async () => {
    seedHandlers();
    server.use(
      http.get(FEEDBACK_URL, () =>
        HttpResponse.json({ feedback: [], pagination: { total: 0, page: 0, perPage: 20, hasMore: false } }),
      ),
      http.get(`${TEST_BASE_URL}/api/experiments`, () =>
        HttpResponse.json({ experiments: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
      ),
    );
    renderInbox('/inbox');

    expect(await screen.findByText('Your inbox is empty')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to experiments' }).getAttribute('href')).toBe('/experiments');
    expect(screen.getByRole('link', { name: 'Go to traces' }).getAttribute('href')).toBe('/traces');
    expect(screen.queryByRole('tab', { name: /Feedback/ })).toBeNull();
  });

  it('keeps the tabs when only one list is empty', async () => {
    seedHandlers();
    server.use(
      http.get(FEEDBACK_URL, () =>
        HttpResponse.json({ feedback: [], pagination: { total: 0, page: 0, perPage: 20, hasMore: false } }),
      ),
    );
    renderInbox('/inbox?tab=dataset');

    expect(await screen.findByText('item-1')).toBeTruthy();
    expect(screen.queryByText('Your inbox is empty')).toBeNull();
  });

  it('opens the experiment Reviews tab featuring the result when a dataset row is clicked', async () => {
    seedHandlers();
    renderInbox('/inbox?tab=dataset');

    fireEvent.click(await screen.findByRole('button', { name: /item-1/ }));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/experiments/experiment-1?review=result-1'),
    );
  });
});
