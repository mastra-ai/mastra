import { GetWorkflowResponse } from '@mastra/client-js';

export type WorkflowType = 'code' | 'stored' | 'processor';

// Base workflow data for the table - works for both code workflows and stored definitions
export interface WorkflowTableData {
  id: string;
  name: string;
  description?: string;
  steps?: Record<string, unknown>;
  workflowType?: WorkflowType;
  // Optional fields from GetWorkflowResponse for code workflows
  allSteps?: GetWorkflowResponse['allSteps'];
  inputSchema?: GetWorkflowResponse['inputSchema'];
  outputSchema?: GetWorkflowResponse['outputSchema'];
  stateSchema?: GetWorkflowResponse['stateSchema'];
  stepGraph?: unknown[];
  isProcessorWorkflow?: boolean;
}
