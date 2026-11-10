import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatHierarchicalSpans } from '@mastra/playground-ui/domains/traces/components/format-hierarchical-spans';
import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import { TraceSpanTimeline } from '@mastra/playground-ui/domains/traces/components/trace-span-timeline';
import { TraceSummaryDescription } from '@mastra/playground-ui/domains/traces/components/trace-summary-description';
import type { LightSpanRecord, SpanRecord } from '@mastra/playground-ui/domains/traces/types';
import { applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import type { App, McpUiTheme } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

/** The built-in server's light trace (`get_trace`): every span's tree fields, paged by `nextOffset`. */
type LightTrace = { traceId: string; spanCount: number; spans: LightSpanRecord[]; nextOffset?: number };

function applyTheme(theme: McpUiTheme | undefined) {
  if (!theme) return;
  applyDocumentTheme(theme);
  document.documentElement.classList.toggle('light', theme === 'light');
}

/** A tool result's JSON: `structuredContent` when the tool declares an output schema, else its text block. */
function readResult(result: { structuredContent?: unknown; content?: { type: string; text?: string }[] }): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = result.content?.find(block => block.type === 'text')?.text;
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isLightTrace(value: unknown): value is LightTrace {
  return !!value && typeof value === 'object' && Array.isArray((value as LightTrace).spans);
}

async function callTool(app: App, name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError) {
    const text = result.content.find(block => block.type === 'text')?.text;
    throw new Error(text ?? `${name} failed.`);
  }
  return readResult(result);
}

/** Loads the rest of a trace that `get_trace` cut to fit the result size limit. */
async function loadRest(app: App, trace: LightTrace): Promise<LightSpanRecord[]> {
  const spans = [...trace.spans];
  let offset = trace.nextOffset;
  while (offset !== undefined) {
    const page = await callTool(app, 'get_trace', { traceId: trace.traceId, offset });
    if (!isLightTrace(page) || page.spans.length === 0) break;
    spans.push(...page.spans);
    offset = page.nextOffset;
  }
  return spans;
}

function SpanPanel({
  app,
  traceId,
  spanId,
  onClose,
}: {
  app: App;
  traceId: string;
  spanId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<{ span?: SpanRecord; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let current = true;
    setState({ loading: true });
    callTool(app, 'get_span', { traceId, spanId }).then(
      result => {
        const span = (result as { span?: SpanRecord })?.span ?? (result as SpanRecord | undefined);
        if (current) setState({ span, loading: false });
      },
      (error: Error) => current && setState({ error: error.message, loading: false }),
    );
    return () => {
      current = false;
    };
  }, [app, traceId, spanId]);

  if (state.error) {
    return (
      <Txt variant="body-sm" tone="muted" className="p-4">
        {state.error}
      </Txt>
    );
  }
  return (
    <DataPanel variant="inline" title={`Span ${spanId}`}>
      <SpanDataPanelView
        traceId={traceId}
        spanId={spanId}
        span={state.span}
        isLoading={state.loading}
        onClose={onClose}
      />
    </DataPanel>
  );
}

function OpenedTrace({ app, trace }: { app: App; trace: LightTrace }) {
  const [spans, setSpans] = useState(trace.spans);
  const [selectedSpanId, setSelectedSpanId] = useState<string>();
  useEffect(() => {
    setSpans(trace.spans);
    if (trace.nextOffset !== undefined) void loadRest(app, trace).then(setSpans);
  }, [app, trace]);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(spans), [spans]);
  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);
  useEffect(() => setExpandedSpanIds(spans.map(span => span.spanId)), [spans]);
  const rootSpan = spans.find(span => span.parentSpanId == null);

  return (
    <div className="flex flex-col gap-3 p-3">
      <DataPanel variant="inline" title={`Trace ${trace.traceId}`}>
        <DataPanel.Header>
          <DataPanel.HeaderContent>
            <DataPanel.Heading>Trace Timeline</DataPanel.Heading>
            {rootSpan && <TraceSummaryDescription rootSpan={rootSpan} />}
          </DataPanel.HeaderContent>
        </DataPanel.Header>
        <DataPanel.Content className="p-0">
          <TraceSpanTimeline
            hierarchicalSpans={hierarchicalSpans}
            selectedSpanId={selectedSpanId}
            onSpanClick={id => setSelectedSpanId(current => (current === id ? undefined : id))}
            expandedSpanIds={expandedSpanIds}
            setExpandedSpanIds={setExpandedSpanIds}
          />
        </DataPanel.Content>
      </DataPanel>
      {selectedSpanId && (
        <div className="h-[32rem]">
          <SpanPanel
            app={app}
            traceId={trace.traceId}
            spanId={selectedSpanId}
            onClose={() => setSelectedSpanId(undefined)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Draws the trace that the built-in server's `get_trace` tool returned, with Studio's timeline, and
 * loads a span's details through `get_span` when the user picks one. Both calls go back through the
 * host's MCP connection, so they run with the caller's own permissions.
 */
export function TraceViewer() {
  const [trace, setTrace] = useState<LightTrace>();
  const [problem, setProblem] = useState<string>();
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  const { app, error } = useApp({
    appInfo: { name: 'Mastra trace viewer', version: __PACKAGE_VERSION__ },
    capabilities: {},
    onAppCreated: app => {
      app.ontoolresult = result => {
        const value = readResult(result);
        if (isLightTrace(value)) setTrace(value);
        else setProblem(result.isError ? 'The trace could not be loaded.' : 'The tool returned no trace.');
      };
      app.onhostcontextchanged = context => applyTheme(context.theme);
    },
  });
  useEffect(() => applyTheme(app?.getHostContext()?.theme), [app]);

  const message = error?.message ?? problem;
  if (message) {
    return (
      <Txt variant="body-sm" tone="muted" className="p-4">
        {message}
      </Txt>
    );
  }
  if (!app || !trace) {
    return (
      <div className="flex min-h-25 items-center justify-center">
        <Spinner size="sm" aria-label="Loading the trace" />
      </div>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OpenedTrace app={app} trace={trace} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
