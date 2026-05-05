import { isDeepStrictEqual } from 'node:util';
import { MastraA2AError } from '@mastra/core/a2a';
import type {
  MessageSendParams,
  TaskQueryParams,
  TaskIdParams,
  AgentCard,
  TaskStatus,
  TaskState,
  Task,
  Artifact,
} from '@mastra/core/a2a';
import type { Agent } from '@mastra/core/agent';
import type { IMastraLogger } from '@mastra/core/logger';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod/v4';
import { convertToCoreMessage, normalizeError, createSuccessResponse } from '../a2a/protocol';
import type { InMemoryTaskStore } from '../a2a/store';
import { applyUpdateToTask, createTaskContext, loadOrCreateTask } from '../a2a/tasks';
import {
  a2aAgentIdPathParams,
  agentExecutionBodySchema,
  agentCardResponseSchema,
  agentExecutionResponseSchema,
} from '../schemas/a2a';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';
import { convertInstructionsToString } from '../utils';
import { getAgentFromSystem } from './agents';
import { getPublicOrigin } from './auth';

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
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

function createAgentCardDefaults(): Pick<
  AgentCard,
  | 'protocolVersion'
  | 'additionalInterfaces'
  | 'supportsAuthenticatedExtendedCard'
  | 'security'
  | 'securitySchemes'
  | 'capabilities'
  | 'defaultInputModes'
  | 'defaultOutputModes'
> {
  return {
    protocolVersion: '0.3.0',
    additionalInterfaces: [],
    supportsAuthenticatedExtendedCard: false,
    security: [],
    securitySchemes: {},
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
      extensions: [],
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
  };
}

export async function getAgentCardByIdHandler({
  mastra,
  agentId,
  executionUrl = `/a2a/${agentId}`,
  provider = {
    organization: 'Mastra',
    url: 'https://mastra.ai',
  },
  version = '1.0',
  requestContext,
}: Context & {
  requestContext: RequestContext;
  agentId: keyof ReturnType<typeof mastra.listAgents>;
  executionUrl?: string;
  version?: string;
  provider?: {
    organization: string;
    url: string;
  };
}): Promise<AgentCard> {
  const agent = await getAgentFromSystem({ mastra, agentId: agentId as string });

  const [instructions, tools]: [
    Awaited<ReturnType<typeof agent.getInstructions>>,
    Awaited<ReturnType<typeof agent.listTools>>,
  ] = await Promise.all([agent.getInstructions({ requestContext }), agent.listTools({ requestContext })]);

  // Extract agent information to create the AgentCard
  const agentCard: AgentCard = {
    name: agent.id || (agentId as string),
    description: convertInstructionsToString(instructions),
    url: executionUrl,
    provider,
    version,
    ...createAgentCardDefaults(),
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

function getA2AExecutionUrl({
  agentId,
  request,
  routePrefix,
}: {
  agentId: string;
  request?: Request;
  routePrefix?: string;
}) {
  const executionPath = `${routePrefix ?? ''}/a2a/${agentId}`;

  if (!request) {
    return executionPath;
  }

  return `${getPublicOrigin(request)}${executionPath}`;
}

function validateMessageSendParams(params: MessageSendParams) {
  try {
    messageSendParamsSchema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw MastraA2AError.invalidParams((error as z.ZodError).issues[0]!.message);
    }

    throw error;
  }
}

function createArtifactUpdate({
  taskId,
  contextId,
  text,
  data,
}: {
  taskId: string;
  contextId: string;
  text?: string;
  data?: Record<string, unknown>;
}) {
  const parts = [
    ...(text ? [{ kind: 'text' as const, text }] : []),
    ...(data ? [{ kind: 'data' as const, data }] : []),
  ];

  if (parts.length === 0) {
    return undefined;
  }

  return {
    kind: 'artifact-update' as const,
    taskId,
    contextId,
    lastChunk: true,
    artifact: {
      artifactId: `${taskId}:response`,
      name: data ? 'response.json' : 'response.txt',
      parts,
    },
  };
}

function createTextChunkArtifactUpdate({
  taskId,
  contextId,
  text,
  append,
  lastChunk,
}: {
  taskId: string;
  contextId: string;
  text: string;
  append?: boolean;
  lastChunk?: boolean;
}) {
  return {
    kind: 'artifact-update' as const,
    taskId,
    contextId,
    ...(append ? { append: true } : {}),
    ...(lastChunk !== undefined ? { lastChunk } : {}),
    artifact: {
      artifactId: `${taskId}:response:text`,
      name: 'response.txt',
      parts: [{ kind: 'text' as const, text }],
    },
  };
}

function createDataArtifactUpdate({
  taskId,
  contextId,
  data,
  lastChunk,
}: {
  taskId: string;
  contextId: string;
  data: Record<string, unknown>;
  lastChunk?: boolean;
}) {
  return {
    kind: 'artifact-update' as const,
    taskId,
    contextId,
    ...(lastChunk !== undefined ? { lastChunk } : {}),
    artifact: {
      artifactId: `${taskId}:response:data`,
      name: 'response.json',
      parts: [{ kind: 'data' as const, data }],
    },
  };
}

function extractFullStreamTextDelta(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return null;
  }

  const chunk = value as {
    type: string;
    payload?: { text?: string; delta?: string };
    textDelta?: string;
    text?: string;
    delta?: string;
  };

  switch (chunk.type) {
    case 'text-delta':
      if (typeof chunk.payload?.text === 'string') {
        return chunk.payload.text;
      }

      if (typeof chunk.payload?.delta === 'string') {
        return chunk.payload.delta;
      }

      if (typeof chunk.textDelta === 'string') {
        return chunk.textDelta;
      }

      if (typeof chunk.delta === 'string') {
        return chunk.delta;
      }

      if (typeof chunk.text === 'string') {
        return chunk.text;
      }

      return null;
    default:
      return null;
  }
}

function extractFinalStructuredObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return undefined;
  }

  const chunk = value as {
    type: string;
    object?: unknown;
    payload?: { object?: unknown };
  };

  if (chunk.type !== 'object-result') {
    return undefined;
  }

  const objectValue = chunk.payload?.object ?? chunk.object;
  return objectValue && typeof objectValue === 'object' ? (objectValue as Record<string, unknown>) : undefined;
}

function isTerminalTaskState(state: TaskState) {
  return ['completed', 'failed', 'canceled'].includes(state);
}

function artifactIdentity(artifact: Artifact) {
  return artifact.artifactId || artifact.name;
}

function areArtifactPartsEqual(left: Artifact['parts'], right: Artifact['parts']) {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((part, index) => {
    const other = right[index];
    if (!other || part.kind !== other.kind) {
      return false;
    }

    if (part.kind === 'text' && other.kind === 'text') {
      return part.text === other.text;
    }

    return part === other;
  });
}

function areArtifactsEqual(left: Artifact | undefined, right: Artifact | undefined) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.artifactId === right.artifactId &&
    left.name === right.name &&
    left.description === right.description &&
    left.metadata === right.metadata &&
    areArtifactPartsEqual(left.parts, right.parts)
  );
}

function areStatusMessagePartsEqual(
  left: NonNullable<Task['status']['message']>['parts'],
  right: NonNullable<Task['status']['message']>['parts'],
) {
  return left === right || isDeepStrictEqual(left, right);
}

function areStatusMessagesEqual(left: Task['status']['message'], right: Task['status']['message']) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.messageId === right.messageId &&
    left.kind === right.kind &&
    left.role === right.role &&
    left.contextId === right.contextId &&
    left.taskId === right.taskId &&
    isDeepStrictEqual(left.referenceTaskIds, right.referenceTaskIds) &&
    isDeepStrictEqual(left.extensions, right.extensions) &&
    isDeepStrictEqual(left.metadata, right.metadata) &&
    areStatusMessagePartsEqual(left.parts, right.parts)
  );
}

function didTaskStatusChange(previous: Task, next: Task) {
  return (
    previous.status.state !== next.status.state ||
    previous.status.timestamp !== next.status.timestamp ||
    !areStatusMessagesEqual(previous.status.message, next.status.message)
  );
}

function getTaskArtifactUpdates({ previous, next }: { previous: Task; next: Task }) {
  const previousArtifacts = new Map((previous.artifacts ?? []).map(artifact => [artifactIdentity(artifact), artifact]));
  const changedArtifacts = (next.artifacts ?? []).filter(artifact => {
    const priorArtifact = previousArtifacts.get(artifactIdentity(artifact));
    return !priorArtifact || !areArtifactsEqual(priorArtifact, artifact);
  });

  return changedArtifacts.map((artifact, index) => ({
    kind: 'artifact-update' as const,
    taskId: next.id,
    contextId: next.contextId,
    lastChunk: isTerminalTaskState(next.status.state) && index === changedArtifacts.length - 1,
    artifact: structuredClone(artifact),
  }));
}

