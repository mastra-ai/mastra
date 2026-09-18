import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import type { TraceDataPanelView } from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useTraceSpanNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-span-navigation';
import type { ComponentProps, ReactNode } from 'react';

import { TraceDataPanel } from '@/domains/traces/components/trace-data-panel';
import { TraceMessagesPanel } from '@/domains/traces/components/trace-messages-panel';
import { getTraceThreadId } from '@/domains/traces/components/trace-thread-context';
import { TraceThreadPanel } from '@/domains/traces/components/trace-thread-panel';
import { Link } from '@/lib/link';

type TraceDataPanelViewProps = ComponentProps<typeof TraceDataPanelView>;

function getEntityHref(entityType: string | null | undefined, entityId: string | null | undefined) {
  if (!entityId || !entityType) return undefined;
  const normalizedEntityType = entityType.toLowerCase();
  if (normalizedEntityType.includes('workflow')) return `/workflows/${encodeURIComponent(entityId)}/graph`;
  if (normalizedEntityType.includes('agent')) return `/agents/${encodeURIComponent(entityId)}/chat/new`;
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
  /** Closes the span panel. Defaults to `onSpanSelect(undefined)`. */
  onSpanClose?: () => void;

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
  /** When true, the whole panel shows the trace's thread (every turn) instead of the trace timeline. */
  isFullThreadOpen?: boolean;
  /** Enables the in-place "View full thread" swap; without it the action falls back to a link. */
  onFullThreadOpenChange?: (open: boolean) => void;
  scoresTabBadge?: ReactNode;
  scoresTabSlot?: TraceDataPanelViewProps['scoresTabSlot'];
  usage?: TraceDataPanelViewProps['usage'];
  traceHref?: string;
  /** Drawer width; defaults to `wide`. */
  size?: TraceDataPanelViewProps['size'];
  /** Sibling-drawer elevation (see `DataPanel`). */
  depth?: TraceDataPanelViewProps['depth'];
  /** Rendered inside the drawer above the trace header (e.g. inbox feedback context). */
  headerSlot?: ReactNode;
  /** Accessible drawer name; defaults to the trace id. */
  title?: string;
  showUnavailableFeaturesMsg?: TraceDataPanelViewProps['showUnavailableFeaturesMsg'];

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
  onSpanClose,
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
  scoresTabBadge,
  scoresTabSlot,
  usage,
  traceHref,
  size,
  depth,
  headerSlot,
  title,
  showUnavailableFeaturesMsg,
  spanActiveTab,
  onSpanTabChange,
  spanFeedbackTabBadge,
  spanFeedbackTabSlot,
}: TraceSpanPanelProps) {
  const { data: spanDetailData, isLoading: isLoadingSpanDetail } = useSpanDetail(traceId, selectedSpanId ?? '');
  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(spans, selectedSpanId, onSpanSelect);

  // The trace summary links the entity to its Studio page; only Studio knows the routes.
  const rootSpan = anchorSpanId
    ? spans?.find(s => s.spanId === anchorSpanId)
    : spans?.find(s => s.parentSpanId == null);
  const entityHref = getEntityHref(rootSpan?.entityType, rootSpan?.entityId);
  const threadId = getTraceThreadId(rootSpan, anchorSpanId);

  if (traceId && isFullThreadOpen && threadId) {
    return (
      <TraceThreadPanel
        title={title}
        threadId={threadId}
        onBack={() => onFullThreadOpenChange?.(false)}
        onClose={onClose}
      />
    );
  }

  return (
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
      title={title}
      showUnavailableFeaturesMsg={showUnavailableFeaturesMsg}
      feedbackTabBadge={feedbackTabBadge}
      feedbackTabSlot={feedbackTabSlot}
      featuredSpanIds={featuredSpanIds}
      messagesPanelSlot={
        traceId && showPartialThread && threadId ? (
          <TraceMessagesPanel
            traceId={traceId}
            threadId={threadId}
            onViewFullThread={onFullThreadOpenChange ? () => onFullThreadOpenChange(true) : undefined}
            onHighlightSpans={onHighlightSpans}
          />
        ) : undefined
      }
      scoresTabBadge={scoresTabBadge}
      scoresTabSlot={scoresTabSlot}
      // The scores tab needs the width; the span drilldown gives it up.
      onTabChange={tab => {
        if (tab === 'scores' && selectedSpanId) (onSpanClose ?? (() => onSpanSelect(undefined)))();
      }}
      spanPanelSlot={
        traceId && selectedSpanId ? (
          <SpanDataPanelView
            traceId={traceId}
            spanId={selectedSpanId}
            span={spanDetailData?.span}
            isAnchor={anchorSpanId ? selectedSpanId === anchorSpanId : undefined}
            isLoading={isLoadingSpanDetail}
            onClose={onSpanClose ?? (() => onSpanSelect(undefined))}
            onPrevious={handlePreviousSpan}
            onNext={handleNextSpan}
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
