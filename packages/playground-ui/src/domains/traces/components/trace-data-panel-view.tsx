import { useState } from 'react';
import type { ReactNode } from 'react';
import type { TraceSearchResult } from '../hooks/use-trace-search';
import type { TraceUsageSummary } from '../trace-list-columns';
import { TracePanel, pickSideView, useTracePanelSide } from './trace-panel';
import type { TracePanelSpan, TraceSideView, TraceSpanView } from './trace-panel';
import type { TraceStreamingTimings } from './trace-span-timeline';
import { getTraceRootSpan } from './trace-thread-context';
import type { DataPanelProps } from '@/ds/components/DataPanel';
import type { LinkComponent } from '@/ds/types/link-component';

export type TraceDataPanelPlacement = 'traces-list' | 'trace-page';

export type { TraceSideView, TraceSpanView } from './trace-panel';

/** A span of the panel: the light record, plus the signal that started it when one did. */
export type TraceDataPanelSpan = TracePanelSpan;

export interface TraceDataPanelViewProps {
  /** Keep the panel mounted and pass `undefined` to close it, so the drawer animates out. */
  traceId?: string;
  /** Lightweight spans for the trace. The panel never fetches: the host hands them down (Studio: `useTraceLightSpans`). */
  spans: TraceDataPanelSpan[] | undefined;
  isLoading?: boolean;
  /** When set, a "Download trace JSON" button calls it with the trace id; the host loads and saves the trace. */
  onDownloadTrace?: (traceId: string) => void;
  /** A download started through `onDownloadTrace` is in flight. */
  isDownloadingTrace?: boolean;
  /** Controlled value of the span search field; the panel keeps its own when omitted. */
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  /**
   * What the host's own search found for `searchQuery` (e.g. on its server): the spans to draw with
   * their ancestors. Omitted, the panel searches `spans` itself.
   */
  searchResult?: TraceSearchResult<TraceDataPanelSpan>;
  onClose: () => void;
  onSpanSelect?: (spanId: string | undefined) => void;
  onEvaluateTrace?: () => void;
  /** When set, an "Add full trace to dataset" button appears; the consumer owns the dialog. */
  onSaveAsDatasetItem?: (args: { traceId: string; rootSpanId: string | undefined }) => void;
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Drawer width; defaults to `wide` since the panel lays out several columns. */
  size?: DataPanelProps['size'];
  /** Elevation when opened next to other sibling panels. */
  depth?: DataPanelProps['depth'];
  /** Rendered inside the drawer above the trace header (e.g. inbox feedback context). */
  headerSlot?: ReactNode;
  /** Integration-specific actions shown alongside the standard trace controls. */
  headerActionsSlot?: ReactNode;
  /** Accessible drawer name; defaults to the trace id. */
  title?: string;
  placement: TraceDataPanelPlacement;
  /** @deprecated No longer used: the panel renders the span tree with the duration as text. */
  timelineChartWidth?: 'wide' | 'default';
  /** When both are provided, renders an "Open trace page" button. */
  LinkComponent?: LinkComponent;
  traceHref?: string;
  /** When provided, the entity name in the trace summary links to the entity's page. */
  entityHref?: string;
  /** Token and estimated-cost totals shown in the compact trace summary. */
  usage?: TraceUsageSummary;
  /**
   * Time to first chunk and first token of the trace root, marked on the timeline. Left off when
   * `anchorSpanId` shows a branch, whose spans don't count from the root.
   */
  rootStreamingTimings?: Omit<TraceStreamingTimings, 'startedAt'>;
  /**
   * Span treated as the displayed root of the timeline. Required for branch
   * subtrees from `getBranch` where the anchor has a real parent that's outside
   * `spans`. When omitted, the span with no parent is used (trace case).
   */
  anchorSpanId?: string;
  /**
   * Root entity type when the caller knows it before the spans load (e.g. from the listed row).
   * Sizes the columns from the start, so they don't shift once the trace arrives. `null` is a
   * trace known to have no entity type.
   */
  entityType?: string | null;
  /**
   * Whether to render the "Evaluating traces and saving them as dataset items is
   * available in Mastra Studio" info notice when neither `onEvaluateTrace` nor
   * `onSaveAsDatasetItem` is provided. Defaults to `true`. Pass `false` when this
   * panel is rendered inside Studio in a context that intentionally omits those
   * handlers (e.g. inline below an experiment result).
   */
  showUnavailableFeaturesMsg?: boolean;
  /**
   * When provided, a "Scores" tab appears in the side column and a "Scores" readout in the
   * summary row opens the same slot in a popover.
   */
  scoresTabSlot?: (args: { traceId: string; rootSpanId: string | undefined }) => ReactNode;
  /** Optional count rendered after the "Scores" labels, e.g. `Scores (3)`. */
  scoresTabBadge?: ReactNode;
  /**
   * When provided, a "Feedback" tab appears in the side column and a "Feedback" readout in
   * the summary row opens the same slot in a popover. Trace feedback is not scoped to a
   * span — the span panel owns that.
   */
  feedbackTabSlot?: (args: { traceId: string }) => ReactNode;
  /** Optional count rendered after the "Feedback" labels, e.g. `Feedback (3)`. */
  feedbackTabBadge?: ReactNode;
  /** Span ids to feature in the timeline; every other span is faded. */
  featuredSpanIds?: string[];
  /**
   * The "Messages" view of the side column next to the span tree (typically the
   * trace as one reconstructed agent turn). Rendered without content padding.
   */
  messagesPanelSlot?: ReactNode;
  /**
   * Actions rendered at the end of the side column's tab row (e.g. "Open full thread").
   * `compact` is true when the side column is narrow and controls collapse to icons.
   */
  sideHeaderActions?: (options: { compact: boolean }) => ReactNode;
  /** Controlled span view (tree or timeline); falls back to local state starting on the tree. */
  spanView?: TraceSpanView;
  onSpanViewChange?: (view: TraceSpanView) => void;
  /** Controlled side column view; falls back to the first available view. */
  sideView?: TraceSideView;
  onSideViewChange?: (view: TraceSideView) => void;
  /**
   * Rendered as a column to the right of the timeline inside the same card;
   * typically the span detail.
   */
  spanPanelSlot?: ReactNode;
}

