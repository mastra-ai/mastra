import type { GetScorerResponse } from '@mastra/client-js';
import type { ComponentProps, ReactNode } from 'react';
import type { SpanRecord, TraceSpanRecord } from '../types';
import type { SpanDataPanelView } from './span-data-panel-view';
import type { TraceNavigation } from './trace-navigation';
import { TracePanel } from './trace-panel';
import type {
  TracePanelDatasetButtonProps,
  TracePanelFrameProps,
  TracePanelMessagesProps,
  TracePanelScoreDialogProps,
  TracePanelSpan,
  TracePanelSpansProps,
  TraceSpanView,
} from './trace-panel';
import { getTraceRootSpan, getTraceThreadId } from './trace-thread-context';
import type { TraceUsageSummary } from '@/domains/traces/trace-list-columns';

type SpanDataPanelViewProps = ComponentProps<typeof SpanDataPanelView>;

export interface TraceSpanPanelViewProps {
  /** Keep the panel mounted and pass `undefined` to close it, so the drawer animates out. */
  traceId?: string;
  /** The trace's spans (`getTrace`, or `getBranch` for a branch). The panel never fetches: the host hands them down. */
  spans: TracePanelSpan[] | undefined;
  isLoadingSpans: boolean;
  /** Controlled span selection (URL state on the traces page, local state in the chat aside). */
  selectedSpanId: string | null;
  onSpanSelect: (spanId: string | undefined) => void;
  onClose: () => void;
  /** Where the panel opens things (the entity, tools, delegated agents, its own trace page): the host's callbacks. */
  navigation?: TraceNavigation;

  /** The trace's spans with their payloads, behind the Messages column, the signal labels and the tool results. */
  fullTrace?: { spans?: TraceSpanRecord[]; isLoading: boolean; error?: Error };
  /** The open span's record (`getSpan`). */
  selectedSpan?: { span?: SpanRecord; isLoading: boolean };
  /** The trace's thread holds other turns: with `onOpenFullThread`, the panel offers to open it. */
  threadHasOtherTraces?: boolean;
  /** The scorers "Score trace" offers. */
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
  /** Starts a scorer on the root span. Without it, the panel offers no scoring. */
  onTriggerScorer?: TracePanelScoreDialogProps['onTriggerScorer'];
  /** Downloads the trace. Without it, the panel offers no download. */
  onDownload?: (traceId: string) => void;
  isDownloading?: boolean;
  /** Draws the Messages column; defaults to `TracePanel.Messages` (Studio: `LiveTraceMessages`, with live tool cards). */
  renderMessages?: (props: TracePanelMessagesProps) => ReactNode;
  /** Replaces the span's Input tab (Studio: `LiveSpanInput`). */
  spanInput?: ReactNode;
  /** Replaces the span's Output tab (Studio: `LiveSpanOutput`). */
  spanOutput?: ReactNode;

  // Trace-panel pass-through.
  anchorSpanId?: string;
  /** Root entity type when known before the spans load (e.g. from the listed row); `null` is a trace with none. */
  entityType?: string | null;
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  onSaveAsDatasetItem?: TracePanelDatasetButtonProps['onSaveAsDatasetItem'];
  feedbackTabBadge?: ReactNode;
  /** Renders the trace's feedback in the side column's Feedback view. */
  feedbackTabSlot?: (args: { traceId: string }) => ReactNode;
  /** Enables the "Messages" column (reconstructed turn) when the displayed root is a complete agent trace with a thread id. */
  showPartialThread?: boolean;
  /** Span ids featured in the timeline (non-featured spans are faded). */
  featuredSpanIds?: string[];
  /** Called with the span ids behind a reconstructed message when the user asks to highlight them. */
  onHighlightSpans?: (spanIds: string[]) => void;
  /**
   * Offers "Open full thread" when the trace's thread holds other turns, and hands the thread id to the
   * host, which shows the thread wherever it wants (e.g. a `TraceThreadPanel` stacked above). Without it,
   * the action is not offered.
   */
  onOpenFullThread?: (threadId: string) => void;
  scoresTabBadge?: ReactNode;
  /** Renders the root span's scores in the side column's Scores view. */
  scoresTabSlot?: (args: { traceId: string; rootSpanId: string | undefined }) => ReactNode;
  usage?: TraceUsageSummary;
  rootStreamingTimings?: TracePanelSpansProps['streamingTimings'];
  /** Drawer width; defaults to `wide`. */
  size?: TracePanelFrameProps['size'];
  /** Sibling-drawer elevation (see `DataPanel`). */
  depth?: TracePanelFrameProps['depth'];
  /** Rendered inside the drawer above the trace header (e.g. feedback context). */
  headerSlot?: ReactNode;
  /** Integration actions displayed alongside the trace controls. */
  headerActionsSlot?: ReactNode;
  /** Accessible drawer name; defaults to the trace id. */
  title?: string;
  spanView?: TraceSpanView;
  onSpanViewChange?: (view: TraceSpanView) => void;

  // Span-panel pass-through.
  spanActiveTab?: SpanDataPanelViewProps['activeTab'];
  onSpanTabChange?: SpanDataPanelViewProps['onTabChange'];
  spanFeedbackTabBadge?: ReactNode;
  spanFeedbackTabSlot?: SpanDataPanelViewProps['feedbackTabSlot'];
}

