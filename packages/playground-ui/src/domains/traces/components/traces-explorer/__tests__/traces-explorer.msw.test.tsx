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
import { TracesExplorer } from '../index';
import { DEFAULT_TRACES_FILTERS, EMPTY_TRACES_SELECTION } from '../traces-explorer-actions';
import type { TracesFilters, TracesSelection, TracesSortDirection } from '../traces-explorer-actions';
import { useTracesConfig, useTracesFilters } from '../traces-explorer-context';
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
  const { filterBarFields } = useTracesConfig();
  const { filterBarValue, onFilterBarChange } = useTracesFilters();
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
  onSelectionChange?: (next: TracesSelection) => void;
  onFiltersChange?: (next: TracesFilters) => void;
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
  onSelectionChange,
  onFiltersChange,
}: HarnessProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [filters, setFilters] = useState(initialFilters);
  const [sortDirection, setSortDirection] = useState<TracesSortDirection>('desc');

  return (
    <TracesExplorer
      selection={selection}
      onSelectionChange={next => {
        onSelectionChange?.(next);
        setSelection(next);
      }}
      filters={filters}
      onFiltersChange={next => {
        onFiltersChange?.(next);
        setFilters(next);
      }}
      sortDirection={sortDirection}
      onSortDirectionChange={setSortDirection}
      scope={scope}
      metricsSupport={metricsSupport}
      features={features}
      initialFilters={baselineFilters}
    >
      <TracesExplorer.Layout
        actionRow={
          <div>
            {filterBar}
            <TracesExplorer.ColumnsMenu />
            <TracesExplorer.AutoRefresh />
          </div>
        }
      >
        <TracesExplorer.List />
        <TracesExplorer.Panel onOpenScore={() => {}} />
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

  describe('when a row is clicked', () => {
    it('emits the clicked trace as the next selection', async () => {
      setExplorerHandlers();
      const onSelectionChange = vi.fn<(next: TracesSelection) => void>();
      const { queryClient } = renderExplorer({ onSelectionChange });
      await settle(queryClient);

      fireEvent.click(traceRow('What is the weather in Paris'));

      expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ traceId: 'trace-weather' }));
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
      const onSelectionChange = vi.fn<(next: TracesSelection) => void>();
      const onFiltersChange = vi.fn<(next: TracesFilters) => void>();
      const { queryClient } = renderExplorer({
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
        onSelectionChange,
        onFiltersChange,
      });
      await settle(queryClient);
      await screen.findByRole('dialog', { name: 'Trace details' });

      fireEvent.click(within(getFilterChips()[0]).getByRole('button', { name: 'Value: Last 7 days', hidden: true }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours', hidden: true }));
      return { onSelectionChange, onFiltersChange };
    };

    it('emits the new filters', async () => {
      const { onFiltersChange } = await editDatePreset();

      expect(onFiltersChange).toHaveBeenLastCalledWith(expect.objectContaining({ datePreset: 'last-24h' }));
    });

    it('emits an empty selection', async () => {
      const { onSelectionChange } = await editDatePreset();

      expect(onSelectionChange).toHaveBeenLastCalledWith(EMPTY_TRACES_SELECTION);
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
      const onFiltersChange = vi.fn<(next: TracesFilters) => void>();
      const { queryClient } = renderExplorer({
        initialFilters: {
          ...DEFAULT_TRACES_FILTERS,
          datePreset: 'custom',
          dateFrom: new Date('2026-01-01T00:00:00Z'),
          dateTo: new Date('2026-01-02T00:00:00Z'),
        },
        onFiltersChange,
      });
      await settle(queryClient);

      fireEvent.click(within(getFilterChips()[0]).getByRole('button', { name: /^Value:/, hidden: true }));
      fireEvent.click(await screen.findByRole('button', { name: /Presets/, hidden: true }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours', hidden: true }));
      return { onFiltersChange };
    };

    it('keeps the preset', async () => {
      const { onFiltersChange } = await switchToPreset();

      expect(onFiltersChange).toHaveBeenLastCalledWith(expect.objectContaining({ datePreset: 'last-24h' }));
    });

    it('drops the custom dates', async () => {
      const { onFiltersChange } = await switchToPreset();

      const last = onFiltersChange.mock.calls.at(-1)?.[0];
      expect(last?.dateFrom).toBeUndefined();
      expect(last?.dateTo).toBeUndefined();
    });
  });

  describe('when a scope is given', () => {
    const renderScoped = async (onFiltersChange?: (next: TracesFilters) => void) => {
      setExplorerHandlers();
      const result = renderExplorer({
        scope: { entityId: 'weather-agent', entityType: 'agent' },
        initialFilters: {
          ...DEFAULT_TRACES_FILTERS,
          tokens: [...SCOPE_TOKENS, { fieldId: 'traceId', value: 'trace-a' }],
        },
        onFiltersChange,
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
      const onFiltersChange = vi.fn<(next: TracesFilters) => void>();
      await renderScoped(onFiltersChange);

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      expect(onFiltersChange.mock.calls.at(-1)?.[0].tokens).toEqual(SCOPE_TOKENS);
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
      const onSelectionChange = vi.fn<(next: TracesSelection) => void>();
      const toolbar = (
        <Profiler id="toolbar" onRender={onToolbarRender}>
          <TracesExplorer.FilterBar />
          <TracesExplorer.ColumnsMenu />
        </Profiler>
      );
      const { queryClient } = renderExplorer({
        filterBar: toolbar,
        onSelectionChange,
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
      });
      await settle(queryClient);
      const dialog = await screen.findByRole('dialog', { name: 'Trace details' });
      onToolbarRender.mockClear();

      fireEvent.click(within(dialog).getAllByRole('button', { name: /weather-agent/ })[0]);
      await waitFor(() =>
        expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ spanId: 'span-weather' })),
      );
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
