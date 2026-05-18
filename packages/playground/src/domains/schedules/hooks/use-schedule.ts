import type { ScheduleResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useSchedule = (scheduleId: string | undefined) => {
  const client = useMastraClient();

  return useQuery<ScheduleResponse>({
    queryKey: ['schedule', scheduleId],
    enabled: !!scheduleId,
    queryFn: async () => {
      if (!scheduleId) throw new Error('scheduleId is required');
      return client.getSchedule(scheduleId);
    },
  });
};
