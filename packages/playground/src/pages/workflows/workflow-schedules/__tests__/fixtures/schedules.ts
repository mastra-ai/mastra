import type { ListSchedulesResponse, WorkflowSchedule } from '@mastra/client-js';

export const WORKFLOW_ID = 'weather-workflow';

export const weatherWorkflowSchedule: WorkflowSchedule = {
  id: 'sched-weather',
  workflowId: WORKFLOW_ID,
  cron: '0 * * * *',
  status: 'active',
  nextFireAt: 1_700_000_000_000,
  createdAt: 1_699_000_000_000,
  updatedAt: 1_699_000_000_000,
};

export const weatherWorkflowSchedules: ListSchedulesResponse = {
  schedules: [weatherWorkflowSchedule],
};
