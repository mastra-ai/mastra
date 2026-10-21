import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { http, HttpResponse } from 'msw';
import type { ComponentProps, ReactNode } from 'react';
import { afterAll, beforeEach } from 'vitest';
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
import { TestLinkProvider } from '@/test/link-provider';
import { LocationProbe } from '@/test/location-probe';
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

/** Renders the traces page on a data router (it blocks navigation), with `children` beside it. */
export const renderTracesPage = (
  initialEntry = '/traces',
  props: ComponentProps<typeof TracesPage> = {},
  children?: ReactNode,
) =>
  renderWithProviders(
    <TestLinkProvider>
      <TracesPage {...props} />
      <LocationProbe />
      {children}
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry], dataRouter: true } },
  );

/** jsdom stubs the traces page needs, and the teardown wait its list virtualizer needs. Call at the top of a test file. */
export function registerTracesPageTestHooks() {
  beforeEach(() => {
    // jsdom has no scrollIntoView; the timeline reveals the selected span row on mount.
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
    // jsdom ships no PointerEvent, and Base UI constructs one on press.
    if (typeof window.PointerEvent === 'undefined') {
      class PointerEventStub extends MouseEvent {}
      Object.defineProperty(window, 'PointerEvent', { configurable: true, value: PointerEventStub });
    }
  });

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
}
