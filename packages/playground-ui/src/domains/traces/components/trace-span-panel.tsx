import { useSpanDetail, useThreadHasOtherTraces } from '@mastra/react/hooks';
import { MessagesSquareIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { SpanDataPanelView } from '@/domains/traces/components/span-data-panel-view';
import { TraceDataPanel } from '@/domains/traces/components/trace-data-panel';
import type { TraceDataPanelView } from '@/domains/traces/components/trace-data-panel-view';
import { TraceMessagesPanel } from '@/domains/traces/components/trace-messages-panel';
import { getTraceThreadId } from '@/domains/traces/components/trace-thread-context';
import { TraceThreadPanel } from '@/domains/traces/components/trace-thread-panel';
import { useTraceSpanNavigation } from '@/domains/traces/hooks/use-trace-span-navigation';
import { Button } from '@/ds/components/Button';
import { useLinkComponent } from '@/lib/framework';
import type { LinkComponentPaths } from '@/lib/framework';

type TraceDataPanelViewProps = ComponentProps<typeof TraceDataPanelView>;

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
type SpanDataPanelViewProps = ComponentProps<typeof SpanDataPanelView>;

export interface TraceSpanPanelProps {
  /** Keep the panel mounted and pass `undefined` to close it, so the drawer animates out. */
  traceId?: string;
  /** Spans returned by `useTraceOrBranchSpans` — the page owns the fetch, the panel renders it. */
  spans: TraceDataPanelViewProps['spans'];
  isLoadingSpans: boolean;
  /** Controlled span selection (URL state on the traces page, local state in the chat aside). */
  selectedSpanId: string | null;
  onSpanSelect: (spanId: string | undefined) => void;
  onClose: () => void;

  // Trace-panel pass-through.
  anchorSpanId?: string;
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  onSaveAsDatasetItem?: TraceDataPanelViewProps['onSaveAsDatasetItem'];
  onAddTraceMocksToItem?: TraceDataPanelViewProps['onAddTraceMocksToItem'];
  feedbackTabBadge?: ReactNode;
  feedbackTabSlot?: TraceDataPanelViewProps['feedbackTabSlot'];
  /** Enables the "Messages" column (reconstructed turn) when the displayed root is a complete agent trace with a thread id. */
  showPartialThread?: boolean;
  /** Span ids featured in the timeline (non-featured spans are faded). */
  featuredSpanIds?: string[];
  /** Called with the span ids behind a reconstructed message when the user asks to highlight them. */
  onHighlightSpans?: (spanIds: string[]) => void;
  /** When true, opens the trace's thread (every turn) in a stacked drawer above the trace panel. */
  isFullThreadOpen?: boolean;
  /** Enables the in-place "Open full thread" swap; without it the action falls back to a link. */
  onFullThreadOpenChange?: (open: boolean) => void;
  /** Full-thread view: lists through the trace-query API; `false` falls back to `listTracesLight`. */
  withQueryTrace: boolean;
  /** Full-thread view: shows the per-trace Feedback tab. */
  withFeedback: boolean;
  /** Full-thread view: opens a score of one of the thread's traces (the app owns routing). */
  onOpenScore: (traceId: string, scoreId: string) => void;
  scoresTabBadge?: ReactNode;
  scoresTabSlot?: TraceDataPanelViewProps['scoresTabSlot'];
  usage?: TraceDataPanelViewProps['usage'];
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
  spanActiveTab?: string;
  onSpanTabChange?: (tab: string) => void;
  spanFeedbackTabBadge?: ReactNode;
  spanFeedbackTabSlot?: SpanDataPanelViewProps['feedbackTabSlot'];
}

/**
 * Shared trace → span drilldown drawer: `TraceDataPanel` with a nested `SpanDataPanelView`.
 * Encapsulates the span-detail fetch and prev/next span navigation that the traces page
 * and the agent chat traces aside used to duplicate.
 */
export function TraceSpanPanel({
  traceId,
  spans,
  isLoadingSpans,
  selectedSpanId,
  onSpanSelect,
  onClose,
  anchorSpanId,
  initialSpanId,
  onPrevious,
  onNext,
  onSaveAsDatasetItem,
  onAddTraceMocksToItem,
  feedbackTabBadge,
  feedbackTabSlot,
  showPartialThread,
  featuredSpanIds,
  onHighlightSpans,
  isFullThreadOpen,
  onFullThreadOpenChange,
  withQueryTrace,
  withFeedback,
  onOpenScore,
  scoresTabBadge,
  scoresTabSlot,
  usage,
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
}: TraceSpanPanelProps) {
  const { data: spanDetailData, isLoading: isLoadingSpanDetail } = useSpanDetail({
    traceId: traceId,
    spanId: selectedSpanId ?? '',
    queryOptions: { enabled: !!traceId && !!selectedSpanId },
  });
  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(spans, selectedSpanId, onSpanSelect);
  const { Link, paths } = useLinkComponent();

  // The trace summary links the entity to its page; the app's link provider owns the routes.
  const rootSpan = anchorSpanId
    ? spans?.find(s => s.spanId === anchorSpanId)
    : spans?.find(s => s.parentSpanId == null);
  const entityHref = getEntityHref(paths, rootSpan?.entityType, rootSpan?.entityId);
  const threadId = getTraceThreadId(rootSpan, anchorSpanId);
  const hasMessagesPanel = !!(traceId && showPartialThread && threadId);
  // A single-trace thread would show exactly what the Messages column already shows.
  const hasOtherTraces = useThreadHasOtherTraces({
    threadId: hasMessagesPanel ? threadId : undefined,
    queryOptions: { enabled: !!(hasMessagesPanel ? threadId : undefined) },
  });
  const showFullThreadAction = hasMessagesPanel && hasOtherTraces && !!onFullThreadOpenChange;

  return (
    <>
      <TraceDataPanel
        traceId={traceId}
        spans={spans}
        anchorSpanId={anchorSpanId}
        entityHref={entityHref}
        usage={usage}
        isLoading={isLoadingSpans}
        onClose={onClose}
        onSpanSelect={onSpanSelect}
        onSaveAsDatasetItem={onSaveAsDatasetItem}
        onAddTraceMocksToItem={onAddTraceMocksToItem}
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
          hasMessagesPanel ? <TraceMessagesPanel traceId={traceId} onHighlightSpans={onHighlightSpans} /> : undefined
        }
        sideHeaderActions={
          showFullThreadAction
            ? ({ compact }) => (
                <Button
                  tooltip={compact ? 'Open full thread' : undefined}
                  icon={<MessagesSquareIcon />}
                  variant="ghost"
                  size="sm"
                  // At a side column of 500px or less, collapse to a round icon button; the label stays for screen readers.
                  className="@max-[501px]:w-control-sm @max-[501px]:rounded-full @max-[501px]:px-0 @max-[501px]:[&>[data-slot=button-icon]]:ml-0"
                  onClick={() => onFullThreadOpenChange(true)}
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
              span={spanDetailData?.span}
              isAnchor={anchorSpanId ? selectedSpanId === anchorSpanId : undefined}
              isLoading={isLoadingSpanDetail}
              onPrevious={handlePreviousSpan}
              onNext={handleNextSpan}
              onClose={() => onSpanSelect(undefined)}
              activeTab={spanActiveTab}
              onTabChange={onSpanTabChange}
              feedbackTabBadge={spanFeedbackTabBadge}
              feedbackTabSlot={spanFeedbackTabSlot}
            />
          ) : null
        }
      />
      {/* Rendered after the trace panel: DataPanel stacking follows DOM order. */}
      <TraceThreadPanel
        open={!!(traceId && isFullThreadOpen && threadId)}
        depth={depth && depth > 1 ? 3 : 2}
        threadId={threadId ?? ''}
        onOpenScore={onOpenScore}
        withQueryTrace={withQueryTrace}
        withFeedback={withFeedback}
        onClose={() => onFullThreadOpenChange?.(false)}
      />
    </>
  );
}
