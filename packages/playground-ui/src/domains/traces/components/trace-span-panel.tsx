import { useSpanDetail, useThreadHasOtherTraces } from '@mastra/react/hooks/traces';
import { MessagesSquareIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { TraceScoresTab } from '@/domains/scores/components/trace-scores-tab';
import { SpanDataPanelView } from '@/domains/traces/components/span-data-panel-view';
import { SpanFeedbackTab } from '@/domains/traces/components/span-feedback-tab';
import { TraceDataPanel } from '@/domains/traces/components/trace-data-panel';
import type { TraceDataPanelView } from '@/domains/traces/components/trace-data-panel-view';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceMessagesPanel } from '@/domains/traces/components/trace-messages-panel';
import { useTracePanelHost } from '@/domains/traces/components/trace-panel-host';
import {
  SpanFeedbackCount,
  TraceFeedbackCount,
  TraceScoresCount,
} from '@/domains/traces/components/trace-panel-tab-counts';
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
  onPrevious?: () => void;
  onNext?: () => void;
  onSaveAsDatasetItem?: TraceDataPanelViewProps['onSaveAsDatasetItem'];
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
  /** Shows the trace and span Feedback tabs (and the full-thread view's per-trace Feedback tab). */
  withFeedback: boolean;
  /** Called when a score card of the Scores tab is clicked; defaults to the host's `openScore`. */
  onScoreSelect?: (scoreId: string) => void;
  usage?: TraceDataPanelViewProps['usage'];
  traceHref?: string;
  /** Drawer width; defaults to `wide`. */
  size?: TraceDataPanelViewProps['size'];
  /** Sibling-drawer elevation (see `DataPanel`). */
  depth?: TraceDataPanelViewProps['depth'];
  /** Rendered inside the drawer above the trace header (e.g. feedback context). */
  headerSlot?: ReactNode;
  /** Accessible drawer name; defaults to the trace id. */
  title?: string;
  showUnavailableFeaturesMsg?: TraceDataPanelViewProps['showUnavailableFeaturesMsg'];
  spanView?: TraceDataPanelViewProps['spanView'];
  onSpanViewChange?: TraceDataPanelViewProps['onSpanViewChange'];

  // Span-panel pass-through.
  spanActiveTab?: string;
  onSpanTabChange?: (tab: string) => void;
}

/**
 * Shared trace → span drilldown drawer: `TraceDataPanel` with a nested `SpanDataPanelView`.
 * Owns the span-detail fetch, prev/next span navigation and the Feedback/Scores tabs
 * (each tab fetches its own count), so call sites only wire selection and routing.
 */
export function TraceSpanPanel({
  traceId,
  spans,
  isLoadingSpans,
  selectedSpanId,
  onSpanSelect,
  onClose,
  anchorSpanId,
  onPrevious,
  onNext,
  onSaveAsDatasetItem,
  showPartialThread,
  featuredSpanIds,
  onHighlightSpans,
  isFullThreadOpen,
  onFullThreadOpenChange,
  withQueryTrace,
  withFeedback,
  onScoreSelect,
  usage,
  traceHref,
  size,
  depth,
  headerSlot,
  title,
  showUnavailableFeaturesMsg,
  spanView,
  onSpanViewChange,
  spanActiveTab,
  onSpanTabChange,
}: TraceSpanPanelProps) {
  const { data: spanDetailData, isLoading: isLoadingSpanDetail } = useSpanDetail({
    traceId: traceId,
    spanId: selectedSpanId ?? '',
    queryOptions: { enabled: !!traceId && !!selectedSpanId },
  });
  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(spans, selectedSpanId, onSpanSelect);
  const { Link, paths } = useLinkComponent();
  const host = useTracePanelHost();
  const handleScoreSelect =
    onScoreSelect ?? (traceId && host.openScore ? (scoreId: string) => host.openScore?.(traceId, scoreId) : undefined);

  // The trace summary links the entity to its page; the app's link provider owns the routes.
  const rootSpan = anchorSpanId
    ? spans?.find(s => s.spanId === anchorSpanId)
    : spans?.find(s => s.parentSpanId == null);
  const rootSpanId = rootSpan?.spanId;
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
        initialSpanId={selectedSpanId}
        onPrevious={onPrevious}
        onNext={onNext}
        placement="traces-list"
        LinkComponent={Link}
        traceHref={traceHref}
        size={size}
        depth={depth}
        headerSlot={headerSlot}
        headerActionsSlot={traceId ? host.renderHeaderActions?.({ traceId, spans }) : undefined}
        title={title}
        showUnavailableFeaturesMsg={showUnavailableFeaturesMsg}
        spanView={spanView}
        onSpanViewChange={onSpanViewChange}
        feedbackTabBadge={withFeedback && traceId ? <TraceFeedbackCount traceId={traceId} /> : undefined}
        feedbackTabSlot={withFeedback ? renderTraceFeedbackTab : undefined}
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
        scoresTabBadge={traceId && rootSpanId ? <TraceScoresCount traceId={traceId} spanId={rootSpanId} /> : undefined}
        scoresTabSlot={({ traceId: tid, rootSpanId: sid }) =>
          sid ? (
            <TraceScoresTab key={`${tid}:${sid}`} traceId={tid} spanId={sid} onScoreSelect={handleScoreSelect} />
          ) : null
        }
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
              feedbackTabBadge={
                withFeedback ? <SpanFeedbackCount traceId={traceId} spanId={selectedSpanId} /> : undefined
              }
              feedbackTabSlot={withFeedback ? renderSpanFeedbackTab : undefined}
            />
          ) : null
        }
      />
      {/* Rendered after the trace panel: DataPanel stacking follows DOM order. */}
      <TraceThreadPanel
        open={!!(traceId && isFullThreadOpen && threadId)}
        depth={depth && depth > 1 ? 3 : 2}
        threadId={threadId ?? ''}
        withQueryTrace={withQueryTrace}
        withFeedback={withFeedback}
        onClose={() => onFullThreadOpenChange?.(false)}
      />
    </>
  );
}

function renderTraceFeedbackTab({ traceId }: { traceId: string }) {
  return <TraceFeedbackTab traceId={traceId} />;
}

// Keyed per span so the tab's pagination resets when the selection changes.
function renderSpanFeedbackTab({ traceId, spanId }: { traceId: string; spanId: string }) {
  return <SpanFeedbackTab key={`${traceId}:${spanId}`} traceId={traceId} spanId={spanId} />;
}
