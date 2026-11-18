import { createContext, useContext } from 'react';
import type { HistogramView } from '@/domains/observability/hooks/use-histogram-view';

type TracesHistogramContextValue = {
  /** Unset while no `Histogram` is mounted. */
  histogram: HistogramView | undefined;
  /** The chart is on screen; the counts load only while it is. Returns the unregister function. */
  register: () => () => void;
};

export const TracesHistogramContext = createContext<TracesHistogramContextValue | null>(null);

/** The histogram's state while a `Histogram` is mounted, for parts that follow its progress. */
export function useTracesHistogramView(): HistogramView | undefined {
  return useContext(TracesHistogramContext)?.histogram;
}
