import type { GetSystemPackagesResponse, GetWorkflowResponse, ListSchedulesResponse } from '@mastra/client-js';

export const WORKFLOW_ID = 'weather-workflow';

export const weatherWorkflow: GetWorkflowResponse = {
  name: WORKFLOW_ID,
  description: 'Fetches the weather',
  stepGraph: [],
  inputSchema: '{}',
  outputSchema: '{}',
  stateSchema: '{}',
  steps: {},
  allSteps: {},
};

export const noSchedules: ListSchedulesResponse = { schedules: [] };

export const twoSchedules: ListSchedulesResponse = {
  schedules: [
    {
      id: 'sched-1',
      workflowId: WORKFLOW_ID,
      cron: '0 * * * *',
      status: 'active',
      nextFireAt: 1_700_000_000_000,
      createdAt: 1_699_000_000_000,
      updatedAt: 1_699_000_000_000,
    },
    {
      id: 'sched-2',
      workflowId: WORKFLOW_ID,
      cron: '0 0 * * *',
      status: 'paused',
      nextFireAt: 1_700_000_000_000,
      createdAt: 1_699_000_000_000,
      updatedAt: 1_699_000_000_000,
    },
  ],
};

const basePackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
  liveKitConnectionRouteEnabled: false,
};

export const packagesWithObservability: GetSystemPackagesResponse = { ...basePackages, observabilityEnabled: true };
export const packagesWithoutObservability: GetSystemPackagesResponse = basePackages;
