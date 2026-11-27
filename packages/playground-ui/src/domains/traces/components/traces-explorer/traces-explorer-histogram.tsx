import { useMemo } from 'react';
import { useTracesConfig, useTracesFilters } from './traces-explorer-context';
import type { TracesExplorerHistogram as TracesExplorerHistogramData } from './traces-explorer-data';
import { canShowTracesHistogram } from './traces-explorer-support';
import { ObservabilityHistogram } from '@/domains/observability/components/observability-histogram';
import { bucketCountRows, zoomWindow } from '@/domains/observability/lib/histogram-buckets';

export type TracesExplorerHistogramProps = {
  /**
   * Trace and error counts over the list's window (Studio: `useTracesHistogramQuery`). Omitted, no chart
   * shows: the host has no counts for this window (e.g. its store can't aggregate it).
   */
  data?: TracesExplorerHistogramData;
};

/**
 * Trace and error counts over the list's time range, from the host's aggregate of the list's filters.
 * Renders nothing without counts, when the server can't aggregate traces, the window is wider than it
 * aggregates, or the filters ask for `running` traces (the query drops that status, so the counts
 * wouldn't match). Dragging across bars narrows the list to their time span as a custom range.
 */
export function TracesExplorerHistogram({ data }: TracesExplorerHistogramProps) {
  const { rootSource, withQueryTrace, withTraceAggregate } = useTracesConfig();
  const { runningSelected, zoomDateRange } = useTracesFilters();
  const rows = data?.rows;
  const timeRange = data?.timeRange;
  const buckets = useMemo(() => (rows && timeRange ? bucketCountRows(rows, timeRange) : []), [rows, timeRange]);

  if (!data) return null;
  const shown = canShowTracesHistogram({
    runningSelected,
    support: { withQueryTrace, withTraceAggregate },
    rootSource,
    timeRange: data.timeRange,
  });
  if (!shown) return null;

  return (
    <ObservabilityHistogram
      label="Traces over time"
      resourceLabel="Traces"
      buckets={buckets}
      isLoading={data.isLoading}
      isError={data.isError}
      isUpdating={data.isUpdating}
      onZoom={range => {
        const { from, to } = zoomWindow(buckets, range, data.timeRange);
        zoomDateRange(from, to);
      }}
    />
  );
}
