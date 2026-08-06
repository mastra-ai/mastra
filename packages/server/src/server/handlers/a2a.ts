import { isDeepStrictEqual } from 'node:util';
import { a2aV03Compat, MastraA2AError } from '@mastra/core/a2a';
import type { Agent } from '@mastra/core/agent';
import type { IMastraLogger } from '@mastra/core/logger';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod/v4';
import { signAgentCard } from '../a2a/agent-card-signing';
import { convertToCoreMessage, normalizeError, createSuccessResponse } from '../a2a/protocol';
import { DefaultPushNotificationSender } from '../a2a/push-notification-sender';
import { InMemoryPushNotificationStore } from '../a2a/push-notification-store';
import type {
  GetTaskPushNotificationConfigParams,
  ListTaskPushNotificationConfigParams,
  DeleteTaskPushNotificationConfigParams,
  TaskPushNotificationConfig,
} from '../a2a/push-notification-store';
import type { InMemoryTaskStore } from '../a2a/store';
import { applyUpdateToTask, loadOrCreateTask } from '../a2a/tasks';
import { normalizeToV1Method, v03MessageToV1, v1EventToV03 } from '../a2a/translate';
import { isLegacyVersion, resolveProtocolVersion } from '../a2a/version';
import type { A2AProtocolVersion } from '../a2a/version';
import type {
  A2ATaskStateWire,
  A2AWireArtifact as Artifact,
  A2AWireMessage,
  A2AWireStreamEvent,
  A2AWireTask as Task,
  A2AWireTaskArtifactUpdateEvent,
  A2AWireTaskStatus as TaskStatus,
} from '../a2a/wire-types';
import { isTextWirePart, TERMINAL_TASK_STATES } from '../a2a/wire-types';
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

type AgentCard = z.infer<typeof agentCardResponseSchema>;

// v1 wire message-send params. The server accepts both v0.3- and v1-shaped
// inbound messages; a legacy inbound message is normalized to v1 (via
// v03MessageToV1) before it reaches these handlers.
interface MessageSendParams {
  message: A2AWireMessage;
  configuration?: {
    acceptedOutputModes?: string[];
    blocking?: boolean;
    historyLength?: number;
    pushNotificationConfig?: TaskPushNotificationConfig['pushNotificationConfig'];
  };
  metadata?: Record<string, unknown>;
}

