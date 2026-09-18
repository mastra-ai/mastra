import {
  CircleGaugeIcon,
  DownloadIcon,
  Link2Icon,
  Loader2Icon,
  MessageSquareReplyIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  SaveIcon,
  WrenchIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getAllSpanIds } from '../hooks/get-all-span-ids';
import { useDownloadTraceJson } from '../hooks/use-download-trace-json';
import { useTraceSearch } from '../hooks/use-trace-search';
import type { TraceUsageSummary } from '../trace-list-columns';
import type { SearchableSpan } from '../types';
import { formatHierarchicalSpans } from './format-hierarchical-spans';
import { TraceIdButton } from './trace-id-button';
import { TraceSpanTimeline } from './trace-span-timeline';
import { TraceSpanTree } from './trace-span-tree';
import { TraceSummaryDescription } from './trace-summary-description';
import { Button } from '@/ds/components/Button';
import { DataPanel } from '@/ds/components/DataPanel';
import type { DataPanelProps } from '@/ds/components/DataPanel';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks';
import { Notice } from '@/ds/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import { Icon } from '@/ds/icons/Icon';
import { ScorersIcon } from '@/ds/icons/ScorersIcon';
import type { LinkComponent } from '@/ds/types/link-component';
import { useScrollToFirstHighlight } from '@/hooks/use-scroll-to-first-highlight';
import { useTextHighlight } from '@/hooks/use-text-highlight';
import { cn } from '@/lib/utils';

export type TraceDataPanelPlacement = 'traces-list' | 'trace-page';

export type TraceDataPanelTab = 'details' | 'timeline';

/** What the side column next to the span tree shows. */
export type TraceSideView = 'messages' | 'feedback' | 'scores';

export interface TraceDataPanelViewProps {
  /** Keep the panel mounted and pass `undefined` to close it, so the drawer animates out. */
  traceId?: string;
  /** Lightweight spans for the trace. Caller fetches via useTraceLightSpans. */
  spans: SearchableSpan[] | undefined;
  isLoading?: boolean;
  onClose: () => void;
  onSpanSelect?: (spanId: string | undefined) => void;
  onEvaluateTrace?: () => void;
  /** When set, an "Add full trace to dataset" button appears; the consumer owns the dialog. */
  onSaveAsDatasetItem?: (args: { traceId: string; rootSpanId: string | undefined }) => void;
  /** When set, an "Add tool mocks to item" button appears; the consumer owns the dialog. */
  onAddTraceMocksToItem?: (args: { traceId: string }) => void;
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Drawer width; defaults to `wide` since the panel lays out several columns. */
  size?: DataPanelProps['size'];
  /** Elevation when opened next to other sibling panels. */
  depth?: DataPanelProps['depth'];
  /** Rendered inside the drawer above the trace header (e.g. inbox feedback context). */
  headerSlot?: ReactNode;
  /** Accessible drawer name; defaults to the trace id. */
  title?: string;
  placement: TraceDataPanelPlacement;
  /** @deprecated No longer used: the panel renders the span tree with the duration as text. */
  timelineChartWidth?: 'wide' | 'default';
  /** When both are provided, renders an "Open trace page" button. */
  LinkComponent?: LinkComponent;
  traceHref?: string;
  /** When provided, the entity name in the trace summary links to the entity's page. */
  entityHref?: string;
  /** Token and estimated-cost totals shown in the compact trace summary. */
  usage?: TraceUsageSummary;
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
   * When provided, a "Scores" tab appears; the slot renders whatever trace-level
   * scoring UI the consumer wants.
   */
  scoresTabSlot?: (args: { traceId: string; rootSpanId: string | undefined }) => ReactNode;
  /** Optional count shown in the "Scores" tab label. */
  scoresTabBadge?: ReactNode;
  /**
   * When provided, a "Feedback" tab appears; the slot renders the trace-level
   * feedback UI. Trace feedback is not scoped to a span — the span panel owns that.
   */
  feedbackTabSlot?: (args: { traceId: string }) => ReactNode;
  /** Optional indicator rendered after the "Feedback" tab label (e.g. a needs-review dot). */
  feedbackTabBadge?: ReactNode;
  activeTab?: TraceDataPanelTab;
  onTabChange?: (tab: TraceDataPanelTab) => void;
  /** Span ids to feature in the timeline; every other span is faded. */
  featuredSpanIds?: string[];
  /**
   * The "Messages" view of the side column next to the span tree (typically the
   * trace as one reconstructed agent turn). Rendered without content padding.
   */
  messagesPanelSlot?: ReactNode;
  /** Header actions shown while the side column is on its "Messages" view. */
  messagesPanelActions?: ReactNode;
  /** Controlled side column view; falls back to the first available view. */
  sideView?: TraceSideView;
  onSideViewChange?: (view: TraceSideView) => void;
  /**
   * Rendered as a column to the right of the timeline inside the same card;
   * typically the span detail.
   */
  spanPanelSlot?: ReactNode;
}

