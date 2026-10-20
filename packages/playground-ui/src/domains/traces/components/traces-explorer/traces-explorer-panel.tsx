import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import { useSpanFeedback, useTraceFeedback, useTraceOrBranchSpans, useTraceUsage } from '@mastra/react/hooks/traces';
import { useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { useTraceListNavigation } from '../../hooks/use-trace-list-navigation';
import type { SpanTab } from '../../types';
import { SpanFeedbackTab } from '../span-feedback-tab';
import { TraceFeedbackTab } from '../trace-feedback-tab';
import { TraceSpanPanel } from '../trace-span-panel';
import type { TraceSpanPanelProps } from '../trace-span-panel';
import { useTraceUsageColumns, useTracesConfig, useTracesList, useTracesSelection } from './traces-explorer-context';
import { AddTraceMocksToItemDialog } from '@/domains/observability/components/add-trace-mocks-to-item-dialog';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { ScoreDataPanel, TraceScoresTab } from '@/domains/scores';

export type TracesExplorerPanelProps = {
  /** Opens a score of one of the full thread's traces (the host owns routing). */
  onOpenScore: (traceId: string, scoreId: string) => void;
  renderCreateDatasetDialog?: ComponentProps<typeof TraceAsItemDialog>['renderCreateDatasetDialog'];
  /** Host integration actions rendered alongside the trace controls. */
  headerActionsSlot?: (args: { traceId: string; spans: TraceSpanPanelProps['spans'] }) => ReactNode;
};

type DatasetDialogTarget = { traceId: string; rootSpanId: string | undefined };

export function TracesExplorerPanel({
  onOpenScore,
  renderCreateDatasetDialog,
  headerActionsSlot,
}: TracesExplorerPanelProps) {
  const { withQueryTrace, withFeedback } = useTracesConfig();
  const { rows, autoRefetch, isLoading: isListLoading } = useTracesList();
  const { selection, selectTrace, closeTrace, selectSpan, setSpanTab, setSpanView, selectScore, highlightSpans } =
    useTracesSelection();
  const { usageEnabled } = useTraceUsageColumns();
  const traceId = selection.traceId;
  const spanId = selection.spanId;

  const [datasetDialogTarget, setDatasetDialogTarget] = useState<DatasetDialogTarget | null>(null);
  const [addMocksTarget, setAddMocksTarget] = useState<{ traceId: string } | null>(null);
  // Keyed by trace id so selecting another trace (row click, prev/next) falls back to the trace panel.
  const [fullThreadTraceId, setFullThreadTraceId] = useState<string | null>(null);

  // Tab badge counts; the tab bodies re-use these first-page queries through React Query's cache.
  const { data: traceFeedbackData } = useTraceFeedback({
    traceId,
    queryOptions: { enabled: withFeedback && !!traceId },
  });
  const { data: spanFeedbackData } = useSpanFeedback({
    traceId,
    spanId,
    queryOptions: { enabled: withFeedback && !!traceId && !!spanId },
  });

  const {
    spans,
    anchorSpanId,
    isLoading: isLoadingSpans,
  } = useTraceOrBranchSpans({ traceId: traceId ?? null, listMode: 'traces', anchorSpanId: null });
  const anchorSpan = useMemo(
    () => (anchorSpanId ? spans?.find(s => s.spanId === anchorSpanId) : spans?.find(s => s.parentSpanId == null)),
    [spans, anchorSpanId],
  );

  const { data: spanScoresData } = useTraceSpanScores({
    traceId,
    spanId: anchorSpan?.spanId,
    queryOptions: { enabled: !!traceId && !!anchorSpan?.spanId },
  });
  const featuredScore = selection.scoreId
    ? spanScoresData?.scores?.find(score => score.id === selection.scoreId)
    : undefined;

  // Same key as the list's usage query when the trace is listed, so React Query serves it from cache.
  // Waits for the list so a deep-linked trace doesn't fetch its own usage before the rows arrive.
  const rowIds = useMemo(() => rows.map(row => row.traceId), [rows]);
  const isListed = !!traceId && rowIds.includes(traceId);
  const usageTraceIds = useMemo(() => (isListed ? rowIds : traceId ? [traceId] : []), [isListed, rowIds, traceId]);
  const { data: usageByTraceId } = useTraceUsage({
    traceIds: usageTraceIds,
    enabled: usageEnabled && !isListLoading,
    autoRefetch,
  });
  const usage = traceId ? usageByTraceId?.get(traceId) : undefined;

  const { handlePreviousTrace, handleNextTrace } = useTraceListNavigation(rows, traceId, null, selectTrace);

  // Tool mocks only make sense for agent runs.
  const isAgentTrace = anchorSpan?.entityType === 'agent';
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
        onOpenScore={onOpenScore}
        onFullThreadOpenChange={open => setFullThreadTraceId(open ? (traceId ?? null) : null)}
        onSpanSelect={id => selectSpan(id ?? null)}
        onSaveAsDatasetItem={setDatasetDialogTarget}
        onAddTraceMocksToItem={isAgentTrace ? setAddMocksTarget : undefined}
        initialSpanId={spanId}
        onPrevious={handlePreviousTrace}
        onNext={handleNextTrace}
        showPartialThread
        featuredSpanIds={selection.highlightSpanIds}
        onHighlightSpans={highlightSpans}
        feedbackTabBadge={withFeedback ? (traceFeedbackData?.pagination?.total ?? undefined) : undefined}
        feedbackTabSlot={withFeedback ? ({ traceId: tid }) => <TraceFeedbackTab traceId={tid} /> : undefined}
        scoresTabBadge={spanScoresData?.pagination?.total ?? undefined}
        scoresTabSlot={({ traceId: tid, rootSpanId }) =>
          rootSpanId ? <TraceScoresTab traceId={tid} spanId={rootSpanId} onScoreSelect={selectScore} /> : null
        }
        spanView={selection.spanView}
        onSpanViewChange={setSpanView}
        spanActiveTab={selection.spanTab ?? 'details'}
        onSpanTabChange={tab => setSpanTab(tab as SpanTab)}
        spanFeedbackTabBadge={withFeedback ? (spanFeedbackData?.pagination?.total ?? undefined) : undefined}
        spanFeedbackTabSlot={
          withFeedback
            ? ({ traceId: tid, spanId: sid }) =>
                tid && sid ? <SpanFeedbackTab key={`${tid}:${sid}`} traceId={tid} spanId={sid} /> : null
            : undefined
        }
        headerActionsSlot={traceId && headerActionsSlot ? headerActionsSlot({ traceId, spans }) : undefined}
      />
      <ScoreDataPanel depth={depth} score={featuredScore} onClose={() => selectScore(null)} />
      <TraceAsItemDialog
        depth={depth}
        rootSpanId={datasetDialogTarget?.rootSpanId}
        traceId={datasetDialogTarget?.traceId}
        isOpen={!!datasetDialogTarget}
        onClose={() => setDatasetDialogTarget(null)}
        renderCreateDatasetDialog={renderCreateDatasetDialog}
      />
      <AddTraceMocksToItemDialog
        traceId={addMocksTarget?.traceId}
        isOpen={!!addMocksTarget}
        onClose={() => setAddMocksTarget(null)}
      />
    </>
  );
}
