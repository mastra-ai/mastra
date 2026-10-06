import type { ScheduleResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useSchedule = <TData = ScheduleResponse>({
  scheduleId,
  queryOptions,
}: {
  scheduleId: string | undefined;
  queryOptions?: MastraQueryOptions<ScheduleResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ScheduleResponse, Error, TData>({
    queryKey: ['schedule', scheduleId],
    queryFn: async () => {
      if (!scheduleId) throw new Error('scheduleId is required');
      return client.getSchedule(scheduleId);
    },
    ...queryOptions,
  });
};
