import type { GetObservabilityCapabilitiesResponse, QuerySpansInput, QuerySpansResult } from '@mastra/client-js';
import { OBSERVABILITY_LIST_REFETCH_INTERVAL_MS } from '@mastra/playground-ui/domains/observability/list-polling';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useEffect, useImperativeHandle } from 'react';
import { Link, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpansPage from '..';
import ThreadsPage from '../../threads';
import {
  emptyEntityNames,
  emptyEnvironments,
  emptySpans,
  emptyThreads,
  noSpanQueryCapabilities,
  spanAndThreadRowsCapabilities,
  spanDetailById,
  spanQueryCapabilities,
  spanQueryCoreOnlyCapabilities,
  spansFirstPage,
  spansLastPage,
  SPANS_PAGE_TWO_CURSOR,
} from './fixtures/spans';
import { ObservabilityLayout } from '@/domains/observability/observability-layout';
import { RouteSidePanelProvider, RouteSidePanelSlot, useRouteSidePanel } from '@/lib/route-side-panel';
import { useMockIntersectionObserver } from '@/test/intersection-observer';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const CAPABILITIES_URL = `${TEST_BASE_URL}/api/observability/capabilities`;
const SPANS_QUERY_URL = `${TEST_BASE_URL}/api/observability/spans/query`;
const THREADS_QUERY_URL = `${TEST_BASE_URL}/api/observability/threads/query`;
const SPAN_DETAIL_URL = `${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`;
const ENTITY_NAMES_URL = `${TEST_BASE_URL}/api/observability/discovery/entity-names`;
const ENVIRONMENTS_URL = `${TEST_BASE_URL}/api/observability/discovery/environments`;
const DAY_MS = 24 * 60 * 60 * 1000;

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

/** Leaves the open span by pointing the URL back at the bare page, as a bookmark or pasted link would. */
const BarePageLink = () => <Link to="/spans">Open bare spans page</Link>;

const panelHandle: CollapsiblePanelHandle = { collapse: vi.fn(), expand: vi.fn(), toggle: vi.fn() };

/** Stands in for the layout's resizable side panel: binds the shared handle and reports it open. */
function FakeLayoutPanel() {
  const { panelHandle: ref, onPanelResize } = useRouteSidePanel();
  useImperativeHandle(ref, () => panelHandle);
  useEffect(() => onPanelResize(380), [onPanelResize]);
  return null;
}

const renderPage = (initialEntry = '/spans') =>
  renderWithProviders(
    <TestLinkProvider>
      <RouteSidePanelProvider>
        <FakeLayoutPanel />
        <Routes>
          <Route
            element={
              <ObservabilityLayout>
                <Outlet />
              </ObservabilityLayout>
            }
          >
            <Route path="/spans" element={<SpansPage />} />
          </Route>
        </Routes>
        <RouteSidePanelSlot data-testid="side-panel" />
        <LocationProbe />
        <BarePageLink />
      </RouteSidePanelProvider>
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

const getSidePanel = () => screen.getByTestId('side-panel');

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

/** Serves the capabilities and answers span queries by cursor, recording every request body. */
function setSpansHandlers(
  capabilities: GetObservabilityCapabilitiesResponse,
  pages: { first: QuerySpansResult; byCursor?: Record<string, QuerySpansResult> },
) {
  const requests: QuerySpansInput[] = [];
  server.use(
    http.get(CAPABILITIES_URL, () => HttpResponse.json(capabilities)),
    http.get(ENTITY_NAMES_URL, () => HttpResponse.json(emptyEntityNames)),
    http.get(ENVIRONMENTS_URL, () => HttpResponse.json(emptyEnvironments)),
    http.get(SPAN_DETAIL_URL, ({ params }) => {
      const detail = spanDetailById[String(params.spanId)];
      return detail ? HttpResponse.json(detail) : HttpResponse.json({ error: 'not found' }, { status: 404 });
    }),
    http.post(SPANS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as QuerySpansInput;
      requests.push(body);
      const after = body.page?.after;
      return HttpResponse.json(after ? (pages.byCursor?.[after] ?? emptySpans) : pages.first);
    }),
  );
  return requests;
}

describe('Spans page', () => {
  // jsdom has no layout, so the list virtualizer sees a zero-height scroll container and
  // renders no rows. Report a fixed viewport so rows materialize.
  let layoutStubs: { rects: ReturnType<typeof vi.spyOn>[]; resizeObserver: typeof ResizeObserver };
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
      rects: [
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600)),
        // The virtualizer sizes its scroll container from clientWidth/clientHeight.
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800),
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600),
      ],
      resizeObserver: originalResizeObserver,
    };
  });
  afterEach(() => {
    layoutStubs.rects.forEach(stub => stub.mockRestore());
    globalThis.ResizeObserver = layoutStubs.resizeObserver;
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });
  // Let the list virtualizer's debounce timer fire before jsdom tears down `window`.
  afterAll(() => new Promise(resolve => setTimeout(resolve, 200)));

  describe('when the observability store does not support span queries', () => {
    it('shows the capability empty state without querying spans', async () => {
      const requests = setSpansHandlers(noSpanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      expect(await screen.findByText('Query spans capability not activated')).toBeTruthy();
      expect(requests).toHaveLength(0);
    });

    it('keeps the breadcrumb header without the Traces/Spans switch', async () => {
      setSpansHandlers(noSpanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      await screen.findByText('Query spans capability not activated');
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
      expect(screen.queryByRole('navigation', { name: 'Observability views' })).toBeNull();
    });

    it('names Spans in the breadcrumb, since no switch shows it', async () => {
      setSpansHandlers(noSpanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      await screen.findByText('Query spans capability not activated');
      const breadcrumb = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
      expect(breadcrumb.getByText('Traces')).toBeTruthy();
      expect(breadcrumb.getByText('Spans')).toBeTruthy();
    });
  });

  describe('while the storage capabilities are loading', () => {
    it('shows the Traces breadcrumb and a placeholder for the Traces/Spans switch below it', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });
      server.use(
        http.get(CAPABILITIES_URL, async () => {
          await delay('infinite');
          return HttpResponse.json(spanQueryCapabilities);
        }),
      );

      renderPage();

      const placeholder = await screen.findByRole('status', { name: 'Loading views' });
      expect(placeholder.closest('header')).toBeNull();
      expect(placeholder.closest('main')).toBeNull();
      const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(breadcrumb.closest('header')).not.toBeNull();
      expect(within(breadcrumb).getByText('Traces')).toBeTruthy();
      expect(within(breadcrumb).queryByText('Spans')).toBeNull();
    });
  });

  describe('when the observability store supports span queries', () => {
    it('keeps the Traces breadcrumb in the header, with the Traces/Spans switch below it', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      const views = await screen.findByRole('navigation', { name: 'Observability views' });
      const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(within(breadcrumb).getByText('Traces')).toBeTruthy();
      expect(breadcrumb.closest('header')).not.toBeNull();
      expect(views.closest('header')).toBeNull();
      expect(views.closest('main')).toBeNull();
    });

    it('leaves Spans out of the breadcrumb, since the switch already shows it', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      await screen.findByRole('navigation', { name: 'Observability views' });
      const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(within(breadcrumb).queryByText('Spans')).toBeNull();
    });

    it('puts the filter bar in the page body, above the list', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      const filterInput = await screen.findByPlaceholderText('Filter spans…');
      expect(filterInput.closest('main')).not.toBeNull();
    });

    it('shows each view with its icon', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      const views = await screen.findByRole('navigation', { name: 'Observability views' });
      for (const tab of within(views).getAllByRole('tab')) {
        expect(tab.querySelector('svg')).not.toBeNull();
      }
    });

    it('marks Spans as the current view', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      expect(views.getByRole('tab', { name: 'Spans' }).getAttribute('aria-selected')).toBe('true');
      expect(views.getByRole('tab', { name: 'Traces' }).getAttribute('aria-selected')).toBe('false');
    });

    it('lists the spans of the first page', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      expect(await screen.findByText('agent run: weather')).toBeTruthy();
      expect(screen.getByText('tool: get-weather')).toBeTruthy();
      expect(requests[0]?.page).toEqual({ limit: 25 });
      expect(requests[0]?.orderBy).toEqual([{ field: 'startedAt', direction: 'desc' }]);
    });
  });

  describe('when Traces is clicked in the view switch', () => {
    it('navigates to the traces page', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      fireEvent.click(views.getByRole('tab', { name: 'Traces' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/traces'));
    });
  });

  describe('when the store does not return thread rows', () => {
    it('does not offer the Threads view', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      expect(views.queryByRole('tab', { name: 'Threads' })).toBeNull();
    });
  });

  describe('when Threads is clicked in the view switch', () => {
    it('navigates to the threads page', async () => {
      setSpansHandlers(spanAndThreadRowsCapabilities, { first: spansFirstPage });

      renderPage();
      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      fireEvent.click(await views.findByRole('tab', { name: 'Threads' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/threads'));
    });
  });

  describe('when the view switch moves from Spans to Threads', () => {
    it('keeps the same header mounted', async () => {
      setSpansHandlers(spanAndThreadRowsCapabilities, { first: spansFirstPage });
      server.use(http.post(THREADS_QUERY_URL, () => HttpResponse.json(emptyThreads)));

      renderWithProviders(
        <TestLinkProvider>
          <RouteSidePanelProvider>
            <Routes>
              <Route
                element={
                  <ObservabilityLayout>
                    <Outlet />
                  </ObservabilityLayout>
                }
              >
                <Route path="/spans" element={<SpansPage />} />
                <Route path="/threads" element={<ThreadsPage />} />
              </Route>
            </Routes>
          </RouteSidePanelProvider>
        </TestLinkProvider>,
        { router: { initialEntries: ['/spans'] } },
      );
      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      const header = screen.getByRole('navigation', { name: 'Breadcrumb' }).closest('header');
      fireEvent.click(await views.findByRole('tab', { name: 'Threads' }));

      await screen.findByPlaceholderText('Filter threads…');
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).closest('header')).toBe(header);
    });
  });

  describe('when a span row is clicked', () => {
    it('shows the span details in the side panel', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('agent run: weather'));

      const panel = within(getSidePanel());
      expect(await panel.findByRole('region', { name: 'Span details' })).toBeTruthy();
      expect(await panel.findByText('session-weather-42')).toBeTruthy();
    });

    it('puts the open span in the URL of the spans page', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('agent run: weather'));

      await within(getSidePanel()).findByText('session-weather-42');
      expect(screen.getByTestId('location').textContent).toBe('/spans?traceId=trace-1&spanId=span-1');
    });
  });

  describe('when the page opens with a span in the URL', () => {
    it('shows that span in the side panel', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage('/spans?traceId=trace-1&spanId=span-2');

      const panel = within(getSidePanel());
      expect(await panel.findByRole('region', { name: 'Span details' })).toBeTruthy();
      expect(await panel.findByText('Weather API timed out')).toBeTruthy();
    });
  });

  describe('when the span params are removed from the URL', () => {
    it('closes the side panel', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage('/spans?traceId=trace-1&spanId=span-2');
      const panel = within(getSidePanel());
      await panel.findByText('Weather API timed out');
      fireEvent.click(screen.getByRole('link', { name: 'Open bare spans page' }));

      await waitFor(() => expect(panel.queryByRole('region', { name: 'Span details' })).toBeNull());
      expect(screen.getByTestId('location').textContent).toBe('/spans');
    });
  });

  describe('when "Go to trace" is clicked in the span panel', () => {
    it('opens the span in its trace on the traces page', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('tool: get-weather'));
      const panel = within(getSidePanel());
      await panel.findByText('Weather API timed out');
      fireEvent.click(panel.getByRole('button', { name: 'Go to trace' }));

      expect(screen.getByTestId('location').textContent).toBe('/traces?traceId=trace-1&spanId=span-2');
    });
  });

  describe('when the open span row is clicked again', () => {
    it('closes the side panel', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('agent run: weather'));
      await within(getSidePanel()).findByText('session-weather-42');
      fireEvent.click(screen.getAllByText('agent run: weather')[0]);

      await waitFor(() => expect(within(getSidePanel()).queryByRole('region', { name: 'Span details' })).toBeNull());
    });
  });

  describe('when the span panel close button is clicked', () => {
    it('closes the side panel', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('agent run: weather'));
      const panel = within(getSidePanel());
      await panel.findByText('session-weather-42');
      fireEvent.click(panel.getByRole('button', { name: 'Close span' }));

      await waitFor(() => expect(panel.queryByRole('region', { name: 'Span details' })).toBeNull());
    });

    it('removes the span from the URL', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('agent run: weather'));
      const panel = within(getSidePanel());
      await panel.findByText('session-weather-42');
      fireEvent.click(panel.getByRole('button', { name: 'Close span' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/spans'));
    });
  });

  describe('when the next span button is clicked', () => {
    it('shows the next loaded span', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('agent run: weather'));
      const panel = within(getSidePanel());
      await panel.findByText('session-weather-42');
      fireEvent.click(panel.getByRole('button', { name: 'Go to next span' }));

      await waitFor(() => expect(panel.queryByText('session-weather-42')).toBeNull());
      expect(await panel.findByText('Weather API timed out')).toBeTruthy();
    });

    it('moves the URL to the next span', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('agent run: weather'));
      const panel = within(getSidePanel());
      await panel.findByText('session-weather-42');
      fireEvent.click(panel.getByRole('button', { name: 'Go to next span' }));

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe('/spans?traceId=trace-1&spanId=span-2'),
      );
    });
  });

  describe('when the span query fails', () => {
    it('shows the error state', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });
      server.use(http.post(SPANS_QUERY_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderPage();

      expect(await screen.findByText('Failed to load spans')).toBeTruthy();
    });

    it('keeps the filter bar so the filters can be changed', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });
      server.use(http.post(SPANS_QUERY_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderPage();

      await screen.findByText('Failed to load spans');
      expect(screen.getByRole('group', { name: 'Span filters' })).toBeTruthy();
    });
  });

  describe('when the span query fails transiently', () => {
    it('retries until the list loads', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });
      // The client retries 5xx on its own, so the server stays down until the page shows the failure.
      let serverDown = true;
      server.use(
        http.post(SPANS_QUERY_URL, () =>
          serverDown ? HttpResponse.json({ error: 'busy' }, { status: 503 }) : HttpResponse.json(spansFirstPage),
        ),
      );
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });

      renderPage();
      await screen.findByText('Failed to load spans');
      serverDown = false;
      await act(() => vi.advanceTimersByTimeAsync(OBSERVABILITY_LIST_REFETCH_INTERVAL_MS));

      expect(await screen.findByText('agent run: weather')).toBeTruthy();
    });
  });

  describe('when the server refuses the span query', () => {
    it('does not retry it', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });
      server.use(
        http.post(SPANS_QUERY_URL, async ({ request }) => {
          requests.push((await request.json()) as QuerySpansInput);
          return HttpResponse.json({ error: 'range too wide' }, { status: 422 });
        }),
      );
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });

      renderPage();
      await screen.findByText('Failed to load spans');
      const requestsAfterFailure = requests.length;
      await act(() => vi.advanceTimersByTimeAsync(OBSERVABILITY_LIST_REFETCH_INTERVAL_MS * 3));

      expect(requests).toHaveLength(requestsAfterFailure);
    });
  });

  describe('when the window regains focus', () => {
    it('does not reload the loaded pages', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      await screen.findByText('agent run: weather');
      const requestsAfterLoad = requests.length;
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(requests).toHaveLength(requestsAfterLoad);
    });
  });

  describe('when the span query returns no spans', () => {
    it('shows the same empty state as the traces page, naming spans and the time range', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: emptySpans });

      renderPage();

      expect(await screen.findByRole('heading', { name: 'No spans for the last 7 days' })).toBeTruthy();
      expect(
        screen.getByText('Pick a wider time range — older spans may fall outside the current window.'),
      ).toBeTruthy();
    });

    it('drops the empty list in favour of that empty state', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: emptySpans });

      renderPage();

      await screen.findByRole('heading', { name: 'No spans for the last 7 days' });
      expect(screen.queryByText('Primitive type')).toBeNull();
    });

    it('keeps the filter bar so the time range can be widened', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: emptySpans });

      renderPage();

      await screen.findByRole('heading', { name: 'No spans for the last 7 days' });
      expect(screen.getByPlaceholderText('Filter spans…')).toBeTruthy();
    });
  });

  describe('when the end of the list scrolls into view', () => {
    const { intersect } = useMockIntersectionObserver();

    it('appends the next page fetched with the first page cursor', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, {
        first: spansFirstPage,
        byCursor: { [SPANS_PAGE_TWO_CURSOR]: spansLastPage },
      });

      renderPage();
      await screen.findByText('agent run: weather');
      act(() => intersect(true));

      expect(await screen.findByText('workflow run: onboarding')).toBeTruthy();
      expect(screen.getByText('agent run: weather')).toBeTruthy();
      expect(requests.at(-1)?.page).toEqual({ limit: 25, after: SPANS_PAGE_TWO_CURSOR });
    });

    it('stops requesting once the last page is loaded', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, {
        first: spansFirstPage,
        byCursor: { [SPANS_PAGE_TWO_CURSOR]: spansLastPage },
      });

      renderPage();
      await screen.findByText('agent run: weather');
      act(() => intersect(true));
      await screen.findByText('workflow run: onboarding');
      const requestsAfterLastPage = requests.length;
      act(() => intersect(false));
      act(() => intersect(true));

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requests).toHaveLength(requestsAfterLastPage);
    });
  });

  describe('when the Start column header is clicked', () => {
    it('restarts the query from the first page in ascending order', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      await screen.findByText('agent run: weather');
      fireEvent.click(screen.getByRole('button', { name: /^Start,/ }));

      await waitFor(() => expect(requests.at(-1)?.orderBy).toEqual([{ field: 'startedAt', direction: 'asc' }]));
      expect(requests.at(-1)?.page).toEqual({ limit: 25 });
    });
  });

  describe('when a Status is error filter is added', () => {
    it('queries the spans whose status is error from the first page', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      await screen.findByText('agent run: weather');
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

  describe('when the store does not support span context fields', () => {
    it('offers core fields but not context fields', async () => {
      setSpansHandlers(spanQueryCoreOnlyCapabilities, { first: spansFirstPage });

      renderPage();
      await screen.findByText('agent run: weather');
      getFilterInput().focus();
      typeFilter('Span');

      expect(await screen.findByRole('option', { name: 'Span type' })).toBeTruthy();
      typeFilter('Environment');
      await waitFor(() => expect(screen.queryByRole('option', { name: 'Environment' })).toBeNull());
    });
  });

  describe('when the store supports span context fields', () => {
    it('offers context fields', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      await screen.findByText('agent run: weather');
      getFilterInput().focus();
      typeFilter('Environment');

      expect(await screen.findByRole('option', { name: 'Environment' })).toBeTruthy();
    });
  });

  describe('when the page opens without a time range', () => {
    it('queries the last 7 days, like the traces page', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      await screen.findByText('agent run: weather');

      const timeRange = requests[0]?.timeRange;
      if (!timeRange) throw new Error('No span query');
      const days = (Date.parse(timeRange.to) - Date.parse(timeRange.from)) / DAY_MS;
      expect(Math.round(days)).toBe(7);
    });
  });

  describe('when the time range changes to the last 30 days', () => {
    it('restarts the query over the wider window', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      await screen.findByText('agent run: weather');
      fireEvent.click(screen.getByRole('button', { name: /Last 7 days/ }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 30 days' }));

      await waitFor(() => {
        const timeRange = requests.at(-1)?.timeRange;
        if (!timeRange) throw new Error('No span query');
        const days = (Date.parse(timeRange.to) - Date.parse(timeRange.from)) / DAY_MS;
        expect(Math.round(days)).toBe(30);
      });
      expect(requests.at(-1)?.page).toEqual({ limit: 25 });
    });
  });
});
