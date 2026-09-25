import { useVirtualizer } from '@tanstack/react-virtual';
import { ListFilterIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  DEFAULT_TRACE_COLUMN_PREFERENCES,
  TRACE_CUSTOM_COLUMN_LABELS,
  buildTraceListColumns,
  formatTraceMetadataValue,
  hasTraceColumn,
} from '../trace-list-columns';
import type { TraceColumnPreferences, TraceCustomColumn, TraceUsageSummary } from '../trace-list-columns';
import { getInputPreview, getSpanDurationMs } from '../utils/span-utils';
import { DataList, DataListSkeleton, TracesDataList, useDataListKeyboard } from '@/ds/components/DataList';
import type { DataListSort } from '@/ds/components/DataList';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Txt } from '@/ds/components/Txt/Txt';
import { formatCompactNumber, formatCost } from '@/lib/cost';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/duration';

export type TracesListViewTrace = {
  traceId: string;
  /** Required for branch rows; absent on plain trace rows (which are root-rooted). */
  spanId?: string | null;
  /** `null`/missing → root span. Drives the Kind column's icon (top-level trace vs nested branch). */
  parentSpanId?: string | null;
  name: string;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  threadId?: string | null;
  resourceId?: string | null;
  environment?: string | null;
  status?: string | null;
  /** Server-rendered preview of `input`. Present on lightweight rows, which omit `input` itself. */
  inputPreview?: string | null;
  input?: unknown;
  metadata?: Record<string, unknown> | null;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  createdAt: Date | string;
};

const ROW_HEIGHT = 36;
const OVERSCAN = 8;
/** Distinct values offered in a custom column's "filter by value" header menu. */
const MAX_FILTER_VALUES = 20;

function customColumnValue(trace: TracesListViewTrace, field: TraceCustomColumn): string | null | undefined {
  return trace[field];
}

function distinctCustomColumnValues(traces: TracesListViewTrace[], field: TraceCustomColumn): string[] {
  const values = new Set<string>();
  for (const trace of traces) {
    const value = trace[field];
    if (typeof value === 'string' && value) values.add(value);
    if (values.size >= MAX_FILTER_VALUES) break;
  }
  return [...values];
}

