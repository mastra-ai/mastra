// @vitest-environment jsdom
import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Profiler, useState } from 'react';
import type { ReactNode } from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACES_LIST_REFETCH_INTERVAL_MS } from '../../../hooks/use-traces-list-source';
import { TRACE_FILTER_BAR_OPERATORS } from '../../../trace-filters';
import { serializeTraceColumnPreferences } from '../../../trace-list-columns';
import { TracesExplorer, useTracesFilterBar, useTracesFilterBarFields } from '../index';
import type { TracesExplorerLayoutProps, TracesExplorerPanelProps } from '../index';
import { DEFAULT_TRACES_FILTERS, EMPTY_TRACES_SELECTION } from '../traces-explorer-actions';
import type {
  TracesExplorerState,
  TracesFilters,
  TracesSelection,
  TracesSortDirection,
} from '../traces-explorer-actions';
import type { TracesExplorerFeatures } from '../traces-explorer-context';
import {
  emptyDatasets,
  emptyEntityNames,
  emptyEnvironments,
  emptyFeedback,
  emptyLightTraces,
  emptyScorers,
  emptyScores,
  emptyTraceQueryFields,
  emptyTracesPage,
  noRootDurationCapabilities,
  traceQueryCapabilities,
  twoTracesPage,
  weatherRootSpan,
  weatherTraceSpans,
  weatherTraceUsage,
} from './fixtures/traces-explorer';
import { FilterBar } from '@/ds/components/FilterBar';
import type { FilterBarExpression, FilterBarField } from '@/ds/components/FilterBar';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const TRACE_COLUMN_STORAGE_KEY = `mastra:traces:columns:${TEST_BASE_URL}:/api`;
const SCOPE_TOKENS: TracesFilters['tokens'] = [
  { fieldId: 'rootEntityType', value: 'agent' },
  { fieldId: 'entityId', value: 'weather-agent' },
];

const onTraceQuery = vi.fn<(body: unknown) => void>();
const onUsageRequest = vi.fn<() => void>();
const onHostFilterChange = vi.fn<(expression: FilterBarExpression) => void>();

const regionField: FilterBarField = { id: 'region', label: 'Region', operators: ['is'] };

/** A host bar: its own design-system FilterBar with an extra field, fed by the explorer hooks. */
function HostFilterBar() {
  const filterBarFields = useTracesFilterBarFields();
  const { filterBarValue, onFilterBarChange } = useTracesFilterBar();
  return (
    <FilterBar
      aria-label="Trace filters"
      fields={[regionField, ...filterBarFields]}
      operators={TRACE_FILTER_BAR_OPERATORS}
      value={{
        ...filterBarValue,
        nodes: [{ id: 'region', fieldId: 'region', operatorId: 'is', value: 'eu' }, ...filterBarValue.nodes],
      }}
      onValueChange={expression => {
        onHostFilterChange(expression);
        onFilterBarChange({ ...expression, nodes: expression.nodes.filter(node => node.id !== 'region') });
      }}
    >
      <TracesExplorer.FilterChips timeRange={<TracesExplorer.TimeRangeChip minDate={new Date(0)} />} />
    </FilterBar>
  );
}
const onFeedbackRequest = vi.fn<() => void>();
const onLightListRequest = vi.fn<() => void>();

type MetricsSupport = { supported: boolean; isLoading: boolean };
// Stable like the host's memoized value; an inline default would re-notify Config consumers on every harness render.
const METRICS_SUPPORTED: MetricsSupport = { supported: true, isLoading: false };

const setExplorerHandlers = (
  capabilities: GetObservabilityCapabilitiesResponse = traceQueryCapabilities,
  tracesPage = twoTracesPage,
) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
      onTraceQuery(await request.json());
      return HttpResponse.json(tracesPage);
    }),
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => {
      onLightListRequest();
      return HttpResponse.json(emptyLightTraces);
    }),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () => HttpResponse.json(emptyTraceQueryFields)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
    http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => {
      onFeedbackRequest();
      return HttpResponse.json(emptyFeedback);
    }),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(emptyScorers)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(emptyDatasets)),
    http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () => HttpResponse.json(emptyScores)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, () =>
      HttpResponse.json(weatherRootSpan),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(weatherTraceSpans)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => {
      onUsageRequest();
      return HttpResponse.json(weatherTraceUsage);
    }),
  );
};

