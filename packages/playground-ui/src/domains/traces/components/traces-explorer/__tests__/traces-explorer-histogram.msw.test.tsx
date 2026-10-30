// @vitest-environment jsdom
import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { planTraceAggregate, traceAggregateRequestSchema } from '@mastra/core/storage';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
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

type RequestBody = { timeRange?: { from: string; to?: string }; where?: unknown };

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
        <TracesExplorer.FilterBar />
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

// ONE_WEEK in UTC is 84 two-hour bars from Oct 20 00:00, sharing the 1200px plot.
const BAR_WIDTH = 1200 / 84;
const atBar = (bar: number) => ({ clientX: (bar + 0.5) * BAR_WIDTH, clientY: 20 });
/** Recharts applies pointer moves on the next animation frame. */
const moveTo = async (plot: Element, bar: number) => {
  fireEvent.mouseMove(plot, atBar(bar));
  await act(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));
};
const dragAcross = async (from: number, to: number) => {
  const plot = (await screen.findByRole('region', { name: 'Traces over time' })).querySelector('.recharts-wrapper');
  if (!plot) throw new Error('chart did not render');
  await moveTo(plot, from);
  fireEvent.mouseDown(plot, atBar(from));
  await moveTo(plot, to);
  fireEvent.mouseUp(window);
};
const clickBar = async (bar: number) => {
  const plot = (await screen.findByRole('region', { name: 'Traces over time' })).querySelector('.recharts-wrapper');
  if (!plot) throw new Error('chart did not render');
  await moveTo(plot, bar);
  fireEvent.mouseDown(plot, atBar(bar));
  fireEvent.mouseUp(plot, atBar(bar));
  fireEvent.click(plot, atBar(bar));
};
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

  describe('when the user drags across bars', () => {
    it('narrows the list and the chart to the dragged bars', async () => {
      setHandlers();
      const { queryClient } = await renderExplorer({ initialFilters: { ...DEFAULT_TRACES_FILTERS, ...ONE_WEEK } });

      // Bars 12 to 23 are Oct 21, 00:00 to 22:00, so the window runs to the next bar at Oct 22 00:00.
      await dragAcross(12, 23);
      await settle(queryClient);

      const zoomed = { from: '2026-10-21T00:00:00.000Z', to: '2026-10-22T00:00:00.000Z' };
      expect(lastBody(onTraceQuery)?.timeRange).toEqual(zoomed);
      expect(lastBody(onAggregate)?.timeRange).toEqual(zoomed);
    });
  });

  describe('when the user clicks a bar', () => {
    it('narrows the list and the chart to that bar', async () => {
      setHandlers();
      const { queryClient } = await renderExplorer({ initialFilters: { ...DEFAULT_TRACES_FILTERS, ...ONE_WEEK } });

      // Bar 12 is Oct 21, 00:00 to 02:00.
      await clickBar(12);
      await settle(queryClient);

      const zoomed = { from: '2026-10-21T00:00:00.000Z', to: '2026-10-21T02:00:00.000Z' };
      expect(lastBody(onTraceQuery)?.timeRange).toEqual(zoomed);
      expect(lastBody(onAggregate)?.timeRange).toEqual(zoomed);
    });

    it('returns to the range from before the click on reset', async () => {
      setHandlers();
      const { queryClient } = await renderExplorer({ initialFilters: { ...DEFAULT_TRACES_FILTERS, ...ONE_WEEK } });
      await clickBar(12);
      await settle(queryClient);

      fireEvent.click(screen.getByRole('button', { name: 'Reset time range' }));
      await settle(queryClient);

      expect(lastBody(onTraceQuery)?.timeRange).toEqual({
        from: '2026-10-20T00:00:00.000Z',
        to: '2026-10-27T00:00:00.000Z',
      });
    });
  });

  describe('when the user resets the time range after dragging', () => {
    const ONE_WEEK_RANGE = { from: '2026-10-20T00:00:00.000Z', to: '2026-10-27T00:00:00.000Z' };
    const resetTimeRange = () => fireEvent.click(screen.getByRole('button', { name: 'Reset time range' }));

    it('returns to the custom range from before the zoom', async () => {
      setHandlers();
      const { queryClient } = await renderExplorer({ initialFilters: { ...DEFAULT_TRACES_FILTERS, ...ONE_WEEK } });
      await dragAcross(12, 23);
      await settle(queryClient);

      resetTimeRange();
      await settle(queryClient);

      expect(lastBody(onTraceQuery)?.timeRange).toEqual(ONE_WEEK_RANGE);
      expect(lastBody(onAggregate)?.timeRange).toEqual(ONE_WEEK_RANGE);
    });

    it('returns to the range from before the first of several zooms', async () => {
      setHandlers();
      const { queryClient } = await renderExplorer({ initialFilters: { ...DEFAULT_TRACES_FILTERS, ...ONE_WEEK } });
      await dragAcross(12, 23);
      await settle(queryClient);
      await dragAcross(0, 1);
      await settle(queryClient);
      expect(lastBody(onTraceQuery)?.timeRange).not.toEqual({
        from: '2026-10-21T00:00:00.000Z',
        to: '2026-10-22T00:00:00.000Z',
      });

      resetTimeRange();
      await settle(queryClient);

      expect(lastBody(onTraceQuery)?.timeRange).toEqual(ONE_WEEK_RANGE);
    });

    it('returns to the rolling preset from before the zoom', async () => {
      setHandlers();
      const { queryClient } = await renderExplorer({
        initialFilters: { ...DEFAULT_TRACES_FILTERS, datePreset: 'last-14d' },
      });
      await dragAcross(12, 23);
      await settle(queryClient);
      expect(screen.queryByRole('button', { name: 'Value: Last 14 days' })).toBeNull();

      resetTimeRange();
      await settle(queryClient);

      expect(screen.getByRole('button', { name: 'Value: Last 14 days' })).toBeTruthy();
      const from = lastBody(onTraceQuery)?.timeRange?.from ?? '';
      expect(Math.round((Date.now() - Date.parse(from)) / (24 * 60 * 60 * 1000))).toBe(14);
    });

    it('resets to the default preset once the zoom is undone', async () => {
      setHandlers();
      const { queryClient } = await renderExplorer({ initialFilters: { ...DEFAULT_TRACES_FILTERS, ...ONE_WEEK } });
      await dragAcross(12, 23);
      await settle(queryClient);
      resetTimeRange();
      await settle(queryClient);

      resetTimeRange();
      await settle(queryClient);

      expect(screen.getByRole('button', { name: 'Value: Last 7 days' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Reset time range' })).toBeNull();
    });

    describe('when the user picked a range by hand after zooming', () => {
      const openRangeEditor = () =>
        fireEvent.click(screen.getByRole('button', { name: /^Value: Oct 21/, hidden: true }));
      const pickTimePart = async (time: string, part: string, value: string) => {
        const group = screen.getByRole('group', { name: time, hidden: true });
        const select = within(group).getByRole('combobox', { name: part, hidden: true });
        fireEvent.click(select);
        // Base UI only commits a pick on a real press: pointerdown followed by click.
        const option = await screen.findByRole('option', { name: value, hidden: true });
        fireEvent.pointerDown(option);
        fireEvent.click(option);
        await waitFor(() => expect(select.textContent).toBe(value));
      };
      const apply = () => fireEvent.click(screen.getByRole('button', { name: /apply/i, hidden: true }));

      it('resets to the default preset even when that range matches the zoom', async () => {
        setHandlers();
        const { queryClient } = await renderExplorer({ initialFilters: { ...DEFAULT_TRACES_FILTERS, ...ONE_WEEK } });
        const zoomed = { from: '2026-10-21T00:00:00.000Z', to: '2026-10-22T00:00:00.000Z' };
        await dragAcross(12, 23);
        await settle(queryClient);

        // The editor opens on the zoomed days, ending at 11:59 PM: another range.
        openRangeEditor();
        apply();
        await settle(queryClient);
        expect(lastBody(onTraceQuery)?.timeRange).toEqual({ ...zoomed, to: '2026-10-22T23:59:00.000Z' });

        // Ending at 12:00 AM instead picks the zoomed bounds again.
        openRangeEditor();
        await pickTimePart('End time', 'Hour', '12');
        await pickTimePart('End time', 'Minute', '00');
        await pickTimePart('End time', 'AM or PM', 'AM');
        apply();
        await settle(queryClient);
        expect(lastBody(onTraceQuery)?.timeRange).toEqual(zoomed);

        resetTimeRange();
        await settle(queryClient);

        expect(screen.getByRole('button', { name: 'Value: Last 7 days' })).toBeTruthy();
      });
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
