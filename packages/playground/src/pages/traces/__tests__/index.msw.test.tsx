import type { GetObservabilityCapabilitiesResponse, GetScoresScorers_Response } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { serializeTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyTraceQueryFields,
  legacyTraceCapabilities,
  noFeedbackCapabilities,
  noRootDurationCapabilities,
  threadRowsCapabilities,
  traceQueryCapabilities,
  traceQueryFieldsWithRegion,
  traceQueryFieldsWithNestedTenant,
  traceQueryFieldsWithTags,
  traceQueryTagValues,
  traceQueryWithoutDiscoveryCapabilities,
  traceQueryPage,
  traceQueryRegionValues,
  traceQuerySpanModelValues,
  traceQueryPageWithThreadAndEnvironment,
} from './fixtures/trace-query';
import {
  branchList,
  environmentsWithProd,
  emptyFeedback,
  metricsCapableCapabilities,
  metricsUnavailableCapabilities,
  threadedTraceSpans,
  traceSpans,
  traceSpansWithPayload,
  traceList,
  traceListWithTwoTraces,
  traceSpanScores,
  emptyTraceSpanScores,
} from './fixtures/traces';
import { renderTracesPage as renderPage, setTracePageHandlers as setPageHandlers } from './traces-page-harness';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';
import { pickTraceSideView, traceSideColumn, traceSideViewLabel } from '@/test/trace-side-view';

const TRACE_COLUMN_STORAGE_KEY = `mastra:traces:columns:${TEST_BASE_URL}:/api`;
const onBreakdownRequest = vi.fn<() => void>();
const setTracePageHandlers = (capabilities: GetObservabilityCapabilitiesResponse) =>
  setPageHandlers(capabilities, { onBreakdownRequest });

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

const getFilterChips = () => document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]');
const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' });
const focusFilterInput = () => act(() => getFilterInput().focus());
const typeInFilter = (text: string) => fireEvent.change(getFilterInput(), { target: { value: text } });
const pressInFilter = (key: string) => fireEvent.keyDown(getFilterInput(), { key });

// `TracesListView` dispatches a synthetic `scroll` event on its scroll container to make the
// virtualizer re-read `scrollTop` once a query settles. The virtualizer answers scroll events
// through a trailing debounce of `isScrollingResetDelay` (150ms) that its `cleanup()` never
// cancels, so a test that finishes right after a render leaves that timer pending. Vitest tears
// the jsdom environment down when the file ends, and the timer then fires with the `window`
// global already gone — an unhandled `ReferenceError: window is not defined` that fails the
// whole run. Let the debounce expire while the environment is still alive.
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
});

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createMemoryStorage(),
  });
  window.localStorage.setItem(
    TRACE_COLUMN_STORAGE_KEY,
    serializeTraceColumnPreferences({ visibleColumns: ['inputTokens'], customColumns: [], metadataKeys: [] }),
  );
  onBreakdownRequest.mockClear();
});

describe('Traces page usage columns', () => {
  describe('when the observability store supports metrics', () => {
    it('renders the selected usage header', async () => {
      setTracePageHandlers(metricsCapableCapabilities);

      const { queryClient } = renderPage();

      await waitFor(() => expect(onBreakdownRequest).toHaveBeenCalled());
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(screen.getByText('Input tokens')).not.toBeNull();
    });

    it('keeps usage totals in the trace list when a trace is selected', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces`, () => HttpResponse.json(traceListWithTwoTraces)),
        http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(traceListWithTwoTraces)),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      renderPage('/traces?traceId=trace-a');

      await waitFor(() => expect(onBreakdownRequest).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getAllByText('Input tokens')).toHaveLength(1));
      expect(screen.queryByText('Est. cost')).toBeNull();
    });
  });

  describe('when the observability store does not support metrics', () => {
    it('suppresses usage columns and metric requests', async () => {
      setTracePageHandlers(metricsUnavailableCapabilities);

      const { queryClient } = renderPage();

      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(screen.queryByText('Input tokens')).toBeNull();
      expect(onBreakdownRequest).not.toHaveBeenCalled();
    });
  });

  describe('when a trace is opened from a direct link', () => {
    it('does not request or show usage in the side panel when usage columns are hidden', async () => {
      window.localStorage.setItem(
        TRACE_COLUMN_STORAGE_KEY,
        serializeTraceColumnPreferences({ visibleColumns: [], customColumns: [], metadataKeys: [] }),
      );
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces`, () =>
          HttpResponse.json({ ...traceList, spans: [], pagination: { ...traceList.pagination, total: 0 } }),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () =>
          HttpResponse.json({ ...traceList, spans: [], pagination: { ...traceList.pagination, total: 0 } }),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      const { queryClient } = renderPage('/traces?traceId=trace-a');

      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(onBreakdownRequest).not.toHaveBeenCalled();
      expect(screen.queryByText('Input tokens')).toBeNull();
      expect(screen.queryByText('Est. cost')).toBeNull();
    });
  });

  describe('Messages column', () => {
    const setThreadedTraceHandlers = () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/spans/span-a`, () =>
          HttpResponse.json({ span: threadedTraceSpans.spans[0] }),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(threadedTraceSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );
    };

    it('given an agent trace with a thread id, when opened, then Messages renders as a column and the panel opens wide', async () => {
      setThreadedTraceHandlers();

      const { queryClient } = renderPage('/traces?traceId=trace-a');

      expect(await screen.findByTestId('messages-panel')).not.toBeNull();
      expect(screen.queryByRole('tab', { name: 'Spans' })).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Trace details' }).className).toContain('w-4/5');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
    });

    describe('given the spanView query param is timeline', () => {
      it('opens the trace column on the timeline and writes the pick back to the URL', async () => {
        setThreadedTraceHandlers();

        const { queryClient } = renderPage('/traces?traceId=trace-a&spanView=timeline');

        expect(await screen.findByLabelText('Trace time axis')).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Timeline' }).getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(screen.getByRole('button', { name: 'Span tree' }));

        await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('spanView='));
        expect(screen.queryByLabelText('Trace time axis')).toBeNull();
        await waitFor(() => {
          expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
          expect(queryClient.isFetching()).toBe(0);
        });
      });
    });

    describe('given the thread has another trace', () => {
      const threadedTraceB = {
        ...threadedTraceSpans,
        traceId: 'trace-b',
        spans: threadedTraceSpans.spans.map(span => ({ ...span, traceId: 'trace-b', spanId: 'span-b' })),
      };
      const threadTraceList = {
        spans: [threadedTraceB.spans[0], threadedTraceSpans.spans[0]],
        pagination: { total: 2, page: 0, perPage: 25, hasMore: false },
      };

      const setMultiTurnThreadHandlers = () => {
        setThreadedTraceHandlers();
        server.use(
          http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
            const body = await request.json();
            if (JSON.stringify(body).includes('threadId')) {
              return HttpResponse.json({
                traces: [
                  traceQueryPage.traces[0],
                  { ...traceQueryPage.traces[0], traceId: 'trace-b', rootSpanId: 'span-b' },
                ],
                page: { next: null },
              });
            }
            return HttpResponse.json(traceQueryPage);
          }),
          // The page list keeps its single row; only thread-scoped requests see both turns.
          http.get(`${TEST_BASE_URL}/api/observability/traces/light`, ({ request }) =>
            HttpResponse.json(new URL(request.url).searchParams.get('threadId') ? threadTraceList : traceList),
          ),
          http.get(`${TEST_BASE_URL}/api/observability/traces/trace-b`, () => HttpResponse.json(threadedTraceB)),
          http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
        );
      };

      it('when "Open full thread" is clicked, then every turn opens in a drawer stacked above the trace, and "Back to trace" closes only that drawer', async () => {
        setMultiTurnThreadHandlers();

        const { queryClient } = renderPage('/traces?traceId=trace-a');
        const traceDialog = () => screen.getByRole('dialog', { name: 'Trace details', hidden: true });

        fireEvent.click(await screen.findByRole('button', { name: 'Open full thread' }));

        const threadView = await screen.findByTestId('thread-view-by-trace');
        const threadDialog = threadView.closest<HTMLElement>('[role="dialog"]');
        expect(threadDialog).not.toBeNull();
        expect(threadDialog).not.toBe(traceDialog());
        expect(threadDialog?.getAttribute('data-depth')).toBe('2');
        await waitFor(() => expect(threadView.querySelectorAll('[data-trace-id]')).toHaveLength(2));
        // The trace stays open underneath.
        expect(traceDialog().className).toContain('w-4/5');

        fireEvent.click(screen.getByRole('button', { name: 'Back to trace' }));

        await waitFor(() => expect(screen.queryByTestId('thread-view-by-trace')).toBeNull());
        expect(screen.getByTestId('messages-panel')).not.toBeNull();
        expect(traceDialog().className).toContain('w-4/5');
        await waitFor(() => {
          expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
          expect(queryClient.isFetching()).toBe(0);
        });
      });
    });

    it('given a trace without a thread id, then no Messages column renders and the panel still opens wide', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)));

      const { queryClient } = renderPage('/traces?traceId=trace-a');

      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(screen.queryByTestId('messages-panel')).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Trace details' }).className).toContain('w-4/5');
    });
  });

  describe('when an old branches URL is opened', () => {
    it('loads trace queries without requesting branches', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      const branches = vi.fn();
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/branches`, () => {
          branches();
          return HttpResponse.json(branchList);
        }),
      );
      const { queryClient } = renderPage('/traces?listMode=branches');
      await waitFor(() => expect(onBreakdownRequest).toHaveBeenCalled());
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(branches).not.toHaveBeenCalled();
      expect(screen.queryByRole('checkbox', { name: 'Subtraces' })).toBeNull();
    });
  });
});

