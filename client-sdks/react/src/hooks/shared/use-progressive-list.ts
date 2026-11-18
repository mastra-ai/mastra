import { MastraClientError } from '@mastra/client-js';
import type { ProgressiveSearchResponse } from '@mastra/client-js';
import { hashKey, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SearchedRange = NonNullable<ProgressiveSearchResponse['searchedRange']>;

export interface ProgressiveListState {
  /** The part of the requested range searched so far. Only set for a progressive search. */
  searchedRange: SearchedRange | undefined;
  /** A progressive search has more of its range left to search. */
  searching: boolean;
  /** `stop()` was called; no more chunks load on their own until the next page is asked for. */
  stopped: boolean;
  /** Stops loading further chunks on their own. Asking for the next page, or scrolling back to the end, resumes. */
  stop: () => void;
  /**
   * A later page or chunk failed. The rows loaded before it stay, and `isError` stays false for a progressive
   * search, so hosts can show the error below them.
   */
  chunkError: Error | null;
}

const isContinuationConflict = (error: unknown) => error instanceof MastraClientError && error.status === 409;

/**
 * Keeps an infinite list loading while its end-of-list sentinel is in view. For a progressive word search
 * (`progressive: true`, one chunk of the range per page), it also tracks the searched range, lets the user
 * stop, and starts the sequence again once when the server rejects a continuation (409).
 */
export function useProgressiveList({
  queryKey,
  progressive,
  enabled,
  inView,
  hasNextPage,
  isFetching,
  isFetchNextPageError,
  fetchNextPage,
  error,
}: {
  queryKey: QueryKey;
  progressive: boolean;
  enabled: boolean;
  inView: boolean;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => Promise<unknown>;
  error: Error | null;
}): ProgressiveListState & { fetchNextPage: () => void } {
  const queryClient = useQueryClient();
  const sequence = hashKey(queryKey);
  const [stoppedSequence, setStoppedSequence] = useState<string | null>(null);
  const stopped = progressive && stoppedSequence === sequence;
  const restartedSequence = useRef<string | null>(null);
  const lastPage = progressive
    ? queryClient.getQueryData<InfiniteData<ProgressiveSearchResponse>>(queryKey)?.pages.at(-1)
    : undefined;

  useEffect(() => {
    if (!inView) setStoppedSequence(null);
  }, [inView]);

  useEffect(() => {
    if (enabled && inView && hasNextPage && !isFetching && !isFetchNextPageError && !stopped) {
      void fetchNextPage();
    }
  }, [enabled, inView, hasNextPage, isFetching, isFetchNextPageError, stopped, fetchNextPage]);

  useEffect(() => {
    if (!progressive || !isContinuationConflict(error) || restartedSequence.current === sequence) return;
    restartedSequence.current = sequence;
    void queryClient.resetQueries({ queryKey, exact: true });
    // The key is identified by its hash.
    // oxlint-disable-next-line react-hooks-js/exhaustive-deps
  }, [progressive, error, sequence, queryClient]);

  const stop = useCallback(() => setStoppedSequence(sequence), [sequence]);
  const resume = useCallback(() => {
    setStoppedSequence(null);
    void fetchNextPage();
  }, [fetchNextPage]);

  return {
    searchedRange: lastPage?.searchedRange,
    searching: lastPage?.continuation != null,
    stopped,
    stop,
    chunkError: isFetchNextPageError ? error : null,
    fetchNextPage: resume,
  };
}
