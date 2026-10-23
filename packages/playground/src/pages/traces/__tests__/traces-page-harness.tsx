import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { http, HttpResponse } from 'msw';
import type { ComponentProps, ReactNode } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router';
import TracesPage from '..';
import { emptySavedViews } from './fixtures/saved-views';
import { emptyTraceQueryFields, traceQueryCapabilities, traceQueryPage } from './fixtures/trace-query';
import {
  branchList,
  emptyEntityNames,
  emptyEnvironments,
  emptyScorers,
  emptyServiceNames,
  emptyTags,
  emptyTraceSpanScores,
  traceList,
  traceSpans,
  traceUsageBreakdown,
} from './fixtures/traces';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { ObservabilityLayout } from '@/domains/observability/observability-layout';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

/** Every endpoint the traces page reads, with no saved views. Register a test's own handlers after it. */
export const setTracePageHandlers = (
  capabilities: GetObservabilityCapabilitiesResponse = traceQueryCapabilities,
  { onBreakdownRequest }: { onBreakdownRequest?: () => void } = {},
) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(emptyScorers)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([]))),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () => HttpResponse.json(traceQueryPage)),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () => HttpResponse.json(emptyTraceQueryFields)),
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
      onBreakdownRequest?.();
      return HttpResponse.json(traceUsageBreakdown);
    }),
    http.get(`${TEST_BASE_URL}/api/saved-views`, () => HttpResponse.json(emptySavedViews)),
  );
};

/**
 * Renders the traces page on a data router (it blocks navigation), with `children` beside it, and
 * the router's search params and pathname in `data-testid="location"` and `data-testid="pathname"`
 * to assert what the URL holds. Unscoped, the page sits in the shared observability layout as on /traces.
 */
export const renderTracesPage = (
  initialEntry = '/traces',
  props: ComponentProps<typeof TracesPage> = {},
  children?: ReactNode,
) => {
  const LocationProbe = () => {
    const location = useLocation();
    return (
      <>
        <div data-testid="location">{location.search}</div>
        <div data-testid="pathname">{location.pathname}</div>
      </>
    );
  };
  return renderWithProviders(
    <TestLinkProvider>
      {props.scopedEntityId ? (
        // Scoped traces live inside an agent/workflow tab, which owns its own header.
        <TracesPage {...props} />
      ) : (
        <Routes>
          <Route
            element={
              <ObservabilityLayout>
                <Outlet />
              </ObservabilityLayout>
            }
          >
            <Route path="/traces" element={<TracesPage {...props} />} />
          </Route>
        </Routes>
      )}
      <LocationProbe />
      {children}
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry], dataRouter: true } },
  );
};