export function TraceDataPanelView({
  traceId,
  spans,
  isLoading,
  onClose,
  onSpanSelect,
  onEvaluateTrace,
  onSaveAsDatasetItem,
  onAddTraceMocksToItem,
  initialSpanId,
  onPrevious,
  onNext,
  size = 'wide',
  depth,
  headerSlot,
  title,
  placement,
  LinkComponent,
  traceHref,
  entityHref,
  usage,
  anchorSpanId,
  showUnavailableFeaturesMsg = true,
  scoresTabSlot,
  scoresTabBadge,
  feedbackTabSlot,
  feedbackTabBadge,
  activeTab,
  onTabChange,
  featuredSpanIds,
  messagesPanelSlot,
  messagesPanelActions,
  sideView: controlledSideView,
  onSideViewChange,
  spanPanelSlot,
}: TraceDataPanelViewProps) {
  const isOnTracePage = placement === 'trace-page';

  // The side column next to the span tree hosts Messages / Feedback / Scores;
  // which one is shown is purely a local viewing choice.
  const sideViews = useMemo(() => {
    const views: Array<{ value: TraceSideView; label: ReactNode }> = [];
    if (messagesPanelSlot) {
      views.push({
        value: 'messages',
        label: (
          <span className="inline-flex items-center gap-1.5">
            <Icon size="sm">
              <MessageSquareTextIcon />
            </Icon>
            Messages
          </span>
        ),
      });
    }
    if (feedbackTabSlot) {
      views.push({
        value: 'feedback',
        label: (
          <span className="inline-flex items-center gap-1.5">
            <Icon size="sm">
              <MessageSquareReplyIcon />
            </Icon>
            Feedback
            {feedbackTabBadge}
          </span>
        ),
      });
    }
    if (scoresTabSlot) {
      views.push({
        value: 'scores',
        label: (
          <span className="inline-flex items-center gap-1.5">
            <Icon size="sm">
              <ScorersIcon />
            </Icon>
            Scores{scoresTabBadge != null && <> ({scoresTabBadge})</>}
          </span>
        ),
      });
    }
    return views;
  }, [messagesPanelSlot, feedbackTabSlot, feedbackTabBadge, scoresTabSlot, scoresTabBadge]);
  const [uncontrolledSideView, setUncontrolledSideView] = useState<TraceSideView>();
  const chosenSideView = controlledSideView ?? uncontrolledSideView;
  const activeSideView = sideViews.find(view => view.value === chosenSideView) ?? sideViews[0];
  const sideView = activeSideView?.value;
  const handleSideViewChange = (view: TraceSideView) => {
    setUncontrolledSideView(view);
    onSideViewChange?.(view);
  };

  const handleTabChange = (tab: TraceDataPanelTab) => {
    onTabChange?.(tab);
  };

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
  const { query, setQuery, results, payloadOnlyMatchIds } = useTraceSearch(spans ?? []);

  const hierarchicalSpans = useMemo(
    () =>
      formatHierarchicalSpans(
        // Carried on the span rather than drilled as a prop: the tree is rebuilt here and
        // rendered several components deeper.
        results.map(span => ({ ...span, matchedInPayloadOnly: payloadOnlyMatchIds.has(span.spanId) })),
        anchorSpanId,
      ),
    [results, payloadOnlyMatchIds, anchorSpanId],
  );

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

  const traceActionsMenu = traceId && (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button size="sm" variant="ghost" tooltip="Open trace actions" aria-label="Open trace actions">
            <MoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenu.Content align="end">
        {!isOnTracePage && onSaveAsDatasetItem && (
          <DropdownMenu.Item onSelect={() => onSaveAsDatasetItem({ traceId, rootSpanId: rootSpan?.spanId })}>
            <SaveIcon />
            Add full trace to dataset
          </DropdownMenu.Item>
        )}
        {!isOnTracePage && onAddTraceMocksToItem && (
          <DropdownMenu.Item onSelect={() => onAddTraceMocksToItem({ traceId })}>
            <WrenchIcon />
            Add tool mocks to item
          </DropdownMenu.Item>
        )}
        {!isOnTracePage && LinkComponent && traceHref && (
          <DropdownMenu.Item render={<LinkComponent href={traceHref} />}>
            <Link2Icon />
            Open trace page
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item disabled={isDownloadingTrace} onSelect={() => downloadTraceJson(traceId)}>
          {isDownloadingTrace ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
          Download trace JSON
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );

  return (
    <DataPanel
      open={!!traceId}
      onClose={onClose}
      title={title ?? (isOnTracePage ? 'Trace Timeline' : `Trace ${traceId ?? ''}`)}
      size={size}
      depth={depth}
    >
      {traceId && (
        <>
          {headerSlot}
          <DataPanel.Header>
            {isOnTracePage ? (
              <>
                <DataPanel.Heading>Trace Timeline</DataPanel.Heading>
                <DataPanel.HeaderActions>{traceActionsMenu}</DataPanel.HeaderActions>
              </>
            ) : (
              <>
                <DataPanel.CloseButton onClick={onClose} />
                <DataPanel.HeaderContent>
                  <DataPanel.Heading>
                    Trace
                    <TraceIdButton id={traceId} />
                  </DataPanel.Heading>
                  {rootSpan && (
                    <TraceSummaryDescription
                      rootSpan={rootSpan}
                      usage={usage}
                      entityHref={entityHref}
                      LinkComponent={LinkComponent}
                    />
                  )}
                </DataPanel.HeaderContent>
                <DataPanel.HeaderActions>
                  {onEvaluateTrace && (
                    <Button variant="primary" size="sm" onClick={onEvaluateTrace} disabled={!rootSpan}>
                      <CircleGaugeIcon />
                      Score trace
                    </Button>
                  )}
                  {traceActionsMenu}
                  {(onPrevious || onNext) && (
                    <DataPanel.NextPrevNav
                      onPrevious={onPrevious}
                      onNext={onNext}
                      previousLabel="Go to previous trace"
                      nextLabel="Go to next trace"
                    />
                  )}
                </DataPanel.HeaderActions>
              </>
            )}
          </DataPanel.Header>

          <TracePanelColumns
            hasMessagesColumn={!!sideView}
            spanPanelSlot={spanPanelSlot}
            highlightQuery={query}
            spanPanelKey={selectedSpanId}
          >
            {!isLoading && !spans?.length ? (
              <DataPanel.NoData>No spans found for this trace.</DataPanel.NoData>
            ) : (
              (() => {
                // Shared by the Spans and Timeline tabs: both views render the same
                // filtered `hierarchicalSpans`, so one query drives both.
                const searchField = (
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
                );
                const noSearchResults = !isLoading && hierarchicalSpans.length === 0 && (
                  <DataPanel.NoData>No spans match your search.</DataPanel.NoData>
                );

                return (
                  <Tabs<TraceDataPanelTab>
                    defaultTab="details"
                    value={activeTab}
                    onValueChange={handleTabChange}
                    className="grid h-full min-h-0 grid-rows-[auto_1fr]"
                  >
                    <DataPanel.Header>
                      <TabList variant="pill-ghost" size="sm">
                        <Tab value="details">Spans</Tab>
                        <Tab value="timeline">Timeline</Tab>
                      </TabList>
                    </DataPanel.Header>

                    {/* Tab contents share the tab list's horizontal padding so their edges line up. */}
                    <TabContent value="details" flush>
                      {/* The side column only makes sense beside the span tree, so it lives in this tab
                          rather than as a sibling column: switching tabs takes it away with the tree. */}
                      <div
                        className={cn(
                          'grid h-full min-h-0',
                          sideView
                            ? 'grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[24rem_minmax(0,1fr)]'
                            : 'grid-cols-[minmax(0,1fr)]',
                        )}
                      >
                        {sideView && (
                          <div
                            data-trace-side-column
                            className="border-border1 flex min-h-0 min-w-0 flex-col overflow-hidden border-r"
                          >
                            {/* Same chrome as the Span column header, so the two side columns line up. */}
                            <DataPanel.Header>
                              <DataPanel.HeaderContent>
                                {sideViews.length > 1 ? (
                                  <Select<TraceSideView> value={sideView} onValueChange={handleSideViewChange}>
                                    <SelectTrigger
                                      variant="ghost"
                                      size="sm"
                                      className="w-fit"
                                      aria-label="Side column view"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sideViews.map(view => (
                                        <SelectItem key={view.value} value={view.value}>
                                          {view.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <DataPanel.Heading>{activeSideView.label}</DataPanel.Heading>
                                )}
                              </DataPanel.HeaderContent>
                              {sideView === 'messages' && messagesPanelActions && (
                                <DataPanel.HeaderActions>{messagesPanelActions}</DataPanel.HeaderActions>
                              )}
                            </DataPanel.Header>
                            {/* The turn view brings its own padding; feedback and scores use the panel's. */}
                            {sideView === 'messages' && (
                              <DataPanel.Content className="p-0">{messagesPanelSlot}</DataPanel.Content>
                            )}
                            {sideView === 'feedback' && (
                              <DataPanel.Content>{feedbackTabSlot?.({ traceId })}</DataPanel.Content>
                            )}
                            {sideView === 'scores' && (
                              <DataPanel.Content>
                                {scoresTabSlot?.({ traceId, rootSpanId: rootSpan?.spanId })}
                              </DataPanel.Content>
                            )}
                          </div>
                        )}
                        <DataPanel.Content>
                          {!isOnTracePage &&
                            !onEvaluateTrace &&
                            !onSaveAsDatasetItem &&
                            !onAddTraceMocksToItem &&
                            showUnavailableFeaturesMsg && (
                              <Notice variant="info" className="mb-6">
                                <Notice.Message>
                                  Evaluating traces and saving them as dataset items is available in Mastra Studio
                                  (local or deployed).
                                </Notice.Message>
                              </Notice>
                            )}

                          {/* The tree stays mounted even with no results, because it
                          hosts the search field: unmounting it would strand the user
                          with a query they can no longer clear. */}
                          <TraceSpanTree
                            hierarchicalSpans={hierarchicalSpans}
                            onSpanClick={handleSpanClick}
                            selectedSpanId={selectedSpanId}
                            expandedSpanIds={expandedSpanIds}
                            setExpandedSpanIds={setExpandedSpanIds}
                            featuredSpanIds={featuredSpanIds}
                            leadingSlot={searchField}
                            isLoading={isLoading}
                          />
                          {noSearchResults}
                        </DataPanel.Content>
                      </div>
                    </TabContent>
                    <TabContent value="timeline" flush>
                      <DataPanel.Content>
                        {/* Same selection + expansion state as the Spans tab, so switching views keeps context. */}
                        <TraceSpanTimeline
                          hierarchicalSpans={hierarchicalSpans}
                          onSpanClick={handleSpanClick}
                          selectedSpanId={selectedSpanId}
                          expandedSpanIds={expandedSpanIds}
                          setExpandedSpanIds={setExpandedSpanIds}
                          featuredSpanIds={featuredSpanIds}
                          leadingSlot={searchField}
                          isLoading={isLoading}
                        />
                        {noSearchResults}
                      </DataPanel.Content>
                    </TabContent>
                  </Tabs>
                );
              })()
            )}
          </TracePanelColumns>
        </>
      )}
    </DataPanel>
  );
}

/**
 * Lays out the card body as two columns — `[trace] [span]` — inside the same
 * card. The span cell always exists and collapses to zero when hidden, so
 * opening/closing it animates via `grid-template-columns` rather than
 * mounting/unmounting a DOM column (which cannot be transitioned).
 * Search matches — span names in the timeline tree as well as values in the span
 * detail — are highlighted while a query is active.
 */
function TracePanelColumns({
  hasMessagesColumn,
  spanPanelSlot,
  highlightQuery,
  spanPanelKey,
  children,
}: {
  /** The Spans tab hosts a side column; the trace track then gets more room than the span detail. */
  hasMessagesColumn: boolean;
  spanPanelSlot?: ReactNode;
  highlightQuery: string;
  /** Identity of the span shown in the panel; changing it re-triggers the match scroll. */
  spanPanelKey?: string;
  children: ReactNode;
}) {
  // A single hook call on the common ancestor covers both the timeline tree and
  // the span detail, so span names and payload values highlight together.
  const { ref: highlightRef } = useTextHighlight<HTMLDivElement>(highlightQuery);

  // Scoped to the span-panel column only: a match deep in a large payload sits below
  // the fold, so the first painted match is brought into view when the panel opens.
  // The timeline column must never be scrolled by this.
  const { ref: scrollToMatchRef } = useScrollToFirstHighlight<HTMLDivElement>(highlightQuery, spanPanelKey);

  return (
    <div
      ref={highlightRef}
      data-trace-columns
      className={cn(
        'grid min-h-0 flex-1 transition-[grid-template-columns] duration-300 ease-in-out',
        spanPanelSlot ? (hasMessagesColumn ? 'grid-cols-[2fr_1fr]' : 'grid-cols-[1fr_1fr]') : 'grid-cols-[1fr_0fr]',
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">{children}</div>
      {/* Searchable: the span detail is where a match hides inside a large payload. */}
      <div
        ref={scrollToMatchRef}
        data-highlight
        className={cn(
          'flex min-h-0 min-w-0 flex-col overflow-hidden',
          spanPanelSlot && 'animate-in border-l border-border1 duration-300 fade-in-0',
        )}
      >
        {spanPanelSlot}
      </div>
    </div>
  );
}
