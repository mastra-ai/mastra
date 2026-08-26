import type { LightSpanRecord } from '@mastra/core/storage';
import {
  CircleGaugeIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  Link2Icon,
  Loader2Icon,
  SaveIcon,
  WrenchIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getAllSpanIds } from '../hooks/get-all-span-ids';
import { useDownloadTraceJson } from '../hooks/use-download-trace-json';
import type { TraceUsageSummary } from '../trace-list-columns';
import { formatHierarchicalSpans } from './format-hierarchical-spans';
import { TraceKeysAndValues } from './trace-keys-and-values';
import { TraceTimeline } from './trace-timeline';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DataPanel } from '@/ds/components/DataPanel';
import { Notice } from '@/ds/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import type { LinkComponent } from '@/ds/types/link-component';
import { truncateString } from '@/lib/truncate-string';

export type TraceDataPanelPlacement = 'traces-list' | 'trace-page';

export type TraceDataPanelTab = 'details' | 'scores';

export interface TraceDataPanelViewProps {
  traceId: string;
  /** Lightweight spans for the trace. Caller fetches via useTraceLightSpans. */
  spans: LightSpanRecord[] | undefined;
  /**
   * Token and estimated-cost totals for the trace (from `useTraceUsage`).
   * Rendered in the trace summary when the panel is in the list side-panel
   * placement; the trace page renders its own `TraceKeysAndValues` instead.
   */
  usage?: TraceUsageSummary;
  isLoading?: boolean;
  onClose: () => void;
  onSpanSelect?: (spanId: string | undefined) => void;
  onEvaluateTrace?: () => void;
  /** When set, a "Save as Dataset Item" button appears; the consumer owns the dialog. */
  onSaveAsDatasetItem?: (args: { traceId: string; rootSpanId: string | undefined }) => void;
  /** When set, an "Add tool mocks to item" button appears; the consumer owns the dialog. */
  onAddTraceMocksToItem?: (args: { traceId: string }) => void;
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  placement: TraceDataPanelPlacement;
  timelineChartWidth?: 'wide' | 'default';
  /** When both are provided, renders an "Open trace page" button. */
  LinkComponent?: LinkComponent;
  traceHref?: string;
  /**
   * Span treated as the displayed root of the timeline. Required for branch
   * subtrees from `getBranch` where the anchor has a real parent that's outside
   * `spans`. When omitted, the span with no parent is used (trace case).
   */
  anchorSpanId?: string;
  /**
   * Whether to render the "Evaluating traces and saving them as dataset items is
   * available in Mastra Studio" info notice when neither `onEvaluateTrace` nor
   * `onSaveAsDatasetItem` is provided. Defaults to `true`. Pass `false` when this
   * panel is rendered inside Studio in a context that intentionally omits those
   * handlers (e.g. inline below an experiment result).
   */
  showUnavailableFeaturesMsg?: boolean;
  /**
   * When provided, the panel content becomes tabbed ("Details" / "Scores"); the slot
   * renders whatever trace-level scoring UI the consumer wants.
   */
  scoresTabSlot?: (args: { traceId: string; rootSpanId: string | undefined }) => ReactNode;
  /** Optional count shown in the "Scores" tab label. */
  scoresTabBadge?: ReactNode;
  activeTab?: TraceDataPanelTab;
  onTabChange?: (tab: TraceDataPanelTab) => void;
  /**
   * When provided, the panel splits into two columns inside the same card: the
   * trace content on the left, this slot (typically the span detail) on the right.
   */
  spanPanelSlot?: ReactNode;
  /** Extra classes applied to the panel root (e.g. `h-full` on the trace page). */
  className?: string;
}

