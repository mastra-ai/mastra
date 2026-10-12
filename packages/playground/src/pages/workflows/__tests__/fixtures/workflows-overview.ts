import type { GetWorkflowResponse, ListWorkflowRunCountsResponse, MastraClient } from '@mastra/client-js';
import type { TraceAggregateResponse } from '@mastra/core/storage';
import { weatherWorkflow } from '@/domains/workflows/__tests__/fixtures/workflow';

type Breakdown = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;
type TimeSeries = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;
type StepInfo = GetWorkflowResponse['steps'][string];

const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const stepInfo = (id: string): StepInfo => ({
  id,
  description: `${id} step`,
  inputSchema: '{}',
  outputSchema: '{}',
  resumeSchema: '{}',
  suspendSchema: '{}',
  stateSchema: '{}',
});

export const fourWorkflows: Record<string, GetWorkflowResponse> = {
  orderWorkflow: {
    ...weatherWorkflow,
    name: 'order-flow',
    steps: { charge: stepInfo('charge'), ship: stepInfo('ship') },
  },
  approvalWorkflow: { ...weatherWorkflow, name: 'approval-flow', steps: { approve: stepInfo('approve') } },
  digestWorkflow: { ...weatherWorkflow, name: 'digest-flow' },
  archiveWorkflow: { ...weatherWorkflow, name: 'archive-flow' },
};

export const noWorkflows: Record<string, GetWorkflowResponse> = {};

export const oneRunWaitingForInput: ListWorkflowRunCountsResponse = {
  orderWorkflow: { running: 0, suspended: 0 },
  approvalWorkflow: { running: 0, suspended: 1 },
  digestWorkflow: { running: 0, suspended: 0 },
  archiveWorkflow: { running: 0, suspended: 0 },
};

export const currentWorkflowRuns: Breakdown = {
  groups: [
    { dimensions: { entityId: 'digest-flow', status: 'ok' }, value: 40 },
    { dimensions: { entityId: 'order-flow', status: 'ok' }, value: 6 },
    { dimensions: { entityId: 'order-flow', status: 'error' }, value: 4 },
  ],
};

export const previousWorkflowRunsWithoutFailures: Breakdown = {
  groups: [
    { dimensions: { entityId: 'digest-flow', status: 'ok' }, value: 40 },
    { dimensions: { entityId: 'order-flow', status: 'ok' }, value: 10 },
  ],
};

export const workflowRunsOverTime: TimeSeries = {
  series: [
    { name: 'digest-flow|ok', points: [{ timestamp: anHourAgo, value: 40 }] },
    { name: 'order-flow|ok', points: [{ timestamp: anHourAgo, value: 6 }] },
    { name: 'order-flow|error', points: [{ timestamp: anHourAgo, value: 4 }] },
  ],
};

export const noWorkflowLatency: TraceAggregateResponse = { rows: [], truncated: false };
