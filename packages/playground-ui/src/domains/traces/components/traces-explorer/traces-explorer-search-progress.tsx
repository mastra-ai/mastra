import { useTracesList } from './traces-explorer-context';
import { useTracesHistogramView } from './traces-explorer-histogram-context';
import { SearchProgress } from '@/domains/observability/components/search-progress';
import { searchProgressProps } from '@/domains/observability/hooks/search-progress-props';

/**
 * One line under the filter bar while a word search over more than 7 days loads in chunks: how much of the range
 * is searched, with Stop and Continue. Follows `Histogram` when it is mounted (it chunks under any sort), else the
 * list. Renders nothing otherwise.
 */
export function TracesExplorerSearchProgress() {
  const list = useTracesList();
  const histogram = useTracesHistogramView();
  const progress = searchProgressProps({
    progressive: list.progressive && !!list.timeRange,
    requestedRange: list.timeRange ?? { from: '', to: '' },
    histogram: histogram?.progress,
    list,
  });
  return progress ? <SearchProgress {...progress} /> : null;
}
