import type { CoreMessage } from '@mastra/core';
import { A2AError } from '@mastra/core/a2a';
import type {
  TaskSendParams,
  TaskQueryParams,
  TaskIdParams,
  AgentCard,
  JSONRPCError,
  JSONRPCResponse,
  TaskStatus,
  TaskState,
} from '@mastra/core/a2a';
import type { Agent } from '@mastra/core/agent';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { activeCancellations, inMemoryTaskStore } from '../a2a/store';
import type { InMemoryTaskStore } from '../a2a/store';
import { applyUpdateToTaskAndHistory, createTaskContext, loadOrCreateTaskAndHistory } from '../a2a/tasks';
import type { Context } from '../types';

export async function getAgentCardByIdHandler({
  mastra,
  agentId,
  runtimeContext,
}: Context & { runtimeContext: RuntimeContext; agentId: string }): Promise<AgentCard> {
  const agent = mastra.getAgent(agentId);

  if (!agent) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }

  const instructions = await agent.getInstructions({ runtimeContext });
  const tools = await agent.getTools({ runtimeContext });

  // Extract agent information to create the AgentCard
  const agentCard: AgentCard = {
    name: agent.id || agentId,
    description: instructions,
    url: `/a2a/${agentId}`,
    //TODO
    provider: {
      organization: 'Mastra',
      url: 'https://mastra.ai',
    },
    version: '1.0',
    capabilities: {
      streaming: true, // All agents support streaming
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    // Convert agent tools to skills format for A2A protocol
    skills: Object.entries(tools).map(([toolId, tool]) => ({
      id: toolId,
      name: toolId,
      description: tool.description || `Tool: ${toolId}`,
      // Optional fields
      tags: ['tool'],
    })),
  };

  return agentCard;
}

function createErrorResponse(id: number | string | null, error: JSONRPCError<unknown>): JSONRPCResponse<null, unknown> {
  // For errors, ID should be the same as request ID, or null if that couldn't be determined
  return {
    jsonrpc: '2.0',
    id: id, // Can be null if request ID was invalid/missing
    error: error,
  };
}

function normalizeError(error: any, reqId: number | string | null, taskId?: string): JSONRPCResponse<null, unknown> {
  let a2aError: A2AError;
  if (error instanceof A2AError) {
    a2aError = error;
  } else if (error instanceof Error) {
    // Generic JS error
    a2aError = A2AError.internalError(error.message, { stack: error.stack });
  } else {
    // Unknown error type
    a2aError = A2AError.internalError('An unknown error occurred.', error);
  }

  // Ensure Task ID context is present if possible
  if (taskId && !a2aError.taskId) {
    a2aError.taskId = taskId;
  }

  console.error(`Error processing request (Task: ${a2aError.taskId ?? 'N/A'}, ReqID: ${reqId ?? 'N/A'}):`, a2aError);

  return createErrorResponse(reqId, a2aError.toJSONRPCError());
}

function createSuccessResponse<T>(id: number | string | null, result: T): JSONRPCResponse<T> {
  if (id === null) {
    // This shouldn't happen for methods that expect a response, but safeguard
    throw A2AError.internalError('Cannot create success response for null ID.');
  }
  return {
    jsonrpc: '2.0',
    id: id,
    result: result,
  };
}

function sendJsonResponse<T>(reqId: number | string | null, result: T) {
  if (reqId === null) {
    console.warn('Attempted to send JSON response for a request with null ID.');
    // Should this be an error? Or just log and ignore?
    // For 'tasks/send' etc., ID should always be present.
    return;
  }
  return createSuccessResponse(reqId, result);
}

function validateTaskSendParams(params: TaskSendParams) {
  if (!params || typeof params !== 'object') {
    throw A2AError.invalidParams('Missing or invalid params object.');
  }
  if (typeof params.id !== 'string' || params.id === '') {
    throw A2AError.invalidParams('Invalid or missing task ID (params.id).');
  }
  if (!params.message || typeof params.message !== 'object' || !Array.isArray(params.message.parts)) {
    throw A2AError.invalidParams('Invalid or missing message object (params.message).');
  }
}

