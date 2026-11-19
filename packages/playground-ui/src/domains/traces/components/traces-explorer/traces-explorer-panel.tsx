import type { GetScorerResponse } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { useTraceListNavigation } from '../../hooks/use-trace-list-navigation';
import type { FeedbackOptions } from '../feedback-options';
import type { TraceNavigation } from '../trace-navigation';
import type { TracePanelMessagesProps, TracePanelScoreDialogProps, TracePanelSpan } from '../trace-panel';
import { TraceSpanPanelView } from '../trace-span-panel-view';
import { useTracesConfig, useTracesList, useTracesSelection } from './traces-explorer-context';
import type { TracesExplorerOpenTrace } from './traces-explorer-data';
import { ScoreDataPanelView } from '@/domains/scores/components/score-data-panel-view';
import type { ScoreDataPanelDatasetDialogArgs } from '@/domains/scores/components/score-data-panel-view';

export type TracesExplorerPanelThreadArgs = {
  /** Keep the thread mounted and toggle `open`, so its drawer animates in and out. */
  open: boolean;
  /** The last thread opened: kept while its drawer animates out. Empty before any. */
  threadId: string;
  /** Sibling-drawer elevation: the thread stacks above the trace panel. */
  depth: 2;
  /** Back to the trace panel underneath. */
  onClose: () => void;
  /** The root's `feedbackOptions`, for the feedback views inside the thread. */
  feedbackOptions?: FeedbackOptions;
};

/** What a feedback view needs: its trace (and span), and the root's `feedbackOptions`. */
export type TracesExplorerPanelFeedbackArgs = { traceId: string; feedbackOptions?: FeedbackOptions };
export type TracesExplorerPanelSpanFeedbackArgs = TracesExplorerPanelFeedbackArgs & { spanId: string };

export type TracesExplorerPanelDatasetDialogArgs = {
  traceId?: string;
  rootSpanId?: string;
  isOpen: boolean;
  onClose: () => void;
};

export type TracesExplorerPanelProps = {
  /** The records of the open trace (Studio: `useOpenTraceQuery`). Omitted while no trace is open. */
  trace?: TracesExplorerOpenTrace;
  /** Where the panel opens things (the entity, tools, delegated agents, the trace's own page): the host's callbacks. */
  navigation?: TraceNavigation;
  /** The scorers "Score trace" offers. */
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
  /** Starts a scorer on the trace's root span. Without it, the panel offers no scoring. */
  onTriggerScorer?: TracePanelScoreDialogProps['onTriggerScorer'];
  /** Downloads the trace. Without it, the panel offers no download. */
  onDownload?: (traceId: string) => void;
  isDownloading?: boolean;
  /** Draws the Messages column; defaults to `TracePanel.Messages` over `trace.fullTrace`. */
  renderMessages?: (props: TracePanelMessagesProps) => ReactNode;
  /** Replaces the open span's Input tab (e.g. a part that loads the tool registry when it opens). */
  spanInput?: ReactNode;
  /** Replaces the open span's Output tab (e.g. a part that loads the live tool cards when it opens). */
  spanOutput?: ReactNode;
  /** The trace's feedback, in the side column's Feedback view. Shown only when feedback is on. */
  renderFeedback?: (args: TracesExplorerPanelFeedbackArgs) => ReactNode;
  /** The open span's feedback, in its Feedback tab. Shown only when feedback is on. */
  renderSpanFeedback?: (args: TracesExplorerPanelSpanFeedbackArgs) => ReactNode;
  /** The root span's scores, in the side column's Scores view. Selecting one opens it in the score drawer. */
  renderScores?: (args: { traceId: string; rootSpanId: string; onScoreSelect: (scoreId: string) => void }) => ReactNode;
  /** The trace's full thread, stacked above the trace panel. Without it, the panel offers no full thread. */
  renderThread?: (args: TracesExplorerPanelThreadArgs) => ReactNode;
  /** The dialog that saves the trace as a dataset item. Without it, the panel offers no "Add to dataset". */
  renderDatasetDialog?: (args: TracesExplorerPanelDatasetDialogArgs) => ReactNode;
  /** Opens the trace a selected score ran on, or its span when `spanId` is given. Without it, the score drawer shows both ids as text. */
  onOpenScoreTrace?: (traceId: string, spanId?: string) => void;
  /** The dialog that saves a selected score as a dataset item. Without it, the score drawer offers no "Save as dataset item". */
  renderScoreDatasetDialog?: (args: ScoreDataPanelDatasetDialogArgs) => ReactNode;
  /** Host integration actions rendered alongside the trace controls. */
  headerActionsSlot?: (args: { traceId: string; spans: TracePanelSpan[] | undefined }) => ReactNode;
};

type DatasetDialogTarget = { traceId: string; rootSpanId: string | undefined };

/**
 * The open trace's drawer, with the full-thread and score drawers stacked above it and the dataset
 * dialog. Draws the host's records and slots; never fetches.
 */