export async function handleMessageSend({
  requestId,
  params,
  taskStore,
  agent,
  agentId,
  logger,
  requestContext,
}: {
  requestId: number | string;
  params: MessageSendParams;
  taskStore: InMemoryTaskStore;
  agent: Agent;
  agentId: string;
  logger?: IMastraLogger;
  requestContext: RequestContext;
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
    // Pass contextId as threadId for memory persistence across A2A conversations
    // Allow user to pass resourceId via metadata, fall back to agentId
    const resourceId = (metadata?.resourceId as string) ?? (message.metadata?.resourceId as string) ?? agentId;
    const result = await agent.generate([convertToCoreMessage(message)], {
      runId: taskId,
      requestContext,
      ...(contextId ? { threadId: contextId, resourceId } : {}),
    });

    const artifactUpdate = createArtifactUpdate({
      taskId: currentData.id,
      contextId: currentData.contextId,
      text: result.text,
      data: result.object as Record<string, unknown> | undefined,
    });

    if (artifactUpdate) {
      currentData = applyUpdateToTask(currentData, artifactUpdate);
    }

    currentData = applyUpdateToTask(currentData, {
      state: 'completed',
      message: undefined,
    });

    // Store execution details in task metadata
    currentData.metadata = {
      ...currentData.metadata,
      execution: {
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
        usage: result.usage,
        finishReason: result.finishReason,
      },
    };

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
  requestId: number | string;
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
  requestContext,
}: {
  requestId: number | string;
  params: MessageSendParams;
  taskStore: InMemoryTaskStore;
  agent: Agent;
  agentId: string;
  logger?: IMastraLogger;
  requestContext: RequestContext;
}) {
  validateMessageSendParams(params);

  const { message, metadata } = params;
  const { contextId } = message;
  const taskId = message.taskId || crypto.randomUUID();

  let currentData = await loadOrCreateTask({
    taskId,
    taskStore,
    agentId,
    message,
    contextId,
    metadata,
  });

  currentData = applyUpdateToTask(currentData, {
    state: 'working',
    message: {
      messageId: crypto.randomUUID(),
      kind: 'message',
      role: 'agent',
      parts: [{ kind: 'text', text: 'Generating response...' }],
    },
  });

  await taskStore.save({ agentId, data: currentData });

  yield createSuccessResponse(requestId, currentData);

  try {
    const resourceId = (metadata?.resourceId as string) ?? (message.metadata?.resourceId as string) ?? agentId;
    const result = await agent.stream([convertToCoreMessage(message)], {
      runId: taskId,
      requestContext,
      ...(contextId ? { threadId: contextId, resourceId } : {}),
    });
    let sawTextArtifact = false;
    let pendingTextChunk: string | undefined;
    let structuredData: Record<string, unknown> | undefined;

    for await (const chunk of result.fullStream) {
      const textDelta = extractFullStreamTextDelta(chunk);
      if (textDelta !== null) {
        if (!pendingTextChunk) {
          pendingTextChunk = textDelta;
          continue;
        }

        const textUpdate = createTextChunkArtifactUpdate({
          taskId: currentData.id,
          contextId: currentData.contextId,
          text: pendingTextChunk,
          append: sawTextArtifact,
          lastChunk: false,
        });

        currentData = applyUpdateToTask(currentData, textUpdate);
        await taskStore.save({ agentId, data: currentData });
        yield createSuccessResponse(requestId, textUpdate);

        sawTextArtifact = true;
        pendingTextChunk = textDelta;
        continue;
      }

      const finalStructuredObject = extractFinalStructuredObject(chunk);
      if (finalStructuredObject) {
        structuredData = finalStructuredObject;
      }
    }

    structuredData ??= (await result.object) as Record<string, unknown> | undefined;

    if (!pendingTextChunk && !sawTextArtifact) {
      const finalText = await result.text;
      if (finalText) {
        pendingTextChunk = finalText;
      }
    }

    if (pendingTextChunk) {
      const textUpdate = createTextChunkArtifactUpdate({
        taskId: currentData.id,
        contextId: currentData.contextId,
        text: pendingTextChunk,
        append: sawTextArtifact,
        lastChunk: !structuredData,
      });

      currentData = applyUpdateToTask(currentData, textUpdate);
      await taskStore.save({ agentId, data: currentData });
      yield createSuccessResponse(requestId, textUpdate);

      sawTextArtifact = true;
      pendingTextChunk = undefined;
    }

    if (structuredData) {
      const dataUpdate = createDataArtifactUpdate({
        taskId: currentData.id,
        contextId: currentData.contextId,
        data: structuredData,
        lastChunk: true,
      });

      currentData = applyUpdateToTask(currentData, dataUpdate);
      await taskStore.save({ agentId, data: currentData });
      yield createSuccessResponse(requestId, dataUpdate);
    }

    currentData = applyUpdateToTask(currentData, {
      state: 'completed',
      message: undefined,
    });

    currentData.metadata = {
      ...currentData.metadata,
      execution: {
        toolCalls: await result.toolCalls,
        toolResults: await result.toolResults,
        usage: await result.usage,
        finishReason: await result.finishReason,
      },
    };

    await taskStore.save({ agentId, data: currentData });
  } catch (handlerError) {
    currentData = applyUpdateToTask(currentData, {
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
    });

    try {
      await taskStore.save({ agentId, data: currentData });
    } catch (saveError) {
      // @ts-expect-error saveError is an unknown error
      logger?.error(`Failed to save task ${currentData.id} after handler error:`, saveError?.message);
    }
  }

  yield createSuccessResponse(requestId, {
    kind: 'status-update',
    taskId: currentData.id,
    contextId: currentData.contextId,
    status: currentData.status,
    final: true,
  });
}

