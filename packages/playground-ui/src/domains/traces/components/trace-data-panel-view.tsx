import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  Link2Icon,
  MoreHorizontalIcon,
  Loader2Icon,
  SaveIcon,
  WrenchIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getAllSpanIds } from '../hooks/get-all-span-ids';
import { useDownloadTraceJson } from '../hooks/use-download-trace-json';
import { useTraceSearch } from '../hooks/use-trace-search';
import type { SearchableSpan } from '../types';
import { formatHierarchicalSpans } from './format-hierarchical-spans';
import { TraceDescription } from './trace-description';
import { TraceTimeline } from './trace-timeline';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DataPanel } from '@/ds/components/DataPanel';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks';
import { Notice } from '@/ds/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import type { LinkComponent } from '@/ds/types/link-component';
import { useTextHighlight } from '@/hooks/use-text-highlight';
import { truncateString } from '@/lib/truncate-string';

export type TraceDataPanelPlacement = 'traces-list' | 'trace-page';

export type TraceDataPanelTab = 'details' | 'thread' | 'scores' | 'feedback';

export interface TraceDataPanelViewProps {
  traceId: string;
  /** Lightweight spans for the trace. Caller fetches via useTraceLightSpans. */
  spans: SearchableSpan[] | undefined;
  isLoading?: boolean;
  onClose: () => void;
  onSpanSelect?: (spanId: string | undefined) => void;
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
   * available in Mastra Studio" info notice when neither `onSaveAsDatasetItem`
   * nor `onAddTraceMocksToItem` is provided. Defaults to `true`. Pass `false` when this
   * panel is rendered inside Studio in a context that intentionally omits those
   * handlers (e.g. inline below an experiment result).
   */
  showUnavailableFeaturesMsg?: boolean;
  /**
   * When the trace belongs to a conversation, a "Partial thread" tab appears next to
   * "Spans"; the slot renders the thread view for that trace.
   */
  threadTabSlot?: (args: { traceId: string }) => ReactNode;
  /**
   * Rendered inside the "Partial thread" tab, selected or not — the way out of the single
   * turn (e.g. opening the whole thread). Must not render a nested `<button>`.
   */
  threadTabAction?: ReactNode;
  /**
   * When provided, the panel content becomes tabbed ("Spans" / "Scores"); the slot
   * renders whatever trace-level scoring UI the consumer wants.
   */
  scoresTabSlot?: (args: { traceId: string; rootSpanId: string | undefined }) => ReactNode;
  /** Optional count shown in the "Scores" tab label. */
  scoresTabBadge?: ReactNode;
  /**
   * When provided, a "Feedback" tab appears; the slot renders the trace-level
   * feedback UI. Trace feedback is not scoped to a span — the span panel owns that.
   */
  feedbackTabSlot?: (args: { traceId: string }) => ReactNode;
  /** Optional count shown in the "Feedback" tab label. */
  feedbackTabBadge?: ReactNode;
  activeTab?: TraceDataPanelTab;
  onTabChange?: (tab: TraceDataPanelTab) => void;
  /**
   * When provided, the panel splits into two columns inside the same card: the
   * trace content on the left, this slot (typically the span detail) on the right.
   */
  spanPanelSlot?: ReactNode;
  /**
   * Primary trace action rendered in the header, before the overflow menu — the
   * consumer owns it (e.g. Studio's "Score trace" dialog). Stays reachable while
   * the panel is collapsed.
   */
  headerActionSlot?: ReactNode;
  /** Extra classes applied to the panel root (e.g. `h-full` on the trace page). */
  className?: string;
}

const tabPaneClassName = 'min-h-0 flex-1 overflow-y-auto px-4 pb-4';

/**
 * The spans pane hands its padding to `SplitWithSpanPanel` instead, so the span
 * detail's left border can run the full height of the pane, flush with the tab band.
 */
const spansPaneClassName = 'min-h-0 flex-1 overflow-hidden p-0';

