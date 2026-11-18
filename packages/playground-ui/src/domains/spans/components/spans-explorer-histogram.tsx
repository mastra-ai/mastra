import { useSpansHistogram } from '../hooks/use-spans-histogram';
import type { UseSpansHistogramArgs } from '../hooks/use-spans-histogram';
import { ObservabilityHistogram } from '@/domains/observability/components/observability-histogram';
import type { HistogramView } from '@/domains/observability/hooks/use-histogram-view';
import { zoomWindow } from '@/domains/observability/lib/histogram-buckets';

export type SpansExplorerHistogramProps = UseSpansHistogramArgs & {
  /** From `useSpansHistogram`, when the host also shows its progress. Without it, the chart loads its own. */
  histogram?: HistogramView;
  /** Called with the time span of the bars the user drags across. */
  onZoom?: (window: { from: Date; to: Date }) => void;
};

/**
 * Span and error counts over the span list's time range and filters.
 * Renders nothing when the server can't aggregate spans or the window is wider than it aggregates.
 */
export function SpansExplorerHistogram({ histogram, timeRange, where, onZoom }: SpansExplorerHistogramProps) {
  const own = useSpansHistogram({ timeRange, where, enabled: !histogram });
  const { hidden, buckets, chartRange, isLoading, isError, isUpdating, pendingBefore, note } = histogram ?? own;

  if (hidden) return null;

  return (
    <ObservabilityHistogram
      label="Spans over time"
      resourceLabel="Spans"
      buckets={buckets}
      isLoading={isLoading}
      isError={isError}
      isUpdating={isUpdating}
      pendingBefore={pendingBefore}
      note={note}
      onZoom={onZoom && (range => onZoom(zoomWindow(buckets, range, chartRange)))}
    />
  );
}
