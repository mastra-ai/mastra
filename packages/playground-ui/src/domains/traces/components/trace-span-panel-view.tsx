import type { GetScorerResponse } from '@mastra/client-js';
import type { ComponentProps, ReactNode } from 'react';
import type { SpanRecord, TraceSpanRecord } from '../types';
import type { TriggerScorerArgs } from '@/domains/scores/components/span-scoring';
import { SpanDataPanelView } from '@/domains/traces/components/span-data-panel-view';
import type { RegisteredTools } from '@/domains/traces/components/span-payload/span-tools-section';
import { TraceDataPanel } from '@/domains/traces/components/trace-data-panel';
import type { TraceDataPanelView } from '@/domains/traces/components/trace-data-panel-view';
import { TraceMessagesPanel } from '@/domains/traces/components/trace-messages-panel';
import { getTraceRootSpan, getTraceThreadId } from '@/domains/traces/components/trace-thread-context';
import { Button } from '@/ds/components/Button';
import { IconChatBubbles } from '@/ds/icons/central/IconChatBubbles';
import { useLinkComponent } from '@/lib/framework';
import type { LinkComponentPaths } from '@/lib/framework';

type TraceDataPanelViewProps = ComponentProps<typeof TraceDataPanelView>;
type SpanDataPanelViewProps = ComponentProps<typeof SpanDataPanelView>;

function getEntityHref(
  paths: LinkComponentPaths,
  entityType: string | null | undefined,
  entityId: string | null | undefined,
) {
  if (!entityId || !entityType) return undefined;
  const normalizedEntityType = entityType.toLowerCase();
  if (normalizedEntityType.includes('workflow')) return paths.workflowLink(entityId) || undefined;
  if (normalizedEntityType.includes('agent')) return paths.agentLink(entityId) || undefined;
  return undefined;
}

export interface TraceSpanPanelViewProps {
  /** Keep the panel mounted and pass `undefined` to close it, so the drawer animates out. */
  traceId?: string;
  /** Light spans of the trace (or branch) the panel draws (`getTraceLight` / `getBranch`). */
  spans: TraceDataPanelViewProps['spans'];
  isLoadingSpans: boolean;
  /** Controlled span selection (URL state on the traces page, local state in the chat aside). */
  selectedSpanId: string | null;
  onSpanSelect: (spanId: string | undefined) => void;
  onClose: () => void;

  // Data handed down by the host. The panel never fetches, so a host with its own transport (e.g. an
  // MCP server app) can draw it from the same response types the Studio hooks return.

  /** Full record of the selected span (`getSpan`). */
  selectedSpan?: SpanRecord;
  isLoadingSelectedSpan?: boolean;
  /**
   * Every span of the trace with its payload (`getTrace`). The Messages column reconstructs the turn from
   * them, rows started by a signal are labelled with it, and tool calls show the result their span recorded.
   */
  traceSpans?: TraceSpanRecord[];
  isLoadingTraceSpans?: boolean;
  traceSpansError?: unknown;
  /** The tool registry (`listTools`), so the tools a span offered link to their pages. */
  registeredTools?: RegisteredTools;
  /** The scorers "Score trace" offers (`listScorers`). */
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
  /** Starts a scorer on the trace's root span; "Score trace" only shows when it is set. */
  onTriggerScorer?: (args: TriggerScorerArgs) => Promise<unknown>;
  /** When set, "Download trace JSON" calls it; the host loads and saves the trace. */
  onDownloadTrace?: TraceDataPanelViewProps['onDownloadTrace'];
  isDownloadingTrace?: boolean;
  /** Whether the trace's thread holds more turns than this one; with `onOpenFullThread`, offers "Open full thread". */
  threadHasOtherTraces?: boolean;
  /** Opens the trace's whole thread; the host renders it (e.g. a `TraceThreadPanelView` stacked above). */
  onOpenFullThread?: () => void;
  /** Controlled span search; see `TraceDataPanelView`. */
  searchQuery?: TraceDataPanelViewProps['searchQuery'];
  onSearchQueryChange?: TraceDataPanelViewProps['onSearchQueryChange'];
  searchResult?: TraceDataPanelViewProps['searchResult'];

  // Trace-panel pass-through.
  anchorSpanId?: string;
  entityType?: TraceDataPanelViewProps['entityType'];
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  onSaveAsDatasetItem?: TraceDataPanelViewProps['onSaveAsDatasetItem'];
  feedbackTabBadge?: ReactNode;
  feedbackTabSlot?: TraceDataPanelViewProps['feedbackTabSlot'];
  /** Enables the "Messages" column (reconstructed turn) when the displayed root is a complete agent trace with a thread id. */
  showPartialThread?: boolean;
  /** Span ids featured in the timeline (non-featured spans are faded). */
  featuredSpanIds?: string[];
  /** Called with the span ids behind a reconstructed message when the user asks to highlight them. */
  onHighlightSpans?: (spanIds: string[]) => void;
  scoresTabBadge?: ReactNode;
  scoresTabSlot?: TraceDataPanelViewProps['scoresTabSlot'];
  usage?: TraceDataPanelViewProps['usage'];
  rootStreamingTimings?: TraceDataPanelViewProps['rootStreamingTimings'];
  traceHref?: string;
  /** Drawer width; defaults to `wide`. */
  size?: TraceDataPanelViewProps['size'];
  /** Sibling-drawer elevation (see `DataPanel`). */
  depth?: TraceDataPanelViewProps['depth'];
  /** Rendered inside the drawer above the trace header (e.g. feedback context). */
  headerSlot?: ReactNode;
  /** Integration actions displayed alongside the trace controls. */
  headerActionsSlot?: ReactNode;
  /** Accessible drawer name; defaults to the trace id. */
  title?: string;
  showUnavailableFeaturesMsg?: TraceDataPanelViewProps['showUnavailableFeaturesMsg'];
  spanView?: TraceDataPanelViewProps['spanView'];
  onSpanViewChange?: TraceDataPanelViewProps['onSpanViewChange'];

