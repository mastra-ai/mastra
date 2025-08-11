import { MastraA2AError } from '@mastra/core/a2a';
import type {
  MessageSendParams,
  TaskQueryParams,
  TaskIdParams,
  AgentCard,
  TaskStatus,
  TaskState,
} from '@mastra/core/a2a';
import type { Agent } from '@mastra/core/agent';
import type { IMastraLogger } from '@mastra/core/logger';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { convertToCoreMessage, normalizeError, createSuccessResponse, createErrorResponse } from '../a2a/protocol';
import type { InMemoryTaskStore } from '../a2a/store';
import { applyUpdateToTask, createTaskContext, loadOrCreateTask } from '../a2a/tasks';
import type { Context } from '../types';

const messageSendParamsSchema = z.object({
  message: z.object({
    role: z.enum(['user', 'agent']),
    parts: z.array(
      z.object({
        kind: z.enum(['text']),
        text: z.string(),
      }),
    ),
    kind: z.literal('message'),
    messageId: z.string(),
    contextId: z.string().optional(),
    taskId: z.string().optional(),
    referenceTaskIds: z.array(z.string()).optional(),
    extensions: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export async function getAgentCardByIdHandler({
  mastra,
  agentId,
  executionUrl = `/a2a/${agentId}`,
  provider = {
    organization: 'Mastra',
    url: 'https://mastra.ai',
  },
  version = '1.0',
  runtimeContext,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: keyof ReturnType<typeof mastra.getAgents>;
  executionUrl?: string;
  version?: string;
  provider?: {
    organization: string;
    url: string;
  };
}): Promise<AgentCard> {
  const agent = mastra.getAgent(agentId);

  if (!agent) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }

  const [instructions, tools] = await Promise.all([
    agent.getInstructions({ runtimeContext }),
    agent.getTools({ runtimeContext }),
  ]);

  // Extract agent information to create the AgentCard
  const agentCard: AgentCard = {
    name: agent.id || agentId,
    description: instructions,
    url: executionUrl,
    provider,
    version,
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

function validateMessageSendParams(params: MessageSendParams) {
  try {
    messageSendParamsSchema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw MastraA2AError.invalidParams((error as z.ZodError).errors[0]!.message);
    }

    throw error;
  }
}

export async function handleMessageSend({
  requestId,
  params,
  taskStore,
  agent,
  agentId,
  logger,
  runtimeContext,
}: {
  requestId: string;
  params: MessageSendParams;
  taskStore: InMemoryTaskStore;
  agent: Agent;
  agentId: string;
  logger?: IMastraLogger;
  runtimeContext: RuntimeContext;
}) {
  validateMessageSendParams(params);

  const { message, metadata } = params;
  const { contextId } = message;
  const taskId = message.taskId || crypto.randomUUID();

  // Load or create task
  let currentData = await loadOrCreateTask({
    taskId,
    taskStore,
    agentId,
    message,
    contextId,
    metadata,
  });

  // Use the new TaskContext definition, passing history
  const context = createTaskContext({
    task: currentData,
    userMessage: message,
    history: currentData.history || [],
    activeCancellations: taskStore.activeCancellations,
  });

  try {
    const { text } = await agent.generate([convertToCoreMessage(message)], {
      runId: taskId,
      runtimeContext,
    });

    currentData = applyUpdateToTask(currentData, {
      state: 'completed',
      message: {
        messageId: crypto.randomUUID(),
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text: text,
          },
        ],
        kind: 'message',
      },
    });

    await taskStore.save({ agentId, data: currentData });
    context.task = currentData;
  } catch (handlerError) {
    // If handler throws, apply 'failed' status, save, and rethrow
    const failureStatusUpdate: Omit<TaskStatus, 'timestamp'> = {
      state: 'failed',
      message: {
        messageId: crypto.randomUUID(),
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text: `Handler failed: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`,
          },
        ],
        kind: 'message',
      },
    };
    currentData = applyUpdateToTask(currentData, failureStatusUpdate);

    try {
      await taskStore.save({ agentId, data: currentData });
    } catch (saveError) {
      // @ts-expect-error saveError is an unknown error
      logger?.error(`Failed to save task ${currentData.id} after handler error:`, saveError?.message);
    }

    return normalizeError(handlerError, requestId, currentData.id, logger); // Rethrow original error
  }

  // The loop finished, send the final task state
  return createSuccessResponse(requestId, currentData);
}

