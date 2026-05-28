import type { ListSchedulesParams, ScheduleResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export type UseHeartbeatsParams = {
  ownerId?: string;
};

/**
 * Lists heartbeat schedules — owned schedules with `ownerType: 'agent'`
 * targeting the built-in `__mastra_heartbeat__` workflow. Optionally
 * narrows to a single agent via `ownerId`.
 */
export const useHeartbeats = (params: UseHeartbeatsParams = {}) => {
  const client = useMastraClient();

  const queryParams: ListSchedulesParams = params.ownerId
    ? { ownerType: 'agent', ownerId: params.ownerId }
    : { ownerType: 'agent' };

  return useQuery<ScheduleResponse[]>({
    queryKey: ['heartbeats', params],
    queryFn: async () => {
      const result = await client.listSchedules(queryParams);
      return result.schedules;
    },
  });
};