export async function* handleTaskResubscribe({
  requestId,
  taskStore,
  agentId,
  taskId,
  abortSignal,
}: {
  requestId: number | string;
  taskStore: InMemoryTaskStore;
  agentId: string;
  taskId: string;
  abortSignal?: AbortSignal;
}) {
  let snapshot = taskStore.loadWithVersion({ agentId, taskId });

  if (!snapshot) {
    throw MastraA2AError.taskNotFound(taskId);
  }

  yield createSuccessResponse(requestId, snapshot.task);

  if (isTerminalTaskState(snapshot.task.status.state)) {
    return;
  }

  while (true) {
    const { task, version } = snapshot;
    const nextUpdate = await taskStore.waitForNextUpdate({
      agentId,
      taskId,
      afterVersion: version,
      signal: abortSignal,
    });

    for (const artifactUpdate of getTaskArtifactUpdates({ previous: task, next: nextUpdate.task })) {
      yield createSuccessResponse(requestId, artifactUpdate);
    }

    if (didTaskStatusChange(task, nextUpdate.task)) {
      yield createSuccessResponse(requestId, {
        kind: 'status-update',
        taskId: nextUpdate.task.id,
        contextId: nextUpdate.task.contextId,
        status: nextUpdate.task.status,
        final: isTerminalTaskState(nextUpdate.task.status.state),
      });
    }

    if (isTerminalTaskState(nextUpdate.task.status.state)) {
      return;
    }

    snapshot = nextUpdate;
  }
}

function getTaskIdFromParams(
  params: MessageSendParams | TaskQueryParams | TaskIdParams | Record<string, unknown> | undefined,
) {
  if (!params || typeof params !== 'object') {
    return undefined;
  }

  if ('id' in params && typeof params.id === 'string') {
    return params.id;
  }

  if ('taskId' in params && typeof params.taskId === 'string') {
    return params.taskId;
  }

  if ('message' in params && params.message && typeof params.message === 'object' && 'taskId' in params.message) {
    return typeof params.message.taskId === 'string' ? params.message.taskId : undefined;
  }

  return undefined;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return !!value && typeof value === 'object' && Symbol.asyncIterator in value;
}

function createA2AJsonResponse(payload: unknown): Response {
  return Response.json(payload);
}

