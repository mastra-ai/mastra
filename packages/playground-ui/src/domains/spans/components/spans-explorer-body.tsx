import type { SpanQueryArgs } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSpansListSource } from '../hooks/use-spans-list-source';
import { buildSpanQueryWhere } from '../span-filters';
import { spanToListRow } from '../span-list-row';
import type { SpanSelection } from './span-detail-panel';
import { SpansExplorerHistogram } from './spans-explorer-histogram';
import { SpansFilterBar } from './spans-filter-bar';
import { useObservabilityCapabilities } from '@/domains/capabilities';
import { ObservabilityListBody } from '@/domains/observability/components/observability-list-body';
import { useObservabilityListFilters } from '@/domains/observability/hooks/use-observability-list-filters';
import type { ObservabilityListUrlState } from '@/domains/observability/hooks/use-observability-list-filters';
import { SPAN_LIST_SORT_FIELDS } from '@/domains/observability/observability-list-url-state';
import { ColumnsMenu } from '@/domains/traces/components/columns-menu';
import { NoTracesInfo } from '@/domains/traces/components/no-traces-info';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { TracesListView } from '@/domains/traces/components/traces-list-view';
import type { TracesListSortField, TracesListViewTrace } from '@/domains/traces/components/traces-list-view';
import { useTraceColumnPreferences } from '@/domains/traces/hooks/use-trace-column-preferences';
import { hasTraceColumn, withoutUnrecordedStreamingColumns } from '@/domains/traces/trace-list-columns';
import { ActionRow } from '@/ds/components/ActionRow';

export type SpansExplorerPanelArgs = {
  selection: SpanSelection | undefined;
  /** Loaded spans, in list order, for the panel's previous/next buttons. */
  spans: SpanSelection[];
  onSelect: (selection: SpanSelection) => void;
  onClose: () => void;
};

export type SpansExplorerBodyProps = {
  /** The open span. The host keeps it (e.g. in the URL) so it survives a reload. */
  selection: SpanSelection | undefined;
  onSelectionChange: (selection: SpanSelection | undefined) => void;
  /** Renders the open span's panel in the host's own side panel or drawer. */
  renderPanel: (args: SpansExplorerPanelArgs) => ReactNode;
  /** The host's search params, so the time range, filters and sort survive a reload. Omitted: kept in memory. */
  urlState?: ObservabilityListUrlState;
};

/** The spans page body: filter bar, span list and the host's span panel. Router-agnostic. */
export function SpansExplorerBody({ selection, onSelectionChange, renderPanel, urlState }: SpansExplorerBodyProps) {
  const filters = useObservabilityListFilters(urlState, { sortFields: SPAN_LIST_SORT_FIELDS });
  const { timeRange, tokens, groups } = filters;
  const columns = useTraceColumnPreferences({ scope: 'spans' });

  const { data: capabilities, isLoading: isCapabilitiesLoading } = useObservabilityCapabilities();
  const withContextFields = capabilities?.capabilities.spanQueryContextFields ?? false;
  const withTimeToFirstChunk = capabilities?.capabilities.traceQueryTimeToFirstChunk ?? false;
  const withTimeToFirstToken = capabilities?.capabilities.traceQueryTimeToFirstToken ?? false;

  // Stored columns the store can't fill stay saved but aren't drawn, so they come back on a store that can.
  const displayedColumns = useMemo(
    () =>
      isCapabilitiesLoading
        ? columns.preferences
        : withoutUnrecordedStreamingColumns(columns.preferences, { withTimeToFirstChunk, withTimeToFirstToken }),
    [columns.preferences, isCapabilitiesLoading, withTimeToFirstChunk, withTimeToFirstToken],
  );

  const sortableFields = useMemo(() => {
    const fields: TracesListSortField[] = ['startedAt'];
    if (
      withTimeToFirstChunk &&
      capabilities?.capabilities.traceQueryTimeToFirstChunkSort &&
      hasTraceColumn(displayedColumns, 'timeToFirstChunk')
    ) {
      fields.push('timeToFirstChunkMs');
    }
    if (
      withTimeToFirstToken &&
      capabilities?.capabilities.traceQueryTimeToFirstTokenSort &&
      hasTraceColumn(displayedColumns, 'timeToFirstToken')
    ) {
      fields.push('timeToFirstTokenMs');
    }
    return fields;
  }, [capabilities, withTimeToFirstChunk, withTimeToFirstToken, displayedColumns]);

  // A URL sort the store can't run, or on a hidden column, lists newest first without rewriting the URL.
  const sort = sortableFields.includes(filters.sort.field)
    ? filters.sort
    : ({ field: 'startedAt', direction: 'desc' } as const);
  const { field: sortField, direction: sortDirection } = sort;

  const where = useMemo(
    () => buildSpanQueryWhere(tokens, groups, { withContextFields, withTimeToFirstChunk, withTimeToFirstToken }),
    [tokens, groups, withContextFields, withTimeToFirstChunk, withTimeToFirstToken],
  );
  const query = useMemo<SpanQueryArgs>(
    () => ({ timeRange, orderBy: [{ field: sortField, direction: sortDirection }], ...(where ? { where } : {}) }),
    [timeRange, sortField, sortDirection, where],
  );

  const { spans, hasNextPage, isFetchingNextPage, setEndOfListElement, isLoading, isError, error } = useSpansListSource(
    {
      query,
      rolling: filters.rolling,
    },
  );

  const rows = useMemo(() => (spans ?? []).map(spanToListRow), [spans]);
  const panelSpans = useMemo(
    () => rows.flatMap(row => (row.spanId ? [{ traceId: row.traceId, spanId: row.spanId }] : [])),
    [rows],
  );

  // Clicking the open row again closes the panel.
  const handleSpanClick = (row: TracesListViewTrace) => {
    if (!row.spanId) return;
    const isOpen = selection?.traceId === row.traceId && selection.spanId === row.spanId;
    onSelectionChange(isOpen ? undefined : { traceId: row.traceId, spanId: row.spanId });
  };

  // Same rule as /traces: an empty window without filters gets the full-page empty state.
  const showEmptyState = !isLoading && !isError && rows.length === 0 && !filters.contentFiltersApplied && !selection;

  return (
    <>
      <h1 className="sr-only">Spans</h1>
      <ObservabilityListBody
        toolbar={
          <ActionRow>
            <ActionRow.Start>
              <ColumnsMenu scope="spans" value={columns.preferences} onChange={columns.setPreferences} />
              <SpansFilterBar
                datePreset={filters.datePreset}
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                timeRange={timeRange}
                tokens={tokens}
                groups={groups}
                onDatePresetChange={filters.onDatePresetChange}
                onDateChange={filters.onDateChange}
                onDateRangeChange={filters.onDateRangeChange}
                onFiltersChange={filters.onFiltersChange}
                disabled={isLoading}
              />
            </ActionRow.Start>
          </ActionRow>
        }
        chart={
          <SpansExplorerHistogram
            timeRange={timeRange}
            where={where}
            onZoom={({ from, to }) => {
              filters.onDatePresetChange('custom');
              filters.onDateRangeChange(from, to);
            }}
          />
        }
        error={
          isError ? <TracesErrorContent error={error} resource="spans" errorTitle="Failed to load spans" /> : undefined
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
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
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