type HarnessProps = {
  initialSelection?: TracesSelection;
  initialFilters?: TracesFilters;
  scope?: { entityId: string; entityType?: 'agent' };
  metricsSupport?: MetricsSupport;
  features?: TracesExplorerFeatures;
  /** The host's default filters, passed to the explorer as `initialFilters`. */
  baselineFilters?: TracesFilters;
  filterBar?: ReactNode;
  onChange?: (next: TracesExplorerState) => void;
  traceHref?: TracesExplorerPanelProps['traceHref'];
  renderError?: TracesExplorerLayoutProps['renderError'];
};

// Plain React state stands in for the host: no router, no search params.
function Harness({
  initialSelection = EMPTY_TRACES_SELECTION,
  initialFilters = DEFAULT_TRACES_FILTERS,
  scope,
  metricsSupport = METRICS_SUPPORTED,
  features,
  baselineFilters,
  filterBar = <TracesExplorer.FilterBar />,
  onChange,
  traceHref,
  renderError,
}: HarnessProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [filters, setFilters] = useState(initialFilters);
  const [sortDirection, setSortDirection] = useState<TracesSortDirection>('desc');

  return (
    <TracesExplorer
      selection={selection}
      filters={filters}
      onChange={next => {
        onChange?.(next);
        setSelection(next.selection);
        setFilters(next.filters);
      }}
      sortDirection={sortDirection}
      onSortDirectionChange={setSortDirection}
      scope={scope}
      metricsSupport={metricsSupport}
      features={features}
      initialFilters={baselineFilters}
    >
      <TracesExplorer.Layout
        renderError={renderError}
        actionRow={
          <div>
            {filterBar}
            <TracesExplorer.ColumnsMenu />
            <TracesExplorer.AutoRefresh />
          </div>
        }
      >
        <TracesExplorer.List />
        <TracesExplorer.Panel onOpenScore={() => {}} traceHref={traceHref} />
      </TracesExplorer.Layout>
    </TracesExplorer>
  );
}

const renderExplorer = (props: HarnessProps = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <Harness {...props} />
    </TestLinkProvider>,
  );

const settle = async (queryClient: { isFetching: () => number }) => {
  await waitFor(() => {
    expect(screen.queryByTestId('traces-page-skeleton')).toBeNull();
    expect(queryClient.isFetching()).toBe(0);
  });
};

const getFilterChips = () => [...document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]')];
const traceRow = (input: string) => screen.getByRole('button', { name: new RegExp(input) });
const traceDialog = () => screen.queryByRole('dialog', { name: 'Trace details' });

beforeAll(() => {
  // jsdom has no layout; without a sized scroll container the virtualizer renders no rows.
  class ResizeObserverStub {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      const size = [{ inlineSize: 1200, blockSize: 800 }];
      this.callback(
        [
          {
            target,
            contentRect: new DOMRect(0, 0, 1200, 800),
            borderBoxSize: size,
            contentBoxSize: size,
            devicePixelContentBoxSize: size,
          },
        ],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1200, 800));
  Element.prototype.getAnimations ??= () => [];
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    TRACE_COLUMN_STORAGE_KEY,
    serializeTraceColumnPreferences({ visibleColumns: ['input', 'inputTokens'], customColumns: [], metadataKeys: [] }),
  );
  onTraceQuery.mockClear();
  onUsageRequest.mockClear();
  onFeedbackRequest.mockClear();
  onLightListRequest.mockClear();
});

// The list virtualizer schedules a 150ms scroll debounce its cleanup never cancels; let it
// expire before jsdom is torn down.
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
});

