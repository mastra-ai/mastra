import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatHierarchicalSpans } from '@mastra/playground-ui/domains/traces/components/format-hierarchical-spans';
import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import { TraceSpanTimeline } from '@mastra/playground-ui/domains/traces/components/trace-span-timeline';
import { TraceSummaryDescription } from '@mastra/playground-ui/domains/traces/components/trace-summary-description';
import type { LightSpanRecord, SpanRecord } from '@mastra/playground-ui/domains/traces/types';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useEffect, useMemo, useState } from 'react';
import { AppState, AskButton } from './host';
import { callTool } from './mcp-app';

/** The built-in server's light trace (`get_trace`): every span's tree fields, paged by `nextOffset`. */
export type LightTrace = { traceId: string; spanCount: number; spans: LightSpanRecord[]; nextOffset?: number };

export function isLightTrace(value: unknown): value is LightTrace {
  return !!value && typeof value === 'object' && Array.isArray((value as LightTrace).spans);
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

function errorMessage(span: LightSpanRecord): string | undefined {
  const { error } = span as { error?: unknown };
  if (!error) return undefined;
  const message = typeof error === 'object' && 'message' in error ? error.message : error;
  return typeof message === 'string' ? message.slice(0, 300) : 'unknown error';
}

/** A span as one line: its type and name, whether it failed, and how long it took. */
function describeSpan(span: LightSpanRecord): string {
  const ms = span.endedAt ? Date.parse(String(span.endedAt)) - Date.parse(String(span.startedAt)) : undefined;
  const error = errorMessage(span);
  return [
    `${span.spanType} "${span.name}" (span ${span.spanId})`,
    error ? `failed: ${error}` : span.endedAt ? 'succeeded' : 'still running',
    ms !== undefined && !Number.isNaN(ms) ? `took ${ms}ms` : undefined,
  ]
    .filter(Boolean)
    .join(', ');
}

/** What the model hears about the open trace, and what "Ask" asks it. */
function traceState(traceId: string, spans: LightSpanRecord[], selected: LightSpanRecord | undefined) {
  const root = spans.find(span => span.parentSpanId == null);
  const failed = spans.filter(span => errorMessage(span));
  const context = [
    `They're viewing trace ${traceId}${root ? `, whose root is ${describeSpan(root)}` : ''}. It has ${spans.length} spans${failed.length ? `, ${failed.length} of them failed` : ''}.`,
    selected && `The span open beside it is ${describeSpan(selected)}.`,
  ]
    .filter(Boolean)
    .join(' ');
  const prompt = selected
    ? `Look into the ${describeSpan(selected)} in trace ${traceId}. What did it do${errorMessage(selected) ? ', and why did it fail' : ''}?`
    : `Look into trace ${traceId}. Summarize what happened${failed.length ? ' and why it failed' : ''}.`;
  return { context, prompt };
}

export function OpenedTrace({ app, trace, spanId }: { app: App; trace: LightTrace; spanId?: string }) {
  const [spans, setSpans] = useState(trace.spans);
  const [selectedSpanId, setSelectedSpanId] = useState(spanId);
  useEffect(() => {
    setSpans(trace.spans);
    if (trace.nextOffset !== undefined) void loadRest(app, trace).then(setSpans);
  }, [app, trace]);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(spans), [spans]);
  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);
  useEffect(() => setExpandedSpanIds(spans.map(span => span.spanId)), [spans]);
  const rootSpan = spans.find(span => span.parentSpanId == null);
  const selectedSpan = spans.find(span => span.spanId === selectedSpanId);
  const { context, prompt } = traceState(trace.traceId, spans, selectedSpan);
  const studioPath = `/traces?${new URLSearchParams({ traceId: trace.traceId, ...(selectedSpanId ? { spanId: selectedSpanId } : {}) })}`;

  return (
    <AppState context={context} studioPath={studioPath}>
      <div className="flex flex-col gap-3 p-3">
        <DataPanel variant="inline" title={`Trace ${trace.traceId}`}>
          <DataPanel.Header>
            <DataPanel.HeaderContent>
              <DataPanel.Heading>Trace Timeline</DataPanel.Heading>
              {rootSpan && <TraceSummaryDescription rootSpan={rootSpan} />}
            </DataPanel.HeaderContent>
            <AskButton label={selectedSpan ? 'Ask about this span' : 'Ask about this trace'} prompt={prompt} />
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
    </AppState>
  );
}

/** Loads a trace through `get_trace` and draws it, with `spanId` open when given. */
export function TraceById({ app, traceId, spanId }: { app: App; traceId: string; spanId?: string }) {
  const [state, setState] = useState<{ trace?: LightTrace; error?: string }>({});
  useEffect(() => {
    let current = true;
    setState({});
    callTool(app, 'get_trace', { traceId }).then(
      result => {
        if (!current) return;
        setState(isLightTrace(result) ? { trace: result } : { error: 'The tool returned no trace.' });
      },
      (error: Error) => current && setState({ error: error.message }),
    );
    return () => {
      current = false;
    };
  }, [app, traceId]);

  if (state.error) {
    return (
      <Txt variant="body-sm" tone="muted" className="p-4">
        {state.error}
      </Txt>
    );
  }
  if (!state.trace) {
    return (
      <div className="flex min-h-25 items-center justify-center">
        <Spinner size="sm" aria-label="Loading the trace" />
      </div>
    );
  }
  return <OpenedTrace app={app} trace={state.trace} spanId={spanId} />;
}

/** An opened trace with a way back to the list it was opened from. */
export function TraceView({
  app,
  traceId,
  spanId,
  backLabel = 'Back to the list',
  onBack,
}: {
  app: App;
  traceId: string;
  spanId?: string;
  backLabel?: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3">
        <button type="button" className="text-body-sm underline" onClick={onBack}>
          {backLabel}
        </button>
      </div>
      <TraceById app={app} traceId={traceId} spanId={spanId} />
    </div>
  );
}
