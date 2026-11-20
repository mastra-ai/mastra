import { useMemo } from 'react';
import type { SpansExplorerHistogramData } from '../spans-explorer-data';
import { ObservabilityHistogram } from '@/domains/observability/components/observability-histogram';
import { bucketCountRows, zoomWindow } from '@/domains/observability/lib/histogram-buckets';

export type SpansExplorerHistogramProps = {
  /**
   * Span and error counts over the list's window (Studio: `useSpansHistogramQuery`). Omitted, no chart
   * shows: the host has no counts for this window (e.g. its store can't aggregate it).
   */
  data?: SpansExplorerHistogramData;
  /** Called with the time span of the bars the user drags across. */
  onZoom?: (window: { from: Date; to: Date }) => void;
};

/** Span and error counts over the span list's time range and filters. */
export function SpansExplorerHistogram({ data, onZoom }: SpansExplorerHistogramProps) {
  const rows = data?.rows;
  const timeRange = data?.timeRange;
  const buckets = useMemo(() => (rows && timeRange ? bucketCountRows(rows, timeRange) : []), [rows, timeRange]);

  if (!data) return null;

  return (
    <ObservabilityHistogram
      label="Spans over time"
      resourceLabel="Spans"
      buckets={buckets}
      isLoading={data.isLoading}
      isError={data.isError}
      isUpdating={data.isUpdating}
      onZoom={onZoom && (range => onZoom(zoomWindow(buckets, range, data.timeRange)))}
    />
  );
}
