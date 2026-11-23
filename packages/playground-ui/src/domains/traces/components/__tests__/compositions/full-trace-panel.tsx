import { useState } from 'react';
import type { ReactNode } from 'react';

import type { TraceSearchResult } from '../../../hooks/use-trace-search';
import type { TraceUsageSummary } from '../../../trace-list-columns';
import type { TraceNavigation } from '../../trace-navigation';
import { TracePanel, useTracePanelSide } from '../../trace-panel';
import type { TracePanelSpan, TraceSideView, TraceSpanView } from '../../trace-panel';
import type { TraceStreamingTimings } from '../../trace-span-timeline';
import { getTraceRootSpan } from '../../trace-thread-context';
import type { DataPanelDrawerProps } from '@/ds/components/DataPanel';

/** Where a host shows the trace: as a list's side drawer, or as a trace page. */
export type FullTracePanelPlacement = 'traces-list' | 'trace-page';

export interface FullTracePanelProps {
  traceId?: string;
  spans: TracePanelSpan[] | undefined;
  isLoading?: boolean;
  onDownloadTrace?: (traceId: string) => void;
  isDownloadingTrace?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  searchResult?: TraceSearchResult<TracePanelSpan>;
  onClose: () => void;
  onSpanSelect?: (spanId: string | undefined) => void;
  onEvaluateTrace?: () => void;
  onSaveAsDatasetItem?: (args: { traceId: string; rootSpanId: string | undefined }) => void;
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  size?: DataPanelDrawerProps['size'];
  depth?: DataPanelDrawerProps['depth'];
  headerSlot?: ReactNode;
  headerActionsSlot?: ReactNode;
  title?: string;
  placement: FullTracePanelPlacement;
  /** Where the host opens the entity and the trace page. */
  navigation?: TraceNavigation;
  usage?: TraceUsageSummary;
  rootStreamingTimings?: Omit<TraceStreamingTimings, 'startedAt'>;
  anchorSpanId?: string;
  entityType?: string | null;
  showUnavailableFeaturesMsg?: boolean;
  scoresTabSlot?: (args: { traceId: string; rootSpanId: string | undefined }) => ReactNode;
  scoresTabBadge?: ReactNode;
  feedbackTabSlot?: (args: { traceId: string }) => ReactNode;
  feedbackTabBadge?: ReactNode;
  featuredSpanIds?: string[];
  messagesPanelSlot?: ReactNode;
  sideHeaderActions?: (options: { compact: boolean }) => ReactNode;
  spanView?: TraceSpanView;
  onSpanViewChange?: (view: TraceSpanView) => void;
  sideView?: TraceSideView;
  onSideViewChange?: (view: TraceSideView) => void;
  spanPanelSlot?: ReactNode;
}

/**
 * A host composing every part of `TracePanel`, driven by props: the specs of the parts run through it,
 * the way a real host fills the slots.
 */
export function FullTracePanel({
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
  navigation,
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
}: FullTracePanelProps) {
  const isOnTracePage = placement === 'trace-page';
  const [ownSideView, setOwnSideView] = useState<string>();
  const rootSpanId = getTraceRootSpan(spans, anchorSpanId)?.spanId;
  const showUnavailableNotice =
    !isOnTracePage && !onEvaluateTrace && !onSaveAsDatasetItem && showUnavailableFeaturesMsg;
  const download = onDownloadTrace && (
    <TracePanel.DownloadButton onDownload={onDownloadTrace} isPending={isDownloadingTrace} />
  );
  const score = onEvaluateTrace && <TracePanel.ScoreButton onClick={onEvaluateTrace} />;
  const hasSide = !!(messagesPanelSlot || feedbackTabSlot || scoresTabSlot);

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
      sideView={controlledSideView ?? ownSideView}
      onSideViewChange={view => {
        setOwnSideView(view);
        if (view === 'messages' || view === 'feedback' || view === 'scores') onSideViewChange?.(view);
      }}
      onClose={onClose}
      navigation={navigation}
    >
      <TracePanel.Frame
        title={title ?? (isOnTracePage ? 'Trace Timeline' : undefined)}
        size={size}
        depth={depth}
        banner={headerSlot}
        header={
          isOnTracePage ? (
            <TracePanel.Header
              title={<TracePanel.PageHeading usage={usage} />}
              actions={
                <>
                  {headerActionsSlot}
                  {score}
                  {download}
                </>
              }
            />
          ) : (
            <TracePanel.Header
              navigation={<TracePanel.Navigation onPrevious={onPrevious} onNext={onNext} />}
              title={<TracePanel.TraceId />}
              actions={
                <>
                  {headerActionsSlot}
                  {score}
                  {onSaveAsDatasetItem && <TracePanel.DatasetButton onSaveAsDatasetItem={onSaveAsDatasetItem} />}
                  <TracePanel.OpenPageButton />
                  {download}
                  <TracePanel.CloseButton />
                </>
              }
            />
          )
        }
        summary={
          !isOnTracePage && (
            <TracePanel.Summary
              entity={<TracePanel.Entity />}
              status={<TracePanel.Status />}
              stats={<TracePanel.Stats usage={usage} />}
            />
          )
        }
        body={
          <TracePanel.Body
            side={
              hasSide && (
                <TracePanel.Side
                  messages={messagesPanelSlot}
                  feedback={feedbackTabSlot && traceId ? feedbackTabSlot({ traceId }) : undefined}
                  feedbackCount={feedbackTabBadge}
                  scores={scoresTabSlot && traceId ? scoresTabSlot({ traceId, rootSpanId }) : undefined}
                  scoresCount={scoresTabBadge}
                  actions={sideHeaderActions && <SideHeaderActions render={sideHeaderActions} />}
                />
              )
            }
            main={
              <TracePanel.Main
                toolbar={
                  <TracePanel.SpansToolbar search={<TracePanel.Search />} actions={<TracePanel.SpanViewSwitch />} />
                }
                notices={
                  <>
                    {showUnavailableNotice && <TracePanel.UnavailableFeaturesNotice />}
                    <TracePanel.RootError />
                  </>
                }
                spans={
                  <TracePanel.Spans
                    featuredSpanIds={featuredSpanIds}
                    streamingTimings={rootStreamingTimings}
                    results={searchResult}
                  />
                }
              />
            }
            span={spanPanelSlot}
          />
        }
      />
    </TracePanel>
  );
}

/** The `sideHeaderActions` render prop, given the side column's width. */
function SideHeaderActions({ render }: { render: (options: { compact: boolean }) => ReactNode }) {
  const { compact } = useTracePanelSide();
  return render({ compact });
}
