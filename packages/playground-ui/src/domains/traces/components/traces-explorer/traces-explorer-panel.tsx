import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import { useTraceOrBranchSpans, useTraceUsage } from '@mastra/react/hooks/traces';
import type { TraceUsageSummary } from '@mastra/react/hooks/traces';
import { memo, useState } from 'react';
import type { SpanTab } from '../../types';
import { useTracePanelHost } from '../trace-panel-host';
import { TraceSpanPanel } from '../trace-span-panel';
import { useTraceUsageColumns, useTracesConfig, useTracesList, useTracesSelection } from './traces-explorer-context';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { ScoreDataPanel } from '@/domains/scores';

export type TracesExplorerPanelProps = {
  /**
   * Builds the href of the dedicated trace page; without it the drawer offers no "Open trace page" link.
   * Pass a stable function: a new one on every render re-renders the drawer on every list poll.
   */
  traceHref?: (traceId: string) => string;
  /** Shows "Add full trace to dataset" in the trace actions menu. Defaults to `true`. */
  withAddTraceToDataset?: boolean;
};

/**
 * Reads the list only to derive the open trace's neighbours and usage, then hands them to the
 * drawer as primitives and a structurally shared summary. A poll tick that replaces the rows
 * re-renders this wrapper, but not the drawer unless one of those values changed.
 */
export function TracesExplorerPanel({ traceHref, withAddTraceToDataset = true }: TracesExplorerPanelProps = {}) {
  const { rows, autoRefetch, isLoading: isListLoading } = useTracesList();
  const { selectedTraceId: traceId } = useTracesSelection();
  const { usageEnabled } = useTraceUsageColumns();

  const rowIds = rows.map(row => row.traceId);
  const index = traceId ? rowIds.indexOf(traceId) : -1;
  const isListed = index >= 0;

  // Same key as the list's usage query when the trace is listed, so React Query serves it from cache.
  // Waits for the list so a deep-linked trace doesn't fetch its own usage before the rows arrive.
  // `select` output is structurally shared, so the summary keeps its identity across refetches.
  const { data: usage } = useTraceUsage<TraceUsageSummary | undefined>({
    traceIds: isListed ? rowIds : traceId ? [traceId] : [],
    enabled: usageEnabled && !isListLoading,
    autoRefetch,
    queryOptions: { select: usageByTraceId => (traceId ? usageByTraceId.get(traceId) : undefined) },
  });

  return (
    <TracesExplorerTraceDrawer
      traceHref={traceHref}
      withAddTraceToDataset={withAddTraceToDataset}
      usage={usage}
      previousTraceId={isListed ? rowIds[index - 1] : undefined}
      nextTraceId={isListed ? rowIds[index + 1] : undefined}
    />
  );
}

type TracesExplorerTraceDrawerProps = Required<Pick<TracesExplorerPanelProps, 'withAddTraceToDataset'>> &
  Pick<TracesExplorerPanelProps, 'traceHref'> & {
    usage: TraceUsageSummary | undefined;
    previousTraceId: string | undefined;
    nextTraceId: string | undefined;
  };

type DatasetDialogTarget = { traceId: string; rootSpanId: string | undefined };

const TracesExplorerTraceDrawer = memo(function TracesExplorerTraceDrawer({
  traceHref,
  withAddTraceToDataset,
  usage,
  previousTraceId,
  nextTraceId,
}: TracesExplorerTraceDrawerProps) {
  const { renderCreateDatasetDialog } = useTracePanelHost();
  const { withQueryTrace, withFeedback } = useTracesConfig();
  const { selection, selectTrace, closeTrace, selectSpan, setSpanTab, setSpanView, selectScore, highlightSpans } =
    useTracesSelection();
  const traceId = selection.traceId;
  const spanId = selection.spanId;

  const [datasetDialogTarget, setDatasetDialogTarget] = useState<DatasetDialogTarget | null>(null);
  // Keyed by trace id so selecting another trace (row click, prev/next) falls back to the trace panel.
  const [fullThreadTraceId, setFullThreadTraceId] = useState<string | null>(null);

  const {
    spans,
    anchorSpanId,
    isLoading: isLoadingSpans,
  } = useTraceOrBranchSpans({ traceId: traceId ?? null, listMode: 'traces', anchorSpanId: null });
  // Same anchor as TraceSpanPanel's Scores tab, so both read one cached scores query.
  const rootSpanId = (
    anchorSpanId ? spans?.find(s => s.spanId === anchorSpanId) : spans?.find(s => s.parentSpanId == null)
  )?.spanId;

  const isFullThreadOpen = !!traceId && fullThreadTraceId === traceId;
  const depth = isFullThreadOpen ? 3 : 2;

  return (
    <>
      <TraceSpanPanel
        title="Trace details"
        size={spanId ? 'full' : 'wide'}
        traceId={traceId}
        spans={spans}
        anchorSpanId={anchorSpanId}
        usage={usage}
        isLoadingSpans={isLoadingSpans}
        selectedSpanId={spanId ?? null}
        onClose={() => {
          setFullThreadTraceId(null);
          closeTrace();
        }}
        isFullThreadOpen={isFullThreadOpen}
        withQueryTrace={withQueryTrace}
        withFeedback={withFeedback}
        onFullThreadOpenChange={open => setFullThreadTraceId(open ? (traceId ?? null) : null)}
        onSpanSelect={id => selectSpan(id ?? null)}
        onSaveAsDatasetItem={withAddTraceToDataset ? setDatasetDialogTarget : undefined}
        onPrevious={previousTraceId ? () => selectTrace(previousTraceId) : undefined}
        onNext={nextTraceId ? () => selectTrace(nextTraceId) : undefined}
        showPartialThread
        featuredSpanIds={selection.highlightSpanIds}
        onHighlightSpans={highlightSpans}
        onScoreSelect={selectScore}
        spanView={selection.spanView}
        onSpanViewChange={setSpanView}
        spanActiveTab={selection.spanTab ?? 'details'}
        onSpanTabChange={tab => setSpanTab(tab as SpanTab)}
        traceHref={traceId && traceHref ? traceHref(traceId) : undefined}
      />
      <TracesExplorerScorePanel traceId={traceId} spanId={rootSpanId} depth={depth} />
      {withAddTraceToDataset && (
        <TraceAsItemDialog
          rootSpanId={datasetDialogTarget?.rootSpanId}
          traceId={datasetDialogTarget?.traceId}
          isOpen={!!datasetDialogTarget}
          onClose={() => setDatasetDialogTarget(null)}
          renderCreateDatasetDialog={renderCreateDatasetDialog}
        />
      )}
    </>
  );
});

type TracesExplorerScorePanelProps = {
  traceId: string | undefined;
  spanId: string | undefined;
  depth: 2 | 3;
};

/** Owns the score lookup so a scores refetch re-renders only the score drawer, not the trace drawer. */
function TracesExplorerScorePanel({ traceId, spanId, depth }: TracesExplorerScorePanelProps) {
  const { selection, selectScore } = useTracesSelection();
  // Same first-page query as the Scores tab, served from React Query's cache.
  const { data } = useTraceSpanScores({
    traceId,
    spanId,
    page: 0,
    queryOptions: { enabled: !!traceId && !!spanId },
  });
  const score = selection.scoreId ? data?.scores?.find(item => item.id === selection.scoreId) : undefined;

  return <ScoreDataPanel depth={depth} score={score} onClose={() => selectScore(null)} />;
}
