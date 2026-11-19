import type { ProgressiveListState } from '@mastra/react/hooks/traces';
import type { SearchProgressProps } from '../components/search-progress';
import type { SearchProgressControl } from './use-histogram-view';

type Range = { from: string; to: string };

/**
 * The status line of a progressive word search. It follows the histogram, the only sequence that covers the whole
 * range, or the list when there is no histogram. Stop and Continue apply to both, so neither keeps searching alone.
 */
export function searchProgressProps({
  progressive,
  requestedRange,
  histogram,
  list,
}: {
  /** The list runs a progressive word search. */
  progressive: boolean;
  requestedRange: Range;
  histogram: SearchProgressControl | undefined;
  list: ProgressiveListState & { fetchNextPage: () => void };
}): SearchProgressProps | undefined {
  if (!progressive) return undefined;
  const onStop = () => {
    histogram?.stop();
    list.stop();
  };
  const onContinue = () => {
    histogram?.resume();
    if (list.searching) list.fetchNextPage();
  };
  if (histogram) {
    const { chunkError: _chunkError, stop: _stop, resume: _resume, ...state } = histogram;
    return { ...state, failed: state.failed || list.chunkError !== null, onStop, onContinue };
  }
  return {
    requestedRange,
    searchedRange: list.searchedRange,
    searching: list.searching || !list.searchedRange,
    stopped: list.stopped,
    failed: list.chunkError !== null,
    onStop,
    onContinue,
  };
}
