import type { ScheduleResponse } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Pause/resume a schedule. Used by the schedule detail page button.
 *
 * On success invalidates `['schedule', scheduleId]` and `['schedules']` so the
 * detail meta strip and the list view both refresh.
 */
export const useToggleSchedule = (scheduleId: string | undefined) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ScheduleResponse, Error, 'pause' | 'resume'>({
    mutationFn: async action => {
      if (!scheduleId) throw new Error('scheduleId is required');
      return action === 'pause' ? client.pauseSchedule(scheduleId) : client.resumeSchedule(scheduleId);
    },
    onSuccess: (_, action) => {
      void queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success(action === 'pause' ? 'Schedule paused' : 'Schedule resumed');
    },
    onError: error => {
      toast.error(error.message);
    },
  });
};
