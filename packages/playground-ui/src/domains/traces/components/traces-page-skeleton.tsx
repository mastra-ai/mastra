import { buildTraceListColumns, DEFAULT_TRACE_COLUMN_PREFERENCES } from '../trace-list-columns';
import type { TraceColumnPreferences } from '../trace-list-columns';
import { DataListSkeleton } from '@/ds/components/DataList';
import { Skeleton } from '@/ds/components/Skeleton';

export type TracesPageSkeletonProps = {
  columnPreferences?: TraceColumnPreferences;
};

/**
 * Page-level placeholder shown while filter-field discovery is pending. Pills sized like the
 * toolbar controls (time chip and filter input, then columns menu and auto-refresh) stand in
 * for the action row, spaced from the list skeleton as the action row is from the list.
 */
export function TracesPageSkeleton({ columnPreferences = DEFAULT_TRACE_COLUMN_PREFERENCES }: TracesPageSkeletonProps) {
  const columns = buildTraceListColumns(columnPreferences);
  return (
    <div
      className="flex h-full min-h-0 flex-col gap-4"
      role="status"
      aria-label="Loading traces"
      data-testid="traces-page-skeleton"
    >
      <div className="flex min-h-control-md flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Skeleton className="h-control-sm w-38 rounded-full" />
          <Skeleton className="h-control-sm w-48 rounded-full" />
        </div>
        <div className="flex items-center gap-8">
          <Skeleton className="h-control-sm w-24 rounded-full" />
          <Skeleton className="h-control-sm w-20 rounded-full" />
        </div>
      </div>
      <DataListSkeleton columns={columns} fit="container" />
    </div>
  );
}