function sumTokens(usage: TraceUsageSummary | undefined): number | undefined {
  if (usage?.inputTokens === undefined && usage?.outputTokens === undefined) return undefined;
  return (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
}

export type TracesListViewProps = {
  traces: TracesListViewTrace[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  /** Currently featured/selected trace — its row gets the highlighted background. */
  featuredTraceId?: string | null;
  /**
   * Required in branches mode to disambiguate rows sharing a `traceId`. When set,
   * a row is featured only when both `traceId` and `spanId` match.
   */
  featuredSpanId?: string | null;
  /** Branches mode mixes root traces with subtraces — enables the Trace/Subtrace tooltip on the
   *  level icon in the Name column, which is meaningless when every row is a root. */
  isBranchesMode?: boolean;
  /** Keys (`traceId:spanId`) of rows that just arrived via delta polling. Rows whose key is in
   *  this set get a temporary tint to distinguish them from rows present since the last page-mode
   *  fetch. Auto-expires upstream (in useTraces) after a short window. */
  recentlyAddedKeys?: Set<string>;
  /** Optional and metadata columns selected for this project. */
  columnPreferences?: TraceColumnPreferences;
  /** Token and estimated-cost totals, aggregated across model spans by trace ID. */
  usageByTraceId?: ReadonlyMap<string, TraceUsageSummary>;
  /** Called when a row is clicked. The current selection logic (toggle on same id) is the consumer's call. */
  onTraceClick: (trace: TracesListViewTrace) => void;
  /** Current sort of the Created column. When `onSortChange` is provided the header becomes sortable. */
  createdSort?: DataListSort;
  onSortChange?: (direction: DataListSort, key: 'startedAt') => void;
  /** When provided, custom column headers offer an `is <value>` filter for every value currently listed. */
  onFilterByField?: (field: TraceCustomColumn, value: string) => void;
};

/**
 * Virtualized presentational list. Renders only the visible window via TanStack Virtual, and
 * uses DataList primitives for layout (CSS Grid with subgrid rows).
 */
export function TracesListView({
  traces,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  filtersApplied,
  featuredTraceId,
  featuredSpanId,
  isBranchesMode,
  recentlyAddedKeys,
  columnPreferences = DEFAULT_TRACE_COLUMN_PREFERENCES,
  usageByTraceId,
  onTraceClick,
  createdSort,
  onSortChange,
  onFilterByField,
}: TracesListViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const columns = buildTraceListColumns(columnPreferences);

  const virtualizer = useVirtualizer({
    count: traces.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const { getRowProps } = useDataListKeyboard({
    count: traces.length,
    containerRef: scrollRef,
    onNavigate: index => virtualizer.scrollToIndex(index),
    global: true,
  });

  // Reset scroll to top whenever a fresh query resolves (filter / date range change).
  // `isLoading` only flips on initial fetches — `fetchNextPage` keeps it `false`, so this
  // effect doesn't fire during pagination.
  //
  // Why the manual scroll event: when the skeleton-vs-list branch swaps in the new scroll
  // container, it mounts at `scrollTop = 0`. The virtualizer rebinds its listener but
  // doesn't re-read `scrollTop`, so it keeps the stale `scrollOffset` from the previous
  // element. `scrollToOffset(0)` no-ops because the new element is already at 0 (no scroll
  // event fires). Dispatching a synthetic `scroll` forces the virtualizer's handler to
  // read the fresh `scrollTop` and recompute `virtualItems` with `paddingTop = 0`.
  const wasLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      scrollRef.current?.dispatchEvent(new Event('scroll'));
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  if (isLoading) {
    return <DataListSkeleton columns={columns} fit="container" />;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualItems.length > 0 ? Math.max(0, totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)) : 0;

  return (
    <TracesDataList columns={columns} fit="container" scrollRef={scrollRef} className="min-w-0">
      <TracesDataList.Top>
        {onSortChange ? (
          <TracesDataList.SortableTopCell sortKey="startedAt" sort={createdSort} onSortChange={onSortChange}>
            Start
          </TracesDataList.SortableTopCell>
        ) : (
          <TracesDataList.TopCell>Start</TracesDataList.TopCell>
        )}
        {hasTraceColumn(columnPreferences, 'type') && <TracesDataList.TopCell>Type</TracesDataList.TopCell>}
        <TracesDataList.TopCell>Name</TracesDataList.TopCell>
        {hasTraceColumn(columnPreferences, 'input') && <TracesDataList.TopCell>Input</TracesDataList.TopCell>}
        <TracesDataList.TopCell>Status</TracesDataList.TopCell>
        {hasTraceColumn(columnPreferences, 'duration') && (
          <TracesDataList.TopCell className="justify-end text-right">Duration</TracesDataList.TopCell>
        )}
        {hasTraceColumn(columnPreferences, 'endTime') && <TracesDataList.TopCell>End</TracesDataList.TopCell>}
        {hasTraceColumn(columnPreferences, 'environment') && (
          <TracesDataList.TopCell>Environment</TracesDataList.TopCell>
        )}
        {hasTraceColumn(columnPreferences, 'inputTokens') && (
          <TracesDataList.TopCell className="justify-end text-right">Input tokens</TracesDataList.TopCell>
        )}
        {hasTraceColumn(columnPreferences, 'outputTokens') && (
          <TracesDataList.TopCell className="justify-end text-right">Output tokens</TracesDataList.TopCell>
        )}
        {hasTraceColumn(columnPreferences, 'totalTokens') && (
          <TracesDataList.TopCell className="justify-end text-right">Total tokens</TracesDataList.TopCell>
        )}
        {hasTraceColumn(columnPreferences, 'estimatedCost') && (
          <TracesDataList.TopCell className="justify-end text-right">Est. cost</TracesDataList.TopCell>
        )}
        {columnPreferences.customColumns.map(field => {
          const label = TRACE_CUSTOM_COLUMN_LABELS[field];
          const filterValues = onFilterByField ? distinctCustomColumnValues(traces, field) : [];
          if (!onFilterByField || filterValues.length === 0) {
            return <TracesDataList.TopCell key={field}>{label}</TracesDataList.TopCell>;
          }
          return (
            <TracesDataList.TopCell key={field} className="overflow-visible">
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <button
                      type="button"
                      className="focus-visible:outline-accent flex min-w-0 items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2"
                    >
                      <span className="min-w-0 truncate">{label}</span>
                      <ListFilterIcon aria-hidden className="size-[1.2em] shrink-0" />
                    </button>
                  }
                />
                <DropdownMenu.Content align="start">
                  <DropdownMenu.Label>Filter by value</DropdownMenu.Label>
                  {filterValues.map(value => (
                    <DropdownMenu.Item key={value} onSelect={() => onFilterByField(field, value)}>
                      <Txt as="span" variant="body-sm" font="mono" className="min-w-0 truncate">
                        {value}
                      </Txt>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu>
            </TracesDataList.TopCell>
          );
        })}
        {columnPreferences.metadataKeys.map(key => (
          <TracesDataList.TopCellWithTooltip key={key} tooltip={key}>
            {key}
          </TracesDataList.TopCellWithTooltip>
        ))}
      </TracesDataList.Top>

      {traces.length === 0 ? (
        <TracesDataList.NoMatch
          message={filtersApplied ? 'No traces found for applied filters' : 'No traces found yet'}
        />
      ) : (
        <>
          <TracesDataList.Spacer height={paddingTop} />
          {virtualItems.map(vi => {
            const trace = traces[vi.index];
            if (!trace) return null;

            const isFeatured =
              trace.traceId === featuredTraceId && (featuredSpanId == null || trace.spanId === featuredSpanId);
            const rowKey = `${trace.traceId}:${trace.spanId ?? ''}`;
            const isRecentlyAdded = recentlyAddedKeys?.has(rowKey) ?? false;
            const displayDate = trace.startedAt ?? trace.createdAt;
            const usage = usageByTraceId?.get(trace.traceId);

            return (
              <TracesDataList.RowButton
                key={rowKey}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                {...getRowProps(vi.index)}
                onClick={() => onTraceClick(trace)}
                featured={isFeatured}
                className={cn(isRecentlyAdded && 'animate-row-highlight')}
              >
                <TracesDataList.CreatedCell timestamp={displayDate} />
                {hasTraceColumn(columnPreferences, 'type') && <TracesDataList.TypeCell entityType={trace.entityType} />}
                <TracesDataList.NameCell
                  name={trace.name}
                  parentSpanId={trace.parentSpanId}
                  showLevelTooltip={isBranchesMode}
                />
                {hasTraceColumn(columnPreferences, 'input') && (
                  <TracesDataList.InputCell input={trace.inputPreview ?? getInputPreview(trace.input)} />
                )}
                <TracesDataList.StatusCell status={trace.status} />
                {hasTraceColumn(columnPreferences, 'duration') && (
                  <DataList.NumberCell font="mono">
                    {formatDuration(getSpanDurationMs(trace.startedAt, trace.endedAt))}
                  </DataList.NumberCell>
                )}
                {hasTraceColumn(columnPreferences, 'endTime') && (
                  <TracesDataList.CreatedCell timestamp={trace.endedAt ?? ''} />
                )}
                {hasTraceColumn(columnPreferences, 'environment') && (
                  <DataList.TextCell>{trace.environment || '—'}</DataList.TextCell>
                )}
                {hasTraceColumn(columnPreferences, 'inputTokens') && (
                  <DataList.NumberCell>
                    {usage?.inputTokens === undefined ? undefined : formatCompactNumber(usage.inputTokens)}
                  </DataList.NumberCell>
                )}
                {hasTraceColumn(columnPreferences, 'outputTokens') && (
                  <DataList.NumberCell>
                    {usage?.outputTokens === undefined ? undefined : formatCompactNumber(usage.outputTokens)}
                  </DataList.NumberCell>
                )}
                {hasTraceColumn(columnPreferences, 'totalTokens') && (
                  <DataList.NumberCell>
                    {(() => {
                      const total = sumTokens(usage);
                      return total === undefined ? undefined : formatCompactNumber(total);
                    })()}
                  </DataList.NumberCell>
                )}
                {hasTraceColumn(columnPreferences, 'estimatedCost') && (
                  <DataList.NumberCell>
                    {usage?.estimatedCost === undefined ? undefined : formatCost(usage.estimatedCost, usage.costUnit)}
                  </DataList.NumberCell>
                )}
                {columnPreferences.customColumns.map(field => (
                  <DataList.TextCell font="mono" key={field}>
                    {customColumnValue(trace, field) ?? undefined}
                  </DataList.TextCell>
                ))}
                {columnPreferences.metadataKeys.map(key => {
                  const value = formatTraceMetadataValue(trace.metadata, key);
                  return (
                    <DataList.TextCell font="mono" key={key}>
                      {value}
                    </DataList.TextCell>
                  );
                })}
              </TracesDataList.RowButton>
            );
          })}
          <TracesDataList.Spacer height={paddingBottom} />
          <TracesDataList.NextPageLoading
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        </>
      )}
    </TracesDataList>
  );
}