// v1 wire message-send params validation schema (content-keyed parts, no kind).
const messagePartSchema = z.union([
  z.object({
    text: z.string(),
    mediaType: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  z.object({
    raw: z.string(),
    filename: z.string().optional(),
    mediaType: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  z.object({
    url: z.string(),
    filename: z.string().optional(),
    mediaType: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  z.object({
    data: z.union([z.record(z.string(), z.any()), z.array(z.any())]),
    mediaType: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
]);

const messageSendParamsSchema = z.object({
  message: z.object({
    role: z.enum(['ROLE_USER', 'ROLE_AGENT']),
    parts: z.array(messagePartSchema),
    messageId: z.string(),
    contextId: z.string().optional(),
    taskId: z.string().optional(),
    referenceTaskIds: z.array(z.string()).optional(),
    extensions: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  configuration: z
    .object({
      acceptedOutputModes: z.array(z.string()).optional(),
      blocking: z.boolean().optional(),
      historyLength: z.number().optional(),
      pushNotificationConfig: z
        .object({
          url: z.string(),
          id: z.string().optional(),
          token: z.string().optional(),
          authentication: z
            .object({
              schemes: z.array(z.string()),
              credentials: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

const defaultPushNotificationStore = new InMemoryPushNotificationStore();
const defaultPushNotificationSender = new DefaultPushNotificationSender(defaultPushNotificationStore);

function createAgentCardDefaults({
  pushNotifications = false,
}: {
  pushNotifications?: boolean;
} = {}) {
  return {
    security: [] as Array<Record<string, string[]>>,
    securitySchemes: {} as Record<string, unknown>,
    capabilities: {
      streaming: true,
      pushNotifications,
      extendedAgentCard: false,
      extensions: [] as unknown[],
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
  pushNotifications = false,
  requestContext,
  protocolVersion,
}: Context & {
  requestContext: RequestContext;
  agentId: keyof ReturnType<typeof mastra.listAgents>;
  executionUrl?: string;
  version?: string;
  provider?: {
    organization: string;
    url: string;
  };
  pushNotifications?: boolean;
  protocolVersion?: A2AProtocolVersion;
}): Promise<AgentCard> {
  const agent = await getAgentFromSystem({ mastra, agentId: agentId as string });

  const [instructions, tools]: [
    Awaited<ReturnType<typeof agent.getInstructions>>,
    Awaited<ReturnType<typeof agent.listTools>>,
  ] = await Promise.all([agent.getInstructions({ requestContext }), agent.listTools({ requestContext })]);

  const legacy = protocolVersion ? isLegacyVersion(protocolVersion) : false;

  // v1 AgentCard: the execution endpoint lives in `supportedInterfaces`.
  const v1Interface = {
    url: executionUrl,
    protocolBinding: 'JSONRPC',
    protocolVersion: '1.0',
    tenant: '',
  };

  // Build a V1 AgentCard.
  const agentCard: AgentCard = {
    name: agent.id || (agentId as string),
    description: convertInstructionsToString(instructions),
    protocolVersion: '1.0',
    supportedInterfaces: [v1Interface],
    provider,
    version,
    ...createAgentCardDefaults({ pushNotifications }),
    // Convert agent tools to skills format for A2A protocol
    skills: Object.entries(tools).map(([toolId, tool]) => ({
      id: toolId,
      name: toolId,
      description: ('description' in tool && tool.description) || `Tool: ${toolId}`,
      // Optional fields
      tags: ['tool'],
    })),
  };

  if (legacy) {
    // Down-translate for a v0.3 consumer: mirror the interface as a top-level
    // `url` + `additionalInterfaces`, restore the extended-card flag, and add a
    // legacy interface alongside the v1 one so both peers can discover it.
    const legacyInterfaces = a2aV03Compat.duplicateInterfacesForLegacy([v1Interface], ['JSONRPC']);
    agentCard.protocolVersion = '0.3';
    agentCard.url = executionUrl;
    agentCard.supportedInterfaces = legacyInterfaces;
    agentCard.additionalInterfaces = legacyInterfaces;
    agentCard.supportsAuthenticatedExtendedCard = false;
  }

  const signing = mastra.getServer?.()?.a2a?.agentCardSigning;
  if (!signing) {
    return agentCard;
  }

  return signAgentCard({
    agentCard: agentCard as unknown as Parameters<typeof signAgentCard>[0]['agentCard'],
    signing,
  }) as unknown as AgentCard;
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
}): A2AWireTaskArtifactUpdateEvent | undefined {
  const parts: Artifact['parts'] = [...(text ? [{ text }] : []), ...(data ? [{ data }] : [])];

  if (parts.length === 0) {
    return undefined;
  }

  return {
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
}): A2AWireTaskArtifactUpdateEvent {
  return {
    taskId,
    contextId,
    ...(append ? { append: true } : {}),
    ...(lastChunk !== undefined ? { lastChunk } : {}),
    artifact: {
      artifactId: `${taskId}:response:text`,
      name: 'response.txt',
      parts: [{ text }],
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
}): A2AWireTaskArtifactUpdateEvent {
  return {
    taskId,
    contextId,
    ...(lastChunk !== undefined ? { lastChunk } : {}),
    artifact: {
      artifactId: `${taskId}:response:data`,
      name: 'response.json',
      parts: [{ data }],
    },
  };
}

function resolvePushNotificationPair({
  pushNotificationStore,
  pushNotificationSender,
}: {
  pushNotificationStore?: InMemoryPushNotificationStore;
  pushNotificationSender?: DefaultPushNotificationSender;
}) {
  if (pushNotificationSender) {
    return {
      pushNotificationStore: pushNotificationSender.getStore(),
      pushNotificationSender,
    };
  }

  if (pushNotificationStore) {
    return {
      pushNotificationStore,
      pushNotificationSender: new DefaultPushNotificationSender(pushNotificationStore),
    };
  }

  return {
    pushNotificationStore: defaultPushNotificationStore,
    pushNotificationSender: defaultPushNotificationSender,
  };
}

function createTaskPushNotificationConfig(
  taskId: string,
  pushNotificationConfig: TaskPushNotificationConfig['pushNotificationConfig'],
): TaskPushNotificationConfig {
  return {
    taskId,
    pushNotificationConfig: {
      ...pushNotificationConfig,
      id: pushNotificationConfig.id ?? taskId,
    },
  };
}

function shouldSendPushNotification(previousTask: Task | undefined, nextTask: Task) {
  const pushTriggerStates: A2ATaskStateWire[] = [
    'TASK_STATE_COMPLETED',
    'TASK_STATE_FAILED',
    'TASK_STATE_CANCELED',
    'TASK_STATE_INPUT_REQUIRED',
  ];

  if (!pushTriggerStates.includes(nextTask.status.state)) {
    return false;
  }

  return previousTask?.status.state !== nextTask.status.state;
}

async function saveTaskAndMaybeSendPushNotification({
  taskStore,
  pushNotificationSender,
  previousTask,
  nextTask,
  agentId,
  logger,
}: {
  taskStore: InMemoryTaskStore;
  pushNotificationSender: DefaultPushNotificationSender;
  previousTask?: Task;
  nextTask: Task;
  agentId: string;
  logger?: IMastraLogger;
}) {
  await taskStore.save({ agentId, data: nextTask });

  if (!shouldSendPushNotification(previousTask, nextTask)) {
    return;
  }

  void pushNotificationSender
    .sendNotifications({
      agentId,
      // The sender only reads `task.id`; it is typed against the SDK's in-memory
      // Task, but Mastra passes wire-shaped tasks internally.
      task: nextTask as unknown as Parameters<DefaultPushNotificationSender['sendNotifications']>[0]['task'],
      logger,
    })
    .catch(error => {
      logger?.error('Failed to schedule A2A push notification', error);
    });
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

function isTerminalTaskState(state: A2ATaskStateWire) {
  return TERMINAL_TASK_STATES.includes(state);
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
    if (!other) {
      return false;
    }

    if (isTextWirePart(part) && isTextWirePart(other)) {
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
    taskId: next.id,
    contextId: next.contextId,
    lastChunk: isTerminalTaskState(next.status.state) && index === changedArtifacts.length - 1,
    artifact: structuredClone(artifact),
  }));
}

async function executeMessageSend({
  requestId,
  message,
  metadata,
  currentData,
  taskStore,
  pushNotificationSender,
  agent,
  agentId,
  logger,
  requestContext,
}: {
  requestId: number | string;
  message: MessageSendParams['message'];
  metadata: MessageSendParams['metadata'];
  currentData: Task;
  taskStore: InMemoryTaskStore;
  pushNotificationSender: DefaultPushNotificationSender;
  agent: Agent;
  agentId: string;
  logger?: IMastraLogger;
  requestContext: RequestContext;
}) {
  const { contextId } = message;

  try {
    // Pass contextId as threadId for memory persistence across A2A conversations
    // Allow user to pass resourceId via metadata, fall back to agentId
    const resourceId = (metadata?.resourceId as string) ?? (message.metadata?.resourceId as string) ?? agentId;
    const result = await agent.generate([convertToCoreMessage(message)], {
      runId: currentData.id,
      requestContext,
      ...(contextId ? { threadId: contextId, resourceId } : {}),
    });

    const latestTask = await taskStore.load({ agentId, taskId: currentData.id });
    if (latestTask?.status.state === 'TASK_STATE_CANCELED') {
      return createSuccessResponse(requestId, latestTask);
    }
    currentData = latestTask ?? currentData;

    const artifactUpdate = createArtifactUpdate({
      taskId: currentData.id,
      contextId: currentData.contextId,
      text: result.text,
      data: result.object as Record<string, unknown> | undefined,
    });

    if (artifactUpdate) {
      currentData = applyUpdateToTask(currentData, artifactUpdate);
    }

    const previousTask = currentData;
    currentData = applyUpdateToTask(currentData, {
      state: 'TASK_STATE_COMPLETED',
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

    await saveTaskAndMaybeSendPushNotification({
      taskStore,
      pushNotificationSender,
      previousTask,
      nextTask: currentData,
      agentId,
      logger,
    });
  } catch (handlerError) {
    const latestTask = await taskStore.load({ agentId, taskId: currentData.id });
    if (latestTask?.status.state === 'TASK_STATE_CANCELED') {
      return createSuccessResponse(requestId, latestTask);
    }
    currentData = latestTask ?? currentData;

    // If handler throws, apply 'failed' status, save, and rethrow
    const failureStatusUpdate: Omit<TaskStatus, 'timestamp'> = {
      state: 'TASK_STATE_FAILED',
      message: {
        messageId: crypto.randomUUID(),
        role: 'ROLE_AGENT',
        parts: [
          {
            text: `Handler failed: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`,
          },
        ],
      },
    };
    const previousTask = currentData;
    currentData = applyUpdateToTask(currentData, failureStatusUpdate);

    try {
      await saveTaskAndMaybeSendPushNotification({
        taskStore,
        pushNotificationSender,
        previousTask,
        nextTask: currentData,
        agentId,
        logger,
      });
    } catch (saveError) {
      // @ts-expect-error saveError is an unknown error
      logger?.error(`Failed to save task ${currentData.id} after handler error:`, saveError?.message);
    }

    return normalizeError(handlerError, requestId, currentData.id, logger); // Rethrow original error
  }

  // The loop finished, send the final task state
  return createSuccessResponse(requestId, currentData);
}

export async function handleMessageSend({
  requestId,
  params,
  taskStore,
  pushNotificationStore,
  pushNotificationSender,
  agent,
  agentId,
  logger,
  requestContext,
}: {
  requestId: number | string;
  params: MessageSendParams;
  taskStore: InMemoryTaskStore;
  pushNotificationStore?: InMemoryPushNotificationStore;
  pushNotificationSender?: DefaultPushNotificationSender;
  agent: Agent;
  agentId: string;
  logger?: IMastraLogger;
  requestContext: RequestContext;
}) {
  validateMessageSendParams(params);

  const { message, metadata } = params;
  const { contextId } = message;
  const taskId = message.taskId || crypto.randomUUID();
  const existingTask = await taskStore.load({ agentId, taskId });
  if (params.configuration?.blocking === false && existingTask?.status.state === 'TASK_STATE_WORKING') {
    return createSuccessResponse(requestId, existingTask);
  }
  const {
    pushNotificationStore: resolvedPushNotificationStore,
    pushNotificationSender: resolvedPushNotificationSender,
  } = resolvePushNotificationPair({
    pushNotificationStore,
    pushNotificationSender,
  });

  let currentData = await loadOrCreateTask({
    taskId,
    taskStore,
    agentId,
    message,
    contextId,
    metadata,
  });

  if (params.configuration?.pushNotificationConfig) {
    resolvedPushNotificationStore.set({
      agentId,
      config: createTaskPushNotificationConfig(taskId, params.configuration.pushNotificationConfig),
    });
  }

  currentData = applyUpdateToTask(currentData, {
    state: 'TASK_STATE_WORKING',
    message: {
      messageId: crypto.randomUUID(),
      role: 'ROLE_AGENT',
      parts: [{ text: 'Generating response...' }],
    },
  });
  await saveTaskAndMaybeSendPushNotification({
    taskStore,
    pushNotificationSender: resolvedPushNotificationSender,
    nextTask: currentData,
    agentId,
    logger,
  });

  const execution = executeMessageSend({
    requestId,
    message,
    metadata,
    currentData,
    taskStore,
    pushNotificationSender: resolvedPushNotificationSender,
    agent,
    agentId,
    logger,
    requestContext,
  });

  if (params.configuration?.blocking === false) {
    void execution.catch(error => {
      logger?.error(`Unexpected background failure for A2A task ${currentData.id}`, error);
    });
    return createSuccessResponse(requestId, currentData);
  }

  return execution;
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

async function loadTaskOrThrow({
  taskStore,
  agentId,
  taskId,
}: {
  taskStore: InMemoryTaskStore;
  agentId: string;
  taskId: string;
}) {
  const task = await taskStore.load({ agentId, taskId });

  if (!task) {
    throw MastraA2AError.taskNotFound(taskId);
  }

  return task;
}

export async function handleSetTaskPushNotificationConfig({
  requestId,
  taskStore,
  pushNotificationStore,
  agentId,
  params,
}: {
  requestId: number | string;
  taskStore: InMemoryTaskStore;
  pushNotificationStore?: InMemoryPushNotificationStore;
  agentId: string;
  params: TaskPushNotificationConfig;
}) {
  await loadTaskOrThrow({
    taskStore,
    agentId,
    taskId: params.taskId,
  });

  const { pushNotificationStore: resolvedPushNotificationStore } = resolvePushNotificationPair({
    pushNotificationStore,
  });
  const config = resolvedPushNotificationStore.set({
    agentId,
    config: createTaskPushNotificationConfig(params.taskId, params.pushNotificationConfig),
  });

  return createSuccessResponse(requestId, config);
}

export async function handleGetTaskPushNotificationConfig({
  requestId,
  taskStore,
  pushNotificationStore,
  agentId,
  params,
}: {
  requestId: number | string;
  taskStore: InMemoryTaskStore;
  pushNotificationStore?: InMemoryPushNotificationStore;
  agentId: string;
  params: GetTaskPushNotificationConfigParams;
}) {
  await loadTaskOrThrow({
    taskStore,
    agentId,
    taskId: params.id,
  });

  const { pushNotificationStore: resolvedPushNotificationStore } = resolvePushNotificationPair({
    pushNotificationStore,
  });
  const config = resolvedPushNotificationStore.get({
    agentId,
    params,
  });

  if (!config) {
    throw MastraA2AError.invalidParams(
      `Push notification config not found: ${params.pushNotificationConfigId ?? params.id}`,
    );
  }

  return createSuccessResponse(requestId, config);
}

export async function handleListTaskPushNotificationConfig({
  requestId,
  taskStore,
  pushNotificationStore,
  agentId,
  params,
}: {
  requestId: number | string;
  taskStore: InMemoryTaskStore;
  pushNotificationStore?: InMemoryPushNotificationStore;
  agentId: string;
  params: ListTaskPushNotificationConfigParams;
}) {
  await loadTaskOrThrow({
    taskStore,
    agentId,
    taskId: params.id,
  });

  const { pushNotificationStore: resolvedPushNotificationStore } = resolvePushNotificationPair({
    pushNotificationStore,
  });
  const configs = resolvedPushNotificationStore.list({
    agentId,
    params,
  });

  return createSuccessResponse(requestId, configs);
}

export async function handleDeleteTaskPushNotificationConfig({
  requestId,
  taskStore,
  pushNotificationStore,
  agentId,
  params,
}: {
  requestId: number | string;
  taskStore: InMemoryTaskStore;
  pushNotificationStore?: InMemoryPushNotificationStore;
  agentId: string;
  params: DeleteTaskPushNotificationConfigParams;
}) {
  await loadTaskOrThrow({
    taskStore,
    agentId,
    taskId: params.id,
  });

  const { pushNotificationStore: resolvedPushNotificationStore } = resolvePushNotificationPair({
    pushNotificationStore,
  });
  const deleted = resolvedPushNotificationStore.delete({
    agentId,
    params,
  });

  if (!deleted) {
    throw MastraA2AError.invalidParams(`Push notification config not found: ${params.pushNotificationConfigId}`);
  }

  return createSuccessResponse(requestId, null);
}

export async function* handleMessageStream({
  requestId,
  params,
  taskStore,
  pushNotificationStore,
  pushNotificationSender,
  agent,
  agentId,
  logger,
  requestContext,
}: {
  requestId: number | string;
  params: MessageSendParams;
  taskStore: InMemoryTaskStore;
  pushNotificationStore?: InMemoryPushNotificationStore;
  pushNotificationSender?: DefaultPushNotificationSender;
  agent: Agent;
  agentId: string;
  logger?: IMastraLogger;
  requestContext: RequestContext;
}) {
  validateMessageSendParams(params);

  const { message, metadata } = params;
  const { contextId } = message;
  const taskId = message.taskId || crypto.randomUUID();
  const {
    pushNotificationStore: resolvedPushNotificationStore,
    pushNotificationSender: resolvedPushNotificationSender,
  } = resolvePushNotificationPair({
    pushNotificationStore,
    pushNotificationSender,
  });

  let currentData = await loadOrCreateTask({
    taskId,
    taskStore,
    agentId,
    message,
    contextId,
    metadata,
  });

  if (params.configuration?.pushNotificationConfig) {
    resolvedPushNotificationStore.set({
      agentId,
      config: createTaskPushNotificationConfig(taskId, params.configuration.pushNotificationConfig),
    });
  }

  currentData = applyUpdateToTask(currentData, {
    state: 'TASK_STATE_WORKING',
    message: {
      messageId: crypto.randomUUID(),
      role: 'ROLE_AGENT',
      parts: [{ text: 'Generating response...' }],
    },
  });

  await saveTaskAndMaybeSendPushNotification({
    taskStore,
    pushNotificationSender: resolvedPushNotificationSender,
    nextTask: currentData,
    agentId,
    logger,
  });

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
        await saveTaskAndMaybeSendPushNotification({
          taskStore,
          pushNotificationSender: resolvedPushNotificationSender,
          nextTask: currentData,
          agentId,
          logger,
        });
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
      await saveTaskAndMaybeSendPushNotification({
        taskStore,
        pushNotificationSender: resolvedPushNotificationSender,
        nextTask: currentData,
        agentId,
        logger,
      });
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
      await saveTaskAndMaybeSendPushNotification({
        taskStore,
        pushNotificationSender: resolvedPushNotificationSender,
        nextTask: currentData,
        agentId,
        logger,
      });
      yield createSuccessResponse(requestId, dataUpdate);
    }

    const previousTask = currentData;
    const completedTask = applyUpdateToTask(currentData, {
      state: 'TASK_STATE_COMPLETED',
      message: undefined,
    });

    completedTask.metadata = {
      ...completedTask.metadata,
      execution: {
        toolCalls: await result.toolCalls,
        toolResults: await result.toolResults,
        usage: await result.usage,
        finishReason: await result.finishReason,
      },
    };

    currentData = completedTask;

    await saveTaskAndMaybeSendPushNotification({
      taskStore,
      pushNotificationSender: resolvedPushNotificationSender,
      previousTask,
      nextTask: currentData,
      agentId,
      logger,
    });
  } catch (handlerError) {
    const previousTask = currentData;
    currentData = applyUpdateToTask(currentData, {
      state: 'TASK_STATE_FAILED',
      message: {
        messageId: crypto.randomUUID(),
        role: 'ROLE_AGENT',
        parts: [
          {
            text: `Handler failed: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`,
          },
        ],
      },
    });

    try {
      await saveTaskAndMaybeSendPushNotification({
        taskStore,
        pushNotificationSender: resolvedPushNotificationSender,
        previousTask,
        nextTask: currentData,
        agentId,
        logger,
      });
    } catch (saveError) {
      // @ts-expect-error saveError is an unknown error
      logger?.error(`Failed to save task ${currentData.id} after handler error:`, saveError?.message);
    }
  }

  yield createSuccessResponse(requestId, {
    taskId: currentData.id,
    contextId: currentData.contextId,
    status: currentData.status,
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
        taskId: nextUpdate.task.id,
        contextId: nextUpdate.task.contextId,
        status: nextUpdate.task.status,
      });
    }

    if (isTerminalTaskState(nextUpdate.task.status.state)) {
      return;
    }

    snapshot = nextUpdate;
  }
}

function getTaskIdFromParams(params: MessageSendParams | Record<string, unknown> | undefined) {
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
  pushNotificationSender,
  agentId,
  taskId,
  logger,
}: {
  requestId: number | string;
  taskStore: InMemoryTaskStore;
  pushNotificationSender?: DefaultPushNotificationSender;
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
  if (TERMINAL_TASK_STATES.includes(data.status.state)) {
    logger?.info(`Task ${taskId} already in final state ${data.status.state}, cannot cancel.`);
    return createSuccessResponse(requestId, data);
  }

  // Signal cancellation
  taskStore.activeCancellations.add(taskId);

  // Apply 'canceled' state update
  const cancelUpdate: Omit<TaskStatus, 'timestamp'> = {
    state: 'TASK_STATE_CANCELED',
    message: {
      role: 'ROLE_AGENT',
      parts: [{ text: 'Task cancelled by request.' }],
      messageId: crypto.randomUUID(),
    },
  };

  const previousTask = data;
  data = applyUpdateToTask(data, cancelUpdate);

  // Save the updated state
  await saveTaskAndMaybeSendPushNotification({
    taskStore,
    pushNotificationSender: resolvePushNotificationPair({ pushNotificationSender }).pushNotificationSender,
    previousTask,
    nextTask: data,
    agentId,
    logger,
  });

  // Remove from active cancellations *after* saving
  taskStore.activeCancellations.delete(taskId);

  // Return the updated task object
  return createSuccessResponse(requestId, data);
}

export async function handleListTasks({
  requestId,
  taskStore,
  agentId,
  params,
}: {
  requestId: number | string;
  taskStore: InMemoryTaskStore;
  agentId: string;
  params?: { pageSize?: number; pageToken?: string; contextId?: string };
}) {
  let tasks = taskStore.listByAgent({ agentId });

  // Optional filtering by contextId.
  if (params?.contextId) {
    tasks = tasks.filter(task => task.contextId === params.contextId);
  }

  // Optional pagination. pageToken is the offset (as a string) into the list.
  const offset = params?.pageToken ? Number.parseInt(params.pageToken, 10) || 0 : 0;
  const pageSize = params?.pageSize;
  let page = offset > 0 ? tasks.slice(offset) : tasks;
  let nextPageToken: string | undefined;

  if (pageSize !== undefined && pageSize > 0 && page.length > pageSize) {
    page = page.slice(0, pageSize);
    nextPageToken = String(offset + pageSize);
  }

  return createSuccessResponse(requestId, {
    tasks: page,
    ...(nextPageToken ? { nextPageToken } : {}),
  });
}

export async function getAgentExecutionHandler({
  requestId,
  mastra,
  agentId,
  requestContext,
  method,
  params,
  taskStore,
  pushNotificationStore,
  pushNotificationSender,
  logger,
  abortSignal,
  protocolVersion,
}: Context & {
  requestId: number | string;
  requestContext: RequestContext;
  agentId: string;
  /** Accepts both v0.3 slash-names and v1 PascalCase names. */
  method: string;
  params?: MessageSendParams | Record<string, unknown>;
  taskStore: InMemoryTaskStore;
  pushNotificationStore?: InMemoryPushNotificationStore;
  pushNotificationSender?: DefaultPushNotificationSender;
  logger?: IMastraLogger;
  abortSignal?: AbortSignal;
  protocolVersion?: A2AProtocolVersion;
}): Promise<any> {
  const agent = await getAgentFromSystem({ mastra, agentId });
  const {
    pushNotificationStore: resolvedPushNotificationStore,
    pushNotificationSender: resolvedPushNotificationSender,
  } = resolvePushNotificationPair({
    pushNotificationStore,
    pushNotificationSender,
  });

  const legacy = protocolVersion ? isLegacyVersion(protocolVersion) : false;

  // Normalize the incoming method to its v1 PascalCase form (accepts both v0.3
  // slash-names and v1 names). Unknown methods surface methodNotFound below.
  const v1Method = normalizeToV1Method(method);

  // For message-bearing methods, normalize a legacy inbound message to v1 wire
  // shape before the handlers see it. The wire shapes only differ for v0.3.
  const normalizedParams: MessageSendParams | Record<string, unknown> | undefined =
    legacy && params && typeof params === 'object' && 'message' in params && params.message
      ? { ...(params as Record<string, unknown>), message: v03MessageToV1((params as any).message) }
      : params;

  let taskId: string | undefined; // For error context

  try {
    taskId = getTaskIdFromParams(normalizedParams as MessageSendParams | Record<string, unknown> | undefined);

    // 2. Route based on the normalized v1 method name.
    switch (v1Method) {
      case 'SendMessage': {
        const result = await handleMessageSend({
          requestId,
          params: normalizedParams as MessageSendParams,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          pushNotificationSender: resolvedPushNotificationSender,
          agent,
          agentId,
          logger,
          requestContext,
        });
        return maybeTranslateResult(result, legacy);
      }
      case 'SendStreamingMessage': {
        const result = handleMessageStream({
          requestId,
          taskStore,
          params: normalizedParams as MessageSendParams,
          pushNotificationStore: resolvedPushNotificationStore,
          pushNotificationSender: resolvedPushNotificationSender,
          agent,
          agentId,
          logger,
          requestContext,
        });
        return legacy ? translateStream(result) : result;
      }

      case 'GetTask': {
        const result = await handleTaskGet({
          requestId,
          taskStore,
          agentId,
          taskId: taskId || 'No task ID provided',
        });

        return maybeTranslateResult(result, legacy);
      }
      case 'CancelTask': {
        const result = await handleTaskCancel({
          requestId,
          taskStore,
          pushNotificationSender: resolvedPushNotificationSender,
          agentId,
          taskId: taskId || 'No task ID provided',
          logger,
        });

        return maybeTranslateResult(result, legacy);
      }
      case 'SubscribeToTask': {
        const result = handleTaskResubscribe({
          requestId,
          taskStore,
          agentId,
          taskId: taskId || 'No task ID provided',
          abortSignal,
        });
        return legacy ? translateStream(result) : result;
      }
      case 'ListTasks':
        return await handleListTasks({
          requestId,
          taskStore,
          agentId,
          params: normalizedParams as { pageSize?: number; pageToken?: string; contextId?: string } | undefined,
        });
      case 'CreateTaskPushNotificationConfig':
        return await handleSetTaskPushNotificationConfig({
          requestId,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          agentId,
          params: normalizedParams as unknown as TaskPushNotificationConfig,
        });
      case 'GetTaskPushNotificationConfig':
        return await handleGetTaskPushNotificationConfig({
          requestId,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          agentId,
          params: normalizedParams as unknown as GetTaskPushNotificationConfigParams,
        });
      case 'ListTaskPushNotificationConfigs':
        return await handleListTaskPushNotificationConfig({
          requestId,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          agentId,
          params: normalizedParams as unknown as ListTaskPushNotificationConfigParams,
        });
      case 'DeleteTaskPushNotificationConfig':
        return await handleDeleteTaskPushNotificationConfig({
          requestId,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          agentId,
          params: normalizedParams as unknown as DeleteTaskPushNotificationConfigParams,
        });
      case 'GetExtendedAgentCard':
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

/**
 * Translates a single JSON-RPC success result to the v0.3 wire shape when the
 * negotiated version is legacy. Error responses and non-result payloads pass
 * through unchanged.
 */
function maybeTranslateResult(result: any, legacy: boolean) {
  if (!legacy || !result || typeof result !== 'object' || !('result' in result) || result.result == null) {
    return result;
  }
  return { ...result, result: v1EventToV03(result.result as A2AWireStreamEvent) };
}

/** Wraps an SSE stream so each JSON-RPC event's result is down-translated to v0.3. */
async function* translateStream(stream: AsyncIterable<any>) {
  for await (const event of stream) {
    yield maybeTranslateResult(event, true);
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

    const request = (ctx as typeof ctx & { request?: Request }).request;
    const protocolVersion = resolveProtocolVersion(request?.headers ?? {});

    return getAgentCardByIdHandler({
      mastra: ctx.mastra,
      requestContext: ctx.requestContext,
      agentId: ctx.agentId,
      executionUrl,
      pushNotifications: true,
      protocolVersion,
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
  handler: async ({ mastra, agentId, requestContext, taskStore, abortSignal, request, ...bodyParams }) => {
    const { id: requestId, method } = bodyParams;
    const params = 'params' in bodyParams ? bodyParams.params : undefined;
    const protocolVersion = resolveProtocolVersion(request?.headers ?? {});
    const result = await getAgentExecutionHandler({
      requestId,
      mastra,
      agentId: agentId as string,
      requestContext,
      method,
      params,
      taskStore: taskStore!,
      abortSignal,
      protocolVersion,
    });

    // Both the v0.3 slash-name and the v1 PascalCase name map to streaming.
    const v1Method = normalizeToV1Method(method);
    if (v1Method === 'SendStreamingMessage' || v1Method === 'SubscribeToTask') {
      return createA2ASSEResponse(result);
    }

    return createA2AJsonResponse(result);
  },
});