export function TraceDataPanelView({
  traceId,
  spans,
  usage,
  isLoading,
  onClose,
  onSpanSelect,
  onEvaluateTrace,
  onSaveAsDatasetItem,
  onAddTraceMocksToItem,
  initialSpanId,
  onPrevious,
  onNext,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  placement,
  timelineChartWidth = 'default',
  LinkComponent,
  traceHref,
  anchorSpanId,
  showUnavailableFeaturesMsg = true,
  scoresTabSlot,
  scoresTabBadge,
  activeTab,
  onTabChange,
  spanPanelSlot,
  className,
}: TraceDataPanelViewProps) {
  const isOnTracePage = placement === 'trace-page';
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;

  const { download: downloadTraceJson, isPending: isDownloadingTrace } = useDownloadTraceJson();

  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(initialSpanId ?? undefined);

  // Sync selected span when initialSpanId or trace data changes
  useEffect(() => {
    // No span requested: clear immediately.
    if (!initialSpanId) {
      setSelectedSpanId(undefined);
      onSpanSelect?.(undefined);
      return;
    }
    // Span requested: wait for trace data before deciding so an in-flight
    // fetch doesn't wipe a URL-provided selection. Callers that default their
    // spans to `[]` while loading only say so through `isLoading`.
    if (isLoading || !spans) return;

    const found = spans.find(s => s.spanId === initialSpanId);
    if (found) {
      setSelectedSpanId(initialSpanId);
      onSpanSelect?.(initialSpanId);
    } else {
      setSelectedSpanId(undefined);
      onSpanSelect?.(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpanId, spans, isLoading]);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(spans ?? [], anchorSpanId), [spans, anchorSpanId]);

  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);

  useEffect(() => {
    if (hierarchicalSpans.length > 0) {
      setExpandedSpanIds(getAllSpanIds(hierarchicalSpans));
    }
  }, [hierarchicalSpans]);

  const rootSpan = useMemo(
    () => (anchorSpanId ? spans?.find(s => s.spanId === anchorSpanId) : spans?.find(s => s.parentSpanId == null)),
    [spans, anchorSpanId],
  );
  const isSubtrace = anchorSpanId !== undefined && rootSpan?.parentSpanId != null;

  const handleSpanClick = (id: string) => {
    const newId = selectedSpanId === id ? undefined : id;
    setSelectedSpanId(newId);
    onSpanSelect?.(newId);
  };

  const showOpenTracePageLink = !isOnTracePage && LinkComponent && traceHref;

  // Shared across both header layouts (list side panel and full trace page) so a trace can be
  // downloaded from wherever it's being inspected.
  const downloadTraceButton = (
    <Button
      size="md"
      tooltip="Download trace JSON"
      aria-label="Download trace JSON"
      disabled={isDownloadingTrace}
      onClick={() => downloadTraceJson(traceId)}
    >
      {isDownloadingTrace ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
    </Button>
  );

  return (
    <DataPanel collapsed={collapsed} className={className}>
      <DataPanel.Header>
        {isOnTracePage ? (
          <>
            <DataPanel.Heading>Trace Timeline</DataPanel.Heading>
            <ButtonsGroup className="ml-auto shrink-0">{downloadTraceButton}</ButtonsGroup>
          </>
        ) : (
          <>
            <DataPanel.Heading>
              Trace <b># {truncateString(traceId, 12)}</b>
            </DataPanel.Heading>
            <ButtonsGroup className="ml-auto shrink-0">
              {onCollapsedChange && (
                <Button
                  size="md"
                  tooltip={collapsed ? 'Expand panel' : 'Collapse panel'}
                  onClick={() => setCollapsed(!collapsed)}
                >
                  {collapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
                </Button>
              )}
              {onEvaluateTrace && (
                <Button size="md" tooltip="Evaluate trace" aria-label="Evaluate trace" onClick={onEvaluateTrace}>
                  <CircleGaugeIcon />
                </Button>
              )}
              {onSaveAsDatasetItem && (
                <Button
                  size="md"
                  tooltip="Save as Dataset Item"
                  aria-label="Save as Dataset Item"
                  onClick={() => onSaveAsDatasetItem({ traceId, rootSpanId: rootSpan?.spanId })}
                >
                  <SaveIcon />
                </Button>
              )}
              {onAddTraceMocksToItem && (
                <Button
                  size="md"
                  tooltip="Add tool mocks to item"
                  aria-label="Add tool mocks to item"
                  onClick={() => onAddTraceMocksToItem({ traceId })}
                >
                  <WrenchIcon />
                </Button>
              )}
              {(onPrevious || onNext) && (
                <DataPanel.NextPrevNav
                  onPrevious={onPrevious}
                  onNext={onNext}
                  previousLabel="Previous trace"
                  nextLabel="Next trace"
                />
              )}
              {showOpenTracePageLink && (
                <Button
                  as={LinkComponent}
                  href={traceHref}
                  size="md"
                  tooltip="Open trace page"
                  aria-label="Open trace page"
                >
                  <Link2Icon />
                </Button>
              )}
              {downloadTraceButton}
              <DataPanel.CloseButton onClick={onClose} />
            </ButtonsGroup>
          </>
        )}
      </DataPanel.Header>

      {!collapsed && (
        <SplitWithSpanPanel spanPanelSlot={spanPanelSlot}>
          {isLoading ? (
            <DataPanel.LoadingData>Loading trace...</DataPanel.LoadingData>
          ) : hierarchicalSpans.length === 0 ? (
            <DataPanel.NoData>No spans found for this trace.</DataPanel.NoData>
          ) : (
            <DataPanel.Content>
              {(() => {
                const detailsBody = (
                  <>
                    {!isOnTracePage && rootSpan && (
                      <TraceKeysAndValues rootSpan={rootSpan} usage={isSubtrace ? undefined : usage} className="mb-6" />
                    )}

                    {!isOnTracePage &&
                      !onEvaluateTrace &&
                      !onSaveAsDatasetItem &&
                      !onAddTraceMocksToItem &&
                      showUnavailableFeaturesMsg && (
                        <Notice variant="info" className="mb-6">
                          <Notice.Message>
                            Evaluating traces and saving them as dataset items is available in Mastra Studio (local or
                            deployed).
                          </Notice.Message>
                        </Notice>
                      )}

                    <TraceTimeline
                      hierarchicalSpans={hierarchicalSpans}
                      onSpanClick={handleSpanClick}
                      selectedSpanId={selectedSpanId}
                      expandedSpanIds={expandedSpanIds}
                      setExpandedSpanIds={setExpandedSpanIds}
                      chartWidth={timelineChartWidth}
                    />
                  </>
                );

                // No scores slot → render details directly without the Tabs wrapper.
                if (!scoresTabSlot) return detailsBody;

                return (
                  <Tabs<TraceDataPanelTab>
                    defaultTab="details"
                    value={activeTab}
                    onValueChange={onTabChange}
                    className={activeTab === 'scores' ? 'grid h-full min-h-0 grid-rows-[auto_1fr]' : undefined}
                  >
                    <TabList variant="pill-ghost">
                      <Tab value="details">Details</Tab>
                      <Tab value="scores">Evaluations {scoresTabBadge != null && <>({scoresTabBadge})</>}</Tab>
                    </TabList>

                    <TabContent value="details">{detailsBody}</TabContent>
                    <TabContent value="scores" className="h-full min-h-0">
                      {scoresTabSlot({ traceId, rootSpanId: rootSpan?.spanId })}
                    </TabContent>
                  </Tabs>
                );
              })()}
            </DataPanel.Content>
          )}
        </SplitWithSpanPanel>
      )}
    </DataPanel>
  );
}

/**
 * Renders the trace content as-is, or — when a span panel is provided — as a
 * two-column split inside the same card, with the span detail on the right.
 */
function SplitWithSpanPanel({ spanPanelSlot, children }: { spanPanelSlot?: ReactNode; children: ReactNode }) {
  if (!spanPanelSlot) return <>{children}</>;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr]">
      <div className="flex min-h-0 flex-col overflow-hidden">{children}</div>
      <div className="animate-in border-border1 fade-in-0 flex min-h-0 flex-col overflow-hidden border-l duration-300">
        {spanPanelSlot}
      </div>
    </div>
  );
}
