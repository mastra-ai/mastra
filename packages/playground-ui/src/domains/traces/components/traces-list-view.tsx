import { useVirtualizer } from '@tanstack/react-virtual';
import { CornerDownRightIcon, ListTreeIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { getInputPreview } from '../utils/span-utils';
import { DataListSkeleton, TracesDataList } from '@/ds/components/DataList';
import { cn } from '@/lib/utils';

/** Span attributes fields the list view reads directly. Extra unknown keys are allowed so callers
 *  can pass the full attributes record from @mastra/core/storage without mapping. */
export type TraceAttributes = {
  status?: string | null;
  agentId?: string | null;
  workflowId?: string | null;
  [key: string]: unknown;
};

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
  attributes?: TraceAttributes | null;
  input?: unknown;
  startedAt?: Date | string | null;
  createdAt: Date | string;
};

// Fixed widths on non-flex columns prevent track shifts as the virtualizer swaps rows in/out.
const COLUMNS = '4rem 6rem 9rem 14rem minmax(8rem,1fr) 14rem 6rem';

const ROW_HEIGHT = 36;
const OVERSCAN = 8;

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
  /** Called when a row is clicked. The current selection logic (toggle on same id) is the consumer's call. */
  onTraceClick: (trace: TracesListViewTrace) => void;
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
  onTraceClick,
}: TracesListViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: traces.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
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
    return <DataListSkeleton columns={COLUMNS} />;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualItems.length > 0 ? Math.max(0, totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)) : 0;

  return (
    <TracesDataList columns={COLUMNS} scrollRef={scrollRef} className="min-w-0">
      <TracesDataList.Top>
        <TracesDataList.TopCellWithTooltip
          tooltip={
            <div className="grid gap-1">
              <span className="flex items-center gap-1.5">
                <ListTreeIcon className="size-4 shrink-0" aria-hidden />
                Trace
              </span>
              <span className="flex items-center gap-1.5">
                <CornerDownRightIcon className="size-4 shrink-0" aria-hidden />
                Subtrace
              </span>
            </div>
          }
        >
          Level
        </TracesDataList.TopCellWithTooltip>
        <TracesDataList.TopCell>Date</TracesDataList.TopCell>
        <TracesDataList.TopCell>Time</TracesDataList.TopCell>
        <TracesDataList.TopCell>Name</TracesDataList.TopCell>
        <TracesDataList.TopCell>Input</TracesDataList.TopCell>
        <TracesDataList.TopCell>Entity</TracesDataList.TopCell>
        <TracesDataList.TopCell>Status</TracesDataList.TopCell>
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
            const displayDate = trace.startedAt ?? trace.createdAt;
            const entityName =
              trace.entityName || trace.entityId || trace.attributes?.agentId || trace.attributes?.workflowId;

            return (
              <TracesDataList.RowButton
                key={`${trace.traceId}:${trace.spanId ?? ''}`}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                onClick={() => onTraceClick(trace)}
                className={cn(isFeatured && 'bg-surface4')}
              >
                <TracesDataList.KindCell parentSpanId={trace.parentSpanId} />
                <TracesDataList.DateCell timestamp={displayDate} />
                <TracesDataList.TimeCell timestamp={displayDate} />
                <TracesDataList.NameCell name={trace.name} />
                <TracesDataList.InputCell input={getInputPreview(trace.input)} />
                <TracesDataList.EntityCell entityType={trace.entityType} entityName={entityName} />
                <TracesDataList.StatusCell status={trace.attributes?.status} />
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