const renderDefaultMessages = (props: TracePanelMessagesProps) => <TracePanel.Messages {...props} />;

/**
 * The trace → span drilldown drawer, drawn from the records the host hands it: a ready-made `TracePanel`
 * composition that never fetches. Studio feeds it through `TraceSpanPanel`; any other host (e.g. an MCP
 * server app) passes its own records and callbacks.
 */
export function TraceSpanPanelView({
  traceId,
  spans,
  isLoadingSpans,
  selectedSpanId,
  onSpanSelect,
  onClose,
  navigation,
  fullTrace,
  selectedSpan,
  threadHasOtherTraces = false,
  scorers,
  isLoadingScorers,
  onTriggerScorer,
  onDownload,
  isDownloading,
  renderMessages = renderDefaultMessages,
  spanInput,
  spanOutput,
  anchorSpanId,
  entityType,
  initialSpanId,
  onPrevious,
  onNext,
  onSaveAsDatasetItem,
  feedbackTabBadge,
  feedbackTabSlot,
  showPartialThread,
  featuredSpanIds,
  onHighlightSpans,
  onOpenFullThread,
  scoresTabBadge,
  scoresTabSlot,
  usage,
  rootStreamingTimings,
  size,
  depth,
  headerSlot,
  headerActionsSlot,
  title,
  spanView,
  onSpanViewChange,
  spanActiveTab,
  onSpanTabChange,
  spanFeedbackTabBadge,
  spanFeedbackTabSlot,
}: TraceSpanPanelViewProps) {
  const rootSpan = getTraceRootSpan(spans, anchorSpanId);
  const threadId = getTraceThreadId(rootSpan, anchorSpanId);
  const hasMessages = !!(traceId && showPartialThread && threadId);
  // A single-trace thread would show exactly what the Messages column already shows.
  const fullThreadId = hasMessages && threadHasOtherTraces && onOpenFullThread ? threadId : undefined;

  return (
    <TracePanel
      traceId={traceId}
      spans={spans}
      isLoading={isLoadingSpans}
      anchorSpanId={anchorSpanId}
      entityType={entityType}
      selectedSpanId={initialSpanId ?? selectedSpanId}
      onSpanSelect={onSpanSelect}
      spanView={spanView}
      onSpanViewChange={onSpanViewChange}
      onClose={onClose}
      navigation={navigation}
    >
      <TracePanel.Frame
        title={title}
        size={size}
        depth={depth}
        banner={headerSlot}
        header={
          <TracePanel.Header
            navigation={<TracePanel.Navigation onPrevious={onPrevious} onNext={onNext} />}
            title={<TracePanel.TraceId />}
            actions={
              <>
                {headerActionsSlot}
                {onTriggerScorer && <TracePanel.ScoreButton />}
                {onSaveAsDatasetItem && <TracePanel.DatasetButton onSaveAsDatasetItem={onSaveAsDatasetItem} />}
                <TracePanel.OpenPageButton />
                {onDownload && <TracePanel.DownloadButton onDownload={onDownload} isPending={isDownloading} />}
                <TracePanel.CloseButton />
              </>
            }
          />
        }
        summary={
          <TracePanel.Summary
            entity={<TracePanel.Entity />}
            status={<TracePanel.Status />}
            stats={<TracePanel.Stats usage={usage} />}
          />
        }
        body={
          <TracePanel.Body
            side={
              traceId &&
              (hasMessages || feedbackTabSlot || scoresTabSlot) && (
                <TracePanel.Side
                  messages={
                    hasMessages &&
                    renderMessages({
                      spans: fullTrace?.spans,
                      isLoading: fullTrace?.isLoading,
                      error: fullTrace?.error,
                      onHighlightSpans,
                    })
                  }
                  feedback={feedbackTabSlot?.({ traceId })}
                  feedbackCount={feedbackTabBadge}
                  scores={scoresTabSlot?.({ traceId, rootSpanId: rootSpan?.spanId })}
                  scoresCount={scoresTabBadge}
                  actions={
                    fullThreadId && <TracePanel.OpenFullThreadButton onClick={() => onOpenFullThread?.(fullThreadId)} />
                  }
                />
              )
            }
            main={
              <TracePanel.Main
                toolbar={
                  <TracePanel.SpansToolbar search={<TracePanel.Search />} actions={<TracePanel.SpanViewSwitch />} />
                }
                notices={<TracePanel.RootError />}
                spans={
                  <TracePanel.Spans
                    featuredSpanIds={featuredSpanIds}
                    streamingTimings={rootStreamingTimings}
                    traceSpans={fullTrace?.spans}
                  />
                }
              />
            }
            span={
              <TracePanel.SpanDetail
                span={selectedSpan?.span}
                isLoading={selectedSpan?.isLoading}
                activeTab={spanActiveTab}
                onTabChange={onSpanTabChange}
                feedbackTabBadge={spanFeedbackTabBadge}
                feedbackTabSlot={spanFeedbackTabSlot}
                traceSpans={fullTrace?.spans}
                input={spanInput}
                output={spanOutput}
              />
            }
          />
        }
        dialogs={
          onTriggerScorer && (
            <TracePanel.ScoreDialog
              scorers={scorers}
              isLoadingScorers={isLoadingScorers}
              onTriggerScorer={onTriggerScorer}
            />
          )
        }
      />
    </TracePanel>
  );
}
