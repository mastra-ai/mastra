import { client } from '@/lib/client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useLogsByRunId = (runId: string) => {
  const { transports, isLoading: isLoadingTransports } = useLogTransports();

  const transportId = transports[0];

  const { isLoading, ...data } = useInfiniteQuery({
    queryKey: ['logs', runId],
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ pageParam }) => {
      const res = await client.getLogForRun({
        transportId,
        runId,
        page: pageParam,
        perPage: 50,
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
    refetchInterval: 1000,
    select: data => data.pages.flatMap(page => page.logs),
  });

  return { ...data, isLoading: isLoading || isLoadingTransports };
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