describe('TracesExplorer', () => {
  describe('when the server lists traces', () => {
    it('renders a row per trace', async () => {
      setExplorerHandlers();

      renderExplorer();

      expect(await screen.findByText('What is the weather in Paris?')).toBeTruthy();
      expect(screen.getByText('Book a table for two')).toBeTruthy();
    });
  });

  describe('when the list request fails', () => {
    type ListResponse = 'ok' | 'fail' | 'hold';
    /** Answers successive list requests in order; a `hold` waits for `release`. The last entry repeats. */
    const respondInOrder = (responses: ListResponse[]) => {
      setExplorerHandlers();
      let release!: () => void;
      const held = new Promise<void>(resolve => (release = resolve));
      let calls = 0;
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async () => {
          const response = responses[Math.min(calls, responses.length - 1)];
          calls += 1;
          if (response === 'fail') return HttpResponse.json({ error: 'Service busy' }, { status: 503 });
          if (response === 'hold') await held;
          return HttpResponse.json(twoTracesPage);
        }),
      );
      return { release, listRequests: () => calls };
    };

    const hostError: TracesExplorerLayoutProps['renderError'] = ({ error, refetch, isFetching }) => (
      <div role="alert">
        <p>Host error: {error.message}</p>
        <button type="button" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? 'Retrying' : 'Retry'}
        </button>
      </div>
    );

    it('shows the default error state without a host renderer', async () => {
      respondInOrder(['fail']);

      renderExplorer();

      expect(await screen.findByText('Failed to load traces')).toBeTruthy();
    });

    it('shows the host error state instead of the default one', async () => {
      respondInOrder(['fail']);

      renderExplorer({ renderError: hostError });

      expect(await screen.findByText(/Host error:/)).toBeTruthy();
      expect(screen.queryByText('Failed to load traces')).toBeNull();
    });

    it('re-fetches the list on retry and recovers once it succeeds', async () => {
      const { listRequests } = respondInOrder(['fail', 'ok']);
      renderExplorer({ renderError: hostError });

      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

      expect(await screen.findByText('What is the weather in Paris?')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(listRequests()).toBe(2);
    });

    it('reports the retry as fetching when a refresh failed after traces loaded', async () => {
      const { release } = respondInOrder(['ok', 'fail', 'hold']);
      const { queryClient } = renderExplorer({ renderError: hostError });
      await screen.findByText('What is the weather in Paris?');
      await queryClient.refetchQueries({ queryKey: ['trace-query'] });

      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('button', { name: 'Retrying' })).toHaveProperty('disabled', true);
      release();
      expect(await screen.findByText('What is the weather in Paris?')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('when a trace is open', () => {
    const openTraceActions = async (traceHref?: TracesExplorerPanelProps['traceHref']) => {
      setExplorerHandlers();
      const { queryClient } = renderExplorer({
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
        traceHref,
      });
      await settle(queryClient);
      const dialog = await screen.findByRole('dialog', { name: 'Trace details' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Open trace actions' }));
      await screen.findByRole('menuitem', { name: 'Download trace JSON' });
    };

    it('links to the host trace page of the selected trace', async () => {
      await openTraceActions(traceId => `/observe/traces/${traceId}`);

      expect(screen.getByRole('menuitem', { name: 'Open trace page' }).getAttribute('href')).toBe(
        '/observe/traces/trace-weather',
      );
    });

    it('offers no trace page link without traceHref', async () => {
      await openTraceActions();

      expect(screen.queryByRole('menuitem', { name: 'Open trace page' })).toBeNull();
    });
  });

  describe('when a row is clicked', () => {
    it('emits the clicked trace as the next selection', async () => {
      setExplorerHandlers();
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      const { queryClient } = renderExplorer({ onChange });
      await settle(queryClient);

      fireEvent.click(traceRow('What is the weather in Paris'));

      expect(onChange.mock.calls.at(-1)?.[0].selection.traceId).toBe('trace-weather');
    });

    it('opens the trace details panel', async () => {
      setExplorerHandlers();
      const { queryClient } = renderExplorer();
      await settle(queryClient);

      fireEvent.click(traceRow('What is the weather in Paris'));

      expect(await screen.findByRole('dialog', { name: 'Trace details' })).toBeTruthy();
    });
  });

  describe('when a filter changes while a trace is open', () => {
    const editDatePreset = async () => {
      setExplorerHandlers();
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      const { queryClient } = renderExplorer({
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
        onChange,
      });
      await settle(queryClient);
      await screen.findByRole('dialog', { name: 'Trace details' });
      onChange.mockClear();

      fireEvent.click(within(getFilterChips()[0]).getByRole('button', { name: 'Value: Last 7 days', hidden: true }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours', hidden: true }));
      return { onChange };
    };

    it('emits the new filters and an empty selection in a single change', async () => {
      const { onChange } = await editDatePreset();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0]?.[0].filters).toEqual(expect.objectContaining({ datePreset: 'last-24h' }));
      expect(onChange.mock.calls[0]?.[0].selection).toEqual(EMPTY_TRACES_SELECTION);
    });

    it('closes the trace details panel', async () => {
      await editDatePreset();

      await waitFor(() => expect(traceDialog()).toBeNull());
    });
  });

  describe('when a custom range is switched to a preset', () => {
    // The picker reports the preset, then trailing `onDateChange` calls in the same handler.
    const switchToPreset = async () => {
      setExplorerHandlers();
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      const { queryClient } = renderExplorer({
        initialFilters: {
          ...DEFAULT_TRACES_FILTERS,
          datePreset: 'custom',
          dateFrom: new Date('2026-01-01T00:00:00Z'),
          dateTo: new Date('2026-01-02T00:00:00Z'),
        },
        onChange,
      });
      await settle(queryClient);

      fireEvent.click(within(getFilterChips()[0]).getByRole('button', { name: /^Value:/, hidden: true }));
      fireEvent.click(await screen.findByRole('button', { name: /Presets/, hidden: true }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours', hidden: true }));
      return { onChange };
    };

    it('keeps the preset', async () => {
      const { onChange } = await switchToPreset();

      expect(onChange.mock.calls.at(-1)?.[0].filters.datePreset).toBe('last-24h');
    });

    it('drops the custom dates', async () => {
      const { onChange } = await switchToPreset();

      const last = onChange.mock.calls.at(-1)?.[0].filters;
      expect(last?.dateFrom).toBeUndefined();
      expect(last?.dateTo).toBeUndefined();
    });
  });

  describe('when a scope is given', () => {
    const renderScoped = async (onChange?: (next: TracesExplorerState) => void) => {
      setExplorerHandlers();
      const result = renderExplorer({
        scope: { entityId: 'weather-agent', entityType: 'agent' },
        initialFilters: {
          ...DEFAULT_TRACES_FILTERS,
          tokens: [...SCOPE_TOKENS, { fieldId: 'traceId', value: 'trace-a' }],
        },
        onChange,
      });
      await settle(result.queryClient);
      return result;
    };

    it('does not render chips for the scope fields', async () => {
      await renderScoped();

      expect(
        getFilterChips()
          .slice(1)
          .map(chip => chip.textContent),
      ).toEqual(['Trace IDistrace-a']);
    });

    it('sends the scope predicate in the trace query', async () => {
      await renderScoped();

      expect(JSON.stringify(onTraceQuery.mock.calls.at(-1)?.[0])).toContain('weather-agent');
    });

    it('keeps the scope tokens after Clear filters', async () => {
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      await renderScoped(onChange);

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      expect(onChange.mock.calls.at(-1)?.[0].filters.tokens).toEqual(SCOPE_TOKENS);
    });
  });

  describe('when the server lacks root-duration support', () => {
    it('does not send a duration token in the trace query', async () => {
      setExplorerHandlers(noRootDurationCapabilities);

      const { queryClient } = renderExplorer({
        initialFilters: {
          ...DEFAULT_TRACES_FILTERS,
          tokens: [{ fieldId: 'durationMs', operatorId: 'gt', value: '1000' }],
        },
      });
      await settle(queryClient);

      expect(onTraceQuery).toHaveBeenCalled();
      expect(JSON.stringify(onTraceQuery.mock.calls.at(-1)?.[0])).not.toContain('durationMs');
    });

    describe('and a filter group holds a duration condition', () => {
      const durationGroup = {
        id: 'group-duration',
        logic: 'or' as const,
        nodes: [
          { fieldId: 'durationMs', operatorId: 'gt', value: '1000' },
          { fieldId: 'status', operatorId: 'is', value: 'error' },
        ],
      };
      const renderWithGroup = async (onChange?: (next: TracesExplorerState) => void) => {
        setExplorerHandlers(noRootDurationCapabilities);
        const rendered = renderExplorer({
          onChange,
          initialFilters: { ...DEFAULT_TRACES_FILTERS, groups: [durationGroup] },
        });
        await settle(rendered.queryClient);
        return rendered;
      };

      it('leaves the duration condition out of the trace query', async () => {
        await renderWithGroup();

        const body = JSON.stringify(onTraceQuery.mock.calls.at(-1)?.[0]);
        expect(body).not.toContain('durationMs');
        expect(body).toContain('error');
      });

      it('still shows the duration condition in the filter bar', async () => {
        await renderWithGroup();

        expect(screen.getByRole('group', { name: 'Advanced filter, 2 conditions' })).toBeTruthy();
      });

      it('keeps the group in the host value when another filter is edited', async () => {
        const onChange = vi.fn<(next: TracesExplorerState) => void>();
        await renderWithGroup(onChange);

        fireEvent.click(within(getFilterChips()[0]).getByRole('button', { name: 'Value: Last 7 days', hidden: true }));
        fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours', hidden: true }));

        expect(onChange.mock.calls.at(-1)?.[0].filters).toMatchObject({
          datePreset: 'last-24h',
          groups: [durationGroup],
        });
      });
    });
  });

  describe('when metricsSupport is unsupported', () => {
    const renderUnsupported = async () => {
      setExplorerHandlers();
      const result = renderExplorer({ metricsSupport: { supported: false, isLoading: false } });
      await settle(result.queryClient);
      return result;
    };

    it('does not render usage columns', async () => {
      await renderUnsupported();

      expect(screen.queryByText('Input tokens')).toBeNull();
    });

    it('does not request usage', async () => {
      await renderUnsupported();

      expect(onUsageRequest).not.toHaveBeenCalled();
    });

    it('explains why usage columns are unavailable in the columns menu', async () => {
      await renderUnsupported();

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      expect(await screen.findByText('This observability store does not support token and cost metrics.')).toBeTruthy();
    });
  });

  describe('when metricsSupport is loading', () => {
    const renderLoading = async () => {
      setExplorerHandlers();
      const result = renderExplorer({ metricsSupport: { supported: false, isLoading: true } });
      await settle(result.queryClient);
      return result;
    };

    it('tells the columns menu that usage support is being checked', async () => {
      await renderLoading();

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      expect(await screen.findByText('Checking whether this storage supports usage data.')).toBeTruthy();
    });

    it('does not request usage', async () => {
      await renderLoading();

      expect(onUsageRequest).not.toHaveBeenCalled();
    });
  });

  describe('when the selected trace is in the list', () => {
    it('shows its usage in the panel from the list usage request', async () => {
      setExplorerHandlers();

      const { queryClient } = renderExplorer({
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
      });
      await settle(queryClient);

      const dialog = await screen.findByRole('dialog', { name: 'Trace details' });
      await waitFor(() => expect(within(dialog).getByText('1.23K')).toBeTruthy());
      expect(onUsageRequest).toHaveBeenCalledTimes(1);
    });
  });
  describe('when the host turns the trace query API off', () => {
    const renderWithoutTraceQuery = async () => {
      setExplorerHandlers();
      const result = renderExplorer({ features: { traceQuery: false } });
      await settle(result.queryClient);
      return result;
    };

    it('lists traces through the legacy endpoint', async () => {
      await renderWithoutTraceQuery();

      expect(onLightListRequest).toHaveBeenCalled();
    });

    it('does not send a trace query', async () => {
      await renderWithoutTraceQuery();

      expect(onTraceQuery).not.toHaveBeenCalled();
    });
  });

  describe('when the host turns feedback off', () => {
    it('does not request feedback for the open trace', async () => {
      setExplorerHandlers();

      const { queryClient } = renderExplorer({
        features: { feedback: false },
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
      });
      await settle(queryClient);
      await screen.findByRole('dialog', { name: 'Trace details' });

      expect(onFeedbackRequest).not.toHaveBeenCalled();
    });
  });

  describe('when the filters match the host baseline', () => {
    it('reports no applied filters', async () => {
      setExplorerHandlers(traceQueryCapabilities, emptyTracesPage);
      const baseline: TracesFilters = { ...DEFAULT_TRACES_FILTERS, datePreset: 'last-24h' };

      const { queryClient } = renderExplorer({
        baselineFilters: baseline,
        initialFilters: baseline,
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
      });
      await settle(queryClient);

      expect(await screen.findByText('No traces found yet')).toBeTruthy();
    });
  });

  describe('when the host composes the time range chip with its own presets', () => {
    it('only offers those presets', async () => {
      setExplorerHandlers();
      const { queryClient } = renderExplorer({
        initialFilters: { ...DEFAULT_TRACES_FILTERS, datePreset: 'last-24h' },
        filterBar: (
          <TracesExplorer.FilterBar>
            <TracesExplorer.FilterChips
              timeRange={<TracesExplorer.TimeRangeChip presets={['last-24h', 'last-3d']} />}
            />
          </TracesExplorer.FilterBar>
        ),
      });
      await settle(queryClient);

      fireEvent.click(within(getFilterChips()[0]).getByRole('button', { name: 'Value: Last 24 hours', hidden: true }));

      const options = await screen.findAllByRole('menuitemradio', { hidden: true });
      expect(options.map(option => option.textContent)).toEqual(['Last 24 hours', 'Last 3 days']);
    });
  });

  describe('when the host renders its own filter chips', () => {
    it('renders the host chip for each filter', async () => {
      setExplorerHandlers();
      const { queryClient } = renderExplorer({
        initialFilters: { ...DEFAULT_TRACES_FILTERS, tokens: [{ fieldId: 'traceId', value: 'trace-a' }] },
        filterBar: (
          <TracesExplorer.FilterBar>
            <TracesExplorer.FilterChips renderChip={item => <span>host chip for {item.fieldId}</span>} />
          </TracesExplorer.FilterBar>
        ),
      });
      await settle(queryClient);

      expect(screen.getByText('host chip for traceId')).toBeTruthy();
    });
  });
  describe('when the host renders its own filter bar from the explorer hooks', () => {
    it('renders the host field next to the explorer chips', async () => {
      setExplorerHandlers();
      const { queryClient } = renderExplorer({
        initialFilters: { ...DEFAULT_TRACES_FILTERS, tokens: [{ fieldId: 'traceId', value: 'trace-a' }] },
        filterBar: <HostFilterBar />,
      });
      await settle(queryClient);

      expect(getFilterChips().map(chip => chip.textContent)).toEqual([
        expect.stringContaining('Region'),
        expect.stringContaining('Time'),
        expect.stringContaining('trace-a'),
      ]);
    });
  });

  describe('when a trace is opened', () => {
    it('does not re-render the filter bar or the columns menu', async () => {
      setExplorerHandlers();
      const onToolbarRender = vi.fn();
      const toolbar = (
        <Profiler id="toolbar" onRender={onToolbarRender}>
          <TracesExplorer.FilterBar />
          <TracesExplorer.ColumnsMenu />
        </Profiler>
      );
      const { queryClient } = renderExplorer({ filterBar: toolbar });
      await settle(queryClient);
      onToolbarRender.mockClear();

      fireEvent.click(traceRow('What is the weather in Paris'));
      await waitFor(() => expect(traceDialog()).toBeTruthy());
      await settle(queryClient);

      expect(onToolbarRender).not.toHaveBeenCalled();
    });
  });

  describe('when a trace is opened while the filters hold an entry the server cannot query', () => {
    it('does not re-render the filter bar or the columns menu', async () => {
      setExplorerHandlers();
      const onToolbarRender = vi.fn();
      const toolbar = (
        <Profiler id="toolbar" onRender={onToolbarRender}>
          <TracesExplorer.FilterBar />
          <TracesExplorer.ColumnsMenu />
        </Profiler>
      );
      const { queryClient } = renderExplorer({
        initialFilters: { ...DEFAULT_TRACES_FILTERS, tokens: [{ fieldId: 'status', value: 'running' }] },
        filterBar: toolbar,
      });
      await settle(queryClient);
      onToolbarRender.mockClear();

      fireEvent.click(traceRow('What is the weather in Paris'));
      await waitFor(() => expect(traceDialog()).toBeTruthy());
      await settle(queryClient);

      expect(onToolbarRender).not.toHaveBeenCalled();
    });
  });

  describe('when the list refetches the same traces', () => {
    it('does not re-render the filter bar or the columns menu', async () => {
      setExplorerHandlers();
      const onToolbarRender = vi.fn();
      const toolbar = (
        <Profiler id="toolbar" onRender={onToolbarRender}>
          <TracesExplorer.FilterBar />
          <TracesExplorer.ColumnsMenu />
        </Profiler>
      );
      const { queryClient } = renderExplorer({ filterBar: toolbar });
      await settle(queryClient);
      const queriesBefore = onTraceQuery.mock.calls.length;
      onToolbarRender.mockClear();

      await queryClient.refetchQueries();
      await settle(queryClient);

      expect(onTraceQuery.mock.calls.length).toBeGreaterThan(queriesBefore);
      expect(onToolbarRender).not.toHaveBeenCalled();
    });
  });

  describe('when a span is opened in the trace panel', () => {
    it('does not re-render the filter bar or the columns menu', async () => {
      setExplorerHandlers();
      const onToolbarRender = vi.fn();
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      const toolbar = (
        <Profiler id="toolbar" onRender={onToolbarRender}>
          <TracesExplorer.FilterBar />
          <TracesExplorer.ColumnsMenu />
        </Profiler>
      );
      const { queryClient } = renderExplorer({
        filterBar: toolbar,
        onChange,
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
      });
      await settle(queryClient);
      const dialog = await screen.findByRole('dialog', { name: 'Trace details' });
      onToolbarRender.mockClear();

      fireEvent.click(within(dialog).getAllByRole('button', { name: /weather-agent/ })[0]);
      await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0].selection.spanId).toBe('span-weather'));
      await settle(queryClient);

      expect(onToolbarRender).not.toHaveBeenCalled();
    });
  });

  describe('when the auto-refresh tick fires', () => {
    it('does not re-render the filter bar or the columns menu', async () => {
      setExplorerHandlers();
      // Only the poll interval is faked: MSW, React Query and waitFor keep real timeouts.
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const onToolbarRender = vi.fn();
      const toolbar = (
        <Profiler id="toolbar" onRender={onToolbarRender}>
          <TracesExplorer.FilterBar />
          <TracesExplorer.ColumnsMenu />
        </Profiler>
      );
      try {
        const { queryClient } = renderExplorer({ filterBar: toolbar });
        await settle(queryClient);
        const queriesBefore = onTraceQuery.mock.calls.length;
        onToolbarRender.mockClear();

        act(() => {
          vi.advanceTimersByTime(TRACES_LIST_REFETCH_INTERVAL_MS);
        });
        vi.useRealTimers();
        await waitFor(() => expect(onTraceQuery.mock.calls.length).toBeGreaterThan(queriesBefore));
        await settle(queryClient);

        expect(onToolbarRender).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
