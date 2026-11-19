// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { forwardRef, useState } from 'react';
import type { ReactNode } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TRACE_COLUMN_CATALOGS } from '../../../trace-list-columns';
import type { TraceColumnPreferences } from '../../../trace-list-columns';
import type { TraceNavigation } from '../../trace-navigation';
import { toTracesListViewTraces } from '../../traces-list-view-adapter';
import { TracesExplorer } from '../index';
import type {
  TracesExplorerCapabilities,
  TracesExplorerDiscovery,
  TracesExplorerFilterSuggestions,
  TracesExplorerHistogram,
  TracesExplorerOpenTrace,
  TracesExplorerPanelProps,
  TracesExplorerRootProps,
  TracesExplorerState,
  TracesExplorerTraces,
  TracesSort,
} from '../index';
import { DEFAULT_TRACES_FILTERS, DEFAULT_TRACES_SORT, EMPTY_TRACES_SELECTION } from '../traces-explorer-actions';
import { traceAggregateCapabilities, traceCountsAggregate, traceQueryCapabilities } from './fixtures/traces-explorer';
import { TRACE_THREAD_ID, TRACE_THREAD_ITEM_ID, travelTrace, travelTracesPage } from './fixtures/traces-page';
import { buildScore } from '@/domains/scores/components/__tests__/fixtures/trace-scores';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProps, LinkComponentProviderProps } from '@/lib/framework';
import { recordRequests } from '@/test/record-requests';

/*
 * The whole traces page (filters, columns, histogram, list, trace panel) composed by an app that is not
 * Studio, e.g. an MCP server app with its own transport: no Mastra client, no React Query, no router, no
 * provider at all. Every record comes from the app, typed by `@mastra/client-js`; every action goes back
 * to it through a callback. A part that fetched, linked, or needed a Studio provider fails here.
 */

const WINDOW = { from: '2026-08-24T12:00:00.000Z', to: '2026-08-31T12:00:00.000Z' };
const METRICS = { supported: true, isLoading: false };
const FEATURES = { spanQuery: true, threadQuery: true };
const COLUMNS: TraceColumnPreferences = TRACE_COLUMN_CATALOGS.traces.defaults;
const APP_SUGGESTIONS: TracesExplorerFilterSuggestions = {
  rootEntityNames: ['Travel Agent'],
  environments: ['production'],
};

/** What the app loaded, as its own queries return it. */
type AppData = {
  capabilities: TracesExplorerCapabilities;
  traces: TracesExplorerTraces;
  discovery: TracesExplorerDiscovery;
  histogram?: TracesExplorerHistogram;
  openTrace: TracesExplorerOpenTrace;
};

const appData = (overrides: Partial<AppData> = {}): AppData => ({
  capabilities: { data: traceAggregateCapabilities, isLoading: false },
  traces: {
    rows: toTracesListViewTraces(travelTracesPage.traces),
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
  },
  discovery: { fields: [], canonicalFields: [], isLoading: false },
  histogram: {
    timeRange: WINDOW,
    rows: traceCountsAggregate(WINDOW).rows,
    isLoading: false,
    isError: false,
    isUpdating: false,
  },
  openTrace: { spans: travelTrace.spans, isLoading: false, fullTrace: { spans: travelTrace.spans, isLoading: false } },
  ...overrides,
});

/** Where the app opens things: its own callbacks, no Studio route, no link component. */
const appNavigation = (): Required<TraceNavigation> => ({
  onOpenTrace: vi.fn(),
  onOpenAgent: vi.fn(),
  onOpenWorkflow: vi.fn(),
  onOpenTool: vi.fn(),
  onOpenWorkspace: vi.fn(),
  onOpenKnowledgePage: vi.fn(),
});

type AppProps = {
  data?: AppData;
  initialTraceId?: string;
  initialSpanId?: string;
  initialScoreId?: string;
  feedbackOptions?: TracesExplorerRootProps['feedbackOptions'];
  /** The filter bar's suggestions; defaults to the app's entity names and environments. */
  suggestions?: TracesExplorerFilterSuggestions;
  onChange?: (next: TracesExplorerState) => void;
  onSortChange?: (next: TracesSort) => void;
  onColumnsChange?: (next: TraceColumnPreferences) => void;
  panel?: Partial<TracesExplorerPanelProps>;
};

