import {
  CircleGaugeIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
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
import { TraceSummaryDescription } from './trace-summary-description';
import { TraceTimeline } from './trace-timeline';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DataPanel } from '@/ds/components/DataPanel';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks';
import { Notice } from '@/ds/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import type { LinkComponent } from '@/ds/types/link-component';
import { useScrollToFirstHighlight } from '@/hooks/use-scroll-to-first-highlight';
import { useTextHighlight } from '@/hooks/use-text-highlight';
import { truncateString } from '@/lib/truncate-string';

export type TraceDataPanelPlacement = 'traces-list' | 'trace-page';

export type TraceDataPanelTab = 'details' | 'scores' | 'feedback';

export interface TraceDataPanelViewProps {
  traceId: string;
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
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  placement: TraceDataPanelPlacement;
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
   * When provided, the panel content becomes tabbed ("Details" / "Scores"); the slot
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
  /** Extra classes applied to the panel root (e.g. `h-full` on the trace page). */
  className?: string;
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
  collapsed: controlledCollapsed,
  onCollapsedChange,
  placement,
  timelineChartWidth = 'default',
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

  const traceActionsMenu = (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button size="md" tooltip="Trace actions" aria-label="Trace actions">
            <MoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenu.Content align="end">
        {!isOnTracePage && onCollapsedChange && (
          <DropdownMenu.Item onSelect={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
            {collapsed ? 'Expand panel' : 'Collapse panel'}
          </DropdownMenu.Item>
        )}
        {!isOnTracePage && onEvaluateTrace && (
          <DropdownMenu.Item onSelect={onEvaluateTrace}>
            <CircleGaugeIcon />
            Evaluate trace
          </DropdownMenu.Item>
        )}
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
    <DataPanel collapsed={collapsed} className={className}>
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
                Trace <b># {truncateString(traceId, 12)}</b>
              </DataPanel.Heading>
              {!collapsed && rootSpan && (
                <TraceSummaryDescription
                  rootSpan={rootSpan}
                  usage={usage}
                  entityHref={entityHref}
                  LinkComponent={LinkComponent}
                />
              )}
            </div>
            <ButtonsGroup className="ml-auto shrink-0 self-start">
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

      {!collapsed && (
        <SplitWithSpanPanel spanPanelSlot={spanPanelSlot} highlightQuery={query} spanPanelKey={selectedSpanId}>
          {isLoading ? (
            <DataPanel.LoadingData>Loading trace...</DataPanel.LoadingData>
          ) : !spans?.length ? (
            <DataPanel.NoData>No spans found for this trace.</DataPanel.NoData>
          ) : (
            <DataPanel.Content>
              {(() => {
                const detailsBody = (
                  <>
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
                  </>
                );

                // No extra tab slots → render details directly without the Tabs wrapper.
                if (!scoresTabSlot && !feedbackTabSlot) return detailsBody;

                return (
                  <Tabs<TraceDataPanelTab>
                    defaultTab="details"
                    value={activeTab}
                    onValueChange={onTabChange}
                    className={
                      activeTab === 'scores' || activeTab === 'feedback'
                        ? 'grid h-full min-h-0 grid-rows-[auto_1fr]'
                        : undefined
                    }
                  >
                    <TabList variant="pill-ghost" className="px-0">
                      <Tab value="details">Spans</Tab>
                      {scoresTabSlot && (
                        <Tab value="scores">Evaluations {scoresTabBadge != null && <>({scoresTabBadge})</>}</Tab>
                      )}
                      {feedbackTabSlot && (
                        <Tab value="feedback">Feedback {feedbackTabBadge != null && <>({feedbackTabBadge})</>}</Tab>
                      )}
                    </TabList>

                    <TabContent value="details">{detailsBody}</TabContent>
                    {scoresTabSlot && (
                      <TabContent value="scores" className="h-full min-h-0">
                        {scoresTabSlot({ traceId, rootSpanId: rootSpan?.spanId })}
                      </TabContent>
                    )}
                    {feedbackTabSlot && (
                      <TabContent value="feedback" className="h-full min-h-0">
                        {feedbackTabSlot({ traceId })}
                      </TabContent>
                    )}
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
 * Search matches — span names in the timeline tree as well as values in the span
 * detail — are highlighted while a query is active.
 */
function SplitWithSpanPanel({
  spanPanelSlot,
  highlightQuery,
  spanPanelKey,
  children,
}: {
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

  if (!spanPanelSlot) {
    return (
      <div ref={highlightRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div ref={highlightRef} className="grid min-h-0 flex-1 grid-cols-[1fr_1fr]">
      <div className="flex min-h-0 flex-col overflow-hidden">{children}</div>
      {/* Searchable: the span detail is where a match hides inside a large payload. */}
      <div
        ref={scrollToMatchRef}
        data-highlight
        className="animate-in border-border1 fade-in-0 flex min-h-0 flex-col overflow-hidden border-l duration-300"
      >
        {spanPanelSlot}
      </div>
    </div>
  );
}
