import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import type { previewWorkflows } from '../../../workflows';

export const workflowNodeCoverage = {
  step: 'orderFulfillment',
  agent: 'agentReview',
  tool: 'collectionProcessing',
  mapping: 'documentBatch',
  workflow: 'orderFulfillment',
  parallel: 'orderFulfillment',
  conditional: 'deliveryRouting',
  foreach: 'collectionProcessing',
  loop: 'retryWindow',
  sleep: 'delayedReport',
  sleepUntil: 'retryWindow',
} satisfies Record<SerializedStepFlowEntry['type'], keyof typeof previewWorkflows>;