export async function handleTaskGet({
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

  if (!task) {
    throw MastraA2AError.taskNotFound(taskId);
  }

  return createSuccessResponse(requestId, task);
}

export async function* handleMessageStream({
  requestId,
  params,
  taskStore,
  agent,
  agentId,
  logger,
  runtimeContext,
}: {
  requestId: string;
  params: MessageSendParams;
  taskStore: InMemoryTaskStore;
  agent: Agent;
  agentId: string;
  logger?: IMastraLogger;
  runtimeContext: RuntimeContext;
}) {
  yield createSuccessResponse(requestId, {
    state: 'working',
    message: {
      messageId: crypto.randomUUID(),
      kind: 'message',
      role: 'agent',
      parts: [{ kind: 'text', text: 'Generating response...' }],
    },
  });

  let result;
  try {
    result = await handleMessageSend({
      requestId,
      params,
      taskStore,
      agent,
      agentId,
      runtimeContext,
      logger,
    });
  } catch (err) {
    if (!(err instanceof MastraA2AError)) {
      throw err;
    }

    result = createErrorResponse(requestId, err.toJSONRPCError());
  }

  yield result;
}

export async function handleTaskCancel({
  requestId,
  taskStore,
  agentId,
  taskId,
  logger,
}: {
  requestId: string;
  taskStore: InMemoryTaskStore;
  agentId: string;
  taskId: string;
  logger?: IMastraLogger;
}) {
  // Load task and history
  let data = await taskStore.load({
    agentId,
    taskId,
  });

  if (!data) {
    throw MastraA2AError.taskNotFound(taskId);
  }

  // Check if cancelable (not already in a final state)
  const finalStates: TaskState[] = ['completed', 'failed', 'canceled'];

  if (finalStates.includes(data.status.state)) {
    logger?.info(`Task ${taskId} already in final state ${data.status.state}, cannot cancel.`);
    return createSuccessResponse(requestId, data);
  }

  // Signal cancellation
  taskStore.activeCancellations.add(taskId);

  // Apply 'canceled' state update
  const cancelUpdate: Omit<TaskStatus, 'timestamp'> = {
    state: 'canceled',
    message: {
      role: 'agent',
      parts: [{ kind: 'text', text: 'Task cancelled by request.' }],
      kind: 'message',
      messageId: crypto.randomUUID(),
    },
  };

  data = applyUpdateToTask(data, cancelUpdate);

  // Save the updated state
  await taskStore.save({ agentId, data });

  // Remove from active cancellations *after* saving
  taskStore.activeCancellations.delete(taskId);

  // Return the updated task object
  return createSuccessResponse(requestId, data);
}

export async function getAgentExecutionHandler({
  requestId,
  mastra,
  agentId,
  runtimeContext,
  method,
  params,
  taskStore,
  logger,
}: Context & {
  requestId: string;
  runtimeContext: RuntimeContext;
  agentId: string;
  method: 'message/send' | 'message/stream' | 'tasks/get' | 'tasks/cancel';
  params: MessageSendParams | TaskQueryParams | TaskIdParams;
  taskStore: InMemoryTaskStore;
  logger?: IMastraLogger;
}): Promise<any> {
  const agent = mastra.getAgent(agentId);

  let taskId: string | undefined; // For error context

  try {
    // Attempt to get task ID early for error context. Cast params to any to access id.
    // Proper validation happens within specific handlers.
    taskId = 'id' in params ? params.id : params.message?.taskId || 'No task ID provided';

    // 2. Route based on method
    switch (method) {
      case 'message/send': {
        const result = await handleMessageSend({
          requestId,
          params: params as MessageSendParams,
          taskStore,
          agent,
          agentId,
          runtimeContext,
        });
        return result;
      }
      case 'message/stream':
        const result = await handleMessageStream({
          requestId,
          taskStore,
          params: params as MessageSendParams,
          agent,
          agentId,
          runtimeContext,
        });
        return result;

      case 'tasks/get': {
        const result = await handleTaskGet({
          requestId,
          taskStore,
          agentId,
          taskId,
        });

        return result;
      }
      case 'tasks/cancel': {
        const result = await handleTaskCancel({
          requestId,
          taskStore,
          agentId,
          taskId,
        });

        return result;
      }
      default:
        throw MastraA2AError.methodNotFound(method);
    }
  } catch (error) {
    if (error instanceof MastraA2AError && taskId && !error.taskId) {
      error.taskId = taskId; // Add task ID context if missing
    }

    return normalizeError(error, requestId, taskId, logger);
  }
}
