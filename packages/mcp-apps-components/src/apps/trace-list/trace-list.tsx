import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui/components/Tabs';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useObservabilityViews } from '@mastra/playground-ui/domains/observability/hooks/use-observability-views';
import { SpansExplorerBody } from '@mastra/playground-ui/domains/spans/components/spans-explorer-body';
import { ThreadsExplorerBody } from '@mastra/playground-ui/domains/threads/components/threads-explorer-body';
import {
  DEFAULT_TRACES_FILTERS,
  DEFAULT_TRACES_SORT,
  EMPTY_TRACES_SELECTION,
  TRACES_SORT_FIELDS,
  TracesExplorer,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type {
  TracesExplorerState,
  TracesFilters,
  TracesSort,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import {
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_PRESET_VALUES,
  TRACE_DATE_TO_PARAM,
  applyTracePropertyFilterTokens,
  getTraceFilterGroups,
  getTracePropertyFilterTokens,
} from '@mastra/playground-ui/domains/traces/trace-filters';
import { MastraReactProvider } from '@mastra/react';
import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppFrame, AppHost, AppState, AppToolbar, readStudioUrl } from '../../shared/host';
import { applyTheme } from '../../shared/mcp-app';
import { createMcpFetch } from '../../shared/mcp-fetch';
import type { OpenedTraceFilter } from '../../shared/mcp-fetch';
import { TraceView } from '../../shared/trace-view';
import { LogsTab } from './logs-tab';
import { MetricsTab } from './metrics-tab';
import type { Drilldown } from './metrics-tab';

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
};

/** Logs list arguments that are paging or sort, which the logs tab sets itself. */
const LOG_PAGING_ARGS = new Set(['page', 'perPage', 'field', 'direction', 'orderBy', 'pagination']);

/** The model's `list_logs` arguments: the time range becomes the tab's range, the rest stays applied. */
function toOpenedLogs(args: Args | undefined, opened: Opened): Opened {
  opened.view = 'logs';
  const timestamp = args?.timestamp as { start?: string; end?: string } | undefined;
  if (timestamp?.start || timestamp?.end) {
    const params = new URLSearchParams({ datePreset: 'custom' });
    if (timestamp.start) params.set('dateFrom', new Date(timestamp.start).toISOString());
    if (timestamp.end) params.set('dateTo', new Date(timestamp.end).toISOString());
    opened.logParams = params.toString();
  }
  const logs = Object.fromEntries(
    Object.entries(args ?? {}).filter(
      ([key, value]) => key !== 'timestamp' && !LOG_PAGING_ARGS.has(key) && value != null,
    ),
  );
  if (Object.keys(logs).length > 0) opened.filter = { logs };
  return opened;
}

/** The traces filters in a Studio traces URL, as Studio's traces page reads them. */
function decodeTraceFilters(params: URLSearchParams): TracesFilters {
  const parseDate = (raw: string | null) => {
    const date = raw ? new Date(raw) : undefined;
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
  };
  const preset = params.get(TRACE_DATE_PRESET_PARAM) as TracesFilters['datePreset'] | null;
  return {
    datePreset:
      preset && preset !== 'all' && TRACE_DATE_PRESET_VALUES.has(preset) ? preset : DEFAULT_TRACES_FILTERS.datePreset,
    dateFrom: parseDate(params.get(TRACE_DATE_FROM_PARAM)),
    dateTo: parseDate(params.get(TRACE_DATE_TO_PARAM)),
    tokens: getTracePropertyFilterTokens(params),
    groups: getTraceFilterGroups(params),
  };
}

/** The traces filters as a Studio traces URL's params, the inverse of `decodeTraceFilters`. */
function encodeTraceFilters(filters: TracesFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.datePreset) params.set(TRACE_DATE_PRESET_PARAM, filters.datePreset);
  if (filters.dateFrom) params.set(TRACE_DATE_FROM_PARAM, filters.dateFrom.toISOString());
  if (filters.dateTo) params.set(TRACE_DATE_TO_PARAM, filters.dateTo.toISOString());
  applyTracePropertyFilterTokens(params, filters.tokens, filters.groups);
  return params;
}

const NO_METRICS = { supported: false, isLoading: false };
const FEATURES = { spanQuery: true, threadQuery: true, feedback: false };

/**
 * `query_traces` arguments become the explorer's starting time range and sort, and their `where` and
 * `textSearch` stay applied to every trace query (shown above the list, where they can be cleared), since
 * Studio's filter bar can't draw every predicate. `list_traces` opens on the default view.
 */
