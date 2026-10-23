import type {
  GetObservabilityCapabilitiesResponse,
  QueryTraceThreadsResult,
  ThreadQueryRequest,
  TraceQueryKeysetRequest,
} from '@mastra/client-js';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { Outlet, Route, Routes, useLocation } from 'react-router';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThreadsPage from '..';
import {
  emptyEntityNames,
  emptyEnvironments,
  emptyMcpServers,
  emptyThreads,
  emptyThreadTraces,
  noThreadRowsCapabilities,
  supportThreadTurns,
  supportTurnScores,
  supportTurnSpans,
  threadQueryCapabilities,
  threadsFirstPage,
  threadsLastPage,
  THREADS_PAGE_TWO_CURSOR,
} from './fixtures/threads';
import { ObservabilityLayout } from '@/domains/observability/observability-layout';
import { useMockIntersectionObserver } from '@/test/intersection-observer';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const CAPABILITIES_URL = `${TEST_BASE_URL}/api/observability/capabilities`;
const THREADS_QUERY_URL = `${TEST_BASE_URL}/api/observability/threads/query`;
const TRACES_QUERY_URL = `${TEST_BASE_URL}/api/observability/traces/query`;
const ENTITY_NAMES_URL = `${TEST_BASE_URL}/api/observability/discovery/entity-names`;
const ENVIRONMENTS_URL = `${TEST_BASE_URL}/api/observability/discovery/environments`;
const DAY_MS = 24 * 60 * 60 * 1000;

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderPage = (initialEntry = '/threads') =>
  renderWithProviders(
    <TestLinkProvider>
      <Routes>
        <Route
          element={
            <ObservabilityLayout>
              <Outlet />
            </ObservabilityLayout>
          }
        >
          <Route path="/threads" element={<ThreadsPage />} />
        </Route>
      </Routes>
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' }) as HTMLInputElement;
const typeFilter = (text: string) => fireEvent.change(getFilterInput(), { target: { value: text } });
const pressFilterKey = (key: string) => fireEvent.keyDown(getFilterInput(), { key });

/** Builds a `<field> is <value>` filter through the typeahead input: field, operator, then value. */
const pickFilter = async (field: string, value: string) => {
  getFilterInput().focus();
  typeFilter(field);
  await screen.findByRole('option', { name: field });
  pressFilterKey('Enter');
  await screen.findByRole('option', { name: 'is' });
  pressFilterKey('Enter');
  typeFilter(value);
  await screen.findByRole('option', { name: value });
  pressFilterKey('Enter');
};

/** Serves the capabilities and answers thread queries by cursor, recording every request body. */
function setThreadsHandlers(
  capabilities: GetObservabilityCapabilitiesResponse,
  pages: { first: QueryTraceThreadsResult; byCursor?: Record<string, QueryTraceThreadsResult> },
) {
  const requests: ThreadQueryRequest[] = [];
  const traceRequests: TraceQueryKeysetRequest[] = [];
  server.use(
    http.get(CAPABILITIES_URL, () => HttpResponse.json(capabilities)),
    http.get(ENTITY_NAMES_URL, () => HttpResponse.json(emptyEntityNames)),
    http.get(ENVIRONMENTS_URL, () => HttpResponse.json(emptyEnvironments)),
    http.post(THREADS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as ThreadQueryRequest;
      requests.push(body);
      const after = body.page?.after;
      return HttpResponse.json(after ? (pages.byCursor?.[after] ?? emptyThreads) : pages.first);
    }),
    http.post(TRACES_QUERY_URL, async ({ request }) => {
      traceRequests.push((await request.json()) as TraceQueryKeysetRequest);
      return HttpResponse.json(emptyThreadTraces);
    }),
  );
  return { requests, traceRequests };
}

