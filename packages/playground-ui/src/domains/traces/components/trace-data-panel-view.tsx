import {
  CircleGaugeIcon,
  DownloadIcon,
  Link2Icon,
  Loader2Icon,
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
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DataPanel } from '@/ds/components/DataPanel';
import type { DataPanelProps } from '@/ds/components/DataPanel';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks';
import { Notice } from '@/ds/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import type { LinkComponent } from '@/ds/types/link-component';
import { useScrollToFirstHighlight } from '@/hooks/use-scroll-to-first-highlight';
import { useTextHighlight } from '@/hooks/use-text-highlight';
import { cn } from '@/lib/utils';

export type TraceDataPanelPlacement = 'traces-list' | 'trace-page';

export type TraceDataPanelTab = 'details' | 'timeline' | 'scores' | 'feedback';

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
   * Rendered as a column to the left of the span tree inside the same card
   * (typically the trace as one reconstructed agent turn). Collapsed while the
   * Timeline tab is active, since the timeline needs the width.
   */
  messagesPanelSlot?: ReactNode;
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
  spanPanelSlot,
}: TraceDataPanelViewProps) {
  const isOnTracePage = placement === 'trace-page';

  // Tracked locally too (tabs may be uncontrolled) so the messages column knows
  // when to fold away for the Timeline tab.
  const [uncontrolledTab, setUncontrolledTab] = useState<TraceDataPanelTab>('details');
  const currentTab = activeTab ?? uncontrolledTab;
  const handleTabChange = (tab: TraceDataPanelTab) => {
    setUncontrolledTab(tab);
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
          <Button size="md" variant="ghost" tooltip="Trace actions" aria-label="Trace actions">
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
                <ButtonsGroup className="ml-auto shrink-0">{traceActionsMenu}</ButtonsGroup>
              </>
            ) : (
              <>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
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
                </div>
                <ButtonsGroup className="ml-auto shrink-0 self-start">
                  {onEvaluateTrace && (
                    <Button variant="primary" size="md" onClick={onEvaluateTrace} disabled={!rootSpan}>
                      <CircleGaugeIcon />
                      Score trace
                    </Button>
                  )}
                  {traceActionsMenu}
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

          <TracePanelColumns
            messagesPanelSlot={messagesPanelSlot}
            messagesCollapsed={currentTab === 'timeline'}
            spanPanelSlot={spanPanelSlot}
            highlightQuery={query}
            spanPanelKey={selectedSpanId}
          >
            {isLoading ? (
              <DataPanel.LoadingData>Loading trace...</DataPanel.LoadingData>
            ) : !spans?.length ? (
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
                const noSearchResults = hierarchicalSpans.length === 0 && (
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
                      <TabList variant="pill-ghost">
                        <Tab value="details">Spans</Tab>
                        <Tab value="timeline">Timeline</Tab>
                        {feedbackTabSlot && <Tab value="feedback">Feedback{feedbackTabBadge}</Tab>}
                        {scoresTabSlot && (
                          <Tab value="scores">Scores{scoresTabBadge != null && <> ({scoresTabBadge})</>}</Tab>
                        )}
                      </TabList>
                    </DataPanel.Header>

                    {/* Tab contents share the tab list's horizontal padding so their edges line up. */}
                    <TabContent value="details" className="min-h-0 py-0">
                      <DataPanel.Content>
                        {!isOnTracePage &&
                          !onEvaluateTrace &&
                          !onSaveAsDatasetItem &&
                          !onAddTraceMocksToItem &&
                          showUnavailableFeaturesMsg && (
                            <Notice variant="info" className="mb-6">
                              <Notice.Message>
                                Evaluating traces and saving them as dataset items is available in Mastra Studio (local
                                or deployed).
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
                        />
                        {noSearchResults}
                      </DataPanel.Content>
                    </TabContent>
                    <TabContent value="timeline" className="min-h-0 py-0">
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
                        />
                        {noSearchResults}
                      </DataPanel.Content>
                    </TabContent>
                    {feedbackTabSlot && (
                      <TabContent value="feedback" className="h-full min-h-0 py-0">
                        <DataPanel.Content>{feedbackTabSlot({ traceId })}</DataPanel.Content>
                      </TabContent>
                    )}
                    {scoresTabSlot && (
                      <TabContent value="scores" className="h-full min-h-0 py-0">
                        <DataPanel.Content>
                          {scoresTabSlot({ traceId, rootSpanId: rootSpan?.spanId })}
                        </DataPanel.Content>
                      </TabContent>
                    )}
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
 * Lays out the card body as three columns — `[messages] [trace] [span]` — inside
 * the same card. The messages and span cells always exist and collapse to `0fr`
 * when hidden, so opening/closing them animates via `grid-template-columns`
 * rather than mounting/unmounting a DOM column (which cannot be transitioned).
 * Search matches — span names in the timeline tree as well as values in the span
 * detail — are highlighted while a query is active.
 */
function TracePanelColumns({
  messagesPanelSlot,
  messagesCollapsed,
  spanPanelSlot,
  highlightQuery,
  spanPanelKey,
  children,
}: {
  messagesPanelSlot?: ReactNode;
  /** Folds the messages column away (e.g. while the Timeline tab needs the width). */
  messagesCollapsed: boolean;
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

  const showMessages = !!messagesPanelSlot && !messagesCollapsed;
  const columns =
    showMessages && spanPanelSlot
      ? 'grid-cols-[1fr_1fr_1fr]'
      : showMessages
        ? 'grid-cols-[1fr_1fr_0fr]'
        : spanPanelSlot
          ? 'grid-cols-[0fr_1fr_1fr]'
          : 'grid-cols-[0fr_1fr_0fr]';

  return (
    <div
      ref={highlightRef}
      data-trace-columns
      className={cn('grid min-h-0 flex-1 transition-[grid-template-columns] duration-300 ease-in-out', columns)}
    >
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-col overflow-hidden',
          showMessages && 'animate-in border-r border-border1 duration-300 fade-in-0',
        )}
      >
        {messagesPanelSlot}
      </div>
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
