import type { ListSchedulesParams, ScheduleResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export const useSchedules = (params: ListSchedulesParams = {}) => {
  const client = useMastraClient();

  return useQuery<ScheduleResponse[]>({
    queryKey: ['schedules', params],
    queryFn: async () => {
      const result = await client.listSchedules(params);
      return result.schedules;
    },
  });
};
