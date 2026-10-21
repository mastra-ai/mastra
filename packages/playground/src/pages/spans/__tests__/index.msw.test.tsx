import type { GetObservabilityCapabilitiesResponse, QuerySpansInput, QuerySpansResult } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpansPage from '..';
import {
  emptyEntityNames,
  emptyEnvironments,
  emptySpans,
  noSpanQueryCapabilities,
  spanQueryCapabilities,
  spanQueryCoreOnlyCapabilities,
  spansFirstPage,
  spansLastPage,
  SPANS_PAGE_TWO_CURSOR,
} from './fixtures/spans';
import { useMockIntersectionObserver } from '@/test/intersection-observer';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const CAPABILITIES_URL = `${TEST_BASE_URL}/api/observability/capabilities`;
const SPANS_QUERY_URL = `${TEST_BASE_URL}/api/observability/spans/query`;
const ENTITY_NAMES_URL = `${TEST_BASE_URL}/api/observability/discovery/entity-names`;
const ENVIRONMENTS_URL = `${TEST_BASE_URL}/api/observability/discovery/environments`;
const DAY_MS = 24 * 60 * 60 * 1000;

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderPage = () =>
  renderWithProviders(
    <TestLinkProvider>
      <SpansPage />
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: ['/spans'] } },
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
  });
  afterEach(() => {
    layoutStubs.rect.mockRestore();
    globalThis.ResizeObserver = layoutStubs.resizeObserver;
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
  });

  describe('when the observability store supports span queries', () => {
    it('lists the spans of the first page', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();

      expect(await screen.findByText('agent run: weather')).toBeTruthy();
      expect(screen.getByText('tool: get-weather')).toBeTruthy();
      expect(requests[0]?.page).toEqual({ limit: 25 });
      expect(requests[0]?.orderBy).toEqual([{ field: 'startedAt', direction: 'desc' }]);
    });

    it('opens the clicked span in the traces page', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      fireEvent.click(await screen.findByText('tool: get-weather'));

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe('/traces?traceId=trace-1&spanId=span-2'),
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

  describe('when the span query returns no spans', () => {
    it('shows the empty list message', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: emptySpans });

      renderPage();

      expect(await screen.findByText('No traces found yet')).toBeTruthy();
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

  describe('when the time range changes to the last 7 days', () => {
    it('restarts the query over the wider window', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, { first: spansFirstPage });

      renderPage();
      await screen.findByText('agent run: weather');
      fireEvent.click(screen.getByRole('button', { name: /Last 24 hours/ }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 7 days' }));

      await waitFor(() => {
        const timeRange = requests.at(-1)?.timeRange;
        if (!timeRange) throw new Error('No span query');
        const days = (Date.parse(timeRange.to) - Date.parse(timeRange.from)) / DAY_MS;
        expect(Math.round(days)).toBe(7);
      });
      expect(requests.at(-1)?.page).toEqual({ limit: 25 });
    });
  });
});
