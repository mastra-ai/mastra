// import { agentBuilderWorkflows } from '@mastra/agent-builder';
import type { WorkflowInfo } from '@mastra/core/workflows';
// import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { getWorkflowInfo, WorkflowRegistry } from '../utils';
import { handleError } from './error';
import * as workflows from './workflows';

interface AgentBuilderContext extends Context {
  actionId?: string;
}

/**
 * Generic wrapper that converts agent-builder handlers to use workflow handlers
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
      // WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows);

      // Validate actionId if it's provided
      // if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
      //   throw new HTTPException(400, {
      //     message: `Invalid agent-builder action: ${actionId}. Valid actions are: ${Object.keys(agentBuilderWorkflows).join(', ')}`,
      //   });
      // }

      logger.info(logMessage, { actionId, ...actionArgs });

      try {
        const handlerArgs = {
          ...actionArgs,
          workflowId: actionId, // Map actionId to workflowId
        } as TWorkflowArgs;

        const result = await workflowHandlerFn(handlerArgs);
        return result;
      } finally {
        WorkflowRegistry.cleanup();
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

export const getAgentBuilderActionsHandler = createAgentBuilderWorkflowHandler(async () => {
  try {
    const registryWorkflows = WorkflowRegistry.getAllWorkflows();
    const _workflows = Object.entries(registryWorkflows).reduce<Record<string, WorkflowInfo>>(
      (acc, [key, workflow]) => {
        acc[key] = getWorkflowInfo(workflow);
        return acc;
      },
      {},
    );
    return _workflows;
  } catch (error) {
    return handleError(error, 'Error getting agent builder workflows');
  }
}, 'Getting agent builder actions');

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