describe('Traces page list source', () => {
  describe('when the server does not support trace query', () => {
    it('lists traces through the light endpoint without calling trace query', async () => {
      const onTraceQuery = vi.fn<() => void>();
      const onLightList = vi.fn<() => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(legacyTraceCapabilities)),
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () => {
          onTraceQuery();
          return HttpResponse.json(traceQueryPage);
        }),
        http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => {
          onLightList();
          return HttpResponse.json(traceList);
        }),
      );

      renderPage();

      await waitFor(() => expect(onLightList).toHaveBeenCalled());
      expect(onTraceQuery).not.toHaveBeenCalled();
    });

    it('keeps the breadcrumb header without the Traces/Spans switch', async () => {
      setTracePageHandlers(legacyTraceCapabilities);

      const { queryClient } = renderPage();

      expect(await screen.findByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole('navigation', { name: 'Observability views' })).toBeNull();
    });

    it('shows no Feedback tab on the trace or span panel and never requests feedback', async () => {
      const onFeedback = vi.fn<() => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(legacyTraceCapabilities)),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/spans/span-a`, () =>
          HttpResponse.json({ span: traceSpans.spans[0] }),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => {
          onFeedback();
          return HttpResponse.json(emptyFeedback);
        }),
      );

      const { queryClient } = renderPage('/traces?traceId=trace-a&spanId=span-a');
      expect(await screen.findByRole('heading', { name: /^Span/ })).not.toBeNull();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      expect(screen.getAllByRole('tab', { name: /^scores/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /^score trace/i }).length).toBeGreaterThan(0);
      expect(screen.queryByRole('tab', { name: /feedback/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /^feedback/i })).toBeNull();
      expect(onFeedback).not.toHaveBeenCalled();
    });
  });

  describe('when the server supports trace query but not feedback', () => {
    it('shows no Feedback tab on the trace or span panel and never requests feedback', async () => {
      const onFeedback = vi.fn<() => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(noFeedbackCapabilities)),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/spans/span-a`, () =>
          HttpResponse.json({ span: traceSpans.spans[0] }),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => {
          onFeedback();
          return HttpResponse.json(emptyFeedback);
        }),
      );

      const { queryClient } = renderPage('/traces?traceId=trace-a&spanId=span-a');
      expect(await screen.findByRole('heading', { name: /^Span/ })).not.toBeNull();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      expect(screen.getAllByRole('tab', { name: /^scores/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /^score trace/i }).length).toBeGreaterThan(0);
      expect(screen.queryByRole('tab', { name: /feedback/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /^feedback/i })).toBeNull();
      expect(onFeedback).not.toHaveBeenCalled();
    });
  });
});

