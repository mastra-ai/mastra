import type { QueryKey } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useInView } from '@/hooks/use-in-view';

interface UseInfiniteScrollQueryOptions<TPage, TItem> {
  queryKey: QueryKey;
  queryFn: (pageParam: number) => Promise<TPage>;
  getItems: (page: TPage) => TItem[];
  getTotal?: (page: TPage) => number;
  enabled?: boolean;
  perPage?: number;
  refetchInterval?: number | false;
}

/**
 * Generic infinite scroll hook that combines useInfiniteQuery with useInView
 * for automatic next-page fetching when the end of the list becomes visible.
 */
export function useInfiniteScrollQuery<TPage, TItem>({
  queryKey,
  queryFn,
  getItems,
  getTotal = () => 0,
  enabled = true,
  perPage = 10,
  refetchInterval,
}: UseInfiniteScrollQueryOptions<TPage, TItem>) {
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!getItems(lastPage)?.length) {
        return undefined;
      }
      const totalFetched = (lastPageParam + 1) * perPage;
      const total = getTotal(lastPage);
      if (totalFetched >= total) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    enabled,
    refetchInterval,
    select: data => {
      return data.pages.flatMap(page => getItems(page));
    },
    retry: false,
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [isEndOfListInView, query.hasNextPage, query.isFetchingNextPage]);

  return { ...query, setEndOfListElement };
}