function createA2ASSEResponse(payload: AsyncIterable<unknown> | unknown): Response {
  const encoder = new TextEncoder();
  const iterable = isAsyncIterable(payload)
    ? payload
    : (async function* () {
        yield payload;
      })();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
      } catch (error) {
        controller.error(error);
        return;
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function handleTaskCancel({
  requestId,
  taskStore,
  agentId,
  taskId,
  logger,
}: {
  requestId: number | string;
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
  requestContext,
  method,
  params,
  taskStore,
  logger,
  abortSignal,
}: Context & {
  requestId: number | string;
  requestContext: RequestContext;
  agentId: string;
  method:
    | 'message/send'
    | 'message/stream'
    | 'tasks/get'
    | 'tasks/cancel'
    | 'tasks/resubscribe'
    | 'tasks/pushNotificationConfig/set'
    | 'tasks/pushNotificationConfig/get'
    | 'tasks/pushNotificationConfig/list'
    | 'tasks/pushNotificationConfig/delete'
    | 'agent/getAuthenticatedExtendedCard';
  params?: MessageSendParams | TaskQueryParams | TaskIdParams | Record<string, unknown>;
  taskStore: InMemoryTaskStore;
  logger?: IMastraLogger;
  abortSignal?: AbortSignal;
}): Promise<any> {
  const agent = await getAgentFromSystem({ mastra, agentId });

  let taskId: string | undefined; // For error context

  try {
    taskId = getTaskIdFromParams(params);

    // 2. Route based on method
    switch (method) {
      case 'message/send': {
        const result = await handleMessageSend({
          requestId,
          params: params as MessageSendParams,
          taskStore,
          agent,
          agentId,
          requestContext,
        });
        return result;
      }
      case 'message/stream': {
        const result = await handleMessageStream({
          requestId,
          taskStore,
          params: params as MessageSendParams,
          agent,
          agentId,
          requestContext,
        });
        return result;
      }

      case 'tasks/get': {
        const result = await handleTaskGet({
          requestId,
          taskStore,
          agentId,
          taskId: taskId || 'No task ID provided',
        });

        return result;
      }
      case 'tasks/cancel': {
        const result = await handleTaskCancel({
          requestId,
          taskStore,
          agentId,
          taskId: taskId || 'No task ID provided',
        });

        return result;
      }
      case 'tasks/resubscribe':
        return await handleTaskResubscribe({
          requestId,
          taskStore,
          agentId,
          taskId: taskId || 'No task ID provided',
          abortSignal,
        });
      case 'tasks/pushNotificationConfig/set':
      case 'tasks/pushNotificationConfig/get':
      case 'tasks/pushNotificationConfig/list':
      case 'tasks/pushNotificationConfig/delete':
        throw MastraA2AError.pushNotificationNotSupported();
      case 'agent/getAuthenticatedExtendedCard':
        throw MastraA2AError.extendedAgentCardNotConfigured();
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

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const GET_AGENT_CARD_ROUTE = createRoute({
  method: 'GET',
  path: '/.well-known/:agentId/agent-card.json',
  responseType: 'json',
  pathParamSchema: a2aAgentIdPathParams,
  responseSchema: agentCardResponseSchema,
  summary: 'Get agent card',
  description: 'Returns the agent card information for A2A protocol discovery',
  tags: ['Agent-to-Agent'],
  requiresAuth: true,
  handler: async ctx => {
    const executionUrl = getA2AExecutionUrl({
      agentId: ctx.agentId as string,
      request: (ctx as typeof ctx & { request?: Request }).request,
      routePrefix: ctx.routePrefix,
    });

    return getAgentCardByIdHandler({
      mastra: ctx.mastra,
      requestContext: ctx.requestContext,
      agentId: ctx.agentId,
      executionUrl,
    });
  },
});

export const AGENT_EXECUTION_ROUTE = createRoute({
  method: 'POST',
  path: '/a2a/:agentId',
  responseType: 'datastream-response',
  pathParamSchema: a2aAgentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: agentExecutionResponseSchema,
  summary: 'Execute agent',
  description: 'Executes an agent action via JSON-RPC 2.0 over A2A protocol',
  tags: ['Agent-to-Agent'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, requestContext, taskStore, abortSignal, ...bodyParams }) => {
    const { id: requestId, method } = bodyParams;
    const params = 'params' in bodyParams ? bodyParams.params : undefined;
    const result = await getAgentExecutionHandler({
      requestId,
      mastra,
      agentId: agentId as string,
      requestContext,
      method,
      params,
      taskStore: taskStore!,
      abortSignal,
    });

    if (method === 'message/stream' || method === 'tasks/resubscribe') {
      return createA2ASSEResponse(result);
    }

    return createA2AJsonResponse(result);
  },
});