describe('Traces page view switch', () => {
  describe('when the store supports span queries', () => {
    it('keeps the Traces breadcrumb in the header, with the Traces/Spans switch below it', async () => {
      setTracePageHandlers(traceQueryCapabilities);

      renderPage();

      const views = await screen.findByRole('navigation', { name: 'Observability views' });
      const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(within(breadcrumb).getByText('Traces')).toBeTruthy();
      expect(breadcrumb.closest('header')).not.toBeNull();
      expect(views.closest('header')).toBeNull();
      expect(views.closest('main')).toBeNull();
    });

    it('puts the filter bar in the page body, above the list', async () => {
      setTracePageHandlers(traceQueryCapabilities);

      renderPage();

      const filterInput = await screen.findByPlaceholderText('Filter traces…');
      expect(filterInput.closest('main')).not.toBeNull();
    });

    it('shows each view with its icon', async () => {
      setTracePageHandlers(traceQueryCapabilities);

      renderPage();

      const views = await screen.findByRole('navigation', { name: 'Observability views' });
      for (const tab of within(views).getAllByRole('tab')) {
        expect(tab.querySelector('svg')).not.toBeNull();
      }
    });

    it('marks Traces as the current view', async () => {
      setTracePageHandlers(traceQueryCapabilities);

      renderPage();

      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      expect(views.getByRole('tab', { name: 'Traces' }).getAttribute('aria-selected')).toBe('true');
      expect(views.getByRole('tab', { name: 'Spans' }).getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('while the storage capabilities are loading', () => {
    it('shows the Traces breadcrumb and a placeholder for the Traces/Spans switch below it', async () => {
      setTracePageHandlers(traceQueryCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, async () => {
          await delay('infinite');
          return HttpResponse.json(traceQueryCapabilities);
        }),
      );

      renderPage();

      const placeholder = await screen.findByRole('status', { name: 'Loading views' });
      expect(placeholder.closest('header')).toBeNull();
      expect(placeholder.closest('main')).toBeNull();
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).closest('header')).not.toBeNull();
    });
  });

  describe('while the filter fields are still loading', () => {
    it('keeps the Traces/Spans switch above the loading skeleton', async () => {
      setTracePageHandlers(traceQueryCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, async () => {
          await delay('infinite');
          return HttpResponse.json(emptyTraceQueryFields);
        }),
      );

      renderPage();

      expect(await screen.findByRole('navigation', { name: 'Observability views' })).toBeTruthy();
      expect(screen.getByTestId('traces-page-skeleton')).toBeTruthy();
    });
  });

  describe('when Spans is clicked in the view switch', () => {
    it('navigates to the spans page', async () => {
      setTracePageHandlers(traceQueryCapabilities);

      renderPage();
      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      fireEvent.click(views.getByRole('tab', { name: 'Spans' }));

      await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/spans'));
    });
  });

  describe('when the store does not return thread rows', () => {
    it('does not offer the Threads view', async () => {
      setTracePageHandlers(traceQueryCapabilities);

      renderPage();

      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      expect(views.queryByRole('tab', { name: 'Threads' })).toBeNull();
    });
  });

  describe('when the store returns thread rows', () => {
    it('offers the Threads view after Spans', async () => {
      setTracePageHandlers(threadRowsCapabilities);

      renderPage();

      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      await waitFor(() =>
        expect(views.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Traces', 'Spans', 'Threads']),
      );
    });
  });

  describe('when Threads is clicked in the view switch', () => {
    it('navigates to the threads page', async () => {
      setTracePageHandlers(threadRowsCapabilities);

      renderPage();
      const views = within(await screen.findByRole('navigation', { name: 'Observability views' }));
      fireEvent.click(await views.findByRole('tab', { name: 'Threads' }));

      await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/threads'));
    });
  });
});

describe('Traces page action row', () => {
  it('offers no auto refresh toggle — the list keeps itself up to date', async () => {
    setTracePageHandlers(metricsCapableCapabilities);

    const { queryClient } = renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
      expect(queryClient.isFetching()).toBe(0);
    });

    expect(screen.queryByRole('checkbox', { name: 'Auto refresh' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Subtraces' })).toBeNull();
  });
});

describe('Traces side panel header actions', () => {
  describe('when a registered scorer is selected', () => {
    it('submits the selected trace for scoring and opens its scores', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      const onScore = vi.fn();
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
        http.get(`${TEST_BASE_URL}/api/scores/scorers`, () =>
          HttpResponse.json({
            quality: {
              scorer: { config: { id: 'quality', name: 'Quality scorer' } },
              agentIds: [],
              agentNames: [],
              workflowIds: [],
              isRegistered: true,
              source: 'code',
            },
          } satisfies GetScoresScorers_Response),
        ),
        http.post(`${TEST_BASE_URL}/api/observability/traces/score`, async ({ request }) => {
          onScore(await request.json());
          return HttpResponse.json({ status: 'success', message: 'Scoring started' });
        }),
      );
      const { queryClient } = renderPage('/traces?traceId=trace-a');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Score trace' }));
      fireEvent.click(await screen.findByRole('combobox', { name: 'Select scorer' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Quality scorer' }));
      fireEvent.click(screen.getByRole('button', { name: 'Start scoring' }));
      await waitFor(() =>
        expect(onScore).toHaveBeenCalledWith({
          scorerName: 'quality',
          targets: [{ traceId: 'trace-a', spanId: 'span-a' }],
        }),
      );
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Score trace' })).toBeNull());
      expect(traceSideViewLabel()).toMatch(/scores/i);
    });
  });
  it('shows the trace actions in the panel header when a trace is selected', async () => {
    setTracePageHandlers(metricsCapableCapabilities);
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
      http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
    );

    const { queryClient } = renderPage('/traces?traceId=trace-a');
    await waitFor(() => {
      expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
      expect(queryClient.isFetching()).toBe(0);
    });

    expect(await screen.findByRole('button', { name: /^score trace/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Add to dataset' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Download trace JSON' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Open trace actions' })).toBeNull();
    // The parent trace panel is no longer collapsible.
    expect(screen.queryByRole('button', { name: /collapse panel/i })).toBeNull();
  });
});

describe('Traces side panel scores tab', () => {
  const openScoresTab = async (scoresResponse = emptyTraceSpanScores) => {
    setTracePageHandlers(metricsCapableCapabilities);
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
      http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () =>
        HttpResponse.json(scoresResponse),
      ),
    );

    const { queryClient } = renderPage('/traces?traceId=trace-a');
    await waitFor(() => {
      expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
      expect(queryClient.isFetching()).toBe(0);
    });

    await pickTraceSideView(/^scores/i);
    return traceSideColumn();
  };

  describe('when the trace has scores', () => {
    it('opens score details in a sibling drawer above the trace and closes it independently', async () => {
      const scoresTab = await openScoresTab(traceSpanScores);
      const [firstRelevance] = await within(scoresTab).findAllByRole('button', { name: 'Open Relevance score' });
      fireEvent.click(firstRelevance);

      const scoreDialog = await screen.findByRole('dialog', { name: 'Score score-1' });
      expect(scoreDialog.getAttribute('data-depth')).toBe('2');
      expect(screen.getByRole('dialog', { name: 'Trace details', hidden: true })).not.toBeNull();

      fireEvent.click(within(scoreDialog).getByRole('button', { name: /close/i }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Score score-1' })).toBeNull());
      expect(screen.getByRole('dialog', { name: 'Trace details', hidden: true })).not.toBeNull();
    });

    it('lists each scorer against its value', async () => {
      const scoresTab = await openScoresTab(traceSpanScores);

      await within(scoresTab).findByText('Toxicity');
      expect(
        within(scoresTab)
          .getAllByRole('term')
          .map(term => term.textContent),
      ).toEqual(['Relevance', 'Relevance', 'Toxicity']);
      expect(
        within(scoresTab)
          .getAllByRole('definition')
          .map(value => value.textContent),
      ).toEqual(['0.40', '0.80', '1.00']);
    });

    it('reveals a score reason on hover', async () => {
      const scoresTab = await openScoresTab({
        ...traceSpanScores,
        scores: [{ ...traceSpanScores.scores[0], reason: 'Stays on the user question' }],
      });

      fireEvent.mouseEnter(await within(scoresTab).findByRole('button', { name: 'Show Relevance reason' }));
      expect(await screen.findByText('Stays on the user question')).not.toBeNull();
    });
  });

  describe('when a span is open', () => {
    it('keeps the span panel open while the scores tab is shown', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/spans/span-a`, () =>
          HttpResponse.json({ span: traceSpans.spans[0] }),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      const { queryClient } = renderPage('/traces?traceId=trace-a&spanId=span-a');
      expect(await screen.findByRole('heading', { name: /^Span/ })).not.toBeNull();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      await pickTraceSideView(/^scores/i);
      const scoresTab = traceSideColumn();

      expect(await within(scoresTab).findByText(/no scores/i)).not.toBeNull();
      expect(screen.getByRole('heading', { name: /^Span/ })).not.toBeNull();
    });
  });

  describe('when the trace has no scores', () => {
    it('shows the empty state', async () => {
      const scoresTab = await openScoresTab();

      expect(await within(scoresTab).findByText(/no scores/i)).not.toBeNull();
      expect(screen.queryByText('0.60')).toBeNull();
    });
  });
});

describe('Traces page columns menu', () => {
  // jsdom has no layout, so the list virtualizer sees a zero-height scroll container and
  // renders no rows. Report a fixed viewport so rows (and their cells) materialize, and
  // stub the Web Animations API that Base UI menus call on close.
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
    Element.prototype.getAnimations ??= () => [];
  });
  afterEach(() => {
    layoutStubs.rect.mockRestore();
    globalThis.ResizeObserver = layoutStubs.resizeObserver;
  });

  describe('when the columns menu enables Environment', () => {
    it('shows the header with each trace environment and keeps it after a reload', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () =>
          HttpResponse.json(traceQueryPageWithThreadAndEnvironment),
        ),
      );

      const first = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(first.queryClient.isFetching()).toBe(0);
      });
      expect(screen.queryByText('Environment')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Environment' }));

      await waitFor(() => expect(screen.getByText('production')).toBeTruthy());
      first.unmount();

      renderPage();
      expect(await screen.findByText('production')).toBeTruthy();
      expect(screen.getByText('Environment')).toBeTruthy();
    });
  });

  describe('when a Thread ID custom column offers to filter by a listed value', () => {
    it('adds a Thread ID chip and sends the thread predicate in the next query', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      const requestBodies: unknown[] = [];
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          requestBodies.push(await request.json());
          return HttpResponse.json(traceQueryPageWithThreadAndEnvironment);
        }),
      );

      const { queryClient } = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Thread ID' }));
      await waitFor(() => expect(screen.getByText('thread-42')).toBeTruthy());

      fireEvent.click(screen.getByRole('button', { name: 'Thread ID' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'thread-42' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('filterThreadId=thread-42'));
      const chips = [...getFilterChips()];
      expect(
        chips.some(chip => chip.textContent?.includes('Thread ID') && chip.textContent.includes('thread-42')),
      ).toBe(true);
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(JSON.stringify(requestBodies.at(-1))).toContain(
        JSON.stringify({ op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-42' } }),
      );
    });
  });

  describe('when the fields endpoint reports a region metadata key', () => {
    it('offers region in the metadata column picker and adds it as a column', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () =>
          HttpResponse.json(traceQueryFieldsWithRegion),
        ),
      );

      const { queryClient } = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));
      // A field opens on mousedown (a real press), which fireEvent.click doesn't send.
      fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Metadata key' }));
      fireEvent.click(await screen.findByRole('option', { name: 'region' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

      await waitFor(() => expect(screen.getByText('region')).toBeTruthy());
      const stored = localStorage.getItem(TRACE_COLUMN_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored ?? '{}').metadataKeys).toEqual(['region']);
    });
  });

  describe('when the fields endpoint reports nested metadata paths', () => {
    it('collapses them to a single top-level key option', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () =>
          HttpResponse.json(traceQueryFieldsWithNestedTenant),
        ),
      );

      const { queryClient } = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));
      // A field opens on mousedown (a real press), which fireEvent.click doesn't send.
      fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Metadata key' }));

      expect(await screen.findAllByRole('option', { name: 'tenant' })).toHaveLength(1);
      expect(screen.queryByRole('option', { name: 'tenant.id' })).toBeNull();
    });
  });
});

describe('Traces page filter bar', () => {
  describe('when the page loads without any filter', () => {
    it('renders a non-removable Time chip defaulting to Last 7 days', async () => {
      setTracePageHandlers(metricsCapableCapabilities);

      const { queryClient } = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      const chips = [...getFilterChips()];
      expect(chips).toHaveLength(1);
      expect(chips[0]?.textContent).toContain('Time');
      expect(within(chips[0]).getByRole('button', { name: 'Value: Last 7 days' })).toBeTruthy();
      expect(within(chips[0]).queryByRole('button', { name: /remove/i })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    });
  });

  describe('when the user picks Last 24 hours from the Time chip', () => {
    it('writes the preset to the URL', async () => {
      setTracePageHandlers(metricsCapableCapabilities);

      const { queryClient } = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Value: Last 7 days' }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('datePreset=last-24h'));
      expect(screen.getByRole('button', { name: 'Value: Last 24 hours' })).toBeTruthy();
    });
  });

  describe('when the URL carries filterTraceId and filterEnvironment', () => {
    it('renders the Time chip then one chip per filter in URL order', async () => {
      setTracePageHandlers(metricsCapableCapabilities);

      const { queryClient } = renderPage('/traces?filterTraceId=trace-a&filterEnvironment=prod');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      const chips = getFilterChips();
      expect(chips).toHaveLength(3);
      expect(chips[0]?.textContent).toContain('Time');
      expect(chips[1]?.textContent).toContain('Trace ID');
      expect(chips[1]?.textContent).toContain('trace-a');
      expect(chips[2]?.textContent).toContain('Environment');
      expect(chips[2]?.textContent).toContain('prod');
    });

    it('keeps the Time chip after Clear filters', async () => {
      setTracePageHandlers(metricsCapableCapabilities);

      const { queryClient } = renderPage('/traces?filterTraceId=trace-a&filterEnvironment=prod');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      await waitFor(() => expect(getFilterChips()).toHaveLength(1));
      expect(getFilterChips()[0]?.textContent).toContain('Time');
      expect(screen.getByTestId('location').textContent).not.toContain('filterTraceId');
    });
  });

  describe('when the URL carries filterTraceId, filterTags and filterEnvironment', () => {
    it('renders one chip per filter in URL order, including tags', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () =>
          HttpResponse.json(traceQueryFieldsWithTags),
        ),
      );

      const { queryClient } = renderPage('/traces?filterTraceId=trace-a&filterTags=alpha&filterEnvironment=prod');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      const chips = Array.from(getFilterChips(), chip => chip.textContent).slice(1);
      expect(chips).toHaveLength(3);
      expect(chips[0]).toBe('Trace IDistrace-a');
      expect(chips[1]).toContain('Tags');
      expect(chips[1]).toContain('alpha');
      expect(chips[2]).toBe('Environmentisprod');
    });

    it('sends the tag as an includes predicate to the trace query API', async () => {
      const bodies: unknown[] = [];
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () =>
          HttpResponse.json(traceQueryFieldsWithTags),
        ),
      );
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );

      renderPage('/traces?filterTags=alpha');

      await waitFor(() => expect(JSON.stringify(bodies)).toContain('{"op":"includes","path":"tags","value":"alpha"}'));
    });
  });

  describe('when the URL gives the feedback comment a text value', () => {
    it('keeps the chip and sends the comment predicate', async () => {
      const bodies: unknown[] = [];
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );

      const { queryClient } = renderPage('/traces?filterFeedbackComment=wrong%20answer');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      expect(JSON.stringify(bodies)).toContain(
        '{"op":"eq","left":{"path":"comment"},"right":{"literal":"wrong answer"}}',
      );
      expect(screen.queryByText(/Failed to load traces/i)).toBeNull();
      expect(Array.from(getFilterChips(), chip => chip.textContent).slice(1)).toEqual([
        'Feedback commentiswrong answer',
      ]);
    });
  });

  describe('when the user changes the field of an existing chip', () => {
    it('keeps the chip with an empty value on the new field', async () => {
      setTracePageHandlers(metricsCapableCapabilities);

      const { queryClient } = renderPage('/traces?status=error');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      fireEvent.click(screen.getByRole('combobox', { name: 'Field: Status' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Environment' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('filterEnvironment='));
      expect(Array.from(getFilterChips(), chip => chip.textContent).slice(1)).toEqual(['Environmentis…']);
      expect(screen.getByTestId('location').textContent).not.toContain('status=');
    });
  });

  describe('when the user commits Environment is prod through the input', () => {
    const commitEnvironmentFilter = async () => {
      const onQuery = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () =>
          HttpResponse.json(environmentsWithProd),
        ),
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          onQuery(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );

      const { queryClient } = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      focusFilterInput();
      typeInFilter('Environment');
      await screen.findByRole('option', { name: 'Environment' });
      pressInFilter('Enter');
      // Operator step: "is" is the first option.
      await screen.findByRole('option', { name: 'is' });
      pressInFilter('Enter');
      await screen.findByRole('option', { name: 'prod' });
      pressInFilter('Enter');

      return { onQuery, queryClient };
    };

    it('writes filterEnvironment=prod to the URL', async () => {
      await commitEnvironmentFilter();

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('filterEnvironment=prod'));
    });

    it('sends an eq predicate on environment in the trace query request', async () => {
      const { onQuery, queryClient } = await commitEnvironmentFilter();

      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      const lastBody = onQuery.mock.calls.at(-1)?.[0];
      expect(JSON.stringify(lastBody)).toContain(
        JSON.stringify({ op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } }),
      );
    });
  });

  describe('when the URL carries filterTraceId.op=isNot', () => {
    const renderIsNot = async () => {
      const onQuery = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          onQuery(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );
      const { queryClient } = renderPage('/traces?filterTraceId=trace-a&filterTraceId.op=isNot');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      return onQuery;
    };

    it('renders the chip with the "is not" operator', async () => {
      await renderIsNot();

      expect(screen.getByRole('combobox', { name: 'Operator: is not' })).toBeTruthy();
    });

    it('sends a ne predicate on traceId in the trace query request', async () => {
      const onQuery = await renderIsNot();

      expect(JSON.stringify(onQuery.mock.calls.at(-1)?.[0])).toContain(
        JSON.stringify({ op: 'ne', left: { path: 'traceId' }, right: { literal: 'trace-a' } }),
      );
    });
  });

  const renderCapturingQuery = async (entry: string) => {
    const onQuery = vi.fn<(body: unknown) => void>();
    setTracePageHandlers(metricsCapableCapabilities);
    server.use(
      http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
        onQuery(await request.json());
        return HttpResponse.json(traceQueryPage);
      }),
    );
    const { queryClient } = renderPage(entry);
    await waitFor(() => {
      expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
      expect(queryClient.isFetching()).toBe(0);
    });
    return onQuery;
  };

  describe('when the URL carries filterSpanModel.op=isNot', () => {
    it('sends spans.none with the positive eq predicate', async () => {
      const onQuery = await renderCapturingQuery('/traces?filterSpanModel=gpt-5-mini&filterSpanModel.op=isNot');

      expect(JSON.stringify(onQuery.mock.calls.at(-1)?.[0])).toContain(
        JSON.stringify({ spans: { none: { op: 'eq', left: { path: 'model' }, right: { literal: 'gpt-5-mini' } } } }),
      );
    });
  });

  describe('when the URL carries filterThreadId.op=isNot', () => {
    it('also keeps traces whose thread is unset', async () => {
      const onQuery = await renderCapturingQuery('/traces?filterThreadId=t1&filterThreadId.op=isNot');

      expect(JSON.stringify(onQuery.mock.calls.at(-1)?.[0])).toContain(
        JSON.stringify({
          op: 'or',
          args: [
            { op: 'ne', left: { path: 'threadId' }, right: { literal: 't1' } },
            { op: 'notExists', path: 'threadId' },
          ],
        }),
      );
    });
  });

  describe('when the URL carries an advanced filterGroup', () => {
    const group = {
      id: 'g1',
      logic: 'or',
      nodes: [
        { id: 'n1', fieldId: 'status', value: 'error' },
        { id: 'n2', fieldId: 'spans.model', value: 'gpt-4o' },
      ],
    };
    const entry = `/traces?filterTraceId=trace-a&filterGroup=${encodeURIComponent(JSON.stringify(group))}`;
    const expectedOr = {
      op: 'or',
      args: [
        { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
        { spans: { some: { op: 'eq', left: { path: 'model' }, right: { literal: 'gpt-4o' } } } },
      ],
    };

    it('renders the flat chip and one "Advanced filter" chip', async () => {
      await renderCapturingQuery(entry);

      expect(getFilterChips()[1]?.textContent).toContain('trace-a');
      expect(screen.getByRole('group', { name: 'Advanced filter, 2 conditions' })).toBeTruthy();
    });

    it('sends the group as an or predicate next to the flat filter', async () => {
      const onQuery = await renderCapturingQuery(entry);

      const body = JSON.stringify(onQuery.mock.calls.at(-1)?.[0]);
      expect(body).toContain(JSON.stringify(expectedOr));
      expect(body).toContain(JSON.stringify({ op: 'eq', left: { path: 'traceId' }, right: { literal: 'trace-a' } }));
    });

    it('drops filterGroup from the URL when the advanced chip is removed', async () => {
      await renderCapturingQuery(entry);

      fireEvent.click(screen.getByRole('button', { name: 'Remove advanced filter' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('filterGroup'));
      expect(screen.getByTestId('location').textContent).toContain('filterTraceId=trace-a');
    });

    it('keeps the agent scope alongside the group on the agent traces page', async () => {
      const onQuery = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          onQuery(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );
      const { queryClient } = renderPage(entry.replace('/traces', '/agents/agent-a/traces'), {
        scopedEntityId: 'agent-a',
        scopedEntityType: EntityType.AGENT,
      });
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      const body = JSON.stringify(onQuery.mock.calls.at(-1)?.[0]);
      expect(body).toContain(JSON.stringify(expectedOr));
      expect(body).toContain('"literal":"agent-a"');
      expect(screen.getByRole('group', { name: 'Advanced filter, 2 conditions' })).toBeTruthy();
    });
  });

  describe('when the URL carries filterSpanDurationMs=1000 with the gt operator', () => {
    it('sends a numeric gt predicate inside spans.some', async () => {
      const onQuery = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          onQuery(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );

      const { queryClient } = renderPage('/traces?filterSpanDurationMs=1000&filterSpanDurationMs.op=gt');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      expect(JSON.stringify(onQuery.mock.calls.at(-1)?.[0])).toContain(
        JSON.stringify({ spans: { some: { op: 'gt', left: { path: 'durationMs' }, right: { literal: 1000 } } } }),
      );
    });
  });

  describe('when the server declares traceQueryRootDuration', () => {
    const renderRootDuration = async (entry = '/traces') => {
      const onQuery = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          onQuery(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );
      const { queryClient } = renderPage(entry);
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      return { onQuery, queryClient };
    };
    const rootGt = (literal: number) => JSON.stringify({ op: 'gt', left: { path: 'durationMs' }, right: { literal } });

    it('sends a top-level durationMs predicate for filterDurationMs=1000 with gt', async () => {
      const { onQuery } = await renderRootDuration('/traces?filterDurationMs=1000&filterDurationMs.op=gt');

      const body = JSON.stringify(onQuery.mock.calls.at(-1)?.[0]);
      expect(body).toContain(rootGt(1000));
      expect(body).not.toContain('"spans"');
    });

    it('offers Duration (ms) in the field step', async () => {
      await renderRootDuration();

      focusFilterInput();
      expect(await screen.findByRole('option', { name: 'Duration (ms)' })).toBeTruthy();
    });

    it('writes the filter to the URL and queries it when the user picks Duration (ms) › greater than › 2000', async () => {
      const { onQuery, queryClient } = await renderRootDuration();

      focusFilterInput();
      typeInFilter('Duration (ms)');
      await screen.findByRole('option', { name: 'Duration (ms)' });
      pressInFilter('Enter');
      typeInFilter('greater than');
      await screen.findByRole('option', { name: 'greater than' });
      pressInFilter('Enter');
      typeInFilter('2000');
      pressInFilter('Enter');

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toContain('filterDurationMs=2000&filterDurationMs.op=gt'),
      );
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(JSON.stringify(onQuery.mock.calls.at(-1)?.[0])).toContain(rootGt(2000));
    });
  });

  describe('when the server does not declare traceQueryRootDuration', () => {
    const renderWithoutRootDuration = async (entry = '/traces') => {
      const onQuery = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(noRootDurationCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          onQuery(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );
      const { queryClient } = renderPage(entry);
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      return onQuery;
    };

    it('does not offer Duration (ms) in the field step', async () => {
      await renderWithoutRootDuration();

      focusFilterInput();
      await screen.findByRole('option', { name: 'Trace ID' });
      expect(screen.queryByRole('option', { name: 'Duration (ms)' })).toBeNull();
    });

    it('sends no durationMs predicate for a filterDurationMs URL param', async () => {
      const onQuery = await renderWithoutRootDuration('/traces?filterDurationMs=1000&filterDurationMs.op=gt');

      expect(onQuery).toHaveBeenCalled();
      expect(JSON.stringify(onQuery.mock.calls.at(-1)?.[0])).not.toContain('durationMs');
    });

    it('drops durationMs conditions from a filterGroup and keeps the rest of the group', async () => {
      const group = {
        id: 'g1',
        logic: 'or',
        nodes: [
          { id: 'n1', fieldId: 'durationMs', value: '1000', operatorId: 'gt' },
          { id: 'n2', fieldId: 'status', value: 'error' },
        ],
      };
      const onQuery = await renderWithoutRootDuration(
        `/traces?filterGroup=${encodeURIComponent(JSON.stringify(group))}`,
      );

      expect(onQuery.mock.calls.at(-1)?.[0]).toMatchObject({
        where: { op: 'and', args: [{ op: 'eq', left: { path: 'status' }, right: { literal: 'error' } }] },
      });
    });
  });

  describe('when the URL carries filterSpanError with the exists operator', () => {
    const renderExists = async () => {
      const onQuery = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          onQuery(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );
      const { queryClient } = renderPage('/traces?filterSpanError=&filterSpanError.op=exists');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      return onQuery;
    };

    it('renders the chip without a value segment', async () => {
      await renderExists();

      const chip = getFilterChips()[1];
      expect(chip?.textContent).toBe('Span errorexists');
      expect(within(chip).queryByRole('combobox', { name: /^Value/ })).toBeNull();
    });

    it('sends an exists predicate inside spans.some', async () => {
      const onQuery = await renderExists();

      expect(JSON.stringify(onQuery.mock.calls.at(-1)?.[0])).toContain(
        JSON.stringify({ spans: { some: { op: 'exists', path: 'error' } } }),
      );
    });
  });

  describe('when the user switches an existing chip to the "is not" operator', () => {
    it('writes the .op param to the URL', async () => {
      setTracePageHandlers(metricsCapableCapabilities);

      const { queryClient } = renderPage('/traces?filterTraceId=trace-a');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      fireEvent.click(screen.getByRole('combobox', { name: 'Operator: is' }));
      fireEvent.click(await screen.findByRole('option', { name: 'is not' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('filterTraceId.op=isNot'));
      expect(screen.getByTestId('location').textContent).toContain('filterTraceId=trace-a');
    });
  });

  describe('when the user opens the value step of a Model chip', () => {
    it('suggests models discovered in the spans scope', async () => {
      const onValues = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/values`, async ({ request }) => {
          onValues(await request.json());
          return HttpResponse.json(traceQuerySpanModelValues);
        }),
      );

      const { queryClient } = renderPage('/traces?filterSpanModel=');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      fireEvent.click(screen.getByRole('combobox', { name: 'Value: …' }));

      expect(await screen.findByRole('option', { name: 'gpt-4o' })).toBeTruthy();
      expect(onValues.mock.calls.at(-1)?.[0]).toMatchObject({ predicateScope: 'spans', path: 'model' });
    });
  });

  describe('when the page is scoped to an agent', () => {
    const renderScoped = async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      const result = renderPage('/traces?filterTraceId=trace-a', {
        scopedEntityId: 'weather-agent',
        scopedEntityType: EntityType.AGENT,
      });
      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('filterEntityId=weather-agent'));
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(result.queryClient.isFetching()).toBe(0);
      });
      return result;
    };

    it('does not render chips for the scope fields', async () => {
      await renderScoped();

      expect([...getFilterChips()].slice(1).map(chip => chip.textContent)).toEqual(['Trace IDistrace-a']);
    });

    it('keeps the scope in the URL after Clear filters', async () => {
      await renderScoped();

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('filterTraceId'));
      expect(screen.getByTestId('location').textContent).toContain('filterEntityId=weather-agent');
      expect(screen.getByTestId('location').textContent).toContain('rootEntityType=agent');
    });

    it('does not offer Primitive name in the field step', async () => {
      await renderScoped();

      focusFilterInput();
      await screen.findByRole('option', { name: 'Trace ID' });
      expect(screen.queryByRole('option', { name: 'Primitive name' })).toBeNull();
      expect(screen.queryByRole('option', { name: 'Primitive type' })).toBeNull();
      expect(screen.queryByRole('option', { name: 'Primitive ID' })).toBeNull();
    });

    it('does not render the Traces/Spans switch', async () => {
      await renderScoped();

      expect(screen.queryByRole('navigation', { name: 'Observability views' })).toBeNull();
    });
  });
});

