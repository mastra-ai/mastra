import { useQuerySpans } from '@mastra/react/hooks/traces';
import type { SpanQueryArgs } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { buildSpanQueryWhere } from '../span-filters';
import { spanToListRow } from '../span-list-row';
import type { SpanSelection } from './span-detail-panel';
import { SpansFilterBar } from './spans-filter-bar';
import { useObservabilityCapabilities } from '@/domains/capabilities';
import { ObservabilityListBody } from '@/domains/observability/components/observability-list-body';
import {
  observabilityListQueryOptions,
  useObservabilityListFilters,
} from '@/domains/observability/hooks/use-observability-list-filters';
import { ColumnsMenu } from '@/domains/traces/components/columns-menu';
import { NoTracesInfo } from '@/domains/traces/components/no-traces-info';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { TracesListView } from '@/domains/traces/components/traces-list-view';
import type { TracesListViewTrace } from '@/domains/traces/components/traces-list-view';
import { useTraceColumnPreferences } from '@/domains/traces/hooks/use-trace-column-preferences';
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
};

/** The spans page body: filter bar, span list and the host's span panel. Router-agnostic. */
export function SpansExplorerBody({ selection, onSelectionChange, renderPanel }: SpansExplorerBodyProps) {
  const filters = useObservabilityListFilters();
  const { timeRange, tokens, groups, sort } = filters;
  const columns = useTraceColumnPreferences({ scope: 'spans' });

  const { data: capabilities } = useObservabilityCapabilities();
  const withContextFields = capabilities?.capabilities.spanQueryContextFields ?? false;

  const query = useMemo<SpanQueryArgs>(() => {
    const where = buildSpanQueryWhere(tokens, groups, { withContextFields });
    return { timeRange, orderBy: [{ field: 'startedAt', direction: sort }], ...(where ? { where } : {}) };
  }, [timeRange, sort, tokens, groups, withContextFields]);

  const { spans, hasNextPage, isFetchingNextPage, setEndOfListElement, isLoading, isError, error } = useQuerySpans({
    query,
    queryOptions: observabilityListQueryOptions,
  });

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
            <ActionRow.End>
              <ColumnsMenu scope="spans" value={columns.preferences} onChange={columns.setPreferences} />
            </ActionRow.End>
          </ActionRow>
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
          columnPreferences={columns.preferences}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          setEndOfListElement={setEndOfListElement}
          filtersApplied={filters.filtersApplied}
          resource="spans"
          isBranchesMode
          createdSort={sort}
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
