import { useScorers, useTriggerScorer } from '@mastra/react/hooks/scores';
import { useTools } from '@mastra/react/hooks/tools';
import { useSpanDetail, useThreadHasOtherTraces, useTraceSpans } from '@mastra/react/hooks/traces';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { useDownloadTraceJson } from '../hooks/use-download-trace-json';
import type { SpanDataPanelView } from '@/domains/traces/components/span-data-panel-view';
import type { TraceDataPanelView } from '@/domains/traces/components/trace-data-panel-view';
import { TracePanel, pickSideView } from '@/domains/traces/components/trace-panel';
import type { TraceSideView } from '@/domains/traces/components/trace-panel';
import { getTraceRootSpan, getTraceThreadId } from '@/domains/traces/components/trace-thread-context';
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
  /**
   * Offers "Open full thread" when the trace's thread holds other turns, and hands the thread id to the
   * host, which shows the thread wherever it wants (e.g. a `TraceThreadPanel` stacked above). Without it,
   * the action is not offered.
   */
  onOpenFullThread?: (threadId: string) => void;
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
  /** @deprecated No longer used: Studio always offers scoring, so the notice never shows. */
  showUnavailableFeaturesMsg?: boolean;
  spanView?: TraceDataPanelViewProps['spanView'];
  onSpanViewChange?: TraceDataPanelViewProps['onSpanViewChange'];

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

  const rootSpan = getTraceRootSpan(spans, anchorSpanId);
  const threadId = getTraceThreadId(rootSpan, anchorSpanId);
  const hasMessages = !!(traceId && showPartialThread && threadId);
  // A single-trace thread would show exactly what the Messages column already shows.
  const threadHasOtherTraces = useThreadHasOtherTraces({
    threadId: hasMessages ? threadId : undefined,
    queryOptions: { enabled: hasMessages },
  });
  const fullThreadId = hasMessages && threadHasOtherTraces && onOpenFullThread ? threadId : undefined;

  const offeredSideViews: TraceSideView[] = [];
  if (hasMessages) offeredSideViews.push('messages');
  if (feedbackTabSlot) offeredSideViews.push('feedback');
  if (scoresTabSlot) offeredSideViews.push('scores');
  // Scoring lands on "Scores"; a view picked on a trace that lacks it falls back to the first one offered.
  const [chosenSideView, setChosenSideView] = useState<string>();
  const sideView = pickSideView(chosenSideView, offeredSideViews);

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
      sideView={sideView}
      onSideViewChange={setChosenSideView}
      onClose={onClose}
    >
      <TracePanel.Frame title={title} size={size} depth={depth}>
        {headerSlot}
        <TracePanel.Header>
          <TracePanel.Navigation onPrevious={onPrevious} onNext={onNext} />
          <TracePanel.TraceId />
          <TracePanel.Actions>
            {headerActionsSlot}
            <TracePanel.ScoreButton />
            {onSaveAsDatasetItem && <TracePanel.DatasetButton onSaveAsDatasetItem={onSaveAsDatasetItem} />}
            {traceHref && <TracePanel.OpenPageButton href={traceHref} LinkComponent={Link} />}
            <TracePanel.DownloadButton onDownload={download.download} isPending={download.isPending} />
            <TracePanel.CloseButton />
          </TracePanel.Actions>
        </TracePanel.Header>
        <TracePanel.Summary
          usage={usage}
          entityHref={getEntityHref(paths, rootSpan?.entityType, rootSpan?.entityId)}
          LinkComponent={Link}
        />
        <TracePanel.Body>
          {traceId && sideView && (
            <TracePanel.Side>
              <TracePanel.SideHeader>
                <TracePanel.SideTabs>
                  {hasMessages && <TracePanel.MessagesTab />}
                  {feedbackTabSlot && <TracePanel.FeedbackTab count={feedbackTabBadge} />}
                  {scoresTabSlot && <TracePanel.ScoresTab count={scoresTabBadge} />}
                </TracePanel.SideTabs>
                {fullThreadId && (
                  <TracePanel.SideActions>
                    <TracePanel.OpenFullThreadButton onClick={() => onOpenFullThread?.(fullThreadId)} />
                  </TracePanel.SideActions>
                )}
              </TracePanel.SideHeader>
              {hasMessages && (
                <TracePanel.Messages
                  spans={fullTrace.data?.spans}
                  isLoading={fullTrace.isLoading}
                  error={fullTrace.error ?? undefined}
                  onHighlightSpans={onHighlightSpans}
                />
              )}
              {feedbackTabSlot && <TracePanel.Feedback>{feedbackTabSlot({ traceId })}</TracePanel.Feedback>}
              {scoresTabSlot && (
                <TracePanel.Scores>{scoresTabSlot({ traceId, rootSpanId: rootSpan?.spanId })}</TracePanel.Scores>
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
              traceSpans={fullTrace.data?.spans}
            >
              <TracePanel.RootError />
            </TracePanel.Spans>
          </TracePanel.Main>
          <TracePanel.SpanPanel>
            <TracePanel.SpanDetail
              span={selectedSpanDetail.data?.span}
              isLoading={selectedSpanDetail.isLoading}
              traceSpans={fullTrace.data?.spans}
              registeredTools={registeredTools}
              activeTab={spanActiveTab}
              onTabChange={onSpanTabChange}
              feedbackTabBadge={spanFeedbackTabBadge}
              feedbackTabSlot={spanFeedbackTabSlot}
            />
          </TracePanel.SpanPanel>
        </TracePanel.Body>
      </TracePanel.Frame>
      {/* Next to the drawer, not inside it: a dialog nested in the drawer would leave its scorer list inert. */}
      <TracePanel.ScoreDialog
        scorers={scorers.data}
        isLoadingScorers={scorers.isLoading}
        onTriggerScorer={triggerScorer.mutateAsync}
      />
    </TracePanel>
  );
}
