import type {
  DefaultError,
  QueryKey,
  UseInfiniteQueryOptions,
  UseMutationOptions,
  UseQueryOptions,
} from '@tanstack/react-query';

/**
 * TanStack `useQuery` options accepted by every Mastra query hook via `queryOptions`.
 * Spread last into the underlying call, so any key (including `queryKey`, `queryFn`,
 * `enabled`, `select`) overrides the hook's default.
 */
export type MastraQueryOptions<TQueryFnData, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> = Partial<
  UseQueryOptions<TQueryFnData, DefaultError, TData, TQueryKey>
>;

/**
 * TanStack `useInfiniteQuery` options accepted by every Mastra infinite query hook via `queryOptions`.
 * Spread last into the underlying call, so any key overrides the hook's default.
 */
export type MastraInfiniteQueryOptions<
  TQueryFnData,
  TData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = Partial<UseInfiniteQueryOptions<TQueryFnData, DefaultError, TData, TQueryKey, TPageParam>>;

/**
 * TanStack `useMutation` options accepted by every Mastra mutation hook via `queryOptions`.
 * Spread last into the underlying call: passing `onSuccess` replaces the hook's internal
 * `onSuccess` (including its cache invalidation).
 */
export type MastraMutationOptions<TData, TVariables = void, TContext = unknown> = Partial<
  UseMutationOptions<TData, DefaultError, TVariables, TContext>
>;
