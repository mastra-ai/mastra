import { serializeTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowTraces from '..';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  emptyTraceQueryFields,
  traceQueryCapabilities,
  traceQueryPage,
} from '@/pages/traces/__tests__/fixtures/trace-query';
import {
  branchList,
  emptyEntityNames,
  emptyEnvironments,
  emptyScorers,
  emptyServiceNames,
  emptyTags,
  metricsCapableSystemPackages,
  traceList,
  traceUsageBreakdown,
} from '@/pages/traces/__tests__/fixtures/traces';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const TRACE_COLUMN_STORAGE_KEY = `mastra:traces:columns:${TEST_BASE_URL}:/api`;
const WORKFLOW_ID = 'weather-workflow';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
};

const setHandlers = (onQuery: (body: unknown) => void) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(metricsCapableSystemPackages)),
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(traceQueryCapabilities)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(emptyScorers)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([]))),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
      onQuery(await request.json());
      return HttpResponse.json(traceQueryPage);
    }),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () => HttpResponse.json(emptyTraceQueryFields)),
    http.get(`${TEST_BASE_URL}/api/observability/traces`, () => HttpResponse.json(traceList)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(traceList)),
    http.get(`${TEST_BASE_URL}/api/observability/branches`, () => HttpResponse.json(branchList)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/tags`, () => HttpResponse.json(emptyTags)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/service-names`, () => HttpResponse.json(emptyServiceNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => HttpResponse.json(traceUsageBreakdown)),
  );
};

const renderPage = (search = '') =>
  renderWithProviders(
    <TestLinkProvider>
      <Routes>
        <Route
          path="/workflows/:workflowId/traces"
          element={
            <>
              <WorkflowTraces />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </TestLinkProvider>,
    { router: { initialEntries: [`/workflows/${WORKFLOW_ID}/traces${search}`] } },
  );

const getFilterChips = () => document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]');

beforeEach(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  window.localStorage.clear();
  window.localStorage.setItem(
    TRACE_COLUMN_STORAGE_KEY,
    serializeTraceColumnPreferences({ visibleColumns: ['inputTokens'], customColumns: [], metadataKeys: [] }),
  );
});

// See pages/traces/__tests__/index.msw.test.tsx: let the virtualizer's scroll debounce expire
// before jsdom is torn down.
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
});

describe('WorkflowTraces page', () => {
  describe('when the page is scoped to a workflow', () => {
    const renderScoped = async () => {
      const onQuery = vi.fn<(body: unknown) => void>();
      setHandlers(onQuery);
      const result = renderPage('?filterTraceId=trace-a');
      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toContain(`filterEntityId=${WORKFLOW_ID}`),
      );
      await waitFor(() => {
        expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
        expect(result.queryClient.isFetching()).toBe(0);
      });
      return { ...result, onQuery };
    };

    it('adds the workflow_run root entity type and the workflow id to the URL', async () => {
      await renderScoped();

      const search = screen.getByTestId('location').textContent;
      expect(search).toContain('rootEntityType=workflow_run');
      expect(search).toContain(`filterEntityId=${WORKFLOW_ID}`);
    });

    it('does not render chips for the scope fields', async () => {
      await renderScoped();

      expect([...getFilterChips()].slice(1).map(chip => chip.textContent)).toEqual(['Trace IDistrace-a']);
    });

    it('keeps the scope in the URL after Clear filters', async () => {
      await renderScoped();

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('filterTraceId'));
      const search = screen.getByTestId('location').textContent;
      expect(search).toContain(`filterEntityId=${WORKFLOW_ID}`);
      expect(search).toContain('rootEntityType=workflow_run');
    });

    it('sends the workflow entity filter in the trace query request', async () => {
      const { onQuery } = await renderScoped();

      const body = JSON.stringify(onQuery.mock.calls.at(-1)?.[0]);
      expect(body).toContain(JSON.stringify({ literal: WORKFLOW_ID }));
      expect(body).toContain(JSON.stringify({ literal: 'workflow_run' }));
    });
  });
});