export function TraceDataPanelView({
  traceId,
  spans,
  isLoading,
  onClose,
  onSpanSelect,
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
  threadTabSlot,
  threadTabAction,
  scoresTabSlot,
  scoresTabBadge,
  feedbackTabSlot,
  feedbackTabBadge,
  activeTab,
  onTabChange,
  spanPanelSlot,
  headerActionSlot,
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

  const searchFieldName = useId();
  const { query, setQuery, results } = useTraceSearch(spans ?? []);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(results, anchorSpanId), [results, anchorSpanId]);

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

  // Everything that isn't moving between traces or closing the panel: kept behind one menu so the
  // header stays readable no matter how many of these the consumer wires up.
  const overflowActions = (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button size="md" tooltip="More trace actions" aria-label="More trace actions">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {showOpenTracePageLink && (
          <DropdownMenu.Item render={<LinkComponent href={traceHref} />}>
            <Link2Icon />
            <span>Open trace page</span>
          </DropdownMenu.Item>
        )}
        {onSaveAsDatasetItem && (
          <DropdownMenu.Item onClick={() => onSaveAsDatasetItem({ traceId, rootSpanId: rootSpan?.spanId })}>
            <SaveIcon />
            <span>Save as Dataset Item</span>
          </DropdownMenu.Item>
        )}
        {onAddTraceMocksToItem && (
          <DropdownMenu.Item onClick={() => onAddTraceMocksToItem({ traceId })}>
            <WrenchIcon />
            <span>Add tool mocks to item</span>
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item disabled={isDownloadingTrace} onClick={() => downloadTraceJson(traceId)}>
          {isDownloadingTrace ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
          <span>Download trace JSON</span>
        </DropdownMenu.Item>
        {onCollapsedChange && (
          <DropdownMenu.Item onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
            <span>{collapsed ? 'Expand panel' : 'Collapse panel'}</span>
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
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
            <div className="flex min-w-0 flex-col gap-0.5">
              <DataPanel.Heading>
                Trace <b># {truncateString(traceId, 12)}</b>
              </DataPanel.Heading>
              {rootSpan && <TraceDescription rootSpan={rootSpan} LinkComponent={LinkComponent} />}
            </div>
            <ButtonsGroup className="ml-auto shrink-0">
              {headerActionSlot}
              {overflowActions}
              {(onPrevious || onNext) && (
                <DataPanel.NextPrevNav
                  onPrevious={onPrevious}
                  onNext={onNext}
                  previousLabel="Previous trace"
                  nextLabel="Next trace"
                />
              )}
              <DataPanel.CloseButton onClick={onClose} />
            </ButtonsGroup>
          </>
        )}
      </DataPanel.Header>

      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading ? (
            <DataPanel.LoadingData>Loading trace...</DataPanel.LoadingData>
          ) : !spans?.length ? (
            <DataPanel.NoData>No spans found for this trace.</DataPanel.NoData>
          ) : (
            (() => {
              const detailsBody = (
                // The span detail belongs to the spans view, so it splits this tab, not the card.
                <SplitWithSpanPanel spanPanelSlot={spanPanelSlot} highlightQuery={query}>
                  {!isOnTracePage && !onSaveAsDatasetItem && !onAddTraceMocksToItem && showUnavailableFeaturesMsg && (
                    <Notice variant="info" className="mb-6">
                      <Notice.Message>
                        Evaluating traces and saving them as dataset items is available in Mastra Studio (local or
                        deployed).
                      </Notice.Message>
                    </Notice>
                  )}

                  {/* The timeline stays mounted even with no results, because it
                        hosts the search field: unmounting it would strand the user
                        with a query they can no longer clear. */}
                  <TraceTimeline
                    hierarchicalSpans={hierarchicalSpans}
                    onSpanClick={handleSpanClick}
                    selectedSpanId={selectedSpanId}
                    expandedSpanIds={expandedSpanIds}
                    setExpandedSpanIds={setExpandedSpanIds}
                    chartWidth={timelineChartWidth}
                    leadingSlot={
                      <SearchFieldBlock
                        name={searchFieldName}
                        label="Search spans"
                        labelIsHidden
                        placeholder="Search spans..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onReset={() => setQuery('')}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      />
                    }
                  />

                  {hierarchicalSpans.length === 0 && <DataPanel.NoData>No spans match your search.</DataPanel.NoData>}
                </SplitWithSpanPanel>
              );

              // No extra tab slots → render the spans view directly, without the Tabs wrapper.
              if (!threadTabSlot && !scoresTabSlot && !feedbackTabSlot)
                // `SplitWithSpanPanel` brings its own padding, so no `DataPanel.Content` here.
                return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{detailsBody}</div>;

              return (
                <Tabs<TraceDataPanelTab>
                  // A span asked for by URL only exists under "Spans", so it wins over the summary.
                  defaultTab="details"
                  value={activeTab}
                  onValueChange={onTabChange}
                  className="grid min-h-0 flex-1 grid-rows-[auto_1fr]"
                >
                  {/* The tab bar sits in its own full-width band so it matches the panel header. */}
                  {/* The pill list carries its own `p-1`, so the band is inset by that much less
                      than the header to end up with the same padding. */}
                  {/* Fixed height so a tab gaining an action (the thread tab) can never resize the band. */}
                  <div className="border-border1 flex h-14 shrink-0 items-center gap-2 border-b px-3">
                    <TabList variant="pill-ghost">
                      <Tab value="details">Spans</Tab>
                      {threadTabSlot && (
                        <Tab value="thread">
                          <span className="flex items-center gap-1.5">
                            Partial thread
                            {threadTabAction}
                          </span>
                        </Tab>
                      )}
                      {scoresTabSlot && (
                        <Tab value="scores">Scorers {scoresTabBadge != null && <>({scoresTabBadge})</>}</Tab>
                      )}
                      {feedbackTabSlot && (
                        <Tab value="feedback">Feedback {feedbackTabBadge != null && <>({feedbackTabBadge})</>}</Tab>
                      )}
                    </TabList>
                  </div>

                  {/* The tab band already separates the content, so these panes drop the top
                      padding `DataPanel.Content` would add. */}
                  <TabContent value="details" className={spansPaneClassName}>
                    {detailsBody}
                  </TabContent>
                  {threadTabSlot && (
                    <TabContent value="thread" className={tabPaneClassName}>
                      {threadTabSlot({ traceId })}
                    </TabContent>
                  )}
                  {scoresTabSlot && (
                    <TabContent value="scores" className={tabPaneClassName}>
                      {scoresTabSlot({ traceId, rootSpanId: rootSpan?.spanId })}
                    </TabContent>
                  )}
                  {feedbackTabSlot && (
                    <TabContent value="feedback" className={tabPaneClassName}>
                      {feedbackTabSlot({ traceId })}
                    </TabContent>
                  )}
                </Tabs>
              );
            })()
          )}
        </div>
      )}
    </DataPanel>
  );
}

