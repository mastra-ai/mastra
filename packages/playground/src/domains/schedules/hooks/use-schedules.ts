import type { ListSchedulesParams, ScheduleResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

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