/** The app: plain React state for what the explorer reports, its own data for what it draws. */
function AppTracesPage({
  data = appData(),
  initialTraceId,
  initialSpanId,
  initialScoreId,
  feedbackOptions,
  suggestions = APP_SUGGESTIONS,
  onChange,
  onSortChange,
  onColumnsChange,
  panel,
}: AppProps) {
  const [state, setState] = useState<TracesExplorerState>({
    selection: { ...EMPTY_TRACES_SELECTION, traceId: initialTraceId, spanId: initialSpanId, scoreId: initialScoreId },
    filters: DEFAULT_TRACES_FILTERS,
  });
  const [sort, setSort] = useState(DEFAULT_TRACES_SORT);
  const [columns, setColumns] = useState(COLUMNS);
  const isOpen = !!state.selection.traceId;

  return (
    <TracesExplorer
      selection={state.selection}
      filters={state.filters}
      onChange={next => {
        onChange?.(next);
        setState(next);
      }}
      sort={sort}
      onSortChange={next => {
        onSortChange?.(next);
        setSort(next);
      }}
      columns={columns}
      onColumnsChange={next => {
        onColumnsChange?.(next);
        setColumns(next);
      }}
      capabilities={data.capabilities}
      traces={data.traces}
      discovery={data.discovery}
      metricsSupport={METRICS}
      features={FEATURES}
      feedbackOptions={feedbackOptions}
    >
      <TracesExplorer.Body
        toolbar={
          <>
            <TracesExplorer.FilterBar suggestions={suggestions} />
            <TracesExplorer.ColumnsMenu />
          </>
        }
        chart={<TracesExplorer.Histogram data={data.histogram} />}
      >
        <TracesExplorer.List usage={new Map([[TRACE_THREAD_ITEM_ID, { inputTokens: 1200, outputTokens: 34 }]])} />
        <TracesExplorer.Panel trace={isOpen ? data.openTrace : undefined} {...panel} />
      </TracesExplorer.Body>
    </TracesExplorer>
  );
}

/** Studio's link provider, rigged to throw the moment a part draws a link, builds a route or navigates through it. */
function StudioLinkTripwire({ children }: { children: ReactNode }) {
  const trip = (what: string) => () => {
    throw new Error(`A traces page part used Studio's link provider: ${what}`);
  };
  // Every route the provider could build trips the wire.
  const paths: LinkComponentProviderProps['paths'] = new Proxy(Object.create(null), {
    get: (_, route) => trip(`paths.${String(route)}`),
  });
  const Link = forwardRef<HTMLAnchorElement, LinkComponentProps>(function TrippedLink() {
    return trip('Link')();
  });
  return (
    <LinkComponentProvider Link={Link} navigate={trip('navigate')} paths={paths}>
      {children}
    </LinkComponentProvider>
  );
}

/** The end of the list is always in view, so the list asks for the next page as soon as it has one. */
class EndOfListInView implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds = [];
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const rect = target.getBoundingClientRect();
    this.callback(
      [
        {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: rect,
          intersectionRect: rect,
          rootBounds: null,
          time: 0,
        },
      ],
      this,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const JSDOM_INTERSECTION_OBSERVER = globalThis.IntersectionObserver;

const traceRow = (input: string) => screen.getByRole('button', { name: new RegExp(input) });
const traceDialog = () => screen.queryByRole('dialog', { name: 'Trace details' });
const getTimeRange = () => screen.getByRole('group', { name: 'Time range', hidden: true });

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
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  // jsdom has no PointerEvent (Base UI menus dispatch it).
  vi.stubGlobal('PointerEvent', MouseEvent);
  Element.prototype.getAnimations ??= () => [];
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// The list virtualizer schedules a 150ms scroll debounce its cleanup never cancels.
afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise(resolve => setTimeout(resolve, 200));
});

