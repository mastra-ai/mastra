import { buildTraceListColumns, DEFAULT_TRACE_COLUMN_PREFERENCES } from '../trace-list-columns';
import type { TraceColumnPreferences } from '../trace-list-columns';
import { DataListSkeleton } from '@/ds/components/DataList';
import { Skeleton } from '@/ds/components/Skeleton';

export type TracesPageSkeletonProps = {
  columnPreferences?: TraceColumnPreferences;
};

/**
 * Page-level placeholder shown while filter-field discovery is pending: a toolbar-height
 * bar stands in for the FilterBar and the usual list skeleton for the trace rows.
 */
export function TracesPageSkeleton({ columnPreferences = DEFAULT_TRACE_COLUMN_PREFERENCES }: TracesPageSkeletonProps) {
  const columns = buildTraceListColumns(columnPreferences);
  return (
    <div
      className="flex h-full min-h-0 flex-col gap-2"
      role="status"
      aria-label="Loading traces"
      data-testid="traces-page-skeleton"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-form-md min-w-64 flex-1" />
        <Skeleton className="h-form-md w-28" />
      </div>
      <DataListSkeleton columns={columns} fit="container" />
    </div>
  );
}
