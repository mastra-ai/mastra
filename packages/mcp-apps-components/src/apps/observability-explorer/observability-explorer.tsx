import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui/components/Tabs';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SpansExplorerBody } from '@mastra/playground-ui/domains/spans/components/spans-explorer-body';
import { ThreadsExplorerBody } from '@mastra/playground-ui/domains/threads/components/threads-explorer-body';
import { TraceThreadPanel } from '@mastra/playground-ui/domains/traces/components/trace-thread-panel';
import {
  DEFAULT_TRACES_FILTERS,
  DEFAULT_TRACES_SORT,
  EMPTY_TRACES_SELECTION,
  TRACES_SORT_FIELDS,
  TracesExplorer,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type {
  TracesExplorerCapabilities,
  TracesExplorerState,
  TracesFilters,
  TracesSort,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { TRACE_COLUMN_CATALOGS } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppFrame, AppHost, AppState, AppToolbar, readStudioUrl } from '../../shared/host';
import { applyTheme } from '../../shared/mcp-app';
import type { OpenedTraceFilter } from '../../shared/mcp-tools';
import { TraceView } from '../../shared/trace-view';
import { resolveMcpViews } from './data/resolve-mcp-views';
import { useMcpCapabilities } from './data/use-mcp-capabilities';
import { useMcpSpansExplorer } from './data/use-mcp-spans-explorer';
import { useMcpThreadsExplorer } from './data/use-mcp-threads-explorer';
import type { UseMcpTracesArgs } from './data/use-mcp-traces-args';
import { useMcpTracesDiscovery } from './data/use-mcp-traces-discovery';
import { useMcpTracesFilterSuggestions } from './data/use-mcp-traces-filter-suggestions';
import { useMcpTracesHistogram } from './data/use-mcp-traces-histogram';
import { useMcpTracesList } from './data/use-mcp-traces-list';
import { LegacyDataProvider, LegacyDataScope, useLegacyDataScopes } from './legacy-data-scope';
import { LogsTab } from './logs-tab';
import { MetricsTab } from './metrics-tab';
import type { Drilldown, MetricsOpening } from './metrics-tab';
import {
  decodeTraceFilters,
  encodeTraceFilters,
  logArgsToParams,
  metricsArgsToFilters,
  whereToTraceFilters,
} from './opened-filters';

type Args = Record<string, unknown>;
type View = 'traces' | 'spans' | 'threads' | 'logs' | 'metrics';

/**
 * What the model asked for when it opened the app: the tab its tool belongs to, and the tool's arguments as
 * the starting traces or logs view. `query` is the part of them Studio's filter bars can't draw, applied to
 * every query and shown above the list.
 */
type Opened = {
  view: View;
  filter?: OpenedTraceFilter;
  filters: TracesFilters;
  sort: TracesSort;
  /** The logs tab's starting search params, as Studio's logs URL. */
  logParams: string;
  /** The metrics tab's starting time range and chips, from `analyze_metrics` filters. */
  metrics?: MetricsOpening;
};

/** Logs list arguments that are paging or sort, which the logs tab sets itself. */
const LOG_PAGING_ARGS = new Set(['page', 'perPage', 'field', 'direction', 'orderBy', 'pagination']);

/** The model's `list_logs` arguments: the time range becomes the tab's range, the rest stays applied. */
function toOpenedLogs(args: Args | undefined, opened: Opened): Opened {
  opened.view = 'logs';
  const timestamp = args?.timestamp as { start?: string; end?: string } | undefined;
  const dates = new URLSearchParams();
  if (timestamp?.start || timestamp?.end) {
    dates.set('datePreset', 'custom');
    if (timestamp.start) dates.set('dateFrom', new Date(timestamp.start).toISOString());
    if (timestamp.end) dates.set('dateTo', new Date(timestamp.end).toISOString());
  }
  const logs = Object.fromEntries(
    Object.entries(args ?? {}).filter(
      ([key, value]) => key !== 'timestamp' && !LOG_PAGING_ARGS.has(key) && value != null,
    ),
  );
  // The filters the logs filter bar can draw become its chips; the rest stays applied, shown above the list.
  const { params, rest } = logArgsToParams(logs, dates);
  opened.logParams = params.toString();
  if (rest) opened.filter = { logs: rest };
  return opened;
}

const NO_METRICS = { supported: false, isLoading: false };
const FEATURES = { spanQuery: true, threadQuery: true, feedback: false };

/**
 * `query_traces` arguments become the explorer's starting time range, sort, and filter chips. The parts of
 * `where` the filter bar can't draw, and `textSearch`, stay applied to every trace query, shown above the
 * list where they can be cleared. `list_traces` opens on the default view.
 */
function toOpened(tool: string | undefined, args: Args | undefined): Opened {
  const opened: Opened = { view: 'traces', filters: DEFAULT_TRACES_FILTERS, sort: DEFAULT_TRACES_SORT, logParams: '' };
  if (tool === 'list_logs') return toOpenedLogs(args, opened);
  if (tool === 'analyze_metrics') {
    opened.view = 'metrics';
    opened.metrics = metricsArgsToFilters(args?.filters);
    return opened;
  }
  const timeRange = args?.timeRange as { from?: string; to?: string } | undefined;
  if (!timeRange?.from || !timeRange.to) return opened;
  opened.filters = {
    ...DEFAULT_TRACES_FILTERS,
    datePreset: 'custom',
    dateFrom: new Date(timeRange.from),
    dateTo: new Date(timeRange.to),
  };
  const order = (args?.orderBy as { field?: string; direction?: 'asc' | 'desc' }[] | undefined)?.[0];
  if (order?.field && (TRACES_SORT_FIELDS as readonly string[]).includes(order.field) && order.direction) {
    opened.sort = { field: order.field as TracesSort['field'], direction: order.direction };
  }
  // The predicate's conditions the filter bar can draw become its chips; the rest stays applied, shown above it.
  const { tokens, groups, rest } = whereToTraceFilters(args?.where);
  opened.filters = { ...opened.filters, tokens, groups };
  if (rest || args?.textSearch) opened.filter = { where: rest, textSearch: args?.textSearch };
  return opened;
}

function OpenedQueryBar({ query, onClear }: { query: Args; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-border1 flex flex-col gap-1 border-b px-3 py-2">
      <div className="flex items-center gap-2">
        <Txt variant="body-sm" tone="muted">
          Also filtered by conditions from the conversation that the filter bar can't show.
        </Txt>
        <button type="button" className="text-body-sm underline" onClick={() => setOpen(v => !v)}>
          {open ? 'Hide' : 'Show'}
        </button>
        <button type="button" className="text-body-sm underline" onClick={onClear}>
          Clear
        </button>
      </div>
      {open && <pre className="text-ui-xs text-neutral3 max-h-40 overflow-auto">{JSON.stringify(query, null, 2)}</pre>}
    </div>
  );
}

/** The opened query's trace predicate, as shown above the trace list. */
function traceQuery(filter: OpenedTraceFilter | undefined): Args | undefined {
  const query = Object.fromEntries(
    Object.entries({ where: filter?.where, textSearch: filter?.textSearch }).filter(([, v]) => v),
  );
  return Object.keys(query).length > 0 ? query : undefined;
}

function TracesTab({
  app,
  opened,
  filters,
  capabilities,
  onClearQuery,
}: {
  app: App;
  opened: Opened;
  filters: TracesFilters;
  capabilities: TracesExplorerCapabilities;
  onClearQuery: () => void;
}) {
  const [state, setState] = useState<TracesExplorerState>({ selection: EMPTY_TRACES_SELECTION, filters });
  const query = traceQuery(opened.filter);
  const [sort, setSort] = useState(opened.sort);
  const traceId = state.selection.traceId;
  const params = encodeTraceFilters(state.filters);
  const context = [
    `The trace list's filters, as Studio URL params: ${params.toString() || 'none'}.`,
    query && `It's also filtered by the query the model opened it with: ${JSON.stringify(query)}.`,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    // Studio's trace page can't apply the model's leftover query, so it would show more than this list.
    <AppState context={context} studioPath={query ? null : `/traces?${params}`}>
      {traceId && (
        <TraceView
          app={app}
          traceId={traceId}
          onBack={() => setState(s => ({ ...s, selection: EMPTY_TRACES_SELECTION }))}
        />
      )}
      {/* The list stays mounted under an opened trace so its columns and pages are there on the way back. */}
      <div className={traceId ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        {query && <OpenedQueryBar query={query} onClear={onClearQuery} />}
        <TracesList
          app={app}
          opened={opened.filter}
          capabilities={capabilities}
          state={state}
          onChange={setState}
          sort={sort}
          onSortChange={setSort}
        />
      </div>
    </AppState>
  );
}

/**
 * The traces explorer, fed through the built-in MCP server's tools: the explorer data hooks call them directly
 * and the explorer's parts draw what they return.
 */
function TracesList({
  app,
  opened,
  capabilities,
  state,
  onChange,
  sort,
  onSortChange,
}: {
  app: App;
  opened?: OpenedTraceFilter;
  capabilities: TracesExplorerCapabilities;
  state: TracesExplorerState;
  onChange: (next: TracesExplorerState) => void;
  sort: TracesSort;
  onSortChange: (next: TracesSort) => void;
}) {
  const [columns, setColumns] = useState(TRACE_COLUMN_CATALOGS.traces.defaults);
  const args: UseMcpTracesArgs = { app, opened, filters: state.filters, capabilities, features: FEATURES };
  const traces = useMcpTracesList({ ...args, sort, columns });
  const discovery = useMcpTracesDiscovery(args);
  return (
    <TracesExplorer
      metricsSupport={NO_METRICS}
      selection={state.selection}
      filters={state.filters}
      onChange={onChange}
      sort={sort}
      onSortChange={onSortChange}
      columns={columns}
      onColumnsChange={setColumns}
      capabilities={capabilities}
      traces={traces}
      discovery={discovery}
      features={FEATURES}
    >
      <TracesExplorer.Body
        toolbar={
          <div className="flex items-center justify-between gap-2">
            <TracesFilterBar {...args} />
            <TracesExplorer.ColumnsMenu />
          </div>
        }
        chart={<TracesHistogram {...args} />}
      >
        <TracesExplorer.List />
      </TracesExplorer.Body>
    </TracesExplorer>
  );
}

function TracesFilterBar(args: UseMcpTracesArgs) {
  return <TracesExplorer.FilterBar suggestions={useMcpTracesFilterSuggestions(args)} />;
}

function TracesHistogram(args: UseMcpTracesArgs) {
  return <TracesExplorer.Histogram data={useMcpTracesHistogram(args)} />;
}

type ListTabProps = { app: App; capabilities: TracesExplorerCapabilities };

function SpansTab({ app, capabilities }: ListTabProps) {
  const [open, setOpen] = useState<{ traceId: string; spanId: string }>();
  // The list stays mounted under an opened trace so its filters and pages are there on the way back.
  return (
    <>
      {open && <TraceView app={app} traceId={open.traceId} spanId={open.spanId} onBack={() => setOpen(undefined)} />}
      <div className={open ? 'hidden' : 'contents'}>
        <SpansList app={app} capabilities={capabilities} onOpen={setOpen} />
      </div>
    </>
  );
}

function SpansList({
  app,
  capabilities,
  onOpen,
}: ListTabProps & { onOpen: (span: { traceId: string; spanId: string }) => void }) {
  const explorer = useMcpSpansExplorer(app, capabilities);
  return (
    <SpansExplorerBody
      {...explorer}
      selection={undefined}
      onSelectionChange={selection => selection && onOpen({ traceId: selection.traceId, spanId: selection.spanId })}
      renderPanel={() => null}
    />
  );
}

function ThreadsTab({ app, capabilities }: ListTabProps) {
  const [threadId, setThreadId] = useState<string>();
  const explorer = useMcpThreadsExplorer(app, capabilities);
  const flags = capabilities.data?.capabilities;
  return (
    <ThreadsExplorerBody
      {...explorer}
      selectedThreadId={threadId}
      onSelectedThreadChange={setThreadId}
      renderPanel={panel => (
        // The drawer loads a thread's traces through the Studio data hooks, without the opened query.
        <LegacyDataScope unfiltered>
          <TraceThreadPanel
            open={!!panel.threadId}
            threadId={panel.threadId ?? ''}
            depth={1}
            closeLabel="Close"
            withQueryTrace={flags?.traceQuery ?? true}
            withFeedback={flags?.feedback ?? true}
            onOpenScore={() => {}}
            onClose={panel.onClose}
          />
        </LegacyDataScope>
      )}
    />
  );
}

const VIEW_LABELS: Record<View, string> = {
  traces: 'Traces',
  spans: 'Spans',
  threads: 'Threads',
  logs: 'Logs',
  metrics: 'Metrics',
};

/**
 * The views the store supports and this caller's tools serve, as tabs. Metrics drilldowns switch to the traces
 * or logs tab, opened on the drilldown's filters.
 */
function Views({ app, opened, onClearQuery }: { app: App; opened: Opened; onClearQuery: () => void }) {
  const capabilities = useMcpCapabilities(app);
  const { data, isLoading } = capabilities;
  const [view, setView] = useState<View>(opened.view);
  // Each drilldown remounts its tab on the new filters.
  const [traces, setTraces] = useState({ key: 0, filters: opened.filters });
  const [logs, setLogs] = useState({ key: 0, params: opened.logParams });

  if (isLoading) {
    return (
      <div className="flex min-h-25 items-center justify-center">
        <Spinner size="sm" aria-label="Loading observability" />
      </div>
    );
  }
  const lists = resolveMcpViews(capabilities, FEATURES);
  const views: View[] = ['traces'];
  if (lists.spans) views.push('spans');
  if (lists.threads) views.push('threads');
  if (data?.capabilities.logs) views.push('logs');
  if (data?.capabilities.metrics) views.push('metrics');
  const current = views.includes(view) ? view : 'traces';

  const drilldown = ({ to, params }: Drilldown) => {
    if (to === 'traces') setTraces(t => ({ key: t.key + 1, filters: decodeTraceFilters(params) }));
    else setLogs(l => ({ key: l.key + 1, params: params.toString() }));
    setView(to);
  };
  const logFilter = opened.filter?.logs;

  return (
    <AppState
      context={`They're on its ${VIEW_LABELS[current]} tab.`}
      studioPath={current === 'traces' || current === 'logs' ? undefined : `/${current}`}
    >
      <Tabs value={current} onValueChange={setView} defaultTab="traces" className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 pr-2">
          {views.length > 1 ? (
            <TabList>
              {views.map(v => (
                <Tab key={v} value={v}>
                  {VIEW_LABELS[v]}
                </Tab>
              ))}
            </TabList>
          ) : (
            <span />
          )}
          <AppToolbar />
        </div>
        <TabContent value="traces" className="min-h-0 flex-1 overflow-auto">
          <TracesTab
            key={traces.key}
            app={app}
            opened={opened}
            filters={traces.filters}
            capabilities={capabilities}
            onClearQuery={onClearQuery}
          />
        </TabContent>
        {views.includes('spans') && (
          <TabContent value="spans" className="min-h-0 flex-1 overflow-auto">
            <SpansTab app={app} capabilities={capabilities} />
          </TabContent>
        )}
        {views.includes('threads') && (
          <TabContent value="threads" className="min-h-0 flex-1 overflow-auto">
            <ThreadsTab app={app} capabilities={capabilities} />
          </TabContent>
        )}
        {views.includes('logs') && (
          <TabContent value="logs" className="min-h-0 flex-1 overflow-auto">
            <LegacyDataScope>
              <LogsTab
                key={logs.key}
                app={app}
                initialParams={logs.params}
                banner={logFilter && <OpenedQueryBar query={logFilter} onClear={onClearQuery} />}
              />
            </LegacyDataScope>
          </TabContent>
        )}
        {views.includes('metrics') && (
          <TabContent value="metrics" className="min-h-0 flex-1 overflow-auto">
            <LegacyDataScope>
              <MetricsTab onDrilldown={drilldown} logs={views.includes('logs')} opening={opened.metrics} />
            </LegacyDataScope>
          </TabContent>
        )}
      </Tabs>
    </AppState>
  );
}

function Explorer({ app, opened: initial, studioUrl }: { app: App; opened: Opened; studioUrl?: string }) {
  const [opened, setOpened] = useState(initial);
  const filter = useRef(opened.filter);
  filter.current = opened.filter;
  const scopes = useLegacyDataScopes(app, () => filter.current);
  // Serves the tabs' tool-call queries; the trace lists key on the opened query, so clearing it reloads them.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  // Clearing the opened query changes what every trace and log query returns: the trace lists reload on the
  // new filter, and the logs drop what they loaded with the old one.
  const clearQuery = () => {
    setOpened(current => ({ ...current, filter: undefined }));
    filter.current = undefined;
    void scopes.opened.queryClient.resetQueries();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <LegacyDataProvider scopes={scopes}>
        <TooltipProvider>
          <AppHost app={app} name="observability explorer" studioUrl={studioUrl}>
            <AppFrame fixed>
              <Views app={app} opened={opened} onClearQuery={clearQuery} />
            </AppFrame>
          </AppHost>
        </TooltipProvider>
      </LegacyDataProvider>
    </QueryClientProvider>
  );
}

/**
 * Studio's observability pages: the observability explorer (filters, field and value discovery, histogram, sort and
 * paging), its span and thread lists, the logs list, and the metrics dashboard, served by the built-in MCP
 * server's observability tools. It opens on the tab of the tool that opened it. Opening a row draws the trace
 * with the trace viewer's timeline.
 */
export function ObservabilityExplorer() {
  const [opened, setOpened] = useState<Opened>();
  const [studioUrl, setStudioUrl] = useState<string>();
  const { app, error } = useApp({
    appInfo: { name: 'Mastra observability explorer', version: __PACKAGE_VERSION__ },
    capabilities: {},
    onAppCreated: app => {
      const tool = () => app.getHostContext()?.toolInfo?.tool.name;
      app.ontoolinput = ({ arguments: args }) => setOpened(current => current ?? toOpened(tool(), args));
      // Hosts may skip the input; the result still means the tool ran.
      app.ontoolresult = result => {
        setStudioUrl(readStudioUrl(result));
        setOpened(current => current ?? toOpened(tool(), undefined));
      };
      app.onhostcontextchanged = context => applyTheme(context.theme);
    },
  });
  useEffect(() => applyTheme(app?.getHostContext()?.theme), [app]);

  if (error) {
    return (
      <AppFrame>
        <Txt variant="body-sm" tone="muted" className="p-4">
          {error.message}
        </Txt>
      </AppFrame>
    );
  }
  if (!app || !opened) {
    return (
      <AppFrame>
        <div className="flex min-h-25 items-center justify-center">
          <Spinner size="sm" aria-label="Loading traces" />
        </div>
      </AppFrame>
    );
  }
  return <Explorer app={app} opened={opened} studioUrl={studioUrl} />;
}