describe('Agent traces page opened from a conversation', () => {
  const SAVED_FILTERS_KEY = 'mastra:traces:saved-filters:agent:weather-agent';

  const renderFromConversation = async () => {
    setTracePageHandlers(metricsCapableCapabilities);
    const result = renderPage('/agents/weather-agent/traces?filterThreadId=thread-1', {
      scopedEntityId: 'weather-agent',
      scopedEntityType: EntityType.AGENT,
    });
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('filterEntityId=weather-agent'));
    await waitFor(() => {
      expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
      expect(result.queryClient.isFetching()).toBe(0);
    });
    return result;
  };

  describe('when the agent has saved filters', () => {
    it('shows only the conversation filter as a removable chip', async () => {
      window.localStorage.setItem(SAVED_FILTERS_KEY, 'status=error');
      await renderFromConversation();

      const chips = [...getFilterChips()].slice(1);
      expect(chips.map(chip => chip.textContent)).toEqual(['Thread IDisthread-1']);
      expect(within(chips[0]).getByRole('button', { name: /remove/i })).toBeTruthy();
      expect(screen.getByTestId('location').textContent).not.toContain('status=');
    });
  });

  describe('when the user removes the conversation filter', () => {
    it('lists all of the agent traces', async () => {
      await renderFromConversation();

      fireEvent.click(within([...getFilterChips()][1]).getByRole('button', { name: /remove/i }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('filterThreadId'));
      expect(screen.getByTestId('location').textContent).toContain('filterEntityId=weather-agent');
    });
  });

  describe('when the user changes another filter', () => {
    it('does not remember the conversation for the next visit', async () => {
      await renderFromConversation();

      fireEvent.click(within([...getFilterChips()][0]).getByRole('button', { name: 'Value: Last 7 days' }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('datePreset=last-24h'));
      const saved = window.localStorage.getItem(SAVED_FILTERS_KEY) ?? '';
      expect(saved).toContain('datePreset=last-24h');
      expect(saved).not.toContain('filterThreadId');
      expect(screen.getByTestId('location').textContent).toContain('filterThreadId=thread-1');
    });
  });
});

describe('Traces page metadata filter discovery', () => {
  describe('when field discovery is still pending', () => {
    it('shows the page skeleton instead of the filter bar and list', async () => {
      let releaseFields: () => void = () => {};
      const fieldsGate = new Promise<void>(resolve => {
        releaseFields = resolve;
      });
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, async () => {
          await fieldsGate;
          return HttpResponse.json(emptyTraceQueryFields);
        }),
      );

      const { queryClient } = renderPage();

      expect(screen.getByTestId('traces-page-skeleton')).not.toBeNull();
      expect(screen.queryByRole('combobox', { name: 'Add filter' })).toBeNull();

      releaseFields();
      await waitFor(() => expect(screen.queryByTestId('traces-page-skeleton')).toBeNull());
      expect(getFilterInput()).not.toBeNull();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
    });
  });

  describe('when discovery is unsupported by the server', () => {
    it('renders the filter bar without metadata fields and no skeleton', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () =>
          HttpResponse.json(
            {
              error: 'Trace query discovery requires a newer @mastra/core.',
              code: 'TRACE_QUERY_DISCOVERY_UNSUPPORTED',
            },
            { status: 501 },
          ),
        ),
      );

      const { queryClient } = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
      focusFilterInput();
      await screen.findByRole('option', { name: 'Trace ID' });
      expect(screen.queryByRole('option', { name: 'region' })).toBeNull();
    });
  });

  describe('when discovery reports a metadata.region field', () => {
    const commitRegionFilter = async () => {
      const onFields = vi.fn<(body: unknown) => void>();
      const onValues = vi.fn<(body: unknown) => void>();
      const onQuery = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, async ({ request }) => {
          onFields(await request.json());
          return HttpResponse.json(traceQueryFieldsWithRegion);
        }),
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/values`, async ({ request }) => {
          onValues(await request.json());
          return HttpResponse.json(traceQueryRegionValues);
        }),
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          onQuery(await request.json());
          return HttpResponse.json(traceQueryPage);
        }),
      );

      const { queryClient } = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      focusFilterInput();
      typeInFilter('region');
      await screen.findByRole('option', { name: 'region' });
      pressInFilter('Enter');
      await screen.findByRole('option', { name: 'is' });
      pressInFilter('Enter');
      await screen.findByRole('option', { name: 'eu-west' });
      pressInFilter('Enter');

      return { onFields, onValues, onQuery, queryClient };
    };

    it('requests fields on mount with the trace predicate scope', async () => {
      const { onFields } = await commitRegionFilter();

      expect(onFields).toHaveBeenCalledTimes(1);
      expect(onFields.mock.calls[0]?.[0]).toMatchObject({ predicateScope: 'trace' });
    });

    it('fetches values only when the value step opens, for the chosen path', async () => {
      const { onValues } = await commitRegionFilter();

      expect(onValues).toHaveBeenCalledTimes(1);
      expect(onValues.mock.calls[0]?.[0]).toMatchObject({ path: 'metadata.region', predicateScope: 'trace' });
    });

    it('writes filterMetadata.region=eu-west to the URL', async () => {
      await commitRegionFilter();

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toContain('filterMetadata.region=eu-west'),
      );
    });

    it('sends an eq predicate on metadata.region in the trace query request', async () => {
      const { onQuery, queryClient } = await commitRegionFilter();

      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(JSON.stringify(onQuery.mock.calls.at(-1)?.[0])).toContain(
        JSON.stringify({ op: 'eq', left: { path: 'metadata.region' }, right: { literal: 'eu-west' } }),
      );
    });
  });

  describe('when the URL carries filterMetadata.region', () => {
    it('renders a removable region chip', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () =>
          HttpResponse.json(traceQueryFieldsWithRegion),
        ),
      );

      const { queryClient } = renderPage('/traces?filterMetadata.region=eu-west');
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      expect(Array.from(getFilterChips(), chip => chip.textContent).slice(1)).toEqual(['regioniseu-west']);
    });
  });
});

describe('Traces page sorting', () => {
  const orderBys: unknown[] = [];

  const captureTraceQueries = () => {
    orderBys.length = 0;
    setTracePageHandlers(metricsUnavailableCapabilities);
    server.use(
      http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
        const body = (await request.json()) as { orderBy?: unknown; mode?: string };
        // Delta polls share this endpoint but never sort; only the list request carries the order.
        if (body.mode !== 'delta') orderBys.push(body.orderBy);
        return HttpResponse.json(traceQueryPage);
      }),
    );
  };

  describe('when traces are sorted from the Start column', () => {
    it('asks the server for newest-first by default', async () => {
      captureTraceQueries();
      const { queryClient } = renderPage();

      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(orderBys.at(-1)).toEqual([{ field: 'startedAt', direction: 'desc' }]);
      expect(screen.getByRole('button', { name: 'Start, sorted descending, sort ascending' })).not.toBeNull();
    });

    it('asks the server for oldest-first when toggled and writes it to the URL', async () => {
      captureTraceQueries();
      const { queryClient } = renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Start, sorted descending, sort ascending' }));

      await waitFor(() => expect(orderBys.at(-1)).toEqual([{ field: 'startedAt', direction: 'asc' }]));
      expect(screen.getByTestId('location').textContent).toContain('sort=startedAt');
      expect(screen.getByTestId('location').textContent).toContain('dir=asc');
    });

    it('restores the sort from the URL', async () => {
      captureTraceQueries();
      const { queryClient } = renderPage('/traces?sort=startedAt&dir=asc');

      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(orderBys.at(-1)).toEqual([{ field: 'startedAt', direction: 'asc' }]);
    });
  });
});

describe('Traces side panel span search', () => {
  describe('when the opened trace has a span whose payload holds the searched term', () => {
    it('keeps only the span matching the payload text', async () => {
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(traceSpansWithPayload)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      renderPage('/traces?traceId=trace-a');

      expect(await screen.findByText('llm call')).toBeTruthy();
      fireEvent.change(screen.getByPlaceholderText('Search spans...'), { target: { value: 'zanzibar-payload-term' } });

      await waitFor(() => expect(screen.queryByText('llm call')).toBeNull());
      expect(screen.getByText('weather tool')).toBeTruthy();
    });
  });
});

describe('Traces page tags filter', () => {
  const renderAndSettle = async (path = '/traces') => {
    const { queryClient } = renderPage(path);
    await waitFor(() => {
      expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
      expect(queryClient.isFetching()).toBe(0);
    });
  };

  describe('when the store supports trace query and discovery describes tags', () => {
    it('offers Tags in the field step', async () => {
      setTracePageHandlers(traceQueryCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () =>
          HttpResponse.json(traceQueryFieldsWithTags),
        ),
      );
      await renderAndSettle();

      focusFilterInput();
      expect(await screen.findByRole('option', { name: 'Tags' })).toBeTruthy();
    });

    it('suggests the tag values the store knows about', async () => {
      setTracePageHandlers(traceQueryCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () =>
          HttpResponse.json(traceQueryFieldsWithTags),
        ),
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/values`, () =>
          HttpResponse.json(traceQueryTagValues),
        ),
      );
      await renderAndSettle();

      focusFilterInput();
      fireEvent.click(await screen.findByRole('option', { name: 'Tags' }));
      fireEvent.click(await screen.findByRole('option', { name: 'is any of' }));
      expect(await screen.findByRole('option', { name: 'production' })).toBeTruthy();
      expect(screen.getByRole('option', { name: 'manual-review' })).toBeTruthy();
    });
  });

  describe('when the store supports trace query but not discovery', () => {
    it('never calls the fields endpoint and does not offer Tags', async () => {
      let fieldRequests = 0;
      setTracePageHandlers(traceQueryWithoutDiscoveryCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () => {
          fieldRequests++;
          return HttpResponse.json(traceQueryFieldsWithTags);
        }),
      );
      await renderAndSettle();

      focusFilterInput();
      await screen.findByRole('option', { name: 'Trace ID' });
      expect(screen.queryByRole('option', { name: 'Tags' })).toBeNull();
      expect(fieldRequests).toBe(0);
    });
  });

  describe('when the store only supports the legacy list', () => {
    it('does not offer Tags', async () => {
      setTracePageHandlers(legacyTraceCapabilities);
      await renderAndSettle();

      focusFilterInput();
      await screen.findByRole('option', { name: 'Trace ID' });
      expect(screen.queryByRole('option', { name: 'Tags' })).toBeNull();
    });
  });
});

