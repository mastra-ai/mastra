import { SpanType } from '@mastra/core/observability';
import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import type { TraceDataPanelView } from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useTraceSpanNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-span-navigation';
import type { ComponentProps, ReactNode } from 'react';

import { TraceDataPanel } from '@/domains/traces/components/trace-data-panel';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
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
  traceId: string;
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
  /** Enables the reconstructed turn tab when the displayed root is a complete agent trace with a thread id. */
  showPartialThread?: boolean;
  scoresTabBadge?: ReactNode;
  scoresTabSlot?: TraceDataPanelViewProps['scoresTabSlot'];
  usage?: TraceDataPanelViewProps['usage'];
  traceHref?: string;
  collapsed?: TraceDataPanelViewProps['collapsed'];
  onCollapsedChange?: TraceDataPanelViewProps['onCollapsedChange'];
  showUnavailableFeaturesMsg?: TraceDataPanelViewProps['showUnavailableFeaturesMsg'];
  className?: string;

  // Span-panel pass-through.
  spanActiveTab?: string;
  onSpanTabChange?: (tab: string) => void;
  spanFeedbackTabBadge?: ReactNode;
  spanFeedbackTabSlot?: SpanDataPanelViewProps['feedbackTabSlot'];
  spanPanelClassName?: string;
}

/**
 * Shared trace → span drilldown panel: `TraceDataPanel` with a nested `SpanDataPanelView`.
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
  scoresTabBadge,
  scoresTabSlot,
  usage,
  traceHref,
  collapsed,
  onCollapsedChange,
  showUnavailableFeaturesMsg,
  className,
  spanActiveTab,
  onSpanTabChange,
  spanFeedbackTabBadge,
  spanFeedbackTabSlot,
  spanPanelClassName,
}: TraceSpanPanelProps) {
  const { data: spanDetailData, isLoading: isLoadingSpanDetail } = useSpanDetail(traceId, selectedSpanId ?? '');
  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(spans, selectedSpanId, onSpanSelect);

  // The trace summary links the entity to its Studio page; only Studio knows the routes.
  const rootSpan = anchorSpanId
    ? spans?.find(s => s.spanId === anchorSpanId)
    : spans?.find(s => s.parentSpanId == null);
  const entityHref = getEntityHref(rootSpan?.entityType, rootSpan?.entityId);
  const hasThreadId = rootSpan && 'threadId' in rootSpan && typeof rootSpan.threadId === 'string';
  const canShowPartialThread =
    showPartialThread && !anchorSpanId && rootSpan?.spanType === SpanType.AGENT_RUN && hasThreadId;

  return (
    <TraceDataPanel
      className={className}
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
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      showUnavailableFeaturesMsg={showUnavailableFeaturesMsg}
      feedbackTabBadge={feedbackTabBadge}
      feedbackTabSlot={feedbackTabSlot}
      partialThreadTabSlot={
        canShowPartialThread
          ? ({ traceId: selectedTraceId }) => <TraceThreadItemView traceId={selectedTraceId} />
          : undefined
      }
      scoresTabBadge={scoresTabBadge}
      scoresTabSlot={scoresTabSlot}
      spanPanelSlot={
        selectedSpanId ? (
          <SpanDataPanelView
            className={spanPanelClassName}
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