  // Span-panel pass-through.
  spanActiveTab?: SpanDataPanelViewProps['activeTab'];
  onSpanTabChange?: SpanDataPanelViewProps['onTabChange'];
  spanFeedbackTabBadge?: ReactNode;
  spanFeedbackTabSlot?: SpanDataPanelViewProps['feedbackTabSlot'];
}

/**
 * The trace → span drilldown drawer: the trace panel with the selected span's detail beside it, and the
 * trace's turn in a Messages column. Data-agnostic: every record comes from the props and every action
 * goes out through a callback, so Studio (`TraceSpanPanel`) and other hosts compose the same panel.
 */
export function TraceSpanPanelView({
  traceId,
  spans,
  isLoadingSpans,
  selectedSpanId,
  onSpanSelect,
  onClose,
  selectedSpan,
  isLoadingSelectedSpan,
  traceSpans,
  isLoadingTraceSpans,
  traceSpansError,
  registeredTools,
  scorers,
  isLoadingScorers,
  onTriggerScorer,
  onDownloadTrace,
  isDownloadingTrace,
  threadHasOtherTraces = false,
  onOpenFullThread,
  searchQuery,
  onSearchQueryChange,
  searchResult,
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
  scoresTabBadge,
  scoresTabSlot,
  usage,
  rootStreamingTimings,
  traceHref,
  size,
  depth,
  headerSlot,
  headerActionsSlot,
  title,
  showUnavailableFeaturesMsg,
  spanView,
  onSpanViewChange,
  spanActiveTab,
  onSpanTabChange,
  spanFeedbackTabBadge,
  spanFeedbackTabSlot,
}: TraceSpanPanelViewProps) {
  const { Link, paths } = useLinkComponent();

  // The trace summary links the entity to its page; the app's link provider owns the routes.
  const rootSpan = getTraceRootSpan(spans, anchorSpanId);
  const entityHref = getEntityHref(paths, rootSpan?.entityType, rootSpan?.entityId);
  const threadId = getTraceThreadId(rootSpan, anchorSpanId);
  const hasMessagesPanel = !!(traceId && showPartialThread && threadId);
  // A single-trace thread would show exactly what the Messages column already shows.
  const showFullThreadAction = hasMessagesPanel && threadHasOtherTraces && !!onOpenFullThread;

  return (
    <TraceDataPanel
      traceId={traceId}
      spans={spans}
      traceSpans={traceSpans}
      scorers={scorers}
      isLoadingScorers={isLoadingScorers}
      onTriggerScorer={onTriggerScorer}
      onDownloadTrace={onDownloadTrace}
      isDownloadingTrace={isDownloadingTrace}
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      searchResult={searchResult}
      anchorSpanId={anchorSpanId}
      entityType={entityType}
      entityHref={entityHref}
      usage={usage}
      rootStreamingTimings={rootStreamingTimings}
      isLoading={isLoadingSpans}
      onClose={onClose}
      onSpanSelect={onSpanSelect}
      onSaveAsDatasetItem={onSaveAsDatasetItem}
      initialSpanId={initialSpanId ?? selectedSpanId}
      onPrevious={onPrevious}
      onNext={onNext}
      placement="traces-list"
      LinkComponent={Link}
      traceHref={traceHref}
      size={size}
      depth={depth}
      headerSlot={headerSlot}
      headerActionsSlot={headerActionsSlot}
      title={title}
      showUnavailableFeaturesMsg={showUnavailableFeaturesMsg}
      spanView={spanView}
      onSpanViewChange={onSpanViewChange}
      feedbackTabBadge={feedbackTabBadge}
      feedbackTabSlot={feedbackTabSlot}
      featuredSpanIds={featuredSpanIds}
      messagesPanelSlot={
        hasMessagesPanel ? (
          <TraceMessagesPanel
            spans={traceSpans}
            isLoading={isLoadingTraceSpans}
            error={traceSpansError}
            onHighlightSpans={onHighlightSpans}
          />
        ) : undefined
      }
      sideHeaderActions={
        showFullThreadAction
          ? ({ compact }) => (
              <Button
                tooltip={compact ? 'Open full thread' : undefined}
                icon={<IconChatBubbles />}
                variant="ghost"
                size="sm"
                // At a side column of 500px or less, collapse to a round icon button; the label stays for screen readers.
                className="@max-[501px]:w-control-sm @max-[501px]:rounded-full @max-[501px]:px-0 @max-[501px]:[&>[data-slot=button-icon]]:ml-0"
                onClick={onOpenFullThread}
              >
                <span className="@max-[501px]:sr-only">Open full thread</span>
              </Button>
            )
          : undefined
      }
      scoresTabBadge={scoresTabBadge}
      scoresTabSlot={scoresTabSlot}
      spanPanelSlot={
        traceId && selectedSpanId ? (
          <SpanDataPanelView
            traceId={traceId}
            spanId={selectedSpanId}
            span={selectedSpan}
            isLoading={isLoadingSelectedSpan}
            traceSpans={traceSpans}
            registeredTools={registeredTools}
            onClose={() => onSpanSelect(undefined)}
            activeTab={spanActiveTab}
            onTabChange={onSpanTabChange}
            feedbackTabBadge={spanFeedbackTabBadge}
            feedbackTabSlot={spanFeedbackTabSlot}
          />
        ) : null
      }
    />
  );
}