describe('Traces page parity', () => {
  const settle = async (queryClient: ReturnType<typeof renderPage>['queryClient']) => {
    await waitFor(() => {
      expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
      expect(queryClient.isFetching()).toBe(0);
    });
  };

  describe('when scoped and saved filters exist', () => {
    it('restores the saved filters without dropping the scope', async () => {
      window.localStorage.setItem('mastra:traces:saved-filters:agent:weather-agent', 'status=error');
      setTracePageHandlers(metricsCapableCapabilities);

      const { queryClient } = renderPage('/agents/weather-agent/traces', {
        scopedEntityId: 'weather-agent',
        scopedEntityType: EntityType.AGENT,
      });

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('status=error'));
      await settle(queryClient);
      expect(screen.getByTestId('location').textContent).toContain('filterEntityId=weather-agent');
      expect(screen.getByTestId('location').textContent).toContain('rootEntityType=agent');
    });
  });

  describe('when running on the Mastra platform and storage lacks metrics', () => {
    afterEach(() => {
      delete (window as Partial<Window>).MASTRA_CLOUD_API_ENDPOINT;
    });

    it('still renders the usage columns and requests usage', async () => {
      window.MASTRA_CLOUD_API_ENDPOINT = 'https://api.mastra.cloud';
      setTracePageHandlers(metricsUnavailableCapabilities);

      const { queryClient } = renderPage();

      await waitFor(() => expect(onBreakdownRequest).toHaveBeenCalled());
      await settle(queryClient);
      expect(screen.getByText('Input tokens')).toBeTruthy();
    });
  });

  describe('when the URL asks for branches mode with an anchor span', () => {
    it('queries traces and never requests branches', async () => {
      const onTraceQuery = vi.fn<() => void>();
      const onBranchesRequest = vi.fn<() => void>();
      setTracePageHandlers(metricsCapableCapabilities);
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () => {
          onTraceQuery();
          return HttpResponse.json(traceQueryPage);
        }),
        http.get(`${TEST_BASE_URL}/api/observability/branches`, () => {
          onBranchesRequest();
          return HttpResponse.json(branchList);
        }),
      );

      const { queryClient } = renderPage('/traces?listMode=branches&anchorSpanId=span-a');

      await waitFor(() => expect(onTraceQuery).toHaveBeenCalled());
      await settle(queryClient);
      expect(onBranchesRequest).not.toHaveBeenCalled();
    });
  });

  describe('when a filter is edited while a trace is open', () => {
    it('writes the new filter and closes the trace in the URL', async () => {
      setTracePageHandlers(metricsUnavailableCapabilities);
      server.use(http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)));

      const { queryClient } = renderPage('/traces?traceId=trace-a');
      await settle(queryClient);

      fireEvent.click(
        within([...getFilterChips()][0]).getByRole('button', { name: 'Value: Last 7 days', hidden: true }),
      );
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours', hidden: true }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('datePreset=last-24h'));
      expect(screen.getByTestId('location').textContent).not.toContain('traceId=');
    });
  });
});
