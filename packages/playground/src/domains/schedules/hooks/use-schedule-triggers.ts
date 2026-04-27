import type { ListScheduleTriggersParams, ScheduleTriggerResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useScheduleTriggers = (scheduleId: string | undefined, params: ListScheduleTriggersParams = {}) => {
  const client = useMastraClient();

  return useQuery<ScheduleTriggerResponse[]>({
    queryKey: ['schedule-triggers', scheduleId, params],
    enabled: !!scheduleId,
    queryFn: async () => {
      if (!scheduleId) return [];
      const result = await client.listScheduleTriggers(scheduleId, params);
      return result.triggers;
    },
  });
};
