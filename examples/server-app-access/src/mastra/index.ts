import { Mastra } from '@mastra/core/mastra';

import { calculatorTool, timestampTool } from './tools';
import { dailyReportWorkflow, paymentProcessorWorkflow, processMessageWorkflow } from './workflows';

/**
 * Main Mastra instance configured with tools and workflows
 * for demonstrating server app access patterns.
 */
export const mastra = new Mastra({
  tools: {
    calculatorTool,
    timestampTool,
  },
  workflows: {
    processMessageWorkflow,
    dailyReportWorkflow,
    paymentProcessorWorkflow,
  },
});
