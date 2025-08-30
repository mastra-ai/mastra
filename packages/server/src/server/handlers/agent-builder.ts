import { workflowMap } from '@mastra/agent-builder';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { WorkflowRegistry } from '../utils';
import * as workflows from './workflows';
import type { Context } from '../types';

interface AgentBuilderContext extends Context {
  actionId?: string;
}

/**
 * Generic wrapper that converts template handlers to use workflow handlers
 * TWorkflowArgs - The argument type expected by the workflow handler
 * TResult - The return type of the workflow handler
 */
function createAgentBuilderWorkflowHandler<TWorkflowArgs, TResult>(
  workflowHandlerFn: (args: TWorkflowArgs) => Promise<TResult>,
  logMessage: string,
) {
  return async (builderArgs: TWorkflowArgs & AgentBuilderContext): Promise<TResult> => {
    const { actionId, ...actionArgs } = builderArgs;
    const mastra = (actionArgs as any).mastra;
    const logger = mastra.getLogger();

    try {
      if (actionId) {
        WorkflowRegistry.registerTemporaryWorkflow(actionId, workflowMap[actionId as keyof typeof workflowMap]);
      }

      logger.info(logMessage, { actionId, ...actionArgs });

      try {
        const handlerArgs = {
          ...actionArgs,
          workflowId: actionId, // Map actionId to workflowId
        } as TWorkflowArgs;

        const result = await workflowHandlerFn(handlerArgs);
        return result;
      } finally {
        if (actionId) {
          // Clean up the temporary workflow registration
          WorkflowRegistry.cleanup(actionId);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`${logMessage} failed`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  };
}

export const getAgentBuilderActionsHandler = createAgentBuilderWorkflowHandler(
  workflows.getWorkflowsHandler,
  'Getting agent builder actions',
);

export const getAgentBuilderActionByIdHandler = createAgentBuilderWorkflowHandler(
  workflows.getWorkflowByIdHandler,
  'Getting agent builder action by ID',
);

export const getAgentBuilderActionRunByIdHandler = createAgentBuilderWorkflowHandler(
  workflows.getWorkflowRunByIdHandler,
  'Getting agent builder action run by ID',
);

export const getAgentBuilderActionRunExecutionResultHandler = createAgentBuilderWorkflowHandler(
  workflows.getWorkflowRunExecutionResultHandler,
  'Getting agent builder action run execution result',
);

export const createAgentBuilderActionRunHandler = createAgentBuilderWorkflowHandler(
  workflows.createWorkflowRunHandler,
  'Creating agent builder action run',
);

export const startAsyncAgentBuilderActionHandler = createAgentBuilderWorkflowHandler(
  workflows.startAsyncWorkflowHandler,
  'Starting async agent builder action',
);

export const startAgentBuilderActionRunHandler = createAgentBuilderWorkflowHandler(
  workflows.startWorkflowRunHandler,
  'Starting agent builder action run',
);

export const watchAgentBuilderActionHandler = createAgentBuilderWorkflowHandler(
  workflows.watchWorkflowHandler,
  'Watching agent builder action',
);

export const streamAgentBuilderActionHandler = createAgentBuilderWorkflowHandler(
  workflows.streamWorkflowHandler,
  'Streaming agent builder action',
);

export const streamVNextAgentBuilderActionHandler = createAgentBuilderWorkflowHandler(
  workflows.streamVNextWorkflowHandler,
  'Streaming VNext agent builder action',
);

export const resumeAsyncAgentBuilderActionHandler = createAgentBuilderWorkflowHandler(
  workflows.resumeAsyncWorkflowHandler,
  'Resuming async agent builder action',
);

export const resumeAgentBuilderActionHandler = createAgentBuilderWorkflowHandler(
  workflows.resumeWorkflowHandler,
  'Resuming agent builder action',
);

export const getAgentBuilderActionRunsHandler = createAgentBuilderWorkflowHandler(
  workflows.getWorkflowRunsHandler,
  'Getting agent builder action runs',
);

export const cancelAgentBuilderActionRunHandler = createAgentBuilderWorkflowHandler(
  workflows.cancelWorkflowRunHandler,
  'Cancelling agent builder action run',
);

export const sendAgentBuilderActionRunEventHandler = createAgentBuilderWorkflowHandler(
  workflows.sendWorkflowRunEventHandler,
  'Sending agent builder action run event',
);