export function TracesExplorerPanel({
  trace,
  navigation,
  scorers,
  isLoadingScorers,
  onTriggerScorer,
  onDownload,
  isDownloading,
  renderMessages,
  spanInput,
  spanOutput,
  renderFeedback,
  renderSpanFeedback,
  renderScores,
  renderThread,
  renderDatasetDialog,
  onOpenScoreTrace,
  renderScoreDatasetDialog,
  headerActionsSlot,
}: TracesExplorerPanelProps) {
  const { withFeedback, feedbackOptions } = useTracesConfig();
  const { rows } = useTracesList();
  const { selection, selectTrace, closeTrace, selectSpan, setSpanTab, setSpanView, selectScore, highlightSpans } =
    useTracesSelection();
  const traceId = selection.traceId;
  const spanId = selection.spanId;

  const [datasetDialogTarget, setDatasetDialogTarget] = useState<DatasetDialogTarget | null>(null);
  // Keyed by trace id so selecting another trace (row click, prev/next) falls back to the trace panel.
  const [fullThreadTraceId, setFullThreadTraceId] = useState<string | null>(null);
  // The last thread opened: kept while its drawer animates out.
  const [fullThreadId, setFullThreadId] = useState('');

  const spans = trace?.spans;
  const anchorSpanId = trace?.anchorSpanId;
  const anchorSpan = anchorSpanId
    ? spans?.find(s => s.spanId === anchorSpanId)
    : spans?.find(s => s.parentSpanId == null);
  const featuredScore = selection.scoreId
    ? trace?.scores?.records.find(score => score.id === selection.scoreId)
    : undefined;

  const { handlePreviousTrace, handleNextTrace } = useTraceListNavigation(rows, traceId, null, selectTrace);

  const isFullThreadOpen = !!traceId && fullThreadTraceId === traceId;
  const depth = isFullThreadOpen ? 3 : 2;

  // Only agent traces carry the Messages column, so other traces open the drawer one size
  // smaller, with or without a span open. The listed row knows the entity on click; the root
  // span covers deep-linked traces outside the list.
  const listedRow = rows.find(row => row.traceId === traceId);
  const entityType = listedRow?.entityType ?? anchorSpan?.entityType;
  const isAgent = entityType === EntityType.AGENT;
  const panelSize = spanId ? (isAgent ? 'full' : 'wide') : isAgent ? 'wide' : 'half';

  return (
    <>
      <TraceSpanPanelView
        title="Trace details"
        size={panelSize}
        traceId={traceId}
        spans={spans}
        anchorSpanId={anchorSpanId}
        entityType={entityType}
        usage={trace?.usage}
        rootStreamingTimings={listedRow}
        isLoadingSpans={trace?.isLoading ?? false}
        selectedSpanId={spanId ?? null}
        navigation={navigation}
        fullTrace={trace?.fullTrace}
        selectedSpan={trace?.selectedSpan}
        threadHasOtherTraces={trace?.threadHasOtherTraces}
        scorers={scorers}
        isLoadingScorers={isLoadingScorers}
        onTriggerScorer={onTriggerScorer}
        onDownload={onDownload}
        isDownloading={isDownloading}
        renderMessages={renderMessages}
        spanInput={spanInput}
        spanOutput={spanOutput}
        onClose={() => {
          setFullThreadTraceId(null);
          closeTrace();
        }}
        onOpenFullThread={
          renderThread
            ? threadId => {
                setFullThreadId(threadId);
                setFullThreadTraceId(traceId ?? null);
              }
            : undefined
        }
        onSpanSelect={id => selectSpan(id ?? null)}
        onSaveAsDatasetItem={renderDatasetDialog ? setDatasetDialogTarget : undefined}
        initialSpanId={spanId}
        onPrevious={handlePreviousTrace}
        onNext={handleNextTrace}
        showPartialThread
        featuredSpanIds={selection.highlightSpanIds}
        onHighlightSpans={highlightSpans}
        feedbackTabBadge={withFeedback ? trace?.feedbackCount : undefined}
        feedbackTabSlot={
          withFeedback && renderFeedback
            ? ({ traceId: tid }) => <Fragment key={tid}>{renderFeedback({ traceId: tid, feedbackOptions })}</Fragment>
            : undefined
        }
        scoresTabBadge={trace?.scores?.total}
        scoresTabSlot={
          renderScores
            ? ({ traceId: tid, rootSpanId }) =>
                rootSpanId ? renderScores({ traceId: tid, rootSpanId, onScoreSelect: selectScore }) : null
            : undefined
        }
        spanView={selection.spanView}
        onSpanViewChange={setSpanView}
        spanActiveTab={selection.spanTab ?? 'details'}
        onSpanTabChange={setSpanTab}
        spanFeedbackTabBadge={withFeedback ? trace?.spanFeedbackCount : undefined}
        spanFeedbackTabSlot={
          withFeedback && renderSpanFeedback
            ? ({ traceId: tid, spanId: sid }) =>
                tid && sid ? (
                  <Fragment key={`${tid}:${sid}`}>
                    {renderSpanFeedback({ traceId: tid, spanId: sid, feedbackOptions })}
                  </Fragment>
                ) : null
            : undefined
        }
        headerActionsSlot={traceId && headerActionsSlot ? headerActionsSlot({ traceId, spans }) : undefined}
      />
      {/* Rendered after the trace panel: DataPanel stacking follows DOM order. */}
      {renderThread?.({
        open: isFullThreadOpen,
        threadId: fullThreadId,
        depth: 2,
        onClose: () => setFullThreadTraceId(null),
        feedbackOptions,
      })}
      <ScoreDataPanelView
        depth={depth}
        score={featuredScore}
        onClose={() => selectScore(null)}
        onOpenTrace={onOpenScoreTrace}
        renderDatasetDialog={renderScoreDatasetDialog}
      />
      {renderDatasetDialog?.({
        traceId: datasetDialogTarget?.traceId,
        rootSpanId: datasetDialogTarget?.rootSpanId,
        isOpen: !!datasetDialogTarget,
        onClose: () => setDatasetDialogTarget(null),
      })}
    </>
  );
}
