// @vitest-environment jsdom
import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { Profiler, useState } from 'react';
import type { ReactNode } from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACE_FILTER_BAR_OPERATORS } from '../../../trace-filters';
import { serializeTraceColumnPreferences } from '../../../trace-list-columns';
import { TracesExplorer, useTracesConfig, useTracesFilterBar, useTracesFilterBarFields } from '../index';
import type { TracesExplorerLayoutProps, TracesExplorerPanelProps } from '../index';
import { DEFAULT_TRACES_FILTERS, DEFAULT_TRACES_SORT, EMPTY_TRACES_SELECTION } from '../traces-explorer-actions';
import type { TracesExplorerState, TracesFilters, TracesSelection, TracesSort } from '../traces-explorer-actions';
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
  idleDeltaBatch,
  noDeltaPollingCapabilities,
  noRootDurationCapabilities,
  noSpanQueryCapabilities,
  noThreadRowsCapabilities,
  noTimeToFirstChunkCapabilities,
  noTimeToFirstChunkSortCapabilities,
  streamedTracesPage,
  traceQueryCapabilities,
  twoTracesPage,
  weatherRootSpan,
  weatherTraceSpans,
  weatherTraceUsage,
  workflowTracesPage,
} from './fixtures/traces-explorer';
import {
  OBSERVABILITY_LIST_POLL_INTERVAL_MS,
  OBSERVABILITY_LIST_REFETCH_INTERVAL_MS,
} from '@/domains/observability/list-polling';
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

/** List (page) requests only; delta polls go to `onDeltaPoll`. */
const onTraceQuery = vi.fn<(body: unknown) => void>();
const onDeltaPoll = vi.fn<(body: unknown) => void>();

const isDeltaPoll = (body: unknown) => (body as { mode?: string } | null)?.mode === 'delta';
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
      const body = await request.json();
      if (isDeltaPoll(body)) {
        onDeltaPoll(body);
        return HttpResponse.json(idleDeltaBatch);
      }
      onTraceQuery(body);
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
  initialSort?: TracesSort;
  onSortChange?: (next: TracesSort) => void;
  traceHref?: TracesExplorerPanelProps['traceHref'];
  renderError?: TracesExplorerLayoutProps['renderError'];
  panelProps?: Partial<TracesExplorerPanelProps>;
};

