import { client } from '@/lib/client';
import { GetLogParams } from '@mastra/client-js';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useInView } from './use-in-view';

export const useLogsByRunId = (runId: string, opts?: Pick<GetLogParams, 'logLevel' | 'fromDate' | 'toDate'>) => {
  const { transports, isLoading: isLoadingTransports } = useLogTransports();

  const transportId = transports[0];

  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['logs', { runId, opts }],
    queryFn: async ({ pageParam }) => {
      const res = await client.getLogForRun({
        transportId,
        runId,
        page: pageParam,
        perPage: 50,
        ...opts,
      });

      return res;
    },
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.hasMore) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    initialPageParam: 0,
    enabled: Boolean(transportId),
    refetchInterval: 2000,
    select: data => data.pages.flatMap(page => page.logs),
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [isEndOfListInView, query.hasNextPage, query.isFetchingNextPage]);

  return { ...query, isLoading: query.isLoading || isLoadingTransports, setEndOfListElement };
};

export const useLogTransports = () => {
  const [transports, setTransports] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogTransports = async () => {
    try {
      const res = await client.getLogTransports();
      setTransports(res.transports);
    } catch (error) {
      console.error('Error fetching logs', error);
      toast.error('Error fetching logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogTransports();
  }, []);

  return { transports, isLoading };
};