describe('The traces page in an app other than Studio', () => {
  describe('when the app hands it the traces it loaded', () => {
    it('lists every trace the app loaded', async () => {
      render(<AppTracesPage />);

      expect(await screen.findByRole('button', { name: /Plan a weekend in Paris/ })).toBeTruthy();
      expect(traceRow('Find a hotel near the Louvre')).toBeTruthy();
    });

    it('sends no request of its own', async () => {
      const requests = recordRequests();
      render(<AppTracesPage />);
      await screen.findByRole('button', { name: /Plan a weekend in Paris/ });

      fireEvent.click(traceRow('Plan a weekend in Paris'));
      await screen.findByRole('dialog', { name: 'Trace details' });

      expect(requests).toEqual([]);
    });

    it('needs no Studio link provider: it draws no link and never navigates through Studio', async () => {
      const { container } = render(
        <StudioLinkTripwire>
          <AppTracesPage initialTraceId={TRACE_THREAD_ITEM_ID} panel={{ navigation: appNavigation() }} />
        </StudioLinkTripwire>,
      );
      await screen.findByRole('dialog', { name: 'Trace details' });

      expect(container.ownerDocument.querySelectorAll('a[href]')).toHaveLength(0);
    });
  });

  describe('when the app hands it the counts over the window', () => {
    it('draws the traces histogram', async () => {
      render(<AppTracesPage />);

      expect(await screen.findByRole('region', { name: 'Traces over time' })).toBeTruthy();
    });
  });

  describe('when the store cannot aggregate traces', () => {
    it('draws no histogram, even with counts', async () => {
      render(<AppTracesPage data={appData({ capabilities: { data: traceQueryCapabilities, isLoading: false } })} />);
      await screen.findByRole('button', { name: /Plan a weekend in Paris/ });

      expect(screen.queryByRole('region', { name: 'Traces over time' })).toBeNull();
    });
  });

  describe('when the capabilities are still loading', () => {
    it('holds the page behind its skeleton', () => {
      render(<AppTracesPage data={appData({ capabilities: { isLoading: true } })} />);

      expect(screen.getByTestId('traces-page-skeleton')).toBeTruthy();
    });
  });

  describe('when the app is still discovering the filter fields', () => {
    it('holds the page behind its skeleton', () => {
      render(<AppTracesPage data={appData({ discovery: { fields: [], canonicalFields: [], isLoading: true } })} />);

      expect(screen.getByTestId('traces-page-skeleton')).toBeTruthy();
    });
  });

  describe('when a row is clicked', () => {
    it('reports the trace to open to the app', async () => {
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      render(<AppTracesPage onChange={onChange} />);

      fireEvent.click(await screen.findByRole('button', { name: /Plan a weekend in Paris/ }));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ selection: expect.objectContaining({ traceId: TRACE_THREAD_ITEM_ID }) }),
      );
    });

    it('opens the trace panel on the spans the app loaded', async () => {
      render(<AppTracesPage />);

      fireEvent.click(await screen.findByRole('button', { name: /Plan a weekend in Paris/ }));

      const dialog = await screen.findByRole('dialog', { name: 'Trace details' });
      expect(within(dialog).getAllByText('Travel agent run').length).toBeGreaterThan(0);
    });
  });

  describe('when the reader picks another time range', () => {
    it('reports the new filters to the app', async () => {
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      render(<AppTracesPage onChange={onChange} />);
      await screen.findByRole('button', { name: /Plan a weekend in Paris/ });

      fireEvent.click(within(getTimeRange()).getByRole('button', { name: 'Last 7 days', hidden: true }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours', hidden: true }));

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: expect.objectContaining({ datePreset: 'last-24h' }) }),
      );
    });
  });

  describe('when the reader toggles a column', () => {
    it('reports the next column selection to the app', async () => {
      const onColumnsChange = vi.fn<(next: TraceColumnPreferences) => void>();
      render(<AppTracesPage onColumnsChange={onColumnsChange} />);
      await screen.findByRole('button', { name: /Plan a weekend in Paris/ });

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Duration' }));

      expect(onColumnsChange).toHaveBeenCalledWith(
        expect.objectContaining({ visibleColumns: COLUMNS.visibleColumns.filter(column => column !== 'duration') }),
      );
    });
  });

  describe('when the reader sorts by start time', () => {
    it('reports the new order to the app', async () => {
      const onSortChange = vi.fn<(next: TracesSort) => void>();
      render(<AppTracesPage onSortChange={onSortChange} />);
      await screen.findByRole('button', { name: /Plan a weekend in Paris/ });

      fireEvent.click(screen.getByRole('button', { name: /^Start, sorted descending/ }));

      expect(onSortChange).toHaveBeenCalledWith({ field: 'startedAt', direction: 'asc' });
    });
  });

  describe('when the end of the list is in view and the app has another page', () => {
    beforeAll(() => vi.stubGlobal('IntersectionObserver', EndOfListInView));
    afterAll(() => vi.stubGlobal('IntersectionObserver', JSDOM_INTERSECTION_OBSERVER));

    it('asks the app for the next page', async () => {
      const data = appData();
      render(<AppTracesPage data={{ ...data, traces: { ...data.traces, hasNextPage: true } }} />);

      await waitFor(() => expect(data.traces.onLoadMore).toHaveBeenCalled());
    });
  });

  describe('when the end of the list is in view but the app has no other page', () => {
    beforeAll(() => vi.stubGlobal('IntersectionObserver', EndOfListInView));
    afterAll(() => vi.stubGlobal('IntersectionObserver', JSDOM_INTERSECTION_OBSERVER));

    it('asks for nothing', async () => {
      const data = appData();
      render(<AppTracesPage data={data} />);
      await screen.findByRole('button', { name: /Plan a weekend in Paris/ });

      expect(data.traces.onLoadMore).not.toHaveBeenCalled();
    });
  });

  describe('when the app failed to load the list', () => {
    it('lets the reader retry through the app', async () => {
      const data = appData();
      render(
        <TracesExplorer
          selection={EMPTY_TRACES_SELECTION}
          filters={DEFAULT_TRACES_FILTERS}
          onChange={() => {}}
          sort={DEFAULT_TRACES_SORT}
          onSortChange={() => {}}
          columns={COLUMNS}
          onColumnsChange={() => {}}
          capabilities={data.capabilities}
          traces={{ ...data.traces, rows: [], error: new Error('The app could not list traces') }}
          metricsSupport={METRICS}
        >
          <TracesExplorer.Body
            renderError={({ error, refetch }) => (
              <button type="button" onClick={refetch}>
                Retry: {error.message}
              </button>
            )}
          >
            <TracesExplorer.List />
          </TracesExplorer.Body>
        </TracesExplorer>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Retry: The app could not list traces' }));

      expect(data.traces.onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a trace is open', () => {
    it('opens the agent the trace ran through the app', async () => {
      const navigation = appNavigation();
      render(<AppTracesPage initialTraceId={TRACE_THREAD_ITEM_ID} panel={{ navigation }} />);

      fireEvent.click(await screen.findByRole('button', { name: /Travel Agent/ }));

      expect(navigation.onOpenAgent).toHaveBeenCalledWith('travel-agent');
    });

    it('opens its own trace page through the app', async () => {
      const navigation = appNavigation();
      render(<AppTracesPage initialTraceId={TRACE_THREAD_ITEM_ID} panel={{ navigation }} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Open trace page' }));

      expect(navigation.onOpenTrace).toHaveBeenCalledWith(TRACE_THREAD_ITEM_ID);
    });

    it('downloads it through the app', async () => {
      const onDownload = vi.fn<(traceId: string) => void>();
      render(<AppTracesPage initialTraceId={TRACE_THREAD_ITEM_ID} panel={{ onDownload }} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Download trace JSON' }));

      expect(onDownload).toHaveBeenCalledWith(TRACE_THREAD_ITEM_ID);
    });

    it('closes it through the app', async () => {
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      render(<AppTracesPage initialTraceId={TRACE_THREAD_ITEM_ID} onChange={onChange} />);
      await screen.findByRole('dialog', { name: 'Trace details' });

      fireEvent.click(screen.getByRole('button', { name: 'Close trace' }));

      expect(onChange.mock.lastCall?.[0].selection).toEqual(EMPTY_TRACES_SELECTION);
      await waitFor(() => expect(traceDialog()).toBeNull());
    });

    it('hands the app the trace to add to a dataset', async () => {
      const renderDatasetDialog = vi.fn<NonNullable<TracesExplorerPanelProps['renderDatasetDialog']>>(() => null);
      render(<AppTracesPage initialTraceId={TRACE_THREAD_ITEM_ID} panel={{ renderDatasetDialog }} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Add to dataset' }));

      expect(renderDatasetDialog).toHaveBeenLastCalledWith(
        expect.objectContaining({ traceId: TRACE_THREAD_ITEM_ID, rootSpanId: 'agent-root', isOpen: true }),
      );
    });
  });

  describe("when the open trace's thread holds other turns", () => {
    it('hands the app the thread to show', async () => {
      const renderThread = vi.fn<NonNullable<TracesExplorerPanelProps['renderThread']>>(() => null);
      const data = appData();
      render(
        <AppTracesPage
          initialTraceId={TRACE_THREAD_ITEM_ID}
          data={{ ...data, openTrace: { ...data.openTrace, threadHasOtherTraces: true } }}
          panel={{ renderThread }}
        />,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Open full thread' }));

      expect(renderThread).toHaveBeenLastCalledWith(expect.objectContaining({ threadId: TRACE_THREAD_ID, open: true }));
    });
  });

  describe("when the open trace's thread holds no other turn", () => {
    it('offers no full thread', async () => {
      render(<AppTracesPage initialTraceId={TRACE_THREAD_ITEM_ID} panel={{ renderThread: () => null }} />);
      await screen.findByRole('dialog', { name: 'Trace details' });

      expect(screen.queryByRole('button', { name: 'Open full thread' })).toBeNull();
    });
  });
  describe('when the app restricts what feedback readers can do', () => {
    const FEEDBACK_OPTIONS = {
      contextMode: 'resolve',
      feedbackUserId: null,
      allowDelete: false,
      allowReview: false,
    } as const;
    const openSpan = (panel: Partial<TracesExplorerPanelProps>) => {
      const data = appData();
      const [root] = travelTrace.spans;
      render(
        <AppTracesPage
          initialTraceId={TRACE_THREAD_ITEM_ID}
          initialSpanId={root?.spanId}
          feedbackOptions={FEEDBACK_OPTIONS}
          data={{ ...data, openTrace: { ...data.openTrace, selectedSpan: { span: root, isLoading: false } } }}
          panel={panel}
        />,
      );
    };

    it("hands the options to the trace's feedback view", async () => {
      const renderFeedback = vi.fn<NonNullable<TracesExplorerPanelProps['renderFeedback']>>(() => null);
      openSpan({ renderFeedback });
      await screen.findByRole('dialog', { name: 'Trace details' });

      expect(renderFeedback).toHaveBeenLastCalledWith({
        traceId: TRACE_THREAD_ITEM_ID,
        feedbackOptions: FEEDBACK_OPTIONS,
      });
    });

    it("hands the options to the open span's feedback view", async () => {
      const renderSpanFeedback = vi.fn<NonNullable<TracesExplorerPanelProps['renderSpanFeedback']>>(() => null);
      openSpan({ renderSpanFeedback });
      await screen.findByRole('dialog', { name: 'Trace details' });

      expect(renderSpanFeedback).toHaveBeenLastCalledWith({
        traceId: TRACE_THREAD_ITEM_ID,
        spanId: 'agent-root',
        feedbackOptions: FEEDBACK_OPTIONS,
      });
    });

    it('hands the options to the full thread', async () => {
      const renderThread = vi.fn<NonNullable<TracesExplorerPanelProps['renderThread']>>(() => null);
      openSpan({ renderThread });
      await screen.findByRole('dialog', { name: 'Trace details' });

      expect(renderThread).toHaveBeenLastCalledWith(expect.objectContaining({ feedbackOptions: FEEDBACK_OPTIONS }));
    });
  });
  describe('when the app has no entity names or environments to suggest', () => {
    const filterBy = async (field: string, value: string) => {
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      render(<AppTracesPage suggestions={{}} onChange={onChange} />);
      await screen.findByRole('button', { name: /Plan a weekend in Paris/ });

      const input = screen.getByRole('combobox', { name: 'Add filter' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: field } });
      fireEvent.click(await screen.findByRole('option', { name: field }));
      fireEvent.click(await screen.findByRole('option', { name: 'is', exact: true }));
      fireEvent.change(input, { target: { value } });

      fireEvent.keyDown(input, { key: 'Enter' });
      return onChange;
    };

    it('lets the reader type the primitive name to filter on', async () => {
      const onChange = await filterBy('Primitive name', 'Travel Agent');

      await waitFor(() =>
        expect(onChange.mock.lastCall?.[0].filters.tokens).toEqual([
          expect.objectContaining({ fieldId: 'entityName', value: 'Travel Agent' }),
        ]),
      );
    });

    it('lets the reader type the environment to filter on', async () => {
      const onChange = await filterBy('Environment', 'staging');

      await waitFor(() =>
        expect(onChange.mock.lastCall?.[0].filters.tokens).toEqual([
          expect.objectContaining({ fieldId: 'environment', value: 'staging' }),
        ]),
      );
    });
  });
  describe('when the app suggests the environments', () => {
    it('only accepts an environment it suggests', async () => {
      const onChange = vi.fn<(next: TracesExplorerState) => void>();
      render(<AppTracesPage onChange={onChange} />);
      await screen.findByRole('button', { name: /Plan a weekend in Paris/ });

      const input = screen.getByRole('combobox', { name: 'Add filter' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Environment' } });
      fireEvent.click(await screen.findByRole('option', { name: 'Environment' }));
      fireEvent.click(await screen.findByRole('option', { name: 'is', exact: true }));
      fireEvent.change(input, { target: { value: 'staging' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onChange).not.toHaveBeenCalled();
    });
  });
  describe('when a score of the open trace is open', () => {
    const SCORE = buildScore({ id: 'score-relevancy', traceId: TRACE_THREAD_ITEM_ID, spanId: 'agent-root' });
    const openScore = (panel: Partial<TracesExplorerPanelProps> = {}, wrap = (node: ReactNode) => node) => {
      const data = appData();
      return render(
        wrap(
          <AppTracesPage
            initialTraceId={TRACE_THREAD_ITEM_ID}
            initialScoreId={SCORE.id}
            data={{ ...data, openTrace: { ...data.openTrace, scores: { total: 1, records: [SCORE] } } }}
            panel={panel}
          />,
        ),
      );
    };
    // The score drawer stacks over the trace drawer, whose modal layer hides it from the role queries in jsdom.
    const scoreDialog = () => screen.findByRole('dialog', { name: `Score ${SCORE.id}`, hidden: true });

    it('sends no request of its own', async () => {
      const requests = recordRequests();
      openScore({ onOpenScoreTrace: vi.fn(), renderScoreDatasetDialog: () => null });
      await scoreDialog();

      expect(requests).toEqual([]);
    });

    it('needs no Studio link provider and draws no link', async () => {
      const { container } = openScore({ onOpenScoreTrace: vi.fn() }, node => (
        <StudioLinkTripwire>{node}</StudioLinkTripwire>
      ));
      await scoreDialog();

      expect(container.ownerDocument.querySelectorAll('a[href]')).toHaveLength(0);
    });

    it('opens the trace the score ran on through the app', async () => {
      const onOpenScoreTrace = vi.fn<NonNullable<TracesExplorerPanelProps['onOpenScoreTrace']>>();
      openScore({ onOpenScoreTrace });

      fireEvent.click(within(await scoreDialog()).getByRole('button', { name: TRACE_THREAD_ITEM_ID, hidden: true }));

      expect(onOpenScoreTrace).toHaveBeenCalledWith(TRACE_THREAD_ITEM_ID);
    });

    it('opens the span the score ran on through the app', async () => {
      const onOpenScoreTrace = vi.fn<NonNullable<TracesExplorerPanelProps['onOpenScoreTrace']>>();
      openScore({ onOpenScoreTrace });

      fireEvent.click(within(await scoreDialog()).getByRole('button', { name: 'agent-root', hidden: true }));

      expect(onOpenScoreTrace).toHaveBeenCalledWith(TRACE_THREAD_ITEM_ID, 'agent-root');
    });

    it('hands the app the score to save as a dataset item', async () => {
      const renderScoreDatasetDialog = vi.fn<NonNullable<TracesExplorerPanelProps['renderScoreDatasetDialog']>>(
        () => null,
      );
      openScore({ renderScoreDatasetDialog });

      fireEvent.click(within(await scoreDialog()).getByRole('button', { name: 'Save as dataset item', hidden: true }));

      expect(renderScoreDatasetDialog).toHaveBeenLastCalledWith(
        expect.objectContaining({ score: SCORE, isOpen: true }),
      );
    });

    it('offers no dataset item when the app has no dialog for it', async () => {
      openScore();

      expect(
        within(await scoreDialog()).queryByRole('button', { name: 'Save as dataset item', hidden: true }),
      ).toBeNull();
    });
  });
});
