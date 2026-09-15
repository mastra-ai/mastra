import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';

export const completedLoop: GetWorkflowRunByIdResponse = {
  runId: 'completed-loop',
  workflowName: 'two-step-workflow',
  status: 'success',
  createdAt: new Date('2026-09-15T09:00:00Z'),
  updatedAt: new Date('2026-09-15T09:00:01Z'),
  steps: {
    'analyze-document[0].count-words': {
      status: 'success',
      payload: { text: 'A document' },
      output: { words: 2 },
      startedAt: 100,
      endedAt: 110,
    },
  },
};

export const suspendedLoop: GetWorkflowRunByIdResponse = {
  ...completedLoop,
  status: 'suspended',
  steps: {},
};
