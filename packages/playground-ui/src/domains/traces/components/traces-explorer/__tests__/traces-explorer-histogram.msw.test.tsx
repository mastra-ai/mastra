// @vitest-environment jsdom
import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { planTraceAggregate, traceAggregateRequestSchema } from '@mastra/core/storage';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TracesExplorer } from '../index';
import { DEFAULT_TRACES_FILTERS, DEFAULT_TRACES_SORT, EMPTY_TRACES_SELECTION } from '../traces-explorer-actions';
import type { TracesFilters, TracesSort } from '../traces-explorer-actions';
import type { TracesExplorerFeatures } from '../traces-explorer-context';
import {
  emptyDatasets,
  emptyEntityNames,
  emptyEnvironments,
  emptyLightTraces,
  emptyTraceQueryFields,
  emptyTracesPage,
  idleDeltaBatch,
  traceAggregateCapabilities,
  traceAggregateError,
  traceCountsAggregate,
  traceQueryCapabilities,
  twoTracesPage,
  weatherTraceUsage,
} from './fixtures/traces-explorer';
import { useFixedChartSize } from '@/test/chart-size';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type RequestBody = { timeRange?: unknown; where?: unknown };

const onTraceQuery = vi.fn<(body: RequestBody) => void>();
const onAggregate = vi.fn<(body: RequestBody) => void>();

const isDeltaPoll = (body: unknown) => (body as { mode?: string } | null)?.mode === 'delta';

const ONE_WEEK: Pick<TracesFilters, 'datePreset' | 'dateFrom' | 'dateTo'> = {
  datePreset: 'custom',
  dateFrom: new Date('2026-10-20T00:00:00.000Z'),
  dateTo: new Date('2026-10-27T00:00:00.000Z'),
};
const FAILED_ONLY: TracesFilters['tokens'] = [{ fieldId: 'status', value: 'error' }];

type AggregateResponder = (request: {
  timeRange: { to: string };
}) => Response | ReturnType<typeof traceCountsAggregate>;

const setHandlers = ({
  capabilities = traceAggregateCapabilities,
  tracesPage = twoTracesPage,
  aggregate = request => traceCountsAggregate(request.timeRange),
}: {
  capabilities?: GetObservabilityCapabilitiesResponse;
  tracesPage?: typeof twoTracesPage;
  aggregate?: AggregateResponder;
} = {}) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
      const body = (await request.json()) as RequestBody;
      if (isDeltaPoll(body)) return HttpResponse.json(idleDeltaBatch);
      onTraceQuery(body);
      return HttpResponse.json(tracesPage);
    }),
    // Parsed and planned like the server does, so a request it would reject fails the test.
    http.post(`${TEST_BASE_URL}/api/observability/traces/aggregate`, async ({ request }) => {
      const body = (await request.json()) as RequestBody;
      onAggregate(body);
      const parsed = traceAggregateRequestSchema.safeParse(body);
      if (!parsed.success) return HttpResponse.json({ error: parsed.error.message }, { status: 400 });
      try {
        planTraceAggregate(parsed.data);
      } catch (error) {
        return HttpResponse.json({ error: String(error) }, { status: 400 });
      }
      const result = aggregate(parsed.data);
      return result instanceof Response ? result : HttpResponse.json(result);
    }),
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(emptyLightTraces)),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () => HttpResponse.json(emptyTraceQueryFields)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(emptyDatasets)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => HttpResponse.json(weatherTraceUsage)),
  );
};

const METRICS_SUPPORTED = { supported: true, isLoading: false };

// Plain React state stands in for the host; the button is a host control that narrows the filters.
function Harness({
  initialFilters = DEFAULT_TRACES_FILTERS,
  features,
}: {
  initialFilters?: TracesFilters;
  features?: TracesExplorerFeatures;
}) {
  const [selection, setSelection] = useState(EMPTY_TRACES_SELECTION);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<TracesSort>(DEFAULT_TRACES_SORT);
  return (
    <>
      <button type="button" onClick={() => setFilters(current => ({ ...current, tokens: FAILED_ONLY }))}>
        Only failed traces
      </button>
      <TracesExplorer
        selection={selection}
        filters={filters}
        onChange={next => {
          setSelection(next.selection);
          setFilters(next.filters);
        }}
        sort={sort}
        onSortChange={setSort}
        metricsSupport={METRICS_SUPPORTED}
        features={features}
      >
        <TracesExplorer.Body chart={<TracesExplorer.Histogram />}>
          <TracesExplorer.List />
        </TracesExplorer.Body>
      </TracesExplorer>
    </>
  );
}

const renderExplorer = async (props: Parameters<typeof Harness>[0] = {}) => {
  const result = renderWithProviders(
    <TestLinkProvider>
      <Harness {...props} />
    </TestLinkProvider>,
  );
  await settle(result.queryClient);
  return result;
};

const settle = async (queryClient: { isFetching: () => number }) => {
  await waitFor(() => {
    expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
    expect(queryClient.isFetching()).toBe(0);
  });
};

const chart = () => screen.queryByRole('region', { name: 'Traces over time' });
const lastBody = (spy: typeof onAggregate) => spy.mock.calls.at(-1)?.[0];

beforeAll(() => {
  Element.prototype.getAnimations ??= () => [];
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  localStorage.clear();
  onTraceQuery.mockClear();
  onAggregate.mockClear();
});