// Stands in for the host's view switch, which offers each view only when its query API is on.
function ViewLinks() {
  const { withSpanQuery, withThreadQuery } = useTracesConfig();
  return (
    <>
      {withSpanQuery ? <a href="/spans">Spans view</a> : null}
      {withThreadQuery ? <a href="/threads">Threads view</a> : null}
    </>
  );
}

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
  initialSort = DEFAULT_TRACES_SORT,
  onSortChange,
  traceHref,
  renderError,
  panelProps,
}: HarnessProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<TracesSort>(initialSort);

  return (
    <TracesExplorer
      selection={selection}
      filters={filters}
      onChange={next => {
        onChange?.(next);
        setSelection(next.selection);
        setFilters(next.filters);
      }}
      sort={sort}
      onSortChange={next => {
        onSortChange?.(next);
        setSort(next);
      }}
      scope={scope}
      metricsSupport={metricsSupport}
      features={features}
      initialFilters={baselineFilters}
    >
      <TracesExplorer.Layout
        renderError={renderError}
        tabs={<ViewLinks />}
        actionRow={
          <div>
            {filterBar}
            <TracesExplorer.ColumnsMenu />
          </div>
        }
      >
        <TracesExplorer.List />
        <TracesExplorer.Panel onOpenScore={() => {}} traceHref={traceHref} {...panelProps} />
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
  // The virtualizer sizes its scroll container from clientWidth/clientHeight.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
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
  onDeltaPoll.mockClear();
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
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          if (isDeltaPoll(await request.json())) return HttpResponse.json(idleDeltaBatch);
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
    const openTrace = async (traceHref?: TracesExplorerPanelProps['traceHref']) => {
      setExplorerHandlers();
      const { queryClient } = renderExplorer({
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
        traceHref,
      });
      await settle(queryClient);
      const dialog = await screen.findByRole('dialog', { name: 'Trace details' });
      await within(dialog).findByRole('button', { name: 'Download trace JSON' });
      return dialog;
    };

    it('links to the host trace page of the selected trace', async () => {
      const dialog = await openTrace(traceId => `/observe/traces/${traceId}`);

      expect(within(dialog).getByRole('link', { name: 'Open trace page' }).getAttribute('href')).toBe(
        '/observe/traces/trace-weather',
      );
    });

    it('offers no trace page link without traceHref', async () => {
      const dialog = await openTrace();

      expect(within(dialog).queryByRole('link', { name: 'Open trace page' })).toBeNull();
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

  describe('when a trace opens, the drawer width follows its entity', () => {
    const openDrawerSize = async (tracesPage: typeof twoTracesPage) => {
      setExplorerHandlers(traceQueryCapabilities, tracesPage);
      const { queryClient } = renderExplorer();
      await settle(queryClient);

      fireEvent.click(traceRow('What is the weather in Paris'));

      const dialog = await screen.findByRole('dialog', { name: 'Trace details' });
      return dialog.closest('[data-slot="data-panel-popup"]')?.getAttribute('data-size');
    };

    it('opens an agent trace wide, to fit the Messages column', async () => {
      expect(await openDrawerSize(twoTracesPage)).toBe('wide');
    });

    it('opens a workflow trace at half width', async () => {
      expect(await openDrawerSize(workflowTracesPage)).toBe('half');
    });
  });

  describe('when a span opens, the drawer grows one size from its entity width', () => {
    const openSpanDrawerSize = async (tracesPage: typeof twoTracesPage) => {
      setExplorerHandlers(traceQueryCapabilities, tracesPage);
      const { queryClient } = renderExplorer({
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather', spanId: 'span-weather' },
      });
      await settle(queryClient);

      const dialog = await screen.findByRole('dialog', { name: 'Trace details' });
      return dialog.closest('[data-slot="data-panel-popup"]')?.getAttribute('data-size');
    };

    it('opens an agent trace full width', async () => {
      expect(await openSpanDrawerSize(twoTracesPage)).toBe('full');
    });

    it('opens a workflow trace wide', async () => {
      expect(await openSpanDrawerSize(workflowTracesPage)).toBe('wide');
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

  describe('when the stored columns include time to first chunk', () => {
    const renderWithTimeToFirstChunk = async (
      capabilities: GetObservabilityCapabilitiesResponse,
      props: HarnessProps = {},
    ) => {
      localStorage.setItem(
        TRACE_COLUMN_STORAGE_KEY,
        serializeTraceColumnPreferences({
          visibleColumns: ['input', 'timeToFirstChunk'],
          customColumns: [],
          metadataKeys: [],
        }),
      );
      setExplorerHandlers(capabilities, streamedTracesPage);
      const result = renderExplorer(props);
      await settle(result.queryClient);
      return result;
    };
    const requestedOrders = () => onTraceQuery.mock.calls.map(([body]) => (body as { orderBy?: unknown }).orderBy);

    it('shows how long each root took to stream its first chunk', async () => {
      await renderWithTimeToFirstChunk(traceQueryCapabilities);

      expect(screen.getByText('TTFC')).toBeTruthy();
      expect(within(traceRow('What is the weather in Paris?')).getByText('412ms')).toBeTruthy();
      expect(within(traceRow('Book a table for two')).queryByText(/ms$/)).toBeNull();
    });

    it('sorts the list by it, fastest first, when its header is clicked', async () => {
      await renderWithTimeToFirstChunk(traceQueryCapabilities);
      onTraceQuery.mockClear();

      fireEvent.click(screen.getByRole('button', { name: 'Time to first chunk, not sorted, sort ascending' }));

      await waitFor(() =>
        expect(onTraceQuery.mock.calls.at(-1)?.[0]).toMatchObject({
          orderBy: [{ field: 'timeToFirstChunkMs', direction: 'asc' }],
        }),
      );
      expect(
        screen.getByRole('button', { name: 'Time to first chunk, sorted ascending, sort descending' }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Start, not sorted, sort ascending' })).toBeTruthy();
    });

    it('flips to slowest first on a second click, and hands the order back to Start when Start is clicked', async () => {
      await renderWithTimeToFirstChunk(traceQueryCapabilities);

      fireEvent.click(screen.getByRole('button', { name: 'Time to first chunk, not sorted, sort ascending' }));
      fireEvent.click(
        await screen.findByRole('button', { name: 'Time to first chunk, sorted ascending, sort descending' }),
      );

      await waitFor(() =>
        expect(onTraceQuery.mock.calls.at(-1)?.[0]).toMatchObject({
          orderBy: [{ field: 'timeToFirstChunkMs', direction: 'desc' }],
        }),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Start, not sorted, sort ascending' }));

      await waitFor(() =>
        expect(onTraceQuery.mock.calls.at(-1)?.[0]).toMatchObject({
          orderBy: [{ field: 'startedAt', direction: 'asc' }],
        }),
      );
      expect(screen.getByRole('button', { name: 'Time to first chunk, not sorted, sort ascending' })).toBeTruthy();
    });

    describe('and the store records it but cannot sort by it', () => {
      it('shows the column without a sort control', async () => {
        await renderWithTimeToFirstChunk(noTimeToFirstChunkSortCapabilities);

        expect(screen.getByText('TTFC')).toBeTruthy();
        expect(within(traceRow('What is the weather in Paris?')).getByText('412ms')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Time to first chunk,/ })).toBeNull();
      });

      it("lists newest first instead of the host's sort, without rewriting it", async () => {
        const onSortChange = vi.fn<(next: TracesSort) => void>();
        await renderWithTimeToFirstChunk(noTimeToFirstChunkSortCapabilities, {
          initialSort: { field: 'timeToFirstChunkMs', direction: 'asc' },
          onSortChange,
        });

        expect(requestedOrders()).toEqual([[{ field: 'startedAt', direction: 'desc' }]]);
        expect(screen.getByRole('button', { name: 'Start, sorted descending, sort ascending' })).toBeTruthy();
        expect(onSortChange).not.toHaveBeenCalled();
      });
    });

    describe('and the host sorts by it while the column is hidden', () => {
      it("lists newest first instead of sorting by a column that isn't shown", async () => {
        localStorage.setItem(
          TRACE_COLUMN_STORAGE_KEY,
          serializeTraceColumnPreferences({ visibleColumns: ['input'], customColumns: [], metadataKeys: [] }),
        );
        setExplorerHandlers(traceQueryCapabilities, streamedTracesPage);
        const { queryClient } = renderExplorer({ initialSort: { field: 'timeToFirstChunkMs', direction: 'asc' } });
        await settle(queryClient);

        expect(requestedOrders()).toEqual([[{ field: 'startedAt', direction: 'desc' }]]);
        expect(screen.getByRole('button', { name: 'Start, sorted descending, sort ascending' })).toBeTruthy();
      });
    });

    describe('and the store does not record it', () => {
      it('drops the column rather than showing one that is always empty', async () => {
        await renderWithTimeToFirstChunk(noTimeToFirstChunkCapabilities);

        expect(screen.queryByText('TTFC')).toBeNull();
        expect(within(traceRow('What is the weather in Paris?')).queryByText('412ms')).toBeNull();
      });

      it('does not offer it in the columns menu', async () => {
        await renderWithTimeToFirstChunk(noTimeToFirstChunkCapabilities);

        fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

        expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
        expect(screen.queryByRole('menuitemcheckbox', { name: 'Time to first chunk' })).toBeNull();
      });

      it("lists newest first instead of the host's sort", async () => {
        await renderWithTimeToFirstChunk(noTimeToFirstChunkCapabilities, {
          initialSort: { field: 'timeToFirstChunkMs', direction: 'desc' },
        });

        expect(requestedOrders()).toEqual([[{ field: 'startedAt', direction: 'desc' }]]);
      });
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

  describe('when the server supports span queries and the host turns them on', () => {
    it('lets the host offer the spans view', async () => {
      setExplorerHandlers();

      const { queryClient } = renderExplorer({ features: { spanQuery: true } });
      await settle(queryClient);

      expect(screen.getByRole('link', { name: 'Spans view' })).toBeTruthy();
    });
  });

  describe('when the server does not support span queries', () => {
    it('keeps the spans view hidden', async () => {
      setExplorerHandlers(noSpanQueryCapabilities);

      const { queryClient } = renderExplorer({ features: { spanQuery: true } });
      await settle(queryClient);

      expect(screen.queryByRole('link', { name: 'Spans view' })).toBeNull();
    });
  });

  describe('when the host does not turn span queries on', () => {
    it('keeps the spans view hidden', async () => {
      setExplorerHandlers();

      const { queryClient } = renderExplorer();
      await settle(queryClient);

      expect(screen.queryByRole('link', { name: 'Spans view' })).toBeNull();
    });
  });

  describe('when the host turns the span query API off', () => {
    it('keeps the spans view hidden', async () => {
      setExplorerHandlers();

      const { queryClient } = renderExplorer({ features: { spanQuery: false } });
      await settle(queryClient);

      expect(screen.queryByRole('link', { name: 'Spans view' })).toBeNull();
    });
  });

  describe('when the server supports thread rows and the host turns thread queries on', () => {
    it('lets the host offer the threads view', async () => {
      setExplorerHandlers();

      const { queryClient } = renderExplorer({ features: { threadQuery: true } });
      await settle(queryClient);

      expect(screen.getByRole('link', { name: 'Threads view' })).toBeTruthy();
    });
  });

  describe('when the server does not support thread rows', () => {
    it('keeps the threads view hidden', async () => {
      setExplorerHandlers(noThreadRowsCapabilities);

      const { queryClient } = renderExplorer({ features: { threadQuery: true } });
      await settle(queryClient);

      expect(screen.queryByRole('link', { name: 'Threads view' })).toBeNull();
    });
  });

  describe('when the host does not turn thread queries on', () => {
    it('keeps the threads view hidden', async () => {
      setExplorerHandlers();

      const { queryClient } = renderExplorer({ features: { spanQuery: true } });
      await settle(queryClient);

      expect(screen.queryByRole('link', { name: 'Threads view' })).toBeNull();
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

  describe('the trace header actions', () => {
    const openTracePanel = async (panelProps?: Partial<TracesExplorerPanelProps>) => {
      setExplorerHandlers();
      const { queryClient } = renderExplorer({
        panelProps,
        initialSelection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-weather' },
      });
      const dialog = await screen.findByRole('dialog', { name: 'Trace details' });
      await settle(queryClient);
      return dialog;
    };

    it('offers adding the trace to a dataset by default', async () => {
      const dialog = await openTracePanel();

      expect(within(dialog).getByRole('button', { name: 'Add to dataset' })).toBeTruthy();
    });

    it('hides "Add to dataset" when the host turns it off', async () => {
      const dialog = await openTracePanel({ withAddTraceToDataset: false });

      expect(within(dialog).queryByRole('button', { name: 'Add to dataset' })).toBeNull();
      expect(within(dialog).getByRole('button', { name: 'Download trace JSON' })).toBeTruthy();
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

  describe.each([
    {
      server: 'polls deltas',
      capabilities: traceQueryCapabilities,
      tickRequests: onDeltaPoll,
      interval: OBSERVABILITY_LIST_POLL_INTERVAL_MS,
    },
    {
      server: 'reloads the list',
      capabilities: noDeltaPollingCapabilities,
      tickRequests: onTraceQuery,
      interval: OBSERVABILITY_LIST_REFETCH_INTERVAL_MS,
    },
  ])('when the auto-refresh tick fires and the explorer $server', ({ capabilities, tickRequests, interval }) => {
    it('does not re-render the filter bar or the columns menu', async () => {
      setExplorerHandlers(capabilities);
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
        const requestsBefore = tickRequests.mock.calls.length;
        onToolbarRender.mockClear();

        act(() => {
          vi.advanceTimersByTime(interval);
        });
        vi.useRealTimers();
        await waitFor(() => expect(tickRequests.mock.calls.length).toBeGreaterThan(requestsBefore));
        await settle(queryClient);

        expect(onToolbarRender).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('TracesExplorer.Layout', () => {
  const renderLayout = () =>
    renderWithProviders(
      <TestLinkProvider>
        <TracesExplorer
          selection={EMPTY_TRACES_SELECTION}
          filters={DEFAULT_TRACES_FILTERS}
          onChange={() => {}}
          sort={DEFAULT_TRACES_SORT}
          onSortChange={() => {}}
          metricsSupport={METRICS_SUPPORTED}
        >
          <TracesExplorer.Layout
            breadcrumbs={<span>Traces</span>}
            tabs={<nav aria-label="Views">Tabs</nav>}
            toolbar={
              <div role="toolbar" aria-label="Trace filters">
                <TracesExplorer.FilterBar />
              </div>
            }
          >
            <TracesExplorer.List />
          </TracesExplorer.Layout>
        </TracesExplorer>
      </TestLinkProvider>,
    );

  describe('when the traces have loaded', () => {
    it('pins the tabs above the page body', async () => {
      setExplorerHandlers();

      renderLayout();

      expect(await screen.findByText('What is the weather in Paris?')).toBeTruthy();
      const tabs = screen.getByRole('navigation', { name: 'Views' });
      expect(tabs.closest('main')).toBeNull();
      expect(tabs.closest('header')).toBeNull();
    });

    it('puts the toolbar in the page body, above the list', async () => {
      setExplorerHandlers();

      renderLayout();

      expect(await screen.findByText('What is the weather in Paris?')).toBeTruthy();
      const toolbar = screen.getByRole('toolbar', { name: 'Trace filters' });
      const main = screen.getByRole('main');
      expect(main.contains(toolbar)).toBe(true);
      const row = screen.getByText('What is the weather in Paris?');
      expect(toolbar.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('when the filter fields are still being discovered', () => {
    it('keeps the tabs and holds the toolbar behind the skeleton', async () => {
      setExplorerHandlers();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, async () => {
          await delay('infinite');
          return HttpResponse.json(emptyTraceQueryFields);
        }),
      );

      renderLayout();

      expect(await screen.findByTestId('traces-page-skeleton')).toBeTruthy();
      expect(screen.getByRole('navigation', { name: 'Views' })).toBeTruthy();
      expect(screen.queryByRole('toolbar', { name: 'Trace filters' })).toBeNull();
    });
  });

  describe('when the list request fails', () => {
    it('keeps the toolbar so the filters can still be changed', async () => {
      setExplorerHandlers();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () =>
          HttpResponse.json({ error: 'Bad filter' }, { status: 422 }),
        ),
      );

      renderLayout();

      expect(await screen.findByText('Failed to load traces')).toBeTruthy();
      expect(screen.getByRole('toolbar', { name: 'Trace filters' })).toBeTruthy();
    });
  });
});
