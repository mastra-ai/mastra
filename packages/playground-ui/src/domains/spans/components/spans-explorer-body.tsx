import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { spanToListRow } from '../span-list-row';
import type { SpansExplorerFilterFields, SpansExplorerHistogramData, SpansExplorerSpans } from '../spans-explorer-data';
import { resolveSpansListView } from '../spans-explorer-support';
import type { SpansExplorerSupport } from '../spans-explorer-support';
import type { SpanSelection } from './span-detail-panel';
import { SpansExplorerHistogram } from './spans-explorer-histogram';
import { SpansFilterBar } from './spans-filter-bar';
import { LoadMoreWhenInView } from '@/domains/observability/components/load-more-when-in-view';
import { ObservabilityListBody } from '@/domains/observability/components/observability-list-body';
import type {
  ObservabilityListFiltersState,
  ObservabilityListUrlState,
} from '@/domains/observability/hooks/use-observability-list-filters';
import { ObservabilitySavedViews } from '@/domains/observability/saved-views';
import type { SavedViewColumnsControl } from '@/domains/observability/saved-views';
import { ColumnsMenu } from '@/domains/traces/components/columns-menu';
import { NoTracesInfo } from '@/domains/traces/components/no-traces-info';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { TracesListView } from '@/domains/traces/components/traces-list-view';
import type { TracesListSortField, TracesListViewTrace } from '@/domains/traces/components/traces-list-view';
import { ActionRow } from '@/ds/components/ActionRow';
import { useInView } from '@/hooks/use-in-view';

export type SpansExplorerPanelArgs = {
  selection: SpanSelection | undefined;
  /** Loaded spans, in list order, for the panel's previous/next buttons. */
  spans: SpanSelection[];
  onSelect: (selection: SpanSelection) => void;
  onClose: () => void;
};

export type SpansExplorerBodyProps = {
  /** What the store can do (Studio: `useSpansSupport`). */
  support: SpansExplorerSupport;
  /** The list's time range, filters and sort (`useObservabilityListFilters`). */
  filters: ObservabilityListFiltersState<TracesListSortField>;
  /** The stored column selection. */
  columns: SavedViewColumnsControl;
  /** The loaded spans (Studio: `useSpansListQuery`). */
  spans: SpansExplorerSpans;
  /** The filter bar's fields (Studio: `useSpansFilterBarFields`). */
  filterFields: SpansExplorerFilterFields;
  /** Span and error counts over the window (Studio: `useSpansHistogramQuery`). Omitted, no chart shows. */
  histogram?: SpansExplorerHistogramData;
  /** The open span. The host keeps it (e.g. in the URL) so it survives a reload. */
  selection: SpanSelection | undefined;
  onSelectionChange: (selection: SpanSelection | undefined) => void;
  /** Renders the open span's panel in the host's own side panel or drawer. */
  renderPanel: (args: SpansExplorerPanelArgs) => ReactNode;
  /** The host's search params, for saved views. Omitted: no saved views. */
  urlState?: ObservabilityListUrlState;
};

/** The spans page body: filter bar, histogram, span list and the host's span panel. Never fetches. */
export function SpansExplorerBody({
  support,
  filters,
  columns,
  spans,
  filterFields,
  histogram,
  selection,
  onSelectionChange,
  renderPanel,
  urlState,
}: SpansExplorerBodyProps) {
  const { displayedColumns, sortableFields, sort } = resolveSpansListView(filters.sort, columns.preferences, support);
  const { inView, setRef: setEndOfListElement } = useInView();

  const rows = useMemo(() => spans.spans.map(spanToListRow), [spans.spans]);
  const panelSpans = useMemo(
    () => rows.flatMap(row => (row.spanId ? [{ traceId: row.traceId, spanId: row.spanId }] : [])),
    [rows],
  );
  // The list waits for capabilities before it asks, so it reads as loading until then.
  const isLoading = support.isLoading || spans.isLoading;

  // Clicking the open row again closes the panel.
  const handleSpanClick = (row: TracesListViewTrace) => {
    if (!row.spanId) return;
    const isOpen = selection?.traceId === row.traceId && selection.spanId === row.spanId;
    onSelectionChange(isOpen ? undefined : { traceId: row.traceId, spanId: row.spanId });
  };

  // Same rule as /traces: an empty window without filters gets the full-page empty state.
  const showEmptyState =
    !isLoading && !spans.isError && rows.length === 0 && !filters.contentFiltersApplied && !selection;

  return (
    <>
      <h1 className="sr-only">Spans</h1>
      <ObservabilityListBody
        toolbar={
          <>
            {urlState && <ObservabilitySavedViews page="spans" {...urlState} columns={columns} />}
            <ActionRow>
              <ActionRow.Start>
                <SpansFilterBar
                  fields={filterFields}
                  datePreset={filters.datePreset}
                  dateFrom={filters.dateFrom}
                  dateTo={filters.dateTo}
                  tokens={filters.tokens}
                  groups={filters.groups}
                  onDatePresetChange={filters.onDatePresetChange}
                  onDateChange={filters.onDateChange}
                  onDateRangeChange={filters.onDateRangeChange}
                  onDateReset={filters.onDateReset}
                  onFiltersChange={filters.onFiltersChange}
                  disabled={isLoading}
                />
              </ActionRow.Start>
              <ActionRow.End>
                <ColumnsMenu
                  scope="spans"
                  value={columns.preferences}
                  onChange={columns.setPreferences}
                  support={support}
                />
              </ActionRow.End>
            </ActionRow>
          </>
        }
        chart={<SpansExplorerHistogram data={histogram} onZoom={({ from, to }) => filters.onZoom(from, to)} />}
        error={
          spans.isError ? (
            <TracesErrorContent error={spans.error} resource="spans" errorTitle="Failed to load spans" />
          ) : undefined
        }
        empty={
          showEmptyState ? (
            <NoTracesInfo
              resource="spans"
              datePreset={filters.datePreset}
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
            />
          ) : undefined
        }
      >
        <TracesListView
          listId="all-spans"
          traces={rows}
          columnPreferences={displayedColumns}
          isLoading={isLoading}
          isFetchingNextPage={spans.isFetchingNextPage}
          hasNextPage={spans.hasNextPage}
          setEndOfListElement={setEndOfListElement}
          filtersApplied={filters.filtersApplied}
          resource="spans"
          isBranchesMode
          sort={sort}
          sortableFields={sortableFields}
          onSortChange={filters.setSort}
          featuredTraceId={selection?.traceId}
          featuredSpanId={selection?.spanId}
          onTraceClick={handleSpanClick}
        />
        <LoadMoreWhenInView
          inView={inView}
          hasNextPage={spans.hasNextPage}
          isFetchingNextPage={spans.isFetchingNextPage}
          isError={spans.isError}
          onLoadMore={spans.onLoadMore}
        />
      </ObservabilityListBody>
      {renderPanel({
        selection,
        spans: panelSpans,
        onSelect: onSelectionChange,
        onClose: () => onSelectionChange(undefined),
      })}
    </>
  );
}
