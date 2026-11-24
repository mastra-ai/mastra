import type { ListSchedulesParams, ScheduleResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const useSchedules = <TData = ScheduleResponse[]>({
  queryOptions,
  ...params
}: ListSchedulesParams & { queryOptions?: MastraQueryOptions<ScheduleResponse[], TData> } = {}): UseQueryResult<
  TData,
  Error
> => {
  const client = useMastraClient();

  return useQuery<ScheduleResponse[], Error, TData>({
    queryKey: ['schedules', params],
    queryFn: async () => {
      const result = await client.listSchedules(params);
      return result.schedules;
    },
    ...queryOptions,
  });
};
