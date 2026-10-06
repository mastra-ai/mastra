import type { ScheduleResponse } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';

/**
 * Pause/resume a schedule. Used by the schedule detail page button.
 *
 * On success invalidates `['schedule', scheduleId]` and `['schedules']` so the
 * detail meta strip and the list view both refresh.
 */
export const useToggleSchedule = ({
  scheduleId,
  queryOptions,
}: {
  scheduleId: string | undefined;
  queryOptions?: MastraMutationOptions<ScheduleResponse, 'pause' | 'resume'>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ScheduleResponse, Error, 'pause' | 'resume'>({
    mutationFn: async action => {
      if (!scheduleId) throw new Error('scheduleId is required');
      return action === 'pause' ? client.pauseSchedule(scheduleId) : client.resumeSchedule(scheduleId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    ...queryOptions,
  });
};
