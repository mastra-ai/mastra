import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { successfulRunState } from './workflow-run-states';

export const failedDataRun: GetWorkflowRunByIdResponse = {
  ...successfulRunState,
  runId: 'run-data-failed',
  status: 'failed',
  payload: { customer: 'Test customer' },
  result: undefined,
  error: { name: 'Error', message: 'Dispatch failed. Check the order and run again.' },
};
