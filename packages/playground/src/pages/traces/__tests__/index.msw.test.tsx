import type { GetSystemPackagesResponse } from '@mastra/client-js';
import { serializeTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TracesPage from '..';
import {
  branchList,
  emptyEntityNames,
  emptyEnvironments,
  emptyScorers,
  emptyServiceNames,
  emptyTags,
  metricsCapableSystemPackages,
  metricsUnavailableSystemPackages,
  traceList,
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
