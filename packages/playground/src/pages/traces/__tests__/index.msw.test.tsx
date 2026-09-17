import type { GetSystemPackagesResponse } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { serializeTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TracesPage from '..';
import { traceQueryPage } from './fixtures/trace-query';
import {
  branchList,
  emptyEntityNames,
  emptyEnvironments,
  environmentsWithProd,
  emptyFeedback,
  emptyScorers,
  emptyServiceNames,
  emptyTags,
  metricsCapableSystemPackages,
  metricsUnavailableSystemPackages,
  threadedTraceSpans,
  traceSpans,
  traceList,
  traceListWithTwoTraces,
  traceSpanScores,
  emptyTraceSpanScores,
  traceUsageBreakdown,
} from './fixtures/traces';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const TRACE_COLUMN_STORAGE_KEY = `mastra:traces:columns:${TEST_BASE_URL}:/api`;
const onBreakdownRequest = vi.fn<() => void>();

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

const setTracePageHandlers = (systemPackages: GetSystemPackagesResponse) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(emptyScorers)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([]))),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () => HttpResponse.json(traceQueryPage)),
    http.get(`${TEST_BASE_URL}/api/observability/traces`, () => HttpResponse.json(traceList)),
    // The list fetches the lightweight projection first; serve the same rows there.
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(traceList)),
    http.get(`${TEST_BASE_URL}/api/observability/branches`, () => HttpResponse.json(branchList)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/tags`, () => HttpResponse.json(emptyTags)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/service-names`, () => HttpResponse.json(emptyServiceNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () =>
      HttpResponse.json(emptyTraceSpanScores),
    ),
    // Opening a trace reads the whole trace. Registered after the literal `traces/light`
    // so the list's endpoint isn't swallowed by the `:traceId` segment.
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(traceSpans)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => {
      onBreakdownRequest();
      return HttpResponse.json(traceUsageBreakdown);
    }),
  );
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
};

const renderPage = (initialEntry = '/traces', props: React.ComponentProps<typeof TracesPage> = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <TracesPage {...props} />
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

const getFilterChips = () => document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]');
const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' });
const focusFilterInput = () => act(() => getFilterInput().focus());
const typeInFilter = (text: string) => fireEvent.change(getFilterInput(), { target: { value: text } });
const pressInFilter = (key: string) => fireEvent.keyDown(getFilterInput(), { key });

beforeEach(() => {
  // jsdom has no scrollIntoView; the timeline reveals the selected span row on mount.
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  // jsdom ships no PointerEvent, and Base UI constructs one on press.
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventStub extends MouseEvent {}
    window.PointerEvent = PointerEventStub as unknown as typeof PointerEvent;
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createMemoryStorage(),
  });
  window.localStorage.setItem(
    TRACE_COLUMN_STORAGE_KEY,
    serializeTraceColumnPreferences({ visibleColumns: ['inputTokens'], metadataKeys: [] }),
  );
  onBreakdownRequest.mockClear();
});

