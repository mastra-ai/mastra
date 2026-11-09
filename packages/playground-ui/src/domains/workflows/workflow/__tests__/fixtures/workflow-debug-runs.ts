import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { graphRun } from './workflow-graph-runtime';

export const debugRun: GetWorkflowRunByIdResponse = {
  ...graphRun,
  status: 'paused',
  steps: { extract: graphRun.steps.extract },
};

export const beforeBranchRun: GetWorkflowRunByIdResponse = {
  ...debugRun,
  workflowName: 'branch-workflow',
  payload: { text: 'A' },
  steps: { start: { status: 'success', payload: { text: 'A' }, output: { text: 'A' }, startedAt: 100, endedAt: 200 } },
};

export const matchedBranchRun: GetWorkflowRunByIdResponse = {
  ...beforeBranchRun,
  steps: {
    ...beforeBranchRun.steps,
    'short-text': { status: 'success', payload: { text: 'A' }, output: { text: 'AS' }, startedAt: 200, endedAt: 300 },
  },
};

export const unfinishedParallelRun: GetWorkflowRunByIdResponse = {
  ...beforeBranchRun,
  workflowName: 'parallel-workflow',
  steps: {
    ...beforeBranchRun.steps,
    'add-letter-b': { status: 'success', payload: { text: 'A' }, output: { text: 'AB' }, startedAt: 200, endedAt: 300 },
  },
};
