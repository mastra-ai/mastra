import type { GetSystemPackagesResponse } from '@mastra/client-js';
import { serializeTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TracesPage from '..';
import {
  branchList,
  emptyEntityNames,
  emptyEnvironments,
  emptyFeedback,
  emptyScorers,
  emptyServiceNames,
  emptyTags,
  metricsCapableSystemPackages,
  metricsUnavailableSystemPackages,
  rootBranchList,
  rootBranchSpans,
  subtraceBranchSpans,
  traceSpans,
  traceList,
  traceListWithTwoTraces,
  threadedTrace,
  unthreadedTrace,
  traceSpanScores,
  emptyTraceSpanScores,
  traceUsageBreakdown,
} from './fixtures/traces';
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

const renderPage = (initialEntry = '/traces') =>
  renderWithProviders(
    <TestLinkProvider>
      <TracesPage />
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

beforeEach(() => {
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

  describe('when Branches mode is selected', () => {
    it('suppresses usage columns and metric requests', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);

      const { queryClient } = renderPage('/traces?listMode=branches');

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByText('Input tokens')).toBeNull();
      expect(onBreakdownRequest).not.toHaveBeenCalled();
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

    // Subtraces checkbox uses the short label.
    expect(screen.getByRole('checkbox', { name: 'Subtraces' })).not.toBeNull();
    expect(screen.queryByText('Show subtraces')).toBeNull();
  });
});

describe('Traces side panel header actions', () => {
  it('shows the trace actions in the panel header when a trace is selected', async () => {
    setTracePageHandlers(metricsCapableSystemPackages);
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceSpans)),
      http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
    );

    renderPage('/traces?traceId=trace-a');
    // The panel's scores keep polling, so wait on the panel itself rather than on quiet.
    await screen.findByRole('tab', { name: /spans/i });

    // The header keeps trace-to-trace navigation and the close button; the rest is one menu away.
    fireEvent.click(screen.getByRole('button', { name: 'More trace actions' }));

    expect(screen.getByRole('menuitem', { name: 'Save as Dataset Item' })).not.toBeNull();
    // Evaluating a trace is what the Scorers tab is for.
    expect(screen.queryByRole('menuitem', { name: /evaluate trace/i })).toBeNull();
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
    // The panel's scores keep polling, so wait on the panel itself rather than on quiet.
    await screen.findByRole('tab', { name: /spans/i });

    fireEvent.click(screen.getByRole('tab', { name: /scorers/i }));
    return queryClient;
  };

  describe('when the trace has scores', () => {
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

  describe('when the trace has no scores', () => {
    it('shows the table empty state without a chart', async () => {
      await openScoresTab();

      expect(await screen.findByText(/no scores/i)).not.toBeNull();
      expect(screen.queryByText('0.60')).toBeNull();
    });
  });
});

describe('Traces side panel thread view', () => {
  const openTrace = async (traceResponse: typeof threadedTrace) => {
    setTracePageHandlers(metricsCapableSystemPackages);
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a`, () => HttpResponse.json(traceResponse)),
      http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
    );

    renderPage('/traces?traceId=trace-a');
    // The panel's own queries keep polling, so wait on the panel itself rather than on quiet.
    await screen.findByRole('tab', { name: /spans/i });
  };

  describe('when the opened trace belongs to a thread', () => {
    it('offers the thread as a tab in the trace panel', async () => {
      await openTrace(threadedTrace);

      fireEvent.click(await screen.findByRole('tab', { name: /Partial thread/ }));

      const turn = await screen.findByTestId('trace-investigate');
      expect(turn.getAttribute('data-trace-id')).toBe('trace-a');
      expect(within(turn).getByTestId('trace-investigate-user-turn').textContent).toContain('What can I cook?');
    });

    it('opens the whole thread from the tab, without selecting it first', async () => {
      await openTrace(threadedTrace);

      expect(await screen.findByRole('button', { name: 'See full thread' })).toBeDefined();
    });
  });

  describe('when the opened trace has no thread', () => {
    it('offers no thread tab', async () => {
      await openTrace(unthreadedTrace);

      expect(screen.queryByRole('tab', { name: /Partial thread/ })).toBeNull();
    });
  });
});