describe('Traces page usage columns', () => {
  describe('when the observability store supports metrics', () => {
    it('renders the selected usage header', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);

      const { queryClient } = renderPage();

      await waitFor(() => expect(onBreakdownRequest).toHaveBeenCalled());
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.getByText('Input tokens')).not.toBeNull();
    });

    it('keeps usage totals in the trace list when a trace is selected', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
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
      setTracePageHandlers(metricsUnavailableSystemPackages);

      const { queryClient } = renderPage();

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByText('Input tokens')).toBeNull();
      expect(onBreakdownRequest).not.toHaveBeenCalled();
    });
  });

  describe('when a trace is opened from a direct link', () => {
    it('does not request or show usage in the side panel when usage columns are hidden', async () => {
      window.localStorage.setItem(
        TRACE_COLUMN_STORAGE_KEY,
        serializeTraceColumnPreferences({ visibleColumns: [], metadataKeys: [] }),
      );
      setTracePageHandlers(metricsCapableSystemPackages);
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

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(onBreakdownRequest).not.toHaveBeenCalled();
      expect(screen.queryByText('Input tokens')).toBeNull();
      expect(screen.queryByText('Est. cost')).toBeNull();
    });
  });

  describe('Messages column', () => {
    const setThreadedTraceHandlers = () => {
      setTracePageHandlers(metricsCapableSystemPackages);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/spans/span-a`, () =>
          HttpResponse.json({ span: threadedTraceSpans.spans[0] }),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(threadedTraceSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );
    };

    it('given an agent trace with a thread id, when opened, then Messages renders as a column and the panel is wide', async () => {
      setThreadedTraceHandlers();

      const { queryClient } = renderPage('/traces?traceId=trace-a');

      expect(await screen.findByTestId('messages-panel')).not.toBeNull();
      expect(screen.queryByRole('tab', { name: 'Messages' })).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Trace details' }).className).toContain('w-4/5');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('given a span is also selected, then the panel covers the full frame', async () => {
      setThreadedTraceHandlers();

      const { queryClient } = renderPage('/traces?traceId=trace-a&spanId=span-a');

      expect(await screen.findByTestId('messages-panel')).not.toBeNull();
      await waitFor(() => expect(screen.getByRole('dialog', { name: 'Trace details' }).className).toContain('w-full'));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
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

      it('when "View full thread" is clicked, then the side panel shows every turn at full width, and "Back to trace" restores the trace', async () => {
        setMultiTurnThreadHandlers();

        const { queryClient } = renderPage('/traces?traceId=trace-a');
        const dialog = () => screen.getByRole('dialog', { name: 'Trace details' });

        fireEvent.click(await screen.findByRole('button', { name: 'View full thread' }));

        expect(await screen.findByTestId('thread-view-by-trace')).not.toBeNull();
        await waitFor(() => expect(dialog().querySelectorAll('[data-trace-id]')).toHaveLength(2));
        expect(dialog().className).toContain('w-full');
        expect(screen.queryByTestId('messages-panel')).toBeNull();
        // The page did not navigate away from the traces list.
        expect(screen.getByRole('button', { name: 'Back to trace' })).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Back to trace' }));

        expect(await screen.findByTestId('messages-panel')).not.toBeNull();
        expect(screen.queryByTestId('thread-view-by-trace')).toBeNull();
        expect(dialog().className).toContain('w-4/5');
        await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      });
    });

    it('given a trace without a thread id, then no Messages column renders and the panel is half width', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
      server.use(http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)));

      const { queryClient } = renderPage('/traces?traceId=trace-a');

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByTestId('messages-panel')).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Trace details' }).className).toContain('w-1/2');
    });
  });

  describe('when an old branches URL is opened', () => {
    it('loads trace queries without requesting branches', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
      const branches = vi.fn();
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/branches`, () => {
          branches();
          return HttpResponse.json(branchList);
        }),
      );
      const { queryClient } = renderPage('/traces?listMode=branches');
      await waitFor(() => expect(onBreakdownRequest).toHaveBeenCalled());
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(branches).not.toHaveBeenCalled();
      expect(screen.queryByRole('checkbox', { name: 'Subtraces' })).toBeNull();
    });
  });
});