describe('TracesExplorer.Histogram', () => {
  useFixedChartSize(1200, 800);

  describe('when the server cannot aggregate traces', () => {
    it('does not render the chart', async () => {
      setHandlers({ capabilities: traceQueryCapabilities });
      await renderExplorer();

      expect(screen.getByText('What is the weather in Paris?')).toBeTruthy();
      expect(chart()).toBeNull();
    });

    it('never calls the aggregate endpoint', async () => {
      setHandlers({ capabilities: traceQueryCapabilities });
      await renderExplorer();

      expect(onAggregate).not.toHaveBeenCalled();
    });
  });

  describe('when the host turns the trace query API off', () => {
    it('does not render the chart', async () => {
      setHandlers();
      await renderExplorer({ features: { traceQuery: false } });

      expect(chart()).toBeNull();
      expect(onAggregate).not.toHaveBeenCalled();
    });
  });

  describe('when the server aggregates traces', () => {
    it('shows trace and error totals', async () => {
      setHandlers();
      await renderExplorer();

      const region = await screen.findByRole('region', { name: 'Traces over time' });
      await waitFor(() => expect(within(region).getByText('8 traces · 2 errors')).toBeTruthy());
    });

    it('sends the same time range and filters as the list query', async () => {
      setHandlers();
      await renderExplorer({ initialFilters: { ...DEFAULT_TRACES_FILTERS, ...ONE_WEEK, tokens: FAILED_ONLY } });

      const list = lastBody(onTraceQuery);
      const aggregate = lastBody(onAggregate);
      expect(aggregate?.where).toBeDefined();
      expect(aggregate?.where).toEqual(list?.where);
      expect(aggregate?.timeRange).toEqual(list?.timeRange);
    });
  });

  describe('when the host narrows the filters', () => {
    it('refetches the chart with the new filters', async () => {
      setHandlers();
      const { queryClient } = await renderExplorer({ initialFilters: { ...DEFAULT_TRACES_FILTERS, ...ONE_WEEK } });
      expect(lastBody(onAggregate)?.where).toBeUndefined();

      fireEvent.click(screen.getByRole('button', { name: 'Only failed traces' }));
      await settle(queryClient);

      expect(lastBody(onAggregate)?.where).toBeDefined();
      expect(lastBody(onAggregate)?.where).toEqual(lastBody(onTraceQuery)?.where);
    });
  });

  // The server query can't express `running`, so the chart would count traces the user filtered out.
  describe('when the running status is selected', () => {
    it('does not render the chart', async () => {
      setHandlers();
      await renderExplorer({
        initialFilters: { ...DEFAULT_TRACES_FILTERS, tokens: [{ fieldId: 'status', value: 'running' }] },
      });

      expect(chart()).toBeNull();
      expect(onAggregate).not.toHaveBeenCalled();
    });

    it('does not render the chart when running is one of several statuses', async () => {
      setHandlers();
      await renderExplorer({
        initialFilters: {
          ...DEFAULT_TRACES_FILTERS,
          tokens: [{ fieldId: 'status', value: ['error', 'running'], operatorId: 'in' }],
        },
      });

      expect(chart()).toBeNull();
      expect(onAggregate).not.toHaveBeenCalled();
    });

    it('does not render the chart when running sits inside a filter group', async () => {
      setHandlers();
      await renderExplorer({
        initialFilters: {
          ...DEFAULT_TRACES_FILTERS,
          groups: [
            {
              id: 'group-1',
              logic: 'or',
              nodes: [
                { id: 'token-1', fieldId: 'status', value: 'running' },
                { id: 'token-2', fieldId: 'status', value: 'error' },
              ],
            },
          ],
        },
      });

      expect(chart()).toBeNull();
      expect(onAggregate).not.toHaveBeenCalled();
    });
  });

  describe('when the custom range is wider than the server aggregates', () => {
    it('does not render the chart', async () => {
      setHandlers();
      await renderExplorer({
        initialFilters: {
          ...DEFAULT_TRACES_FILTERS,
          datePreset: 'custom',
          dateFrom: new Date('2025-01-01T00:00:00.000Z'),
          dateTo: new Date('2026-10-27T00:00:00.000Z'),
        },
      });

      expect(screen.getByText('What is the weather in Paris?')).toBeTruthy();
      expect(chart()).toBeNull();
      expect(onAggregate).not.toHaveBeenCalled();
    });
  });

  describe('when the aggregate request fails', () => {
    const renderFailing = () =>
      setHandlers({ aggregate: () => HttpResponse.json(traceAggregateError, { status: 400 }) });

    it('shows an inline error in the chart', async () => {
      renderFailing();
      await renderExplorer();

      const region = await screen.findByRole('region', { name: 'Traces over time' });
      expect(within(region).getByText("Couldn't load the chart.")).toBeTruthy();
    });

    it('still lists the traces', async () => {
      renderFailing();
      await renderExplorer();

      expect(screen.getByText('What is the weather in Paris?')).toBeTruthy();
    });
  });

  describe('when there are no traces and no filters', () => {
    it('shows the empty state without the chart', async () => {
      setHandlers({ tracesPage: emptyTracesPage });
      await renderExplorer();

      expect(screen.getByRole('heading', { name: 'No traces for the last 7 days' })).toBeTruthy();
      expect(chart()).toBeNull();
    });
  });
});
