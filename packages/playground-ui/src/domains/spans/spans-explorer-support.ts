import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import type { TraceQueryScalarPredicate } from '@mastra/core/storage';
import type { SpanQueryArgs } from '@mastra/react/hooks/traces';
import type { TracesListSortField } from '@/domains/traces/components/traces-list-view';
import { hasTraceColumn, withoutUnrecordedStreamingColumns } from '@/domains/traces/trace-list-columns';
import type { TraceColumnPreferences } from '@/domains/traces/trace-list-columns';

/** What the store can do for the spans list, read from `getObservabilityCapabilities()`. */
export type SpansExplorerSupport = {
  /** Capabilities are still loading: the list waits and stored columns are drawn as saved. */
  isLoading: boolean;
  /** The store answers `querySpans()`. Off, the columns menu can't offer the streaming timings. */
  withQuery: boolean;
  /** The store answers `aggregateSpans()`, which draws the histogram. */
  withAggregate: boolean;
  withTokenSearch: boolean;
  withContextFields: boolean;
  withOutcomeFields: boolean;
  withModelFields: boolean;
  withTimeToFirstChunk: boolean;
  withTimeToFirstToken: boolean;
  withTimeToFirstChunkSort: boolean;
  withTimeToFirstTokenSort: boolean;
};

export type SpansListSort = { field: TracesListSortField; direction: 'asc' | 'desc' };

const NEWEST_FIRST: SpansListSort = { field: 'startedAt', direction: 'desc' };

export function resolveSpansSupport({
  data,
  isLoading,
}: {
  data?: GetObservabilityCapabilitiesResponse;
  isLoading: boolean;
}): SpansExplorerSupport {
  const capabilities = data?.capabilities;
  return {
    isLoading,
    withQuery: !isLoading && (capabilities?.spanQuery ?? false),
    withAggregate: !isLoading && capabilities?.spanAggregate === true,
    withTokenSearch: !!(capabilities?.spanQueryTokenSearch && capabilities.spanAggregateTokenSearch),
    withContextFields: capabilities?.spanQueryContextFields ?? false,
    withOutcomeFields: capabilities?.spanQueryOutcomeFields ?? false,
    withModelFields: capabilities?.spanQueryModelFields ?? false,
    withTimeToFirstChunk: capabilities?.traceQueryTimeToFirstChunk ?? false,
    withTimeToFirstToken: capabilities?.traceQueryTimeToFirstToken ?? false,
    withTimeToFirstChunkSort: capabilities?.traceQueryTimeToFirstChunkSort ?? false,
    withTimeToFirstTokenSort: capabilities?.traceQueryTimeToFirstTokenSort ?? false,
  };
}

/** Stored columns the store can't fill stay saved but aren't drawn, so they come back on a store that can. */
function spansDisplayedColumns(
  preferences: TraceColumnPreferences,
  support: SpansExplorerSupport,
): TraceColumnPreferences {
  return support.isLoading ? preferences : withoutUnrecordedStreamingColumns(preferences, support);
}

/** Start time, plus each streaming timing the store sorts on and the list shows. */
function spansSortableFields(
  displayedColumns: TraceColumnPreferences,
  support: SpansExplorerSupport,
): TracesListSortField[] {
  const fields: TracesListSortField[] = ['startedAt'];
  if (
    support.withTimeToFirstChunk &&
    support.withTimeToFirstChunkSort &&
    hasTraceColumn(displayedColumns, 'timeToFirstChunk')
  ) {
    fields.push('timeToFirstChunkMs');
  }
  if (
    support.withTimeToFirstToken &&
    support.withTimeToFirstTokenSort &&
    hasTraceColumn(displayedColumns, 'timeToFirstToken')
  ) {
    fields.push('timeToFirstTokenMs');
  }
  return fields;
}

/** A sort the store can't run, or on a hidden column, lists newest first without rewriting the host's state. */
function resolveSpansSort(sort: SpansListSort, sortableFields: readonly TracesListSortField[]): SpansListSort {
  return sortableFields.includes(sort.field) ? sort : NEWEST_FIRST;
}

/**
 * The columns the list draws, the fields it can sort on, and the sort it runs. The host builds its query
 * with the same `sort` the list shows, so both read it from here.
 */
export function resolveSpansListView(
  sort: SpansListSort,
  preferences: TraceColumnPreferences,
  support: SpansExplorerSupport,
) {
  const displayedColumns = spansDisplayedColumns(preferences, support);
  const sortableFields = spansSortableFields(displayedColumns, support);
  return { displayedColumns, sortableFields, sort: resolveSpansSort(sort, sortableFields) };
}

export function buildSpansListQuery(
  timeRange: SpanQueryArgs['timeRange'],
  sort: SpansListSort,
  where: TraceQueryScalarPredicate | undefined,
): SpanQueryArgs {
  return { timeRange, orderBy: [{ field: sort.field, direction: sort.direction }], where };
}
