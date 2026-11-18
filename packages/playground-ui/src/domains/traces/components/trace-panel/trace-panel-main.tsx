import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Panel } from 'react-resizable-panels';

import { getAllSpanIds } from '../../hooks/get-all-span-ids';
import { useTraceSearchResult } from '../../hooks/use-trace-search';
import type { TraceSearchResult } from '../../hooks/use-trace-search';
import type { TraceSpanRecord } from '../../types';
import { getSignalLabel, getSpanSignal } from '../../utils/span-signal';
import { formatHierarchicalSpans } from '../format-hierarchical-spans';
import { TraceSpanTimeline } from '../trace-span-timeline';
import type { TraceStreamingTimings } from '../trace-span-timeline';
import { TraceSpanTree } from '../trace-span-tree';
import type { TraceSpanTreeProps } from '../trace-span-tree';
import { useTracePanel } from './trace-panel-context';
import type { TracePanelSpan } from './trace-panel-context';
import { Button } from '@/ds/components/Button';
import { DataPanel } from '@/ds/components/DataPanel';
import { Notice } from '@/ds/components/Notice';
import { IconCodeTree } from '@/ds/icons/central/IconCodeTree';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { IconGanttChart } from '@/ds/icons/central/IconGanttChart';
import { IconMagnifyingGlass } from '@/ds/icons/central/IconMagnifyingGlass';

const NO_SPANS: TracePanelSpan[] = [];

/** The signal that started each agent run, by span id, read from the full spans. */
function getSignalLabels(traceSpans: TraceSpanRecord[] | undefined): Map<string, string> {
  const labels = new Map<string, string>();
  for (const span of traceSpans ?? []) {
    const signal = getSpanSignal(span);
    const label = signal && getSignalLabel(signal);
    if (label) labels.set(span.spanId, label);
  }
  return labels;
}

/** The error a span recorded, when it has the `{ name?, message }` shape spans store. */
function getSpanError(error: unknown): { name?: string; message: string } | undefined {
  if (typeof error !== 'object' || error === null || !('message' in error) || typeof error.message !== 'string') {
    return undefined;
  }
  const name = 'name' in error && typeof error.name === 'string' ? error.name : undefined;
  return { name, message: error.message };
}

export interface TracePanelMainProps {
  /** The bar above the spans, typically a `TracePanel.SpansToolbar`. */
  toolbar?: ReactNode;
  /** Above the spans, e.g. `TracePanel.RootError`. */
  notices?: ReactNode;
  /** Typically a `TracePanel.Spans`. */
  spans: ReactNode;
}

/** The main column: toolbar, then notices above the spans. A trace without spans says so instead. */
export function TracePanelMain({ toolbar, notices, spans }: TracePanelMainProps) {
  const { spans: traceSpans, isLoading } = useTracePanel();
  if (!isLoading && !traceSpans?.length) return <DataPanel.NoData>No spans found for this trace.</DataPanel.NoData>;
  return (
    <>
      {toolbar}
      <DataPanel.Content>
        {notices}
        {spans}
      </DataPanel.Content>
    </>
  );
}

export interface TracePanelSpansToolbarProps {
  /** Typically a `TracePanel.Search`; it fills the bar. */
  search?: ReactNode;
  /** At the end of the bar, e.g. `TracePanel.SpanViewSwitch`. */
  actions?: ReactNode;
}

/**
 * The bar above the spans. The bar itself is the search field: no pill inside the square panel, the
 * bottom rule is its only edge, and keyboard focus lights that rule like a field's rim.
 */
export function TracePanelSpansToolbar({ search, actions }: TracePanelSpansToolbarProps) {
  return (
    <DataPanel.Header className="gap-1 border-b border-surface-rim has-[input:focus-visible]:[--surface-rim:var(--field-rim-focus)]">
      {search}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-0.5">{actions}</div>}
    </DataPanel.Header>
  );
}

