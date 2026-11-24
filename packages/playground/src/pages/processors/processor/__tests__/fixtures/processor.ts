import type { GetProcessorDetailResponse } from '@mastra/client-js';

export const workflowProcessor: GetProcessorDetailResponse = {
  id: 'moderation-workflow',
  name: 'Moderation workflow',
  phases: ['input'],
  configurations: [],
  isWorkflow: true,
};
