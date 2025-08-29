import {
  agentBuilderTemplateWorkflow,
  workflowBuilderWorkflow,
  planningAndApprovalWorkflow,
} from '@mastra/agent-builder';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { WorkflowInfo } from '@mastra/core/workflows';
import type { Context } from '../types';
import { getWorkflowInfo, WorkflowRegistry } from '../utils';
import { handleError } from './error';
import * as workflows from './workflows';

interface AgentBuilderActionContext extends Context {
  actionId?: string;
  runtimeContext?: RuntimeContext;
  runId?: string;
  inputData?: Record<string, any>;
  body?: { step: string | string[]; resumeData?: unknown };
  event?: string;
  data?: unknown;
}

/**
 * Register all agent builder workflows in the WorkflowRegistry
 * This should be called during server startup
 */
export function registerAgentBuilderWorkflows(): void {
  // Register the agent builder workflows with their IDs
  WorkflowRegistry.registerTemporaryWorkflow('agent-builder-template', agentBuilderTemplateWorkflow);
  WorkflowRegistry.registerTemporaryWorkflow('workflow-builder', workflowBuilderWorkflow);
  WorkflowRegistry.registerTemporaryWorkflow('planning-and-approval', planningAndApprovalWorkflow);
}

/**
 * Clean up agent builder workflows from the registry
 * This should be called during server shutdown
 */
export function cleanupAgentBuilderWorkflows(): void {
  WorkflowRegistry.cleanup('agent-builder-template');
  WorkflowRegistry.cleanup('workflow-builder');
  WorkflowRegistry.cleanup('planning-and-approval');
}

/**
 * Generic wrapper that converts agent builder action handlers to use workflow handlers
 * TWorkflowArgs - The argument type expected by the workflow handler
 * TResult - The return type of the workflow handler
 */
function createAgentBuilderActionHandler<TWorkflowArgs, TResult>(
  workflowHandlerFn: (args: TWorkflowArgs) => Promise<TResult>,
  logMessage: string,
) {
  return async (actionArgs: AgentBuilderActionContext): Promise<TResult> => {
    const { mastra, runtimeContext, actionId, runId, inputData, body, event, data } = actionArgs;
    const logger = mastra.getLogger();

    try {
      logger.info(`${logMessage} for action: ${actionId}`);

      // Convert actionId to workflowId for the underlying workflow handler
      const workflowArgs = {
        mastra,
        runtimeContext,
        workflowId: actionId,
        runId,
        inputData,
        body,
        event,
        data,
        // Include any other properties that might be needed
        ...actionArgs,
      } as TWorkflowArgs;

      const result = await workflowHandlerFn(workflowArgs);
      logger.info(`${logMessage} completed successfully for action: ${actionId}`);
      
      return result;
    } catch (error) {
      logger.error(`${logMessage} failed for action: ${actionId}`, error);
      throw error;
    }
  };
}

// Agent Builder Action handlers using the wrapper pattern
export const getAgentBuilderActionsHandler = createAgentBuilderActionHandler(
  workflows.getWorkflowsHandler,
  'Getting agent builder actions',
);

export const getAgentBuilderActionByIdHandler = createAgentBuilderActionHandler(
  workflows.getWorkflowByIdHandler,
  'Getting agent builder action by ID',
);

export const createAgentBuilderActionRunHandler = createAgentBuilderActionHandler(
  workflows.createWorkflowRunHandler,
  'Creating agent builder action run',
);

export const startAsyncAgentBuilderActionHandler = createAgentBuilderActionHandler(
  workflows.startAsyncWorkflowHandler,
  'Starting async agent builder action',
);

export const startAgentBuilderActionRunHandler = createAgentBuilderActionHandler(
  workflows.startWorkflowRunHandler,
  'Starting agent builder action run',
);

export const watchAgentBuilderActionHandler = createAgentBuilderActionHandler(
  workflows.watchWorkflowHandler,
  'Watching agent builder action',
);

export const streamAgentBuilderActionHandler = createAgentBuilderActionHandler(
  workflows.streamWorkflowHandler,
  'Streaming agent builder action',
);

export const streamVNextAgentBuilderActionHandler = createAgentBuilderActionHandler(
  workflows.streamVNextWorkflowHandler,
  'Streaming VNext agent builder action',
);

export const resumeAsyncAgentBuilderActionHandler = createAgentBuilderActionHandler(
  workflows.resumeAsyncWorkflowHandler,
  'Resuming async agent builder action',
);

export const resumeAgentBuilderActionHandler = createAgentBuilderActionHandler(
  workflows.resumeWorkflowHandler,
  'Resuming agent builder action',
);

export const getAgentBuilderActionRunsHandler = createAgentBuilderActionHandler(
  workflows.getWorkflowRunsHandler,
  'Getting agent builder action runs',
);

export const getAgentBuilderActionRunByIdHandler = createAgentBuilderActionHandler(
  workflows.getWorkflowRunByIdHandler,
  'Getting agent builder action run by ID',
);

export const getAgentBuilderActionRunExecutionResultHandler = createAgentBuilderActionHandler(
  workflows.getWorkflowRunExecutionResultHandler,
  'Getting agent builder action run execution result',
);

export const cancelAgentBuilderActionRunHandler = createAgentBuilderActionHandler(
  workflows.cancelWorkflowRunHandler,
  'Cancelling agent builder action run',
);

export const sendAgentBuilderActionRunEventHandler = createAgentBuilderActionHandler(
  workflows.sendWorkflowRunEventHandler,
  'Sending agent builder action run event',
);

/**
 * Get all available agent builder actions
 * This returns the workflow info for all registered agent builder workflows
 */
export async function getAvailableAgentBuilderActions(): Promise<Record<string, WorkflowInfo>> {
  try {
    const availableActions: Record<string, WorkflowInfo> = {};
    
    // Get all registered workflow IDs from the registry
    const registeredIds = WorkflowRegistry.getRegisteredWorkflowIds();
    
    for (const workflowId of registeredIds) {
      const workflow = WorkflowRegistry.getWorkflow(workflowId);
      if (workflow) {
        availableActions[workflowId] = getWorkflowInfo(workflow);
      }
    }
    
    return availableActions;
  } catch (error) {
    return handleError(error, 'Error getting available agent builder actions');
  }
}

/**
 * Get a specific agent builder action by ID
 */
export async function getAgentBuilderActionById(actionId: string): Promise<WorkflowInfo> {
  try {
    const workflow = WorkflowRegistry.getWorkflow(actionId);
    if (!workflow) {
      throw new Error(`Agent builder action not found: ${actionId}`);
    }
    
    return getWorkflowInfo(workflow);
  } catch (error) {
    return handleError(error, `Error getting agent builder action: ${actionId}`);
  }
}