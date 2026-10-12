import type { GetWorkflowResponse, ListWorkflowRunCountsResponse, MastraClient } from '@mastra/client-js';
import { weatherWorkflow } from '@/domains/workflows/__tests__/fixtures/workflow';

type Breakdown = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;
type TimeSeries = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;

export const fourWorkflows: Record<string, GetWorkflowResponse> = {
  orderWorkflow: { ...weatherWorkflow, name: 'order-flow', description: 'Charges and ships an order' },
  approvalWorkflow: { ...weatherWorkflow, name: 'approval-flow', description: 'Waits for a manager sign-off' },
  digestWorkflow: { ...weatherWorkflow, name: 'digest-flow', description: 'Builds the daily digest' },
  archiveWorkflow: { ...weatherWorkflow, name: 'archive-flow', description: 'Archives old records' },
};

export const oneRunWaitingForInput: ListWorkflowRunCountsResponse = {
  orderWorkflow: { running: 0, suspended: 0 },
  approvalWorkflow: { running: 0, suspended: 1 },
  digestWorkflow: { running: 1, suspended: 0 },
  archiveWorkflow: { running: 0, suspended: 0 },
};

export const runsByStatus: Breakdown = {
  groups: [
    { dimensions: { entityId: 'order-flow', status: 'ok' }, value: 6 },
    { dimensions: { entityId: 'order-flow', status: 'error' }, value: 4 },
    { dimensions: { entityId: 'approval-flow', status: 'ok' }, value: 2 },
    { dimensions: { entityId: 'digest-flow', status: 'ok' }, value: 40 },
  ],
};

export const averageDurations: Breakdown = {
  groups: [
    { dimensions: { entityId: 'order-flow' }, value: 900 },
    { dimensions: { entityId: 'approval-flow' }, value: 5000 },
    { dimensions: { entityId: 'digest-flow' }, value: 300 },
  ],
};

export const runsOverTime: TimeSeries = {
  series: [{ name: 'digest-flow', points: [{ timestamp: new Date().toISOString(), value: 40 }] }],
};

export const failuresOverTime: TimeSeries = {
  series: [{ name: 'order-flow', points: [{ timestamp: new Date().toISOString(), value: 4 }] }],
};
