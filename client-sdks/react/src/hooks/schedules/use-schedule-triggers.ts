import type { ScheduleTriggerResponse, MastraClient } from '@mastra/client-js';
import { useInfiniteQuery, type InfiniteData, type QueryKey, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';

export type UseScheduleTriggersResult = Omit<UseInfiniteQueryResult<unknown, Error>, 'data'> & {
  data: ScheduleTriggerResponse[];
  setEndOfListElement: (element: HTMLDivElement | null) => void;
};

const PER_PAGE = 25;

type ListScheduleTriggersResponse = Awaited<ReturnType<MastraClient['listScheduleTriggers']>>;

/** `queryOptions` spread last; the hook flattens pages itself, so `select` is not applied to `data`. */
/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useScheduleTriggers = ({
  scheduleId,
  queryOptions,
}: {
  scheduleId: string | undefined;
  queryOptions?: MastraInfiniteQueryOptions<
    ListScheduleTriggersResponse,
    InfiniteData<ListScheduleTriggersResponse, number | undefined>,
    QueryKey,
    number | undefined
  >;
}): UseScheduleTriggersResult => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['schedule-triggers', scheduleId],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (!scheduleId) return { triggers: [] } as unknown as ListScheduleTriggersResponse;
      return client.listScheduleTriggers(scheduleId, {
        limit: PER_PAGE,
        toActualFireAt: pageParam,
      });
    },
    getNextPageParam: lastPage => {
      if (!lastPage?.triggers?.length || lastPage.triggers.length < PER_PAGE) {
        return undefined;
      }
      // triggers come back ordered by actualFireAt desc; cursor for next page
      // is the oldest timestamp on the current page (exclusive upper bound).
      return lastPage.triggers[lastPage.triggers.length - 1]!.actualFireAt;
    },
    refetchInterval: query => {
      const triggers = query.state.data?.pages.flatMap(p => p.triggers) ?? [];
      const hasActive = triggers.some(t => {
        if (!t.run) return t.outcome === 'published';
        return t.run.status === 'pending' || t.run.status === 'running' || t.run.status === 'waiting';
      });
      return hasActive ? 5_000 : false;
    },
    ...queryOptions,
  });

  const triggers = query.data?.pages.flatMap(page => page?.triggers ?? []) ?? [];

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, data: triggers, setEndOfListElement };
};
