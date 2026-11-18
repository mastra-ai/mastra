import type { UseProgressiveAggregateReturn } from '@mastra/react/hooks/traces';
import { useMemo } from 'react';
import { bucketCountRows } from '../lib/histogram-buckets';
import type { HistogramBucket } from '../lib/histogram-buckets';
import { CAPPED_CHART_NOTE } from '../lib/progressive-search';
import type { SearchProgressState } from '../lib/progressive-search';

type Range = { from: string; to: string };
type CountRows = { rows: Parameters<typeof bucketCountRows>[0] };

/** A progressive word search's progress, with the controls `SearchProgress` needs. */
export type SearchProgressControl = SearchProgressState & {
  stop: () => void;
  resume: () => void;
};

/** What a Traces or Spans histogram draws, from either a plain aggregate or a progressive one. */
export type HistogramView = {
  /** The server can't aggregate this selection; draw nothing. */
  hidden: boolean;
  buckets: HistogramBucket[];
  /** The range the bars cover: the list's range, or the newest chunk when the server can't merge chunks. */
  chartRange: Range;
  isLoading: boolean;
  isError: boolean;
  isUpdating: boolean;
  pendingBefore: Date | undefined;
  note: string | undefined;
  /** Set while the histogram runs a progressive word search. */
  progress: SearchProgressControl | undefined;
};

/** Combines the plain and progressive aggregate of a histogram (only one of them is enabled) into what it draws. */
export function useHistogramView({
  timeRange,
  hidden,
  progressive,
  plain,
  chunked,
}: {
  timeRange: Range;
  hidden: boolean;
  progressive: boolean;
  plain: { data: CountRows | undefined; isLoading: boolean; isError: boolean; isPlaceholderData: boolean };
  chunked: UseProgressiveAggregateReturn<CountRows & { mergeable?: boolean }>;
}): HistogramView {
  const source = progressive ? chunked : plain;
  const capped = progressive && chunked.data?.mergeable === false && chunked.searchedRange !== undefined;
  const chartRange = capped && chunked.searchedRange ? chunked.searchedRange : timeRange;
  const buckets = useMemo(() => bucketCountRows(source.data?.rows ?? [], chartRange), [source.data, chartRange]);
  const { searchedRange, searching, stopped, stop, resume, chunkError } = chunked;

  const pendingFrom = progressive && searching && searchedRange ? searchedRange.from : undefined;
  const failed = chunkError !== null;
  const progressing = searching || !searchedRange;
  const progress = useMemo<SearchProgressControl | undefined>(
    () =>
      progressive && !hidden && !capped
        ? { requestedRange: timeRange, searchedRange, searching: progressing, stopped, failed, stop, resume }
        : undefined,
    [progressive, hidden, capped, timeRange, searchedRange, progressing, stopped, failed, stop, resume],
  );

  return useMemo(
    () => ({
      hidden,
      buckets,
      chartRange,
      isLoading: source.isLoading,
      isError: source.isError,
      isUpdating: source.isPlaceholderData,
      pendingBefore: pendingFrom ? new Date(pendingFrom) : undefined,
      note: capped ? CAPPED_CHART_NOTE : undefined,
      progress,
    }),
    [
      hidden,
      buckets,
      chartRange,
      source.isLoading,
      source.isError,
      source.isPlaceholderData,
      pendingFrom,
      capped,
      progress,
    ],
  );
}
