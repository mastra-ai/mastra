import type {
  AggregateSpansArgs,
  AggregateSpansResponse,
  AggregateTracesArgs,
  AggregateTracesResponse,
} from '@mastra/client-js';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { useProgressiveList } from '../shared/use-progressive-list';
import type { ProgressiveListState } from '../shared/use-progressive-list';

type AggregateResponse = AggregateSpansResponse | AggregateTracesResponse;

export interface UseProgressiveAggregateReturn<TResponse> extends ProgressiveListState {
  /** The rows of every chunk loaded so far, appended, on the latest response. */
  data: TResponse | undefined;
  isLoading: boolean;
  /** The first chunk failed. A later failed chunk is `chunkError`, and its earlier rows stay. */
  isError: boolean;
  error: Error | null;
  /** The rows belong to the previous request while the new one loads. */
  isPlaceholderData: boolean;
  /** Loads the next chunk after `stop()`. */
  resume: () => void;
}

function useProgressiveAggregate<
  TArgs extends { progressive?: true; continuation?: string },
  TResponse extends AggregateResponse,
>({
  queryKey,
  request,
  enabled,
  fetchChunk,
}: {
  queryKey: readonly unknown[];
  request: TArgs;
  enabled: boolean;
  fetchChunk: (body: TArgs, signal: AbortSignal) => Promise<TResponse>;
}): UseProgressiveAggregateReturn<TResponse> {
  const progressive = request.progressive === true;
  const {
    data,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
    fetchNextPage,
    isLoading,
    isError,
    error,
    isPlaceholderData,
  } = useInfiniteQuery<TResponse, Error, InfiniteData<TResponse>, readonly unknown[], string | undefined>({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      fetchChunk(pageParam ? { ...request, continuation: pageParam } : request, signal),
    initialPageParam: undefined,
    // Chunks that can't be appended (`mergeable: false`) end the sequence; the server only chunks mergeable ones.
    getNextPageParam: lastPage => (lastPage.mergeable === false ? undefined : (lastPage.continuation ?? undefined)),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const { fetchNextPage: resume, ...progress } = useProgressiveList({
    queryKey,
    progressive,
    enabled,
    // Aggregates load every chunk on their own, until the end or `stop()`.
    inView: true,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
    fetchNextPage,
    error,
  });

  const last = data?.pages.at(-1);
  return {
    ...progress,
    data: data && last && { ...last, rows: data.pages.flatMap(page => page.rows) },
    isLoading,
    isError: isError && !isFetchNextPageError,
    error,
    isPlaceholderData,
    resume,
  };
}

/**
 * Runs `aggregateSpans()` for `request`. With `progressive: true` and a word search, it requests the range one chunk at
 * a time, newest first, until it has searched the whole range or `stop()` is called, appending each chunk's bucket rows.
 */
export function useProgressiveSpanAggregate({
  request,
  enabled = true,
}: {
  request: AggregateSpansArgs;
  enabled?: boolean;
}): UseProgressiveAggregateReturn<AggregateSpansResponse> {
  const client = useMastraClient();
  return useProgressiveAggregate({
    queryKey: ['span-aggregate-progressive', request],
    request,
    enabled,
    fetchChunk: (body, signal) => client.aggregateSpans(body, { signal }),
  });
}

/** `useProgressiveSpanAggregate` for `aggregateTraces()`. */
export function useProgressiveTraceAggregate({
  request,
  enabled = true,
}: {
  request: AggregateTracesArgs;
  enabled?: boolean;
}): UseProgressiveAggregateReturn<AggregateTracesResponse> {
  const client = useMastraClient();
  return useProgressiveAggregate({
    queryKey: ['trace-aggregate-progressive', request],
    request,
    enabled,
    fetchChunk: (body, signal) => client.aggregateTraces(body, { signal }),
  });
}