/** The span search field, bound to the root's query; clearing it shows every span again. */
export function TracePanelSearch() {
  const { query, setQuery } = useTracePanel();
  return (
    <>
      <IconMagnifyingGlass aria-hidden className="ml-1 size-icon-md shrink-0 text-muted-foreground" />
      <input
        type="search"
        aria-label="Search spans"
        placeholder="Search spans"
        value={query}
        onChange={event => setQuery(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-label text-foreground outline-hidden placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
      />
      {query && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Clear search"
          className="rounded-md"
          onClick={() => setQuery('')}
        >
          <IconCrossMedium />
        </Button>
      )}
    </>
  );
}

const SPAN_VIEWS = [
  { view: 'tree', label: 'Span tree', icon: <IconCodeTree /> },
  { view: 'timeline', label: 'Timeline', icon: <IconGanttChart /> },
] as const;

/** Switches the spans between the tree and the timeline, as flat square icons. */
export function TracePanelSpanViewSwitch() {
  const { spanView, setSpanView } = useTracePanel();
  return (
    <div role="group" aria-label="Span view" className="flex shrink-0 items-center gap-0.5">
      {SPAN_VIEWS.map(({ view, label, icon }) => (
        <Button
          key={view}
          size="icon-sm"
          variant={spanView === view ? 'subtle' : 'ghost'}
          aria-label={label}
          aria-pressed={spanView === view}
          tooltip={label}
          className="rounded-md"
          onClick={() => setSpanView(view)}
        >
          {icon}
        </Button>
      ))}
    </div>
  );
}

export interface TracePanelSpansProps {
  /** Span ids to feature; every other span is faded, and the last one is brought into view. */
  featuredSpanIds?: string[];
  /** Time to first chunk and token of the root, marked on the timeline (left off for a branch). */
  streamingTimings?: Omit<TraceStreamingTimings, 'startedAt'>;
  /** What the host's own search found for the root's query; omitted, the spans are searched here. */
  results?: TraceSearchResult<TracePanelSpan>;
  /** Every span with its payload (`getTrace`): rows a signal started are labelled with it. */
  traceSpans?: TraceSpanRecord[];
  /** Full-width, above the span rows (both layouts). */
  leading?: ReactNode;
  /** A cell at the end of each row of the span tree. */
  renderRowTrailing?: TraceSpanTreeProps['renderTrailing'];
}

/**
 * The trace's spans as a tree or a timeline (the root's span layout), filtered by the search. Both
 * layouts share the selection and the expanded rows. They stay mounted with no match, because the
 * search field must stay reachable to clear the query.
 */
export function TracePanelSpans({
  featuredSpanIds,
  streamingTimings,
  results,
  traceSpans,
  leading,
  renderRowTrailing,
}: TracePanelSpansProps) {
  const { spans, isLoading, anchorSpanId, rootSpan, selectedSpanId, selectSpan, query, spanView } = useTracePanel();

  const labels = useMemo(() => getSignalLabels(traceSpans), [traceSpans]);
  // Kept stable: the rows re-expand whenever the spans change identity.
  const labelledSpans = useMemo(() => {
    if (labels.size === 0) return spans ?? NO_SPANS;
    return (spans ?? NO_SPANS).map(span => {
      const signalLabel = labels.get(span.spanId);
      return signalLabel ? { ...span, signalLabel } : span;
    });
  }, [spans, labels]);
  // A host that searches itself hands the results down, so no haystack is built here.
  const localSearch = useTraceSearchResult(results ? NO_SPANS : labelledSpans, query);
  const { results: matches, payloadOnlyMatchIds } = results ?? localSearch;

  const hierarchicalSpans = useMemo(
    () =>
      formatHierarchicalSpans(
        // Carried on the span rather than drilled as a prop: the tree is rendered several components deeper.
        matches.map(span => ({ ...span, matchedInPayloadOnly: payloadOnlyMatchIds.has(span.spanId) })),
        anchorSpanId,
      ),
    [matches, payloadOnlyMatchIds, anchorSpanId],
  );

  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);
  useEffect(() => {
    if (hierarchicalSpans.length > 0) setExpandedSpanIds(getAllSpanIds(hierarchicalSpans));
  }, [hierarchicalSpans]);

  const viewProps = {
    hierarchicalSpans,
    onSpanClick: (id: string) => selectSpan(selectedSpanId === id ? undefined : id),
    selectedSpanId,
    expandedSpanIds,
    setExpandedSpanIds,
    featuredSpanIds,
    revealSpanId: featuredSpanIds?.at(-1),
    isLoading,
    leadingSlot: leading,
  };
  const rootTimings =
    streamingTimings && rootSpan && !anchorSpanId ? { ...streamingTimings, startedAt: rootSpan.startedAt } : undefined;

  return (
    <>
      {spanView === 'timeline' ? (
        <TraceSpanTimeline {...viewProps} streamingTimings={rootTimings} />
      ) : (
        <TraceSpanTree {...viewProps} renderTrailing={renderRowTrailing} />
      )}
      {!isLoading && hierarchicalSpans.length === 0 && <DataPanel.NoData>No spans match your search.</DataPanel.NoData>}
    </>
  );
}

/** Why the trace failed, from its root span, with a way to open that span. Renders nothing for a trace that succeeded. */
export function TracePanelRootError() {
  const { rootSpan, selectSpan } = useTracePanel();
  const rootError = getSpanError(rootSpan?.error);
  if (!rootSpan || !rootError) return null;
  return (
    <Notice
      variant="destructive"
      title={rootError.name ?? 'Error'}
      action={<Notice.Button onClick={() => selectSpan(rootSpan.spanId)}>View details</Notice.Button>}
      className="mb-4"
    >
      <Notice.Message className="line-clamp-3">{rootError.message}</Notice.Message>
    </Notice>
  );
}

/** Tells readers outside Studio that scoring and datasets live there. */
export function TracePanelUnavailableFeaturesNotice() {
  return (
    <Notice variant="info" className="mb-6">
      <Notice.Message>
        Evaluating traces and saving them as dataset items is available in Mastra Studio (local or deployed).
      </Notice.Message>
    </Notice>
  );
}