/**
 * The trace drawer as one component: a ready-made composition of `TracePanel` parts, driven by props and
 * slots. Compose `TracePanel` directly to drop, reorder or replace parts.
 */
export function TraceDataPanelView({
  traceId,
  spans,
  isLoading,
  onDownloadTrace,
  isDownloadingTrace = false,
  searchQuery,
  onSearchQueryChange,
  searchResult,
  onClose,
  onSpanSelect,
  onEvaluateTrace,
  onSaveAsDatasetItem,
  initialSpanId,
  onPrevious,
  onNext,
  size,
  depth,
  headerSlot,
  headerActionsSlot,
  title,
  placement,
  LinkComponent,
  traceHref,
  entityHref,
  usage,
  rootStreamingTimings,
  anchorSpanId,
  entityType,
  showUnavailableFeaturesMsg = true,
  scoresTabSlot,
  scoresTabBadge,
  feedbackTabSlot,
  feedbackTabBadge,
  featuredSpanIds,
  messagesPanelSlot,
  sideHeaderActions,
  sideView: controlledSideView,
  onSideViewChange,
  spanView,
  onSpanViewChange,
  spanPanelSlot,
}: TraceDataPanelViewProps) {
  const isOnTracePage = placement === 'trace-page';

  // The side column next to the span tree hosts Messages / Feedback / Scores; which one is shown is
  // purely a local viewing choice, falling back to the first view offered.
  const offeredSideViews: TraceSideView[] = [];
  if (messagesPanelSlot) offeredSideViews.push('messages');
  if (feedbackTabSlot) offeredSideViews.push('feedback');
  if (scoresTabSlot) offeredSideViews.push('scores');
  const [ownSideView, setOwnSideView] = useState<TraceSideView>();
  const sideView = pickSideView(controlledSideView ?? ownSideView, offeredSideViews);
  const handleSideViewChange = (view: string) => {
    if (view !== 'messages' && view !== 'feedback' && view !== 'scores') return;
    setOwnSideView(view);
    onSideViewChange?.(view);
  };

  const rootSpanId = getTraceRootSpan(spans, anchorSpanId)?.spanId;
  const showUnavailableNotice =
    !isOnTracePage && !onEvaluateTrace && !onSaveAsDatasetItem && showUnavailableFeaturesMsg;
  const downloadButton = onDownloadTrace && (
    <TracePanel.DownloadButton onDownload={onDownloadTrace} isPending={isDownloadingTrace} />
  );
  const scoreButton = onEvaluateTrace && <TracePanel.ScoreButton onClick={onEvaluateTrace} />;

  return (
    <TracePanel
      traceId={traceId}
      spans={spans}
      isLoading={isLoading}
      anchorSpanId={anchorSpanId}
      entityType={entityType}
      selectedSpanId={initialSpanId}
      onSpanSelect={onSpanSelect}
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      spanView={spanView}
      onSpanViewChange={onSpanViewChange}
      sideView={sideView}
      onSideViewChange={handleSideViewChange}
      onClose={onClose}
    >
      <TracePanel.Frame title={title ?? (isOnTracePage ? 'Trace Timeline' : undefined)} size={size} depth={depth}>
        {headerSlot}
        {isOnTracePage ? (
          <TracePanel.Header>
            <TracePanel.PageHeading usage={usage} entityHref={entityHref} LinkComponent={LinkComponent} />
            <TracePanel.Actions>
              {headerActionsSlot}
              {scoreButton}
              {downloadButton}
            </TracePanel.Actions>
          </TracePanel.Header>
        ) : (
          <>
            {/* Navigation row: trace stepping and the trace id on the left; trace actions, then close, on the right. */}
            <TracePanel.Header>
              <TracePanel.Navigation onPrevious={onPrevious} onNext={onNext} />
              <TracePanel.TraceId />
              <TracePanel.Actions>
                {headerActionsSlot}
                {scoreButton}
                {onSaveAsDatasetItem && <TracePanel.DatasetButton onSaveAsDatasetItem={onSaveAsDatasetItem} />}
                {LinkComponent && traceHref && (
                  <TracePanel.OpenPageButton href={traceHref} LinkComponent={LinkComponent} />
                )}
                {downloadButton}
                <TracePanel.CloseButton />
              </TracePanel.Actions>
            </TracePanel.Header>
            {/* Summary row: what ran and how it ended on the left; timing, tokens and cost on the right. */}
            <TracePanel.Summary usage={usage} entityHref={entityHref} LinkComponent={LinkComponent} />
          </>
        )}
        <TracePanel.Body>
          {traceId && sideView && (
            <TracePanel.Side>
              <TracePanel.SideHeader>
                <TracePanel.SideTabs>
                  {messagesPanelSlot && <TracePanel.MessagesTab />}
                  {feedbackTabSlot && <TracePanel.FeedbackTab count={feedbackTabBadge} />}
                  {scoresTabSlot && <TracePanel.ScoresTab count={scoresTabBadge} />}
                </TracePanel.SideTabs>
                {sideHeaderActions && (
                  <TracePanel.SideActions>
                    <SideHeaderActions render={sideHeaderActions} />
                  </TracePanel.SideActions>
                )}
              </TracePanel.SideHeader>
              {messagesPanelSlot && (
                <TracePanel.SideContent value="messages" flush>
                  {messagesPanelSlot}
                </TracePanel.SideContent>
              )}
              {feedbackTabSlot && traceId && <TracePanel.Feedback>{feedbackTabSlot({ traceId })}</TracePanel.Feedback>}
              {scoresTabSlot && traceId && (
                <TracePanel.Scores>{scoresTabSlot({ traceId, rootSpanId })}</TracePanel.Scores>
              )}
            </TracePanel.Side>
          )}
          <TracePanel.Main>
            <TracePanel.SpansToolbar>
              <TracePanel.Search />
              <TracePanel.SpanViewSwitch />
            </TracePanel.SpansToolbar>
            <TracePanel.Spans
              featuredSpanIds={featuredSpanIds}
              streamingTimings={rootStreamingTimings}
              results={searchResult}
            >
              {showUnavailableNotice && <TracePanel.UnavailableFeaturesNotice />}
              <TracePanel.RootError />
            </TracePanel.Spans>
          </TracePanel.Main>
          {spanPanelSlot && <TracePanel.SpanPanel open>{spanPanelSlot}</TracePanel.SpanPanel>}
        </TracePanel.Body>
      </TracePanel.Frame>
    </TracePanel>
  );
}

/** The `sideHeaderActions` render prop, given the side column's width. */
function SideHeaderActions({ render }: { render: (options: { compact: boolean }) => ReactNode }) {
  const { compact } = useTracePanelSide();
  return render({ compact });
}
