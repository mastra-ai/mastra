import type { GetSystemPackagesResponse } from '@mastra/client-js';
import { serializeTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { act, screen, waitFor } from '@testing-library/react';
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
  traceLightSpans,
  traceList,
  traceListWithTwoTraces,
  traceRootSpan,
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
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, () =>
      HttpResponse.json(traceRootSpan),
    ),
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
  // Usage assertions below inspect the technical panel, which only renders in advanced mode.
  window.localStorage.setItem('mastra:traces:view-mode', 'advanced');
  onBreakdownRequest.mockClear();
});

describe('Traces page review mode', () => {
  describe('when a trace is opened without a saved preference', () => {
    it('shows the readable case and response', async () => {
      window.localStorage.setItem('mastra:flags:trace-review', 'on');
      window.localStorage.removeItem('mastra:traces:view-mode');
      setTracePageHandlers(metricsCapableSystemPackages);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/light`, () => HttpResponse.json(traceLightSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      renderPage('/traces?traceId=trace-a');

      expect(await screen.findByText('A patient reports sudden chest pain.')).not.toBeNull();
      expect(screen.getByText('The presentation requires urgent evaluation.')).not.toBeNull();
      expect(screen.queryByText('Studio preview agent')).toBeNull();
    });
  });

  describe('when advanced mode was saved', () => {
    it('shows the technical timeline', async () => {
      window.localStorage.setItem('mastra:flags:trace-review', 'on');
      window.localStorage.setItem('mastra:traces:view-mode', 'advanced');
      setTracePageHandlers(metricsCapableSystemPackages);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/light`, () => HttpResponse.json(traceLightSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      renderPage('/traces?traceId=trace-a');

      expect(await screen.findByText('Studio preview agent')).not.toBeNull();
      expect(screen.queryByText('A patient reports sudden chest pain.')).toBeNull();
    });
  });
});

describe('Traces page review flag', () => {
  describe('when the trace-review flag is off', () => {
    it('opens the technical timeline without review tabs', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/light`, () => HttpResponse.json(traceLightSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      renderPage('/traces?traceId=trace-a');

      expect(await screen.findByText('Studio preview agent')).not.toBeNull();
      expect(screen.queryByRole('tab', { name: 'Review' })).toBeNull();
    });
  });
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

    it('reuses list usage data for a selected trace', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces`, () => HttpResponse.json(traceListWithTwoTraces)),
        http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(traceListWithTwoTraces)),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/light`, () => HttpResponse.json(traceLightSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      const { queryClient } = renderPage('/traces?traceId=trace-a');

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(onBreakdownRequest).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Trace est. cost')).not.toBeNull();
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
    it('shows the trace cost when the trace is outside the loaded list', async () => {
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
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/light`, () => HttpResponse.json(traceLightSpans)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      renderPage('/traces?traceId=trace-a');

      await waitFor(() => expect(onBreakdownRequest).toHaveBeenCalled());
      expect(await screen.findByText('Trace est. cost')).not.toBeNull();
      expect(await screen.findByText('$0.0010')).not.toBeNull();
    });
  });

  describe('when Branches mode is selected', () => {
    it('shows trace totals for a root trace panel', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/branches`, () => HttpResponse.json(rootBranchList)),
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/branches/span-a`, () =>
          HttpResponse.json(rootBranchSpans),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      renderPage('/traces?listMode=branches&traceId=trace-a&anchorSpanId=span-a');

      await waitFor(() => expect(onBreakdownRequest).toHaveBeenCalled());
      expect(await screen.findByText('Trace est. cost')).not.toBeNull();
      expect(await screen.findByText('$0.0010')).not.toBeNull();
    });

    it('suppresses usage columns and metric requests', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);

      const { queryClient } = renderPage('/traces?listMode=branches');

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByText('Input tokens')).toBeNull();
      expect(onBreakdownRequest).not.toHaveBeenCalled();
    });

    it('does not show cached trace totals in a subtrace panel', async () => {
      setTracePageHandlers(metricsCapableSystemPackages);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/trace-a/branches/span-a`, () =>
          HttpResponse.json(subtraceBranchSpans),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(emptyFeedback)),
      );

      const { queryClient } = renderPage('/traces?listMode=branches&traceId=trace-a&anchorSpanId=span-a');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      act(() => {
        queryClient.setQueryData(
          ['trace-usage', `${TEST_BASE_URL}:/api`, ['trace-a']],
          new Map([['trace-a', { inputTokens: 12_500, outputTokens: 405, estimatedCost: 0.01, costUnit: 'usd' }]]),
        );
      });

      expect(screen.queryByText('Trace est. cost')).toBeNull();
      expect(screen.queryByText('12.5K')).toBeNull();
      expect(onBreakdownRequest).not.toHaveBeenCalled();
    });
  });
});