/**
 * Renders the trace content as-is, or — when a span panel is provided — as a
 * two-column split inside the same card, with the span detail on the right.
 * Search matches — span names in the timeline tree as well as values in the span
 * detail — are highlighted while a query is active.
 */
function SplitWithSpanPanel({
  spanPanelSlot,
  highlightQuery,
  children,
}: {
  spanPanelSlot?: ReactNode;
  highlightQuery: string;
  children: ReactNode;
}) {
  // A single hook call on the common ancestor covers both the timeline tree and
  // the span detail, so span names and payload values highlight together.
  const { ref: highlightRef } = useTextHighlight<HTMLDivElement>(highlightQuery);

  if (!spanPanelSlot) {
    return (
      <div ref={highlightRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-4">
        {children}
      </div>
    );
  }

  return (
    <div ref={highlightRef} className="grid h-full min-h-0 grid-cols-[1fr_1fr]">
      <div className="flex min-h-0 flex-col overflow-y-auto px-4 pt-3 pb-4">{children}</div>
      {/* Searchable: the span detail is where a match hides inside a large payload. */}
      {/* The border runs the full pane height, so it meets the tab band above. */}
      <div
        data-highlight
        className="animate-in border-border1 fade-in-0 flex min-h-0 flex-col overflow-y-auto border-l duration-300"
      >
        {spanPanelSlot}
      </div>
    </div>
  );
}
