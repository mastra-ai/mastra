import type { DataTag, InfiniteData, QueryKey, UseInfiniteQueryOptions, UseQueryOptions } from '@tanstack/react-query';

// Named so the published declarations reference @tanstack/react-query, not its internal query-core.
export type FactoryQueryOptions<TData, TKey extends QueryKey, TSelected = TData> = UseQueryOptions<
  TData,
  Error,
  TSelected,
  TKey
> & { queryKey: DataTag<TKey, TData, Error> };

export type FactoryInfiniteQueryOptions<TPage, TKey extends QueryKey, TParam> = UseInfiniteQueryOptions<
  TPage,
  Error,
  InfiniteData<TPage, TParam>,
  TKey,
  TParam
> & { queryKey: DataTag<TKey, InfiniteData<TPage, unknown>, Error> };
