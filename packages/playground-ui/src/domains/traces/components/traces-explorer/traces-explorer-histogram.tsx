import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTracesHistogram } from '../../hooks/use-traces-histogram';
import { useTracesFilters } from './traces-explorer-context';
import { TracesHistogramContext } from './traces-explorer-histogram-context';
import { ObservabilityHistogram } from '@/domains/observability/components/observability-histogram';
import { zoomWindow } from '@/domains/observability/lib/histogram-buckets';

/** The histogram's counts, shared by `Histogram` and `SearchProgress`. Loads only while a `Histogram` is mounted. */
export function TracesHistogramProvider({ children }: { children: ReactNode }) {
  const [charts, setCharts] = useState(0);
  const register = useCallback(() => {
    setCharts(count => count + 1);
    return () => setCharts(count => count - 1);
  }, []);
  const view = useTracesHistogram(charts > 0);
  const histogram = charts > 0 ? view : undefined;
  const value = useMemo(() => ({ histogram, register }), [histogram, register]);
  return <TracesHistogramContext.Provider value={value}>{children}</TracesHistogramContext.Provider>;
}

/**
 * Trace and error counts over the list's time range, built from the same filters as the list query.
 * Renders nothing when the server can't aggregate traces, the window is wider than it aggregates,
 * or the filters ask for `running` traces (the query drops that status, so the counts wouldn't match).
 * Dragging across bars narrows the list to their time span as a custom range.
 */
export function TracesExplorerHistogram() {
  const context = useContext(TracesHistogramContext);
  if (!context) throw new Error('TracesExplorer.Histogram must be used inside <TracesExplorer>');
  const { histogram, register } = context;
  const { zoomDateRange } = useTracesFilters();

  useEffect(register, [register]);

  if (!histogram) return null;
  const { hidden, buckets, chartRange, isLoading, isError, isUpdating, pendingBefore, note } = histogram;
  if (hidden) return null;

  return (
    <ObservabilityHistogram
      label="Traces over time"
      resourceLabel="Traces"
      buckets={buckets}
      isLoading={isLoading}
      isError={isError}
      isUpdating={isUpdating}
      pendingBefore={pendingBefore}
      note={note}
      onZoom={range => {
        const { from, to } = zoomWindow(buckets, range, chartRange);
        zoomDateRange(from, to);
      }}
    />
  );
}
