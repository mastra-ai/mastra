import { useScorers, useTriggerScorer } from '@mastra/react/hooks/scores';
import { useTools } from '@mastra/react/hooks/tools';
import { useSpanDetail, useThreadHasOtherTraces, useTraceSpans } from '@mastra/react/hooks/traces';
import type { ComponentProps, ReactNode } from 'react';
import { useDownloadTraceJson } from '../hooks/use-download-trace-json';
import { useLiveToolCalls } from '../hooks/use-live-tool-calls';
import type { SpanDataPanelView } from '@/domains/traces/components/span-data-panel-view';
import { TracePanel } from '@/domains/traces/components/trace-panel';
import type {
  TracePanelDatasetButtonProps,
  TracePanelFrameProps,
  TracePanelSpan,
  TracePanelSpansProps,
  TraceSpanView,
} from '@/domains/traces/components/trace-panel';
import { getTraceRootSpan, getTraceThreadId } from '@/domains/traces/components/trace-thread-context';
import type { TraceUsageSummary } from '@/domains/traces/trace-list-columns';
import { useLinkComponent } from '@/lib/framework';
import type { LinkComponentPaths } from '@/lib/framework';

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

export interface TraceSpanPanelProps {
  /** Keep the panel mounted and pass `undefined` to close it, so the drawer animates out. */
  traceId?: string;
  /** Spans returned by `useTraceOrBranchSpans` — the page owns the fetch, the panel renders it. */
  spans: TracePanelSpan[] | undefined;
  isLoadingSpans: boolean;
  /** Controlled span selection (URL state on the traces page, local state in the chat aside). */
  selectedSpanId: string | null;
  onSpanSelect: (spanId: string | undefined) => void;
  onClose: () => void;

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
  traceHref?: string;
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
  /** @deprecated No longer used: Studio always offers scoring, so the notice never shows. */
  showUnavailableFeaturesMsg?: boolean;
  spanView?: TraceSpanView;
  onSpanViewChange?: (view: TraceSpanView) => void;

  // Span-panel pass-through.
  spanActiveTab?: SpanDataPanelViewProps['activeTab'];
  onSpanTabChange?: SpanDataPanelViewProps['onTabChange'];
  spanFeedbackTabBadge?: ReactNode;
  spanFeedbackTabSlot?: SpanDataPanelViewProps['feedbackTabSlot'];
}

/**
 * Studio's trace → span drilldown drawer: a `TracePanel` composition fed through the Mastra client. It
 * only loads data and hands it to the parts; the trace's full thread is the host's to show. A host with
 * its own transport composes `TracePanel` (and `ThreadTrace`) the same way with its own data.
 */
export function TraceSpanPanel({
  traceId,
  spans,
  isLoadingSpans,
  selectedSpanId,
  onSpanSelect,
  onClose,
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
  traceHref,
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
}: TraceSpanPanelProps) {
  const { Link, paths } = useLinkComponent();

  const selectedSpanDetail = useSpanDetail({
    traceId,
    spanId: selectedSpanId ?? '',
    queryOptions: { enabled: !!traceId && !!selectedSpanId },
  });
  // Passive: the full trace backs the Messages column, the signal labels and the tool results, and is
  // shared with the list's export; the trace list drives its refreshes.
  const fullTrace = useTraceSpans({ traceId, passive: true, queryOptions: { enabled: !!traceId } });
  // Tools only matter to an open span: its Input tab links the tools it offered to their pages.
  const { data: registeredTools } = useTools({ queryOptions: { enabled: !!selectedSpanId } });
  const scorers = useScorers();
  const triggerScorer = useTriggerScorer();
  const download = useDownloadTraceJson();
  // Studio draws the trace's tool calls with the chat's live cards (workflow graph, MCP app UI).
  const toolCalls = useLiveToolCalls();

  const rootSpan = getTraceRootSpan(spans, anchorSpanId);
  const threadId = getTraceThreadId(rootSpan, anchorSpanId);
  const hasMessages = !!(traceId && showPartialThread && threadId);
  // A single-trace thread would show exactly what the Messages column already shows.
  const threadHasOtherTraces = useThreadHasOtherTraces({
    threadId: hasMessages ? threadId : undefined,
    queryOptions: { enabled: hasMessages },
  });
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
                <TracePanel.ScoreButton />
                {onSaveAsDatasetItem && <TracePanel.DatasetButton onSaveAsDatasetItem={onSaveAsDatasetItem} />}
                {traceHref && <TracePanel.OpenPageButton href={traceHref} LinkComponent={Link} />}
                <TracePanel.DownloadButton onDownload={download.download} isPending={download.isPending} />
                <TracePanel.CloseButton />
              </>
            }
          />
        }
        summary={
          <TracePanel.Summary
            entity={
              <TracePanel.Entity
                entityHref={getEntityHref(paths, rootSpan?.entityType, rootSpan?.entityId)}
                LinkComponent={Link}
              />
            }
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
                    hasMessages && (
                      <TracePanel.Messages
                        spans={fullTrace.data?.spans}
                        isLoading={fullTrace.isLoading}
                        error={fullTrace.error ?? undefined}
                        onHighlightSpans={onHighlightSpans}
                        {...toolCalls}
                      />
                    )
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
                    traceSpans={fullTrace.data?.spans}
                  />
                }
              />
            }
            span={
              <TracePanel.SpanDetail
                span={selectedSpanDetail.data?.span}
                isLoading={selectedSpanDetail.isLoading}
                traceSpans={fullTrace.data?.spans}
                registeredTools={registeredTools}
                activeTab={spanActiveTab}
                onTabChange={onSpanTabChange}
                feedbackTabBadge={spanFeedbackTabBadge}
                feedbackTabSlot={spanFeedbackTabSlot}
                {...toolCalls}
              />
            }
          />
        }
        dialogs={
          <TracePanel.ScoreDialog
            scorers={scorers.data}
            isLoadingScorers={scorers.isLoading}
            onTriggerScorer={triggerScorer.mutateAsync}
          />
        }
      />
    </TracePanel>
  );
}
