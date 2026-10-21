import type { GetObservabilityCapabilitiesResponse, QuerySpansInput, QuerySpansResult } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpansPage from '..';
import {
  emptySpans,
  noSpanQueryCapabilities,
  spanQueryCapabilities,
  spansFirstPage,
  spansLastPage,
  SPANS_PAGE_TWO_CURSOR,
} from './fixtures/spans';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const CAPABILITIES_URL = `${TEST_BASE_URL}/api/observability/capabilities`;
const SPANS_QUERY_URL = `${TEST_BASE_URL}/api/observability/spans/query`;

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

/** Serves the capabilities and answers span queries by cursor, recording every request body. */
function setSpansHandlers(
  capabilities: GetObservabilityCapabilitiesResponse,
  pages: { first: QuerySpansResult; byCursor?: Record<string, QuerySpansResult> },
  options: { beforeCursorPage?: Promise<void> } = {},
) {
  const requests: QuerySpansInput[] = [];
  server.use(
    http.get(CAPABILITIES_URL, () => HttpResponse.json(capabilities)),
    http.post(SPANS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as QuerySpansInput;
      requests.push(body);
      const after = body.page?.after;
      if (after) await options.beforeCursorPage;
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
      server.use(
        http.get(CAPABILITIES_URL, () => HttpResponse.json(spanQueryCapabilities)),
        http.post(SPANS_QUERY_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
      );

      renderPage();

      expect(await screen.findByText('Failed to load spans')).toBeTruthy();
    });
  });

  describe('when the span query returns no spans', () => {
    it('shows the empty list message', async () => {
      setSpansHandlers(spanQueryCapabilities, { first: emptySpans });

      renderPage();

      expect(await screen.findByText('No traces found yet')).toBeTruthy();
    });
  });

  describe('when the first page has a next cursor', () => {
    it('loads only the next page after clicking Next', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, {
        first: spansFirstPage,
        byCursor: { [SPANS_PAGE_TWO_CURSOR]: spansLastPage },
      });

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

      expect(await screen.findByText('workflow run: onboarding')).toBeTruthy();
      expect(screen.queryByText('agent run: weather')).toBeNull();
      expect(requests.at(-1)?.page).toEqual({ limit: 25, after: SPANS_PAGE_TWO_CURSOR });
    });

    it('hides Next on the last page', async () => {
      setSpansHandlers(spanQueryCapabilities, {
        first: spansFirstPage,
        byCursor: { [SPANS_PAGE_TWO_CURSOR]: spansLastPage },
      });

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

      await screen.findByText('workflow run: onboarding');
      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    });

    it('returns to the first page after clicking Previous', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, {
        first: spansFirstPage,
        byCursor: { [SPANS_PAGE_TWO_CURSOR]: spansLastPage },
      });

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
      await screen.findByText('workflow run: onboarding');
      const requestsBeforePrevious = requests.length;
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

      expect(await screen.findByText('agent run: weather')).toBeTruthy();
      expect(screen.queryByText('workflow run: onboarding')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
      await waitFor(() => expect(requests.length).toBeGreaterThan(requestsBeforePrevious));
      expect(requests.at(-1)?.page).toEqual({ limit: 25 });
    });

    describe('when the next page is still loading', () => {
      /** Opens page 2 with its response held back; page 1's rows and cursor stay on screen meanwhile. */
      async function openPendingPageTwo() {
        let releasePageTwo = () => {};
        const pageTwoGate = new Promise<void>(resolve => {
          releasePageTwo = resolve;
        });
        const requests = setSpansHandlers(
          spanQueryCapabilities,
          { first: spansFirstPage, byCursor: { [SPANS_PAGE_TWO_CURSOR]: spansLastPage } },
          { beforeCursorPage: pageTwoGate },
        );
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
        await waitFor(() => expect(requests.at(-1)?.page).toEqual({ limit: 25, after: SPANS_PAGE_TWO_CURSOR }));
        return { requests, releasePageTwo };
      }
      const pageLabel = (page: number) =>
        screen.getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === `Page ${page}`);

      it('ignores Next instead of skipping ahead with the previous page cursor', async () => {
        const { releasePageTwo } = await openPendingPageTwo();

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        releasePageTwo();

        expect(await screen.findByText('workflow run: onboarding')).toBeTruthy();
        expect(pageLabel(2)).toBeTruthy();
      });

      it('ignores Previous until the requested page arrives', async () => {
        const { releasePageTwo } = await openPendingPageTwo();

        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        releasePageTwo();

        expect(await screen.findByText('workflow run: onboarding')).toBeTruthy();
        expect(pageLabel(2)).toBeTruthy();
      });
    });

    it('restarts from the first page when the Start column sort changes', async () => {
      const requests = setSpansHandlers(spanQueryCapabilities, {
        first: spansFirstPage,
        byCursor: { [SPANS_PAGE_TWO_CURSOR]: spansLastPage },
      });

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
      await screen.findByText('workflow run: onboarding');
      fireEvent.click(screen.getByRole('button', { name: /^Start,/ }));

      expect(await screen.findByText('agent run: weather')).toBeTruthy();
      const last = requests.at(-1);
      expect(last?.orderBy).toEqual([{ field: 'startedAt', direction: 'asc' }]);
      expect(last?.page).toEqual({ limit: 25 });
      expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
    });
  });
});