function toOpened(tool: string | undefined, args: Args | undefined): Opened {
  const opened: Opened = { view: 'traces', filters: DEFAULT_TRACES_FILTERS, sort: DEFAULT_TRACES_SORT, logParams: '' };
  if (tool === 'list_logs') return toOpenedLogs(args, opened);
  if (tool === 'analyze_metrics') {
    opened.view = 'metrics';
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
  if (args?.where || args?.textSearch) opened.filter = { where: args.where, textSearch: args.textSearch };
  return opened;
}

function OpenedQueryBar({ query, onClear }: { query: Args; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-border1 flex flex-col gap-1 border-b px-3 py-2">
      <div className="flex items-center gap-2">
        <Txt variant="body-sm" tone="muted">
          Also filtered by the query from the conversation.
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
  onClearQuery,
}: {
  app: App;
  opened: Opened;
  filters: TracesFilters;
  onClearQuery: () => void;
}) {
  const [state, setState] = useState<TracesExplorerState>({ selection: EMPTY_TRACES_SELECTION, filters });
  const query = traceQuery(opened.filter);
  const [sort, setSort] = useState(opened.sort);
  const traceId = state.selection.traceId;

  if (traceId) {
    return (
      <TraceView
        app={app}
        traceId={traceId}
        onBack={() => setState(s => ({ ...s, selection: EMPTY_TRACES_SELECTION }))}
      />
    );
  }
  const params = encodeTraceFilters(state.filters);
  const context = [
    `The trace list's filters, as Studio URL params: ${params.toString() || 'none'}.`,
    query && `It's also filtered by the query the model opened it with: ${JSON.stringify(query)}.`,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <AppState context={context} studioPath={`/traces?${params}`}>
      <div className="flex min-h-0 flex-1 flex-col">
        {query && <OpenedQueryBar query={query} onClear={onClearQuery} />}
        <TracesExplorer
          metricsSupport={NO_METRICS}
          selection={state.selection}
          filters={state.filters}
          onChange={setState}
          sort={sort}
          onSortChange={setSort}
          features={FEATURES}
        >
          <TracesExplorer.Body
            toolbar={
              <div className="flex items-center justify-between gap-2">
                <TracesExplorer.FilterBar />
                <TracesExplorer.ColumnsMenu />
              </div>
            }
            chart={<TracesExplorer.Histogram />}
          >
            <TracesExplorer.List />
          </TracesExplorer.Body>
        </TracesExplorer>
      </div>
    </AppState>
  );
}

function SpansTab({ app }: { app: App }) {
  const [open, setOpen] = useState<{ traceId: string; spanId: string }>();
  if (open)
    return <TraceView app={app} traceId={open.traceId} spanId={open.spanId} onBack={() => setOpen(undefined)} />;
  return (
    <SpansExplorerBody
      selection={undefined}
      onSelectionChange={selection => selection && setOpen({ traceId: selection.traceId, spanId: selection.spanId })}
      renderPanel={() => null}
    />
  );
}

function ThreadsTab() {
  const [threadId, setThreadId] = useState<string>();
  return (
    <ThreadsExplorerBody selectedThreadId={threadId} onSelectedThreadChange={setThreadId} onOpenScore={() => {}} />
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
  const trace = useObservabilityViews({ current: 'traces', features: FEATURES });
  const { data, isLoading } = useObservabilityCapabilities();
  const [view, setView] = useState<View>(opened.view);
  // Each drilldown remounts its tab on the new filters.
  const [traces, setTraces] = useState({ key: 0, filters: opened.filters });
  const [logs, setLogs] = useState({ key: 0, params: opened.logParams });

  if (trace.isLoading || isLoading) {
    return (
      <div className="flex min-h-25 items-center justify-center">
        <Spinner size="sm" aria-label="Loading observability" />
      </div>
    );
  }
  const views: View[] = [...trace.views];
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
          <TracesTab key={traces.key} app={app} opened={opened} filters={traces.filters} onClearQuery={onClearQuery} />
        </TabContent>
        {views.includes('spans') && (
          <TabContent value="spans" className="min-h-0 flex-1 overflow-auto">
            <SpansTab app={app} />
          </TabContent>
        )}
        {views.includes('threads') && (
          <TabContent value="threads" className="min-h-0 flex-1 overflow-auto">
            <ThreadsTab />
          </TabContent>
        )}
        {views.includes('logs') && (
          <TabContent value="logs" className="min-h-0 flex-1 overflow-auto">
            <LogsTab
              key={logs.key}
              app={app}
              initialParams={logs.params}
              banner={logFilter && <OpenedQueryBar query={logFilter} onClear={onClearQuery} />}
            />
          </TabContent>
        )}
        {views.includes('metrics') && (
          <TabContent value="metrics" className="min-h-0 flex-1 overflow-auto">
            <MetricsTab onDrilldown={drilldown} />
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
  const customFetch = useMemo(() => createMcpFetch(app, () => filter.current), [app]);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  // Clearing the opened query changes what every trace and log query returns.
  const clearQuery = () => {
    setOpened(current => ({ ...current, filter: undefined }));
    filter.current = undefined;
    void queryClient.resetQueries();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MastraReactProvider baseUrl="https://mcp-app.mastra.invalid" customFetch={customFetch}>
        <TooltipProvider>
          <AppHost app={app} name="trace explorer" studioUrl={studioUrl}>
            <AppFrame>
              <Views app={app} opened={opened} onClearQuery={clearQuery} />
            </AppFrame>
          </AppHost>
        </TooltipProvider>
      </MastraReactProvider>
    </QueryClientProvider>
  );
}

/**
 * Studio's observability pages: the trace explorer (filters, field and value discovery, histogram, sort and
 * paging), its span and thread lists, the logs list, and the metrics dashboard, served by the built-in MCP
 * server's observability tools. It opens on the tab of the tool that opened it. Opening a row draws the trace
 * with the trace viewer's timeline.
 */
export function TraceList() {
  const [opened, setOpened] = useState<Opened>();
  const [studioUrl, setStudioUrl] = useState<string>();
  const { app, error } = useApp({
    appInfo: { name: 'Mastra trace list', version: __PACKAGE_VERSION__ },
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
      <Txt variant="body-sm" tone="muted" className="p-4">
        {error.message}
      </Txt>
    );
  }
  if (!app || !opened) {
    return (
      <div className="flex min-h-25 items-center justify-center">
        <Spinner size="sm" aria-label="Loading traces" />
      </div>
    );
  }
  return <Explorer app={app} opened={opened} studioUrl={studioUrl} />;
}