async function handleTaskSend({
  requestId,
  params,
  agentId,
  taskStore,
  agent,
}: {
  requestId: string;
  params: TaskSendParams;
  agentId: string;
  taskStore: InMemoryTaskStore;
  agent: Agent;
}) {
  validateTaskSendParams(params);

  const { id: taskId, message, sessionId, metadata } = params;

  // Load or create task AND history
  let currentData = await loadOrCreateTaskAndHistory({
    taskId,
    taskStore,
    agentId,
    message,
    sessionId,
    metadata,
  });

  // Use the new TaskContext definition, passing history
  const context = createTaskContext({
    task: currentData.task,
    userMessage: message,
    history: currentData.history,
  });

  try {
    const { text } = await agent.generate(message as unknown as CoreMessage[]);

    currentData = applyUpdateToTaskAndHistory(currentData, {
      state: 'completed',

      message: {
        role: 'agent',
        parts: [
          {
            type: 'text',
            text: text,
          },
        ],
      },
    });
    await taskStore.save({ agentId, data: currentData });
    context.task = currentData.task;
  } catch (handlerError) {
    // If handler throws, apply 'failed' status, save, and rethrow
    const failureStatusUpdate: Omit<TaskStatus, 'timestamp'> = {
      state: 'failed',
      message: {
        role: 'agent',
        parts: [
          {
            type: 'text',
            text: `Handler failed: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`,
          },
        ],
      },
    };
    currentData = applyUpdateToTaskAndHistory(currentData, failureStatusUpdate);
    try {
      await taskStore.save({ agentId, data: currentData });
    } catch (saveError) {
      console.error(`Failed to save task ${taskId} after handler error:`, saveError);
      // Still throw the original handler error
    }
    throw normalizeError(handlerError, requestId, taskId); // Rethrow original error
  }

  // The loop finished, send the final task state
  return sendJsonResponse(requestId, currentData.task);
}

async function handleTaskGet({
  requestId,
  taskStore,
  agentId,
  taskId,
}: {
  requestId: string;
  taskStore: InMemoryTaskStore;
  agentId: string;
  taskId: string;
}) {
  const task = await taskStore.load({ agentId, taskId });

  return sendJsonResponse(requestId, task);
}

async function handleTaskCancel({
  requestId,
  taskStore,
  agentId,
  taskId,
}: {
  requestId: string;
  taskStore: InMemoryTaskStore;
  agentId: string;
  taskId: string;
}) {
  // Load task and history
  let data = await taskStore.load({
    agentId,
    taskId,
  });

  if (!data) {
    throw A2AError.taskNotFound(taskId);
  }

  // Check if cancelable (not already in a final state)
  const finalStates: TaskState[] = ['completed', 'failed', 'canceled'];

  if (finalStates.includes(data.task.status.state)) {
    console.log(`Task ${taskId} already in final state ${data.task.status.state}, cannot cancel.`);
    return sendJsonResponse(requestId, data.task);
  }

  // Signal cancellation
  activeCancellations.add(taskId);

  // Apply 'canceled' state update
  const cancelUpdate: Omit<TaskStatus, 'timestamp'> = {
    state: 'canceled',
    message: {
      role: 'agent',
      parts: [{ type: 'text', text: 'Task cancelled by request.' }],
    },
  };

  data = applyUpdateToTaskAndHistory(data, cancelUpdate);

  // Save the updated state
  await taskStore.save({ agentId, data });

  // Remove from active cancellations *after* saving
  activeCancellations.delete(taskId);

  // Return the updated task object
  return sendJsonResponse(requestId, data.task);
}

export async function getAgentExecutionHandler({
  requestId,
  mastra,
  agentId,
  runtimeContext,
  method,
  params,
}: Context & {
  requestId: string;
  runtimeContext: RuntimeContext;
  agentId: string;
  method: 'tasks/send' | 'tasks/sendSubscribe' | 'tasks/get' | 'tasks/cancel';
  params: TaskSendParams | TaskQueryParams | TaskIdParams;
}) {
  const agent = mastra.getAgent(agentId);
  console.log({ agent, runtimeContext, method, params });

  let taskId: string | undefined; // For error context

  try {
    // Attempt to get task ID early for error context. Cast params to any to access id.
    // Proper validation happens within specific handlers.
    taskId = params.id;

    // 2. Route based on method
    switch (method) {
      case 'tasks/send': {
        const result = await handleTaskSend({
          requestId,
          params: params as TaskSendParams,
          agentId,
          taskStore: inMemoryTaskStore,
          agent,
        });
        return result;
      }
      // case "tasks/sendSubscribe":
      //     await this.handleTaskSendSubscribe(
      //         requestBody as schema.SendTaskStreamingRequest,
      //         res
      //     );
      //     break;
      case 'tasks/get': {
        const result = await handleTaskGet({
          requestId,
          taskStore: inMemoryTaskStore,
          agentId,
          taskId,
        });

        return result;
      }
      case 'tasks/cancel': {
        const result = await handleTaskCancel({
          requestId,
          taskStore: inMemoryTaskStore,
          agentId,
          taskId,
        });

        return result;
      }
      default:
        throw A2AError.methodNotFound(method);
    }
  } catch (error) {
    if (error instanceof A2AError && taskId && !error.taskId) {
      error.taskId = taskId; // Add task ID context if missing
    }
    return normalizeError(error, requestId, taskId);
  }
}
