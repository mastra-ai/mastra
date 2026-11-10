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
import { MastraReactProvider } from '@mastra/react';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { applyTheme } from '../../shared/mcp-app';
import { createMcpFetch } from '../../shared/mcp-fetch';
import type { OpenedTraceFilter } from '../../shared/mcp-fetch';
import { TraceById } from '../../shared/trace-view';

type Args = Record<string, unknown>;

/** What the model asked for when it opened the app: `query_traces`' arguments, or `list_traces`'. */
type Opened = { filter?: OpenedTraceFilter; filters: TracesFilters; sort: TracesSort; query?: Args };

const NO_METRICS = { supported: false, isLoading: false };
const FEATURES = { spanQuery: true, threadQuery: true, feedback: false };

/**
 * `query_traces` arguments become the explorer's starting time range and sort, and their `where` and
 * `textSearch` stay applied to every trace query (shown above the list, where they can be cleared), since
 * Studio's filter bar can't draw every predicate. `list_traces` opens on the default view.
 */
function toOpened(args: Args | undefined): Opened {
  const opened: Opened = { filters: DEFAULT_TRACES_FILTERS, sort: DEFAULT_TRACES_SORT };
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
  if (args?.where || args?.textSearch) {
    opened.filter = { where: args.where, textSearch: args.textSearch };
    opened.query = Object.fromEntries(
      Object.entries({ where: args.where, textSearch: args.textSearch }).filter(([, v]) => v),
    );
  }
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
        <button type="button" className="text-ui-sm text-accent1 underline" onClick={() => setOpen(v => !v)}>
          {open ? 'Hide' : 'Show'}
        </button>
        <button type="button" className="text-ui-sm text-accent1 underline" onClick={onClear}>
          Clear
        </button>
      </div>
      {open && <pre className="text-ui-xs text-neutral3 max-h-40 overflow-auto">{JSON.stringify(query, null, 2)}</pre>}
    </div>
  );
}

function TracesTab({ app, opened, onClearQuery }: { app: App; opened: Opened; onClearQuery: () => void }) {
  const [state, setState] = useState<TracesExplorerState>({
    selection: EMPTY_TRACES_SELECTION,
    filters: opened.filters,
  });
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
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {opened.query && <OpenedQueryBar query={opened.query} onClear={onClearQuery} />}
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
  );
}

function TraceView({
  app,
  traceId,
  spanId,
  onBack,
}: {
  app: App;
  traceId: string;
  spanId?: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3">
        <button type="button" className="text-ui-sm text-accent1 underline" onClick={onBack}>
          Back to the list
        </button>
      </div>
      <TraceById app={app} traceId={traceId} spanId={spanId} />
    </div>
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

const VIEW_LABELS = { traces: 'Traces', spans: 'Spans', threads: 'Threads' } as const;

/** The views the store supports, as tabs; a store without span or thread queries shows traces alone. */
function Views({ app, opened, onClearQuery }: { app: App; opened: Opened; onClearQuery: () => void }) {
  const { views, isLoading } = useObservabilityViews({ current: 'traces', features: FEATURES });
  if (isLoading) {
    return (
      <div className="flex min-h-25 items-center justify-center">
        <Spinner size="sm" aria-label="Loading traces" />
      </div>
    );
  }
  const traces = <TracesTab app={app} opened={opened} onClearQuery={onClearQuery} />;
  if (views.length === 1) return <div className="min-h-0 flex-1 overflow-auto">{traces}</div>;
  return (
    <Tabs defaultTab="traces" className="flex min-h-0 flex-1 flex-col">
      <TabList>
        {views.map(view => (
          <Tab key={view} value={view}>
            {VIEW_LABELS[view]}
          </Tab>
        ))}
      </TabList>
      <TabContent value="traces" className="min-h-0 flex-1 overflow-auto">
        {traces}
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
    </Tabs>
  );
}

function Explorer({ app, opened: initial }: { app: App; opened: Opened }) {
  const [opened, setOpened] = useState(initial);
  const filter = useRef(opened.filter);
  filter.current = opened.filter;
  const customFetch = useMemo(() => createMcpFetch(app, () => filter.current), [app]);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  // Clearing the opened query changes what every trace query returns.
  const clearQuery = () => {
    setOpened(current => ({ ...current, filter: undefined, query: undefined }));
    filter.current = undefined;
    void queryClient.resetQueries();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MastraReactProvider baseUrl="https://mcp-app.mastra.invalid" customFetch={customFetch}>
        <TooltipProvider>
          <div className="flex h-[44rem] flex-col">
            <Views app={app} opened={opened} onClearQuery={clearQuery} />
          </div>
        </TooltipProvider>
      </MastraReactProvider>
    </QueryClientProvider>
  );
}

/**
 * Studio's trace explorer (filters, field and value discovery, histogram, sort and paging) plus its span and
 * thread lists, served by the built-in MCP server's observability tools. Opening a row draws the trace with
 * the trace viewer's timeline.
 */
export function TraceList() {
  const [opened, setOpened] = useState<Opened>();
  const { app, error } = useApp({
    appInfo: { name: 'Mastra trace list', version: __PACKAGE_VERSION__ },
    capabilities: {},
    onAppCreated: app => {
      app.ontoolinput = ({ arguments: args }) => setOpened(current => current ?? toOpened(args));
      // Hosts may skip the input; the result still means the tool ran.
      app.ontoolresult = () => setOpened(current => current ?? toOpened(undefined));
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
  return <Explorer app={app} opened={opened} />;
}