describe('Traces page auto refresh toggle', () => {
  it('renders labeled checkboxes instead of the old icon button', async () => {
    setTracePageHandlers(metricsCapableSystemPackages);

    const { queryClient } = renderPage();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // Auto-refetch is on by default.
    const toggle = screen.getByRole('checkbox', { name: 'Auto refresh' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Toggle auto-refetch' })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    expect(screen.queryByRole('checkbox', { name: 'Subtraces' })).toBeNull();
    expect(screen.queryByText('Show subtraces')).toBeNull();
  });
});

describe('Traces side panel header actions', () => {
  describe('when a registered scorer is selected', () => {
    it('submits the selected trace for scoring and opens its scores', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
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
          } satisfies typeof emptyScorers),
        ),
        http.post(`${TEST_BASE_URL}/api/observability/traces/score`, async ({ request }) => {
          onScore(await request.json());
          return HttpResponse.json({ status: 'success', message: 'Scoring started' });
        }),
      );
      const { queryClient } = renderPage('/traces?traceId=trace-a');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      fireEvent.click(await screen.findByRole('button', { name: 'Score trace' }));
      fireEvent.click(await screen.findByRole('combobox', { name: 'Select scorer' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Quality scorer' }));
      fireEvent.click(screen.getByRole('button', { name: 'Start Scoring' }));
      await waitFor(() =>
        expect(onScore).toHaveBeenCalledWith({
          scorerName: 'quality',
          targets: [{ traceId: 'trace-a', spanId: 'span-a' }],
        }),
      );
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Score trace' })).toBeNull());
      expect(screen.getByRole('tab', { name: /scores/i }).getAttribute('aria-selected')).toBe('true');
    });
  });
  it('shows the trace actions in the panel header when a trace is selected', async () => {
    setTracePageHandlers(metricsCapableSystemPackages);
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
      http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
    );

    const { queryClient } = renderPage('/traces?traceId=trace-a');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(await screen.findByRole('button', { name: 'Score trace' })).not.toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Trace actions' }));

    expect(screen.queryByRole('menuitem', { name: 'Evaluate trace' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Add full trace to dataset' })).not.toBeNull();
    // The parent trace panel is no longer collapsible.
    expect(screen.queryByRole('menuitem', { name: /collapse panel/i })).toBeNull();
  });
});

describe('Traces side panel Scores tab', () => {
  const openScoresTab = async (scoresResponse = emptyTraceSpanScores) => {
    setTracePageHandlers(metricsCapableSystemPackages);
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
      http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () =>
        HttpResponse.json(scoresResponse),
      ),
    );

    const { queryClient } = renderPage('/traces?traceId=trace-a');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    fireEvent.click(screen.getByRole('tab', { name: /scores/i }));
    return queryClient;
  };

  describe('when the trace has scores', () => {
    it('opens score details in a sibling drawer above the trace and closes it independently', async () => {
      await openScoresTab(traceSpanScores);
      fireEvent.click(await screen.findByText('score-1'));

      const scoreDialog = await screen.findByRole('dialog', { name: 'Score score-1' });
      expect(scoreDialog.getAttribute('data-depth')).toBe('2');
      expect(screen.getByRole('dialog', { name: 'Trace details', hidden: true })).not.toBeNull();

      fireEvent.click(within(scoreDialog).getByRole('button', { name: /close/i }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Score score-1' })).toBeNull());
      expect(screen.getByRole('tab', { name: /scores/i }).getAttribute('aria-selected')).toBe('true');
    });

    it('renders the score chart legend above the scores table', async () => {
      await openScoresTab(traceSpanScores);

      // Chart legend: one entry per scorer with its average (scorer names also
      // appear in the table rows, hence the *AllByText queries).
      expect((await screen.findAllByText('Relevance')).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Toxicity').length).toBeGreaterThan(0);
      expect(screen.getByText('0.60')).not.toBeNull();
      expect(screen.getByText('1.00')).not.toBeNull();

      // Table rows still render from the same data.
      expect(screen.getByText('score-1')).not.toBeNull();
      expect(screen.getByText('score-3')).not.toBeNull();
    });
  });

  describe('when a span is open', () => {
    it('closes the span side panel so the scores get the room', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/spans/span-a`, () =>
          HttpResponse.json({ span: traceSpans.spans[0] }),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      const { queryClient } = renderPage('/traces?traceId=trace-a&spanId=span-a');
      expect(await screen.findByRole('heading', { name: /^Span/ })).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      fireEvent.click(screen.getByRole('tab', { name: /scores/i }));

      await waitFor(() => expect(screen.queryByRole('heading', { name: /^Span/ })).toBeNull());
      expect(screen.getByRole('tab', { name: /scores/i }).getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('when the trace has no scores', () => {
    it('shows the table empty state without a chart', async () => {
      await openScoresTab();

      expect(await screen.findByText(/no scores/i)).not.toBeNull();
      expect(screen.queryByText('0.60')).toBeNull();
    });
  });
});

describe('Traces page filter bar', () => {
  describe('when the page loads without any filter', () => {
    it('renders a non-removable Time chip defaulting to Last 7 days', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);

      const { queryClient } = renderPage();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      const chips = [...getFilterChips()];
      expect(chips).toHaveLength(1);
      expect(chips[0]?.textContent).toContain('Time');
      expect(within(chips[0]!).getByRole('button', { name: 'Value: Last 7 days' })).toBeTruthy();
      expect(within(chips[0]!).queryByRole('button', { name: /remove/i })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    });
  });

  describe('when the user picks Last 24 hours from the Time chip', () => {
    it('writes the preset to the URL', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);

      const { queryClient } = renderPage();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      fireEvent.click(screen.getByRole('button', { name: 'Value: Last 7 days' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Last 24 hours' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('datePreset=last-24h'));
      expect(screen.getByRole('button', { name: 'Value: Last 24 hours' })).toBeTruthy();
    });
  });

  describe('when the URL carries filterTraceId and filterEnvironment', () => {
    it('renders the Time chip then one chip per filter in URL order', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);

      const { queryClient } = renderPage('/traces?filterTraceId=trace-a&filterEnvironment=prod');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      const chips = getFilterChips();
      expect(chips).toHaveLength(3);
      expect(chips[0]?.textContent).toContain('Time');
      expect(chips[1]?.textContent).toContain('Trace ID');
      expect(chips[1]?.textContent).toContain('trace-a');
      expect(chips[2]?.textContent).toContain('Environment');
      expect(chips[2]?.textContent).toContain('prod');
    });

    it('keeps the Time chip after Clear filters', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);

      const { queryClient } = renderPage('/traces?filterTraceId=trace-a&filterEnvironment=prod');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      await waitFor(() => expect(getFilterChips()).toHaveLength(1));
      expect(getFilterChips()[0]?.textContent).toContain('Time');
      expect(screen.getByTestId('location').textContent).not.toContain('filterTraceId');
    });
  });

  describe('when the URL carries filterTraceId, filterEnvironment and a legacy filterTags', () => {
    it('renders one chip per query-supported filter in URL order, ignoring tags', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);

      const { queryClient } = renderPage('/traces?filterTraceId=trace-a&filterTags=alpha&filterEnvironment=prod');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      // Tags cannot be filtered by the trace query API, so no chip advertises them.
      expect(Array.from(getFilterChips(), chip => chip.textContent).slice(1)).toEqual([
        'Trace IDtrace-a',
        'Environmentprod',
      ]);
    });
  });

  describe('when the user changes the field of an existing chip', () => {
    it('keeps the chip with an empty value on the new field', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);

      const { queryClient } = renderPage('/traces?status=error');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      fireEvent.click(screen.getByRole('combobox', { name: 'Field: Status' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Environment' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('filterEnvironment='));
      expect(Array.from(getFilterChips(), chip => chip.textContent).slice(1)).toEqual(['Environment…']);
      expect(screen.getByTestId('location').textContent).not.toContain('status=');
    });
  });

  describe('when the user commits Environment is prod through the input', () => {
    const commitEnvironmentFilter = async () => {
      const onQuery = vi.fn<(body: unknown) => void>();
      setTracePageHandlers(metricsCapableSystemPackages);
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
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      focusFilterInput();
      typeInFilter('Environment');
      await screen.findByRole('option', { name: 'Environment' });
      // Every trace field has a single operator, so the operator step is skipped.
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

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      const lastBody = onQuery.mock.calls.at(-1)?.[0];
      expect(JSON.stringify(lastBody)).toContain(
        JSON.stringify({ op: 'eq', left: { path: 'environment' }, right: { literal: 'prod' } }),
      );
    });
  });

  describe('when the page is scoped to an agent', () => {
    const renderScoped = async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
      const result = renderPage('/traces?filterTraceId=trace-a', {
        scopedEntityId: 'weather-agent',
        scopedEntityType: EntityType.AGENT,
      });
      await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('filterEntityId=weather-agent'));
      await waitFor(() => expect(result.queryClient.isFetching()).toBe(0));
      return result;
    };

    it('does not render chips for the scope fields', async () => {
      await renderScoped();

      expect([...getFilterChips()].slice(1).map(chip => chip.textContent)).toEqual(['Trace IDtrace-a']);
    });

    it('keeps the scope in the URL after Clear filters', async () => {
      await renderScoped();

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('filterTraceId'));
      expect(screen.getByTestId('location').textContent).toContain('filterEntityId=weather-agent');
      expect(screen.getByTestId('location').textContent).toContain('rootEntityType=agent');
    });

    it('does not offer Primitive Name in the field step', async () => {
      await renderScoped();

      focusFilterInput();
      await screen.findByRole('option', { name: 'Trace ID' });
      expect(screen.queryByRole('option', { name: 'Primitive Name' })).toBeNull();
      expect(screen.queryByRole('option', { name: 'Primitive Type' })).toBeNull();
      expect(screen.queryByRole('option', { name: 'Primitive ID' })).toBeNull();
    });
  });
});
