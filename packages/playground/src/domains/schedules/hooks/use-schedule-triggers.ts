import type { ScheduleTriggerResponse } from '@mastra/client-js';
import { useInView } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

const PER_PAGE = 25;

export const useScheduleTriggers = (scheduleId: string | undefined) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['schedule-triggers', scheduleId],
    enabled: !!scheduleId,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (!scheduleId) return { triggers: [] as ScheduleTriggerResponse[] };
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
