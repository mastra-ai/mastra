import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';

export const graphRun = {
  runId: 'graph-run',
  workflowName: 'two-step-workflow',
  status: 'running',
  createdAt: new Date('2026-09-15T09:00:00Z'),
  updatedAt: new Date('2026-09-15T09:00:01Z'),
  payload: { request: true },
  steps: {
    extract: {
      status: 'success',
      payload: { request: true },
      output: { customerId: 'cus_123' },
      startedAt: 100,
      endedAt: 200,
    },
    transform: { status: 'running', payload: { customerId: 'cus_123' }, startedAt: 200 },
  },
} satisfies GetWorkflowRunByIdResponse;

export const completedIterationRun: GetWorkflowRunByIdResponse = {
  ...graphRun,
  steps: {
    batch: { status: 'success', payload: ['first', 'second'], output: [false, null], startedAt: 100, endedAt: 200 },
    'batch[0].extract': { status: 'success', payload: 'first', output: false, startedAt: 100, endedAt: 150 },
    'batch[1].extract': { status: 'success', payload: 'second', output: null, startedAt: 150, endedAt: 200 },
  },
};