describe('Threads page', () => {
  // jsdom has no layout, so the list virtualizer sees a zero-height scroll container and
  // renders no rows. Report a fixed viewport so rows materialize.
  let layoutStubs: { rect: ReturnType<typeof vi.spyOn>; resizeObserver: typeof ResizeObserver };
  beforeEach(() => {
    const originalResizeObserver = globalThis.ResizeObserver;
    class LayoutResizeObserver {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: new DOMRect(0, 0, 800, 600),
              borderBoxSize: [{ inlineSize: 800, blockSize: 600 }],
              contentBoxSize: [{ inlineSize: 800, blockSize: 600 }],
              devicePixelContentBoxSize: [{ inlineSize: 800, blockSize: 600 }],
            },
          ],
          this,
        );
      }
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = LayoutResizeObserver;
    layoutStubs = {
      rect: vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600)),
      resizeObserver: originalResizeObserver,
    };
    // jsdom does not implement scrollIntoView, which the thread view uses to reveal its latest turn.
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    layoutStubs.rect.mockRestore();
    globalThis.ResizeObserver = layoutStubs.resizeObserver;
  });
  // Let the list virtualizer's debounce timer fire before jsdom tears down `window`.
  afterAll(() => new Promise(resolve => setTimeout(resolve, 200)));

  describe('when the observability store cannot return thread rows', () => {
    it('shows the capability empty state without querying threads', async () => {
      const { requests } = setThreadsHandlers(noThreadRowsCapabilities, { first: threadsFirstPage });

      renderPage();

      expect(await screen.findByText('Query threads capability not activated')).toBeTruthy();
      expect(requests).toHaveLength(0);
    });

    it('names Threads in the breadcrumb, since no switch shows it', async () => {
      setThreadsHandlers(noThreadRowsCapabilities, { first: threadsFirstPage });

      renderPage();

      await screen.findByText('Query threads capability not activated');
      const breadcrumb = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
      expect(breadcrumb.getByText('Traces')).toBeTruthy();
      expect(breadcrumb.getByText('Threads')).toBeTruthy();
    });
  });

  describe('while the storage capabilities are loading', () => {
    it('shows a placeholder for the view switch', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });
      server.use(
        http.get(CAPABILITIES_URL, async () => {
          await delay('infinite');
          return HttpResponse.json(threadQueryCapabilities);
        }),
      );

      renderPage();

      expect(await screen.findByRole('status', { name: 'Loading views' })).toBeTruthy();
    });
  });

  describe('when the observability store returns thread rows', () => {
    it('lists the threads of the first page by their primitive name', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage();

      expect(await screen.findByText('Weather Agent')).toBeTruthy();
      expect(screen.getByText('Support Agent')).toBeTruthy();
    });

    it('queries the first page over the trace activity window, newest first', async () => {
      const { requests } = setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage();
      await screen.findByText('Weather Agent');

      const timeRange = requests[0]?.timeRange;
      if (!timeRange || !('traces' in timeRange)) throw new Error('No trace activity window');
      const days = (Date.parse(timeRange.traces.to) - Date.parse(timeRange.traces.from)) / DAY_MS;
      expect(Math.round(days)).toBe(7);
      expect(requests[0]?.orderBy).toEqual([{ field: 'startedAt', direction: 'desc' }]);
      expect(requests[0]?.page).toEqual({ limit: 25 });
    });

    it('marks Threads as the current view', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage();

      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      expect(views.getByRole('tab', { name: 'Threads' }).getAttribute('aria-selected')).toBe('true');
      expect(views.getByRole('tab', { name: 'Traces' }).getAttribute('aria-selected')).toBe('false');
    });

    it('offers the Spans view only when the store supports span queries', async () => {
      setThreadsHandlers(
        { ...threadQueryCapabilities, capabilities: { ...threadQueryCapabilities.capabilities, spanQuery: false } },
        { first: threadsFirstPage },
      );

      renderPage();

      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      expect(views.queryByRole('tab', { name: 'Spans' })).toBeNull();
    });
  });

  describe('when Traces is clicked in the view switch', () => {
    it('navigates to the traces page', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage();
      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      fireEvent.click(views.getByRole('tab', { name: 'Traces' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/traces'));
    });
  });

  describe('when a thread row is clicked', () => {
    it('opens the full thread in a drawer', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('Support Agent'));

      expect(await screen.findByRole('dialog', { name: 'Thread thread-2' })).toBeTruthy();
    });

    it("loads that thread's turns", async () => {
      const { traceRequests } = setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('Support Agent'));

      await waitFor(() =>
        expect(JSON.stringify(traceRequests.at(-1)?.where)).toContain(
          JSON.stringify({ op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-2' } }),
        ),
      );
    });

    it('puts the open thread in the URL of the threads page', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('Support Agent'));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/threads?threadId=thread-2'));
    });
  });

  describe('when a score of a turn is opened in the drawer', () => {
    it('navigates to the trace on that score', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });
      server.use(
        http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(emptyMcpServers)),
        http.post(TRACES_QUERY_URL, () => HttpResponse.json(supportThreadTurns)),
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(supportTurnSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () =>
          HttpResponse.json(supportTurnScores),
        ),
      );

      renderPage('/threads?threadId=thread-2');
      const dialog = within(await screen.findByRole('dialog', { name: 'Thread thread-2' }));
      fireEvent.click(await dialog.findByRole('tab', { name: /Scores/ }));
      fireEvent.click(await dialog.findByRole('button', { name: /^Score / }));

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe('/traces?traceId=thread-2-trace-1&scoreId=score-1'),
      );
    });
  });

  describe('when the drawer Close button is clicked', () => {
    it('closes the drawer', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage('/threads?threadId=thread-1');
      const dialog = within(await screen.findByRole('dialog', { name: 'Thread thread-1' }));
      fireEvent.click(dialog.getByRole('button', { name: 'Close' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/threads'));
    });
  });

  describe('when the thread query fails', () => {
    it('shows the error state', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });
      server.use(http.post(THREADS_QUERY_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderPage();

      expect(await screen.findByText('Failed to load threads')).toBeTruthy();
    });
  });

  describe('when the thread query returns no threads', () => {
    it('shows the empty state naming threads and the time range', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: emptyThreads });

      renderPage();

      expect(await screen.findByRole('heading', { name: 'No threads for the last 7 days' })).toBeTruthy();
    });

    it('keeps the filter bar so the time range can be widened', async () => {
      setThreadsHandlers(threadQueryCapabilities, { first: emptyThreads });

      renderPage();

      await screen.findByRole('heading', { name: 'No threads for the last 7 days' });
      expect(screen.getByPlaceholderText('Filter threads…')).toBeTruthy();
    });
  });

  describe('when the end of the list scrolls into view', () => {
    const { intersect } = useMockIntersectionObserver();

    it('appends the next page fetched with the first page cursor', async () => {
      const { requests } = setThreadsHandlers(threadQueryCapabilities, {
        first: threadsFirstPage,
        byCursor: { [THREADS_PAGE_TWO_CURSOR]: threadsLastPage },
      });

      renderPage();
      await screen.findByText('Weather Agent');
      act(() => intersect(true));

      expect(await screen.findByText('Onboarding Workflow')).toBeTruthy();
      expect(requests.at(-1)?.page).toEqual({ limit: 25, after: THREADS_PAGE_TWO_CURSOR });
    });
  });

  describe('when the Start column header is clicked', () => {
    it('restarts the query from the first page in ascending order', async () => {
      const { requests } = setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage();
      await screen.findByText('Weather Agent');
      fireEvent.click(screen.getByRole('button', { name: /^Start,/ }));

      await waitFor(() => expect(requests.at(-1)?.orderBy).toEqual([{ field: 'startedAt', direction: 'asc' }]));
      expect(requests.at(-1)?.page).toEqual({ limit: 25 });
    });
  });

  describe('when a Status is error filter is added', () => {
    it('queries the threads whose status is error from the first page', async () => {
      const { requests } = setThreadsHandlers(threadQueryCapabilities, { first: threadsFirstPage });

      renderPage();
      await screen.findByText('Weather Agent');
      await pickFilter('Status', 'Error');

      await waitFor(() =>
        expect(requests.at(-1)?.where).toEqual({
          op: 'and',
          args: [{ op: 'eq', left: { path: 'status' }, right: { literal: 'error' } }],
        }),
      );
      expect(requests.at(-1)?.page).toEqual({ limit: 25 });
    });
  });
});
