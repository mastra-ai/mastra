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
  TaskPushNotificationConfig,
  GetTaskPushNotificationConfigParams,
  ListTaskPushNotificationConfigParams,
  DeleteTaskPushNotificationConfigParams,
  Artifact,
} from '@mastra/core/a2a';
import type { Agent } from '@mastra/core/agent';
import type { IMastraLogger } from '@mastra/core/logger';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod/v4';
import { signAgentCard } from '../a2a/agent-card-signing';
import { convertToCoreMessage, normalizeError, createSuccessResponse } from '../a2a/protocol';
import { DefaultPushNotificationSender } from '../a2a/push-notification-sender';
import { InMemoryPushNotificationStore } from '../a2a/push-notification-store';
import { TaskStoreVersionConflictError, type InMemoryTaskStore } from '../a2a/store';
import { isInterruptedTaskState, isTerminalTaskState } from '../a2a/task-state';
import { applyUpdateToTask, loadOrCreateTask } from '../a2a/tasks';
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

// Mirrors @a2a-js/sdk's Part discriminated union (text | file | data) and the
// part shape already declared in ../schemas/a2a.ts. Before this widening, the
// schema hard-coded `kind: z.enum(['text'])` which rejected every non-text
// part before the converter could see it — even though convertToCoreMessagePart
// at ../a2a/protocol.ts already handles file and data parts. With this change,
// FilePart (FileWithBytes | FileWithUri) and DataPart parse successfully and
// reach the converter (data parts then throw a clear "not supported in core
// messages" message; files convert natively to AI-SDK CoreMessage file parts).
const messagePartSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    text: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  z.object({
    kind: z.literal('file'),
    file: z.union([
      z.object({
        bytes: z.string(),
        mimeType: z.string().optional(),
        name: z.string().optional(),
      }),
      z.object({
        uri: z.string(),
        mimeType: z.string().optional(),
        name: z.string().optional(),
      }),
    ]),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  z.object({
    kind: z.literal('data'),
    data: z.record(z.string(), z.any()),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
]);

const messageSendParamsSchema = z.object({
  message: z.object({
    role: z.enum(['user', 'agent']),
    parts: z.array(messagePartSchema),
    kind: z.literal('message'),
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
      returnImmediately: z.boolean().optional(),
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

const V1_TASK_STATES: Record<string, string> = {
  submitted: 'TASK_STATE_SUBMITTED',
  working: 'TASK_STATE_WORKING',
  completed: 'TASK_STATE_COMPLETED',
  failed: 'TASK_STATE_FAILED',
  canceled: 'TASK_STATE_CANCELED',
  'input-required': 'TASK_STATE_INPUT_REQUIRED',
  rejected: 'TASK_STATE_REJECTED',
  'auth-required': 'TASK_STATE_AUTH_REQUIRED',
};

function normalizeV1Part(part: Record<string, unknown>) {
  if ('text' in part) {
    return { kind: 'text', text: part.text, metadata: part.metadata };
  }
  if ('raw' in part) {
    return {
      kind: 'file',
      file: { bytes: part.raw, mimeType: part.mediaType, name: part.filename },
      metadata: part.metadata,
    };
  }
  if ('url' in part) {
    return {
      kind: 'file',
      file: { uri: part.url, mimeType: part.mediaType, name: part.filename },
      metadata: part.metadata,
    };
  }
  return { kind: 'data', data: part.data, metadata: part.metadata };
}

function normalizeV1Params(params: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!params?.message) {
    return params;
  }

  const configuration = params.configuration;
  return {
    ...params,
    message: {
      ...params.message,
      kind: 'message',
      role: params.message.role === 'ROLE_AGENT' ? 'agent' : 'user',
      parts: params.message.parts.map((part: Record<string, unknown>) => normalizeV1Part(part)),
    },
    configuration: configuration
      ? {
          ...configuration,
          blocking: configuration.returnImmediately === undefined ? undefined : !configuration.returnImmediately,
          pushNotificationConfig: configuration.taskPushNotificationConfig,
        }
      : undefined,
  };
}

function toV1Part(part: any) {
  if (part.kind === 'text') {
    return { text: part.text, metadata: part.metadata };
  }
  if (part.kind === 'file') {
    return 'uri' in part.file
      ? { url: part.file.uri, filename: part.file.name, mediaType: part.file.mimeType, metadata: part.metadata }
      : { raw: part.file.bytes, filename: part.file.name, mediaType: part.file.mimeType, metadata: part.metadata };
  }
  return { data: part.data, metadata: part.metadata };
}

function toV1Message(message: any) {
  if (!message) return undefined;
  return {
    messageId: message.messageId,
    contextId: message.contextId,
    taskId: message.taskId,
    role: message.role === 'agent' ? 'ROLE_AGENT' : 'ROLE_USER',
    parts: message.parts?.map(toV1Part),
    metadata: message.metadata,
    extensions: message.extensions,
    referenceTaskIds: message.referenceTaskIds,
  };
}

function toV1Task(
  task: any,
  { includeArtifacts = true, historyLength }: { includeArtifacts?: boolean; historyLength?: number } = {},
) {
  return {
    id: task.id,
    contextId: task.contextId,
    status: {
      state: V1_TASK_STATES[task.status.state] ?? 'TASK_STATE_UNSPECIFIED',
      message: toV1Message(task.status.message),
      timestamp: task.status.timestamp,
    },
    artifacts: includeArtifacts
      ? task.artifacts?.map((artifact: any) => ({
          artifactId: artifact.artifactId,
          name: artifact.name,
          description: artifact.description,
          parts: artifact.parts?.map(toV1Part),
          metadata: artifact.metadata,
          extensions: artifact.extensions,
        }))
      : undefined,
    history: task.history?.slice(historyLength === undefined ? 0 : -historyLength).map(toV1Message),
    metadata: task.metadata,
  };
}

function toV1Result(result: any, method: string) {
  if (method === 'message/send') {
    return result?.kind === 'message' ? { message: toV1Message(result) } : { task: toV1Task(result) };
  }
  if (method === 'message/stream' || method === 'tasks/resubscribe') {
    if (result?.kind === 'status-update') {
      return {
        statusUpdate: {
          taskId: result.taskId,
          contextId: result.contextId,
          status: {
            state: V1_TASK_STATES[result.status.state] ?? 'TASK_STATE_UNSPECIFIED',
            message: toV1Message(result.status.message),
            timestamp: result.status.timestamp,
          },
          final: result.final,
          metadata: result.metadata,
        },
      };
    }
    if (result?.kind === 'artifact-update') {
      return {
        artifactUpdate: {
          taskId: result.taskId,
          contextId: result.contextId,
          artifact: {
            ...result.artifact,
            parts: result.artifact.parts?.map(toV1Part),
          },
          append: result.append,
          lastChunk: result.lastChunk,
          metadata: result.metadata,
        },
      };
    }
    return result?.kind === 'message' ? { message: toV1Message(result) } : { task: toV1Task(result) };
  }
  if (method === 'tasks/get' || method === 'tasks/cancel') {
    return toV1Task(result);
  }
  return result;
}

function convertV1Response(response: any, method: string) {
  if (!response || !('result' in response)) return response;
  return { ...response, result: toV1Result(response.result, method) };
}

async function* convertV1Stream(stream: AsyncIterable<any>, method: string) {
  for await (const response of stream) {
    yield convertV1Response(response, method);
  }
}

function createAgentCardDefaults({
  pushNotifications = false,
}: {
  pushNotifications?: boolean;
} = {}): Pick<
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
      pushNotifications,
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
  pushNotifications = false,
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
  pushNotifications?: boolean;
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

  const signing = mastra.getServer?.()?.a2a?.agentCardSigning;
  if (!signing) {
    return agentCard;
  }

  return signAgentCard({
    agentCard,
    signing,
  });
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

/**
 * Task metadata keys that store the resume bookkeeping for a suspended agent
 * run so a follow-up message for an `input-required` task can resume it.
 */
const SUSPENDED_RUN_ID_METADATA_KEY = 'suspendedRunId';
const SUSPENDED_TOOL_CALL_ID_METADATA_KEY = 'suspendedToolCallId';
const SUSPENDED_REQUIRES_APPROVAL_METADATA_KEY = 'suspendedRequiresApproval';

function toJsonSafe(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

/**
 * Builds the `input-required` status update for a suspended agent run.
 * The status message carries a human-readable prompt plus a data part with
 * the structured suspend payload and resume schema so A2A clients can
 * render/collect the required input (HITL per the A2A spec).
 */
function createInputRequiredStatusUpdate({
  taskId,
  contextId,
  suspendPayload,
  resumeSchema,
  logger,
}: {
  taskId: string;
  contextId: string;
  suspendPayload?: unknown;
  resumeSchema?: unknown;
  logger?: IMastraLogger;
}): Omit<TaskStatus, 'timestamp'> {
  // Suspension payloads are `{ toolCallId, toolName, suspendPayload, ... }`
  // where the nested `suspendPayload` is the tool's own suspend() data. Use a
  // `message` string from either level as the human-readable prompt.
  const extractMessage = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const messageValue = (value as { message?: unknown }).message;
    return typeof messageValue === 'string' && messageValue.length > 0 ? messageValue : undefined;
  };
  const promptText =
    extractMessage(suspendPayload) ??
    extractMessage((suspendPayload as { suspendPayload?: unknown } | undefined)?.suspendPayload) ??
    'Additional input is required to continue this task.';

  const safeSuspendPayload = toJsonSafe(suspendPayload);
  const safeResumeSchema = toJsonSafe(resumeSchema);
  if (suspendPayload !== undefined && safeSuspendPayload === undefined) {
    logger?.warn(`[Task ${taskId}] Suspend payload is not JSON-serializable and was omitted from the status message.`);
  }
  if (resumeSchema !== undefined && safeResumeSchema === undefined) {
    logger?.warn(`[Task ${taskId}] Resume schema is not JSON-serializable and was omitted from the status message.`);
  }
  const data: Record<string, unknown> = {
    ...(safeSuspendPayload !== undefined ? { suspendPayload: safeSuspendPayload } : {}),
    ...(safeResumeSchema !== undefined ? { resumeSchema: safeResumeSchema } : {}),
  };

  return {
    state: 'input-required',
    message: {
      messageId: crypto.randomUUID(),
      kind: 'message',
      role: 'agent',
      taskId,
      contextId,
      parts: [
        { kind: 'text', text: promptText },
        ...(Object.keys(data).length > 0 ? [{ kind: 'data' as const, data }] : []),
      ],
    },
  };
}

/**
 * Extracts resume data from a follow-up message for an `input-required` task.
 * Prefers a structured data part; falls back to parsing the text as JSON
 * (the Mastra A2A client serializes structured resume data as JSON text),
 * and finally to the raw text.
 */
function extractResumeData(message: MessageSendParams['message']): unknown {
  const dataPart = message.parts.find(part => part.kind === 'data');
  if (dataPart && 'data' in dataPart) {
    return dataPart.data;
  }

  const text = message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { kind: 'text' }> => part.kind === 'text')
    .map(part => part.text)
    .join('\n')
    .trim();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getSuspendedRunId(task: Task | undefined | null): string | undefined {
  const value = task?.metadata?.[SUSPENDED_RUN_ID_METADATA_KEY];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Approval suspensions (`requireApproval`) carry `{ toolCallId, toolName, args, resumeSchema }`
 * without a nested `suspendPayload`, while `suspend()` suspensions include one
 * (see `ToolCallApprovalPayload` / `ToolCallSuspendedPayload` in @mastra/core).
 */
function isApprovalSuspension(suspendPayload: unknown): boolean {
  if (!suspendPayload || typeof suspendPayload !== 'object') {
    return false;
  }

  const payload = suspendPayload as { toolCallId?: unknown; suspendPayload?: unknown };
  return typeof payload.toolCallId === 'string' && payload.suspendPayload === undefined;
}

const APPROVAL_AFFIRMATIVE_PATTERN = /^(y|yes|approve|approved|ok|okay|confirm|confirmed|true)[.!]?$/i;
const APPROVAL_NEGATIVE_PATTERN = /^(n|no|decline|declined|deny|denied|reject|rejected|false)[.!]?$/i;

/**
 * Approval resumes are driven by `resumeData.approved` in the agentic loop, so
 * plain-text replies from A2A clients ("yes", "no") are coerced to the
 * `{ approved }` shape. Unrecognized values pass through unchanged.
 */
function normalizeResumeData(resumeData: unknown, requiresApproval: boolean): unknown {
  if (!requiresApproval || typeof resumeData !== 'string') {
    return resumeData;
  }

  const text = resumeData.trim();
  if (APPROVAL_AFFIRMATIVE_PATTERN.test(text)) {
    return { approved: true };
  }
  if (APPROVAL_NEGATIVE_PATTERN.test(text)) {
    return { approved: false };
  }

  return resumeData;
}

/**
 * Marks a task `input-required` for a suspended agent run and records the
 * resume bookkeeping (runId, toolCallId, approval flag) in task metadata.
 * Shared by the send and stream paths so both report identical suspensions.
 */
function applySuspensionToTask({
  task,
  suspendPayload,
  resumeSchema,
  runId,
  logger,
}: {
  task: Task;
  suspendPayload?: unknown;
  resumeSchema?: unknown;
  runId: string;
  logger?: IMastraLogger;
}): Task {
  const nextTask = applyUpdateToTask(
    task,
    createInputRequiredStatusUpdate({
      taskId: task.id,
      contextId: task.contextId,
      suspendPayload,
      resumeSchema,
      logger,
    }),
  );

  const payload = suspendPayload as { toolCallId?: unknown } | undefined;
  nextTask.metadata = {
    ...clearSuspensionMetadata(nextTask.metadata),
    [SUSPENDED_RUN_ID_METADATA_KEY]: runId,
    ...(typeof payload?.toolCallId === 'string' ? { [SUSPENDED_TOOL_CALL_ID_METADATA_KEY]: payload.toolCallId } : {}),
    ...(isApprovalSuspension(suspendPayload) ? { [SUSPENDED_REQUIRES_APPROVAL_METADATA_KEY]: true } : {}),
  };

  return nextTask;
}

/** Removes the suspension bookkeeping from task metadata once the run completes. */
function clearSuspensionMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  const {
    [SUSPENDED_RUN_ID_METADATA_KEY]: _runId,
    [SUSPENDED_TOOL_CALL_ID_METADATA_KEY]: _toolCallId,
    [SUSPENDED_REQUIRES_APPROVAL_METADATA_KEY]: _requiresApproval,
    ...rest
  } = metadata ?? {};
  return rest;
}

interface ResumeClaim {
  runId: string;
  toolCallId?: string;
  requiresApproval: boolean;
}

/**
 * Claims an interrupted task for resume by transitioning it to `working`.
 * `loadWithVersion` and the body of `InMemoryTaskStore.save` both execute
 * synchronously, so two concurrent follow-up messages cannot both claim (and
 * double-resume) the same suspended run.
 */
async function claimInterruptedTaskResume({
  taskStore,
  agentId,
  taskId,
}: {
  taskStore: InMemoryTaskStore;
  agentId: string;
  taskId: string;
}): Promise<ResumeClaim | undefined> {
  const snapshot = taskStore.loadWithVersion({ agentId, taskId });
  if (snapshot?.task.status.state !== 'input-required' && snapshot?.task.status.state !== 'auth-required') {
    return undefined;
  }

  const task = snapshot.task;
  const toolCallId = task.metadata?.[SUSPENDED_TOOL_CALL_ID_METADATA_KEY];
  const claim: ResumeClaim = {
    runId: getSuspendedRunId(task) ?? taskId,
    ...(typeof toolCallId === 'string' ? { toolCallId } : {}),
    requiresApproval: task.metadata?.[SUSPENDED_REQUIRES_APPROVAL_METADATA_KEY] === true,
  };

  try {
    await taskStore.save({
      agentId,
      data: applyUpdateToTask(task, { state: 'working' }),
      expectedVersion: snapshot.version,
    });
  } catch (error) {
    if (error instanceof TaskStoreVersionConflictError) {
      return undefined;
    }
    throw error;
  }

  return claim;
}

async function waitForClaimedResume({
  taskStore,
  agentId,
  taskId,
}: {
  taskStore: InMemoryTaskStore;
  agentId: string;
  taskId: string;
}): Promise<Task> {
  let snapshot = taskStore.loadWithVersion({ agentId, taskId });
  if (!snapshot) {
    throw MastraA2AError.taskNotFound(taskId);
  }

  while (snapshot.task.status.state === 'working') {
    snapshot = await taskStore.waitForNextUpdate({
      agentId,
      taskId,
      afterVersion: snapshot.version,
    });
  }

  return snapshot.task;
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
  const pushTriggerStates: TaskState[] = [
    'completed',
    'failed',
    'canceled',
    'rejected',
    'input-required',
    'auth-required',
  ];

  if (!pushTriggerStates.includes(nextTask.status.state)) {
    return false;
  }

  return previousTask?.status.state !== nextTask.status.state;
}

function createLinkedAbortController(abortSignal?: AbortSignal) {
  const controller = new AbortController();

  if (!abortSignal) {
    return { controller, cleanup: () => {} };
  }

  const abortFromSignal = () => {
    if (!controller.signal.aborted) {
      controller.abort(abortSignal.reason);
    }
  };

  if (abortSignal.aborted) {
    abortFromSignal();
  } else {
    abortSignal.addEventListener('abort', abortFromSignal, { once: true });
  }

  return {
    controller,
    cleanup: () => abortSignal.removeEventListener('abort', abortFromSignal),
  };
}

async function saveTaskAndMaybeSendPushNotification({
  taskStore,
  pushNotificationSender,
  previousTask,
  nextTask,
  agentId,
  expectedVersion,
  logger,
}: {
  taskStore: InMemoryTaskStore;
  pushNotificationSender: DefaultPushNotificationSender;
  previousTask?: Task;
  nextTask: Task;
  agentId: string;
  expectedVersion?: number;
  logger?: IMastraLogger;
}): Promise<Task> {
  const storedTask = await taskStore.save({ agentId, data: nextTask, expectedVersion, skipIfCanceled: true });

  if (storedTask.status.state === 'canceled' && nextTask.status.state !== 'canceled') {
    return storedTask;
  }

  if (!shouldSendPushNotification(previousTask, storedTask)) {
    return storedTask;
  }

  void pushNotificationSender
    .sendNotifications({
      agentId,
      task: storedTask,
      logger,
    })
    .catch(error => {
      logger?.error('Failed to schedule A2A push notification', error);
    });

  return storedTask;
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

function isSuspensionChunk(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }

  const type = (value as { type: string }).type;
  return type === 'tool-call-suspended' || type === 'tool-call-approval';
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
  resume,
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
  resume?: ResumeClaim;
}) {
  const { contextId } = message;

  try {
    // Pass contextId as threadId for memory persistence across A2A conversations
    // Allow user to pass resourceId via metadata, fall back to agentId
    const resourceId = (metadata?.resourceId as string) ?? (message.metadata?.resourceId as string) ?? agentId;
    const result = resume
      ? await agent.resumeGenerate(normalizeResumeData(extractResumeData(message), resume.requiresApproval), {
          runId: resume.runId,
          ...(resume.toolCallId ? { toolCallId: resume.toolCallId } : {}),
          requestContext,
        })
      : await agent.generate([convertToCoreMessage(message)], {
          runId: currentData.id,
          requestContext,
          ...(contextId ? { threadId: contextId, resourceId } : {}),
        });

    const latestTask = await taskStore.load({ agentId, taskId: currentData.id });
    if (latestTask?.status.state === 'canceled') {
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

    // Agent suspensions (tool approval, suspend()) surface as the A2A
    // `input-required` state so clients can provide the missing input and
    // continue the task (HITL per the A2A spec).
    if (result.finishReason === 'suspended') {
      const previousTask = currentData;
      currentData = applySuspensionToTask({
        task: currentData,
        suspendPayload: result.suspendPayload,
        resumeSchema: result.resumeSchema,
        runId: result.runId ?? currentData.id,
        logger,
      });

      await saveTaskAndMaybeSendPushNotification({
        taskStore,
        pushNotificationSender,
        previousTask,
        nextTask: currentData,
        agentId,
        logger,
      });

      return createSuccessResponse(requestId, currentData);
    }

    const previousTask = currentData;
    currentData = applyUpdateToTask(currentData, {
      state: 'completed',
      message: undefined,
    });

    // Store execution details in task metadata
    currentData.metadata = {
      ...clearSuspensionMetadata(currentData.metadata),
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
    if (latestTask?.status.state === 'canceled') {
      return createSuccessResponse(requestId, latestTask);
    }
    currentData = latestTask ?? currentData;

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
  const existingTask = taskStore.loadWithVersion({ agentId, taskId })?.task;
  if (message.taskId && !existingTask) {
    throw MastraA2AError.taskNotFound(message.taskId);
  }
  if (params.configuration?.blocking === false && existingTask?.status.state === 'working') {
    return createSuccessResponse(requestId, existingTask);
  }

  if (existingTask?.status.state === 'working' && getSuspendedRunId(existingTask)) {
    const task = await waitForClaimedResume({ taskStore, agentId, taskId });
    return createSuccessResponse(requestId, task);
  }

  // A follow-up message for an interrupted task resumes the suspended agent
  // run instead of starting a fresh generation (A2A HITL continuation).
  // The claim transitions the task to `working` synchronously so concurrent
  // follow-ups cannot double-resume the same run.
  const wasInterrupted = isInterruptedTaskState(existingTask?.status.state);
  const resume = await claimInterruptedTaskResume({ taskStore, agentId, taskId });
  if (wasInterrupted && !resume) {
    const task = await waitForClaimedResume({ taskStore, agentId, taskId });
    return createSuccessResponse(requestId, task);
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
    state: 'working',
    message: {
      messageId: crypto.randomUUID(),
      kind: 'message',
      role: 'agent',
      parts: [{ kind: 'text', text: 'Generating response...' }],
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
    resume,
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

export function handleTaskList({
  requestId,
  taskStore,
  agentId,
  params,
}: {
  requestId: number | string;
  taskStore: InMemoryTaskStore;
  agentId: string;
  params: Record<string, any>;
}) {
  const requestedPageSize = params.pageSize ?? 50;
  const offset = params.pageToken ? Number.parseInt(params.pageToken, 10) : 0;
  const start = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const status =
    typeof params.status === 'string'
      ? params.status
          .replace(/^TASK_STATE_/, '')
          .toLowerCase()
          .replaceAll('_', '-')
      : undefined;
  const timestampAfter = params.statusTimestampAfter ? Date.parse(params.statusTimestampAfter) : undefined;

  const matchingTasks = taskStore
    .list({ agentId })
    .filter(task => !params.contextId || task.contextId === params.contextId)
    .filter(task => !status || task.status.state === status)
    .filter(
      task =>
        !timestampAfter || (task.status.timestamp !== undefined && Date.parse(task.status.timestamp) >= timestampAfter),
    );
  const tasks = matchingTasks.slice(start, start + requestedPageSize).map(task =>
    toV1Task(task, {
      includeArtifacts: params.includeArtifacts ?? false,
      historyLength: params.historyLength,
    }),
  );
  const nextOffset = start + tasks.length;

  return createSuccessResponse(requestId, {
    tasks,
    nextPageToken: nextOffset < matchingTasks.length ? String(nextOffset) : '',
    pageSize: requestedPageSize,
    totalSize: matchingTasks.length,
  });
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
  abortSignal,
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
  abortSignal?: AbortSignal;
}) {
  validateMessageSendParams(params);

  const { message, metadata } = params;
  const { contextId } = message;
  const taskId = message.taskId || crypto.randomUUID();
  if (message.taskId && !taskStore.loadWithVersion({ agentId, taskId })) {
    throw MastraA2AError.taskNotFound(message.taskId);
  }

  // A follow-up message for an interrupted task resumes the suspended agent
  // run instead of starting a fresh generation (A2A HITL continuation).
  // The claim transitions the task to `working` synchronously so concurrent
  // follow-ups cannot double-resume the same run.
  const resume = await claimInterruptedTaskResume({ taskStore, agentId, taskId });

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
    state: 'working',
    message: {
      messageId: crypto.randomUUID(),
      kind: 'message',
      role: 'agent',
      parts: [{ kind: 'text', text: 'Generating response...' }],
    },
  });

  await saveTaskAndMaybeSendPushNotification({
    taskStore,
    pushNotificationSender: resolvedPushNotificationSender,
    nextTask: currentData,
    agentId,
    logger,
  });

  const { controller: taskAbortController, cleanup: cleanupLinkedAbortController } =
    createLinkedAbortController(abortSignal);
  const unregisterTaskAbortController = taskStore.registerAbortController({
    agentId,
    taskId,
    controller: taskAbortController,
  });

  try {
    yield createSuccessResponse(requestId, currentData);

    const resourceId = (metadata?.resourceId as string) ?? (message.metadata?.resourceId as string) ?? agentId;
    const result = resume
      ? await agent.resumeStream(normalizeResumeData(extractResumeData(message), resume.requiresApproval), {
          runId: resume.runId,
          ...(resume.toolCallId ? { toolCallId: resume.toolCallId } : {}),
          requestContext,
          abortSignal: taskAbortController.signal,
        })
      : await agent.stream([convertToCoreMessage(message)], {
          runId: taskId,
          requestContext,
          abortSignal: taskAbortController.signal,
          ...(contextId ? { threadId: contextId, resourceId } : {}),
        });
    let sawTextArtifact = false;
    let pendingTextChunk: string | undefined;
    let structuredData: Record<string, unknown> | undefined;
    let suspended = false;
    let streamCanceled = false;

    for await (const chunk of result.fullStream) {
      if (taskAbortController.signal.aborted) {
        const latestTask = await taskStore.load({ agentId, taskId: currentData.id });
        if (latestTask) {
          currentData = latestTask;
        }
        streamCanceled = true;
        break;
      }

      if (isSuspensionChunk(chunk)) {
        suspended = true;
        continue;
      }

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
        currentData = await saveTaskAndMaybeSendPushNotification({
          taskStore,
          pushNotificationSender: resolvedPushNotificationSender,
          nextTask: currentData,
          agentId,
          logger,
        });
        if (currentData.status.state === 'canceled') {
          streamCanceled = true;
          break;
        }
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

    if (!streamCanceled && taskAbortController.signal.aborted) {
      const latestTask = await taskStore.load({ agentId, taskId: currentData.id });
      if (latestTask) {
        currentData = latestTask;
      }
      streamCanceled = true;
    }

    if (streamCanceled && abortSignal?.aborted && currentData.status.state !== 'canceled') {
      const previousTask = currentData;
      currentData = applyUpdateToTask(currentData, {
        state: 'canceled',
        message: {
          messageId: crypto.randomUUID(),
          role: 'agent',
          parts: [{ kind: 'text', text: 'Task canceled because the request was aborted.' }],
          kind: 'message',
        },
      });
      currentData = await saveTaskAndMaybeSendPushNotification({
        taskStore,
        pushNotificationSender: resolvedPushNotificationSender,
        previousTask,
        nextTask: currentData,
        agentId,
        logger,
      });
    }

    if (!streamCanceled && suspended) {
      // Agent suspensions (tool approval, suspend()) surface as the A2A
      // `input-required` state so clients can provide the missing input and
      // continue the task (HITL per the A2A spec). Skip the completed path
      // and avoid awaiting result promises that only settle on completion.
      if (pendingTextChunk) {
        const textUpdate = createTextChunkArtifactUpdate({
          taskId: currentData.id,
          contextId: currentData.contextId,
          text: pendingTextChunk,
          append: sawTextArtifact,
          lastChunk: true,
        });

        currentData = applyUpdateToTask(currentData, textUpdate);
        currentData = await saveTaskAndMaybeSendPushNotification({
          taskStore,
          pushNotificationSender: resolvedPushNotificationSender,
          nextTask: currentData,
          agentId,
          logger,
        });
        if (currentData.status.state === 'canceled') {
          streamCanceled = true;
        } else {
          yield createSuccessResponse(requestId, textUpdate);
        }
      }

      const suspensionTask = currentData;
      currentData = applySuspensionToTask({
        task: currentData,
        suspendPayload: await result.suspendPayload,
        resumeSchema: await result.resumeSchema,
        runId: result.runId ?? currentData.id,
        logger,
      });

      currentData = await saveTaskAndMaybeSendPushNotification({
        taskStore,
        pushNotificationSender: resolvedPushNotificationSender,
        previousTask: suspensionTask,
        nextTask: currentData,
        agentId,
        logger,
      });
      if (currentData.status.state === 'canceled') {
        streamCanceled = true;
      }
    }

    if (!streamCanceled && !suspended) {
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
        currentData = await saveTaskAndMaybeSendPushNotification({
          taskStore,
          pushNotificationSender: resolvedPushNotificationSender,
          nextTask: currentData,
          agentId,
          logger,
        });
        if (currentData.status.state === 'canceled') {
          streamCanceled = true;
        } else {
          yield createSuccessResponse(requestId, textUpdate);
        }

        sawTextArtifact = true;
        pendingTextChunk = undefined;
      }

      if (!streamCanceled && structuredData) {
        const dataUpdate = createDataArtifactUpdate({
          taskId: currentData.id,
          contextId: currentData.contextId,
          data: structuredData,
          lastChunk: true,
        });

        currentData = applyUpdateToTask(currentData, dataUpdate);
        currentData = await saveTaskAndMaybeSendPushNotification({
          taskStore,
          pushNotificationSender: resolvedPushNotificationSender,
          nextTask: currentData,
          agentId,
          logger,
        });
        if (currentData.status.state === 'canceled') {
          streamCanceled = true;
        } else {
          yield createSuccessResponse(requestId, dataUpdate);
        }
      }

      if (!streamCanceled) {
        const previousTask = currentData;
        const completedTask = applyUpdateToTask(currentData, {
          state: 'completed',
          message: undefined,
        });

        completedTask.metadata = {
          ...clearSuspensionMetadata(completedTask.metadata),
          execution: {
            toolCalls: await result.toolCalls,
            toolResults: await result.toolResults,
            usage: await result.usage,
            finishReason: await result.finishReason,
          },
        };

        currentData = await saveTaskAndMaybeSendPushNotification({
          taskStore,
          pushNotificationSender: resolvedPushNotificationSender,
          previousTask,
          nextTask: completedTask,
          agentId,
          logger,
        });
      }
    }
  } catch (handlerError) {
    const latestTask = await taskStore.load({ agentId, taskId: currentData.id });
    if (latestTask?.status.state === 'canceled') {
      currentData = latestTask;
    } else if (taskAbortController.signal.aborted) {
      currentData = latestTask ?? currentData;
      if (abortSignal?.aborted) {
        const previousTask = currentData;
        currentData = applyUpdateToTask(currentData, {
          state: 'canceled',
          message: {
            messageId: crypto.randomUUID(),
            role: 'agent',
            parts: [{ kind: 'text', text: 'Task canceled because the request was aborted.' }],
            kind: 'message',
          },
        });

        try {
          currentData = await saveTaskAndMaybeSendPushNotification({
            taskStore,
            pushNotificationSender: resolvedPushNotificationSender,
            previousTask,
            nextTask: currentData,
            agentId,
            logger,
          });
        } catch (saveError) {
          // @ts-expect-error saveError is an unknown error
          logger?.error(`Failed to save task ${currentData.id} after request abort:`, saveError?.message);
        }
      }
    } else {
      currentData = latestTask ?? currentData;
      const previousTask = currentData;
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
        currentData = await saveTaskAndMaybeSendPushNotification({
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
  } finally {
    unregisterTaskAbortController();
    cleanupLinkedAbortController();
  }

  const latestTask = await taskStore.load({ agentId, taskId: currentData.id });
  if (latestTask?.status.state === 'canceled') {
    currentData = latestTask;
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

  // Interrupted states produce no further updates until the client sends a
  // follow-up message, so the event stream ends here.
  if (isTerminalTaskState(snapshot.task.status.state) || isInterruptedTaskState(snapshot.task.status.state)) {
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

    const nextState = nextUpdate.task.status.state;
    const streamEnded = isTerminalTaskState(nextState) || isInterruptedTaskState(nextState);

    if (didTaskStatusChange(task, nextUpdate.task)) {
      yield createSuccessResponse(requestId, {
        kind: 'status-update',
        taskId: nextUpdate.task.id,
        contextId: nextUpdate.task.contextId,
        status: nextUpdate.task.status,
        final: streamEnded,
      });
    }

    if (streamEnded) {
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
  for (let attempt = 0; attempt < 2; attempt++) {
    const snapshot = taskStore.loadWithVersion({ agentId, taskId });
    const data = snapshot?.task;

    if (!data) {
      throw MastraA2AError.taskNotFound(taskId);
    }

    if (isTerminalTaskState(data.status.state)) {
      logger?.info(`Task ${taskId} already in final state ${data.status.state}, cannot cancel.`);
      throw MastraA2AError.taskNotCancelable(taskId);
    }

    taskStore.activeCancellations.add(taskId);
    taskStore.abortTask({
      agentId,
      taskId,
      reason: new DOMException('Task cancelled by request.', 'AbortError'),
    });

    const cancelUpdate: Omit<TaskStatus, 'timestamp'> = {
      state: 'canceled',
      message: {
        role: 'agent',
        parts: [{ kind: 'text', text: 'Task cancelled by request.' }],
        kind: 'message',
        messageId: crypto.randomUUID(),
      },
    };
    const canceledTask = applyUpdateToTask(data, cancelUpdate);

    try {
      await saveTaskAndMaybeSendPushNotification({
        taskStore,
        pushNotificationSender: resolvePushNotificationPair({ pushNotificationSender }).pushNotificationSender,
        previousTask: data,
        nextTask: canceledTask,
        agentId,
        expectedVersion: snapshot.version,
        logger,
      });
      return createSuccessResponse(requestId, canceledTask);
    } catch (error) {
      if (!(error instanceof TaskStoreVersionConflictError)) {
        throw error;
      }
    } finally {
      taskStore.activeCancellations.delete(taskId);
    }
  }

  throw MastraA2AError.invalidRequest(`Task ${taskId} was updated concurrently. Retry the request.`);
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
  protocolVersion = '0.3',
}: Context & {
  requestId: number | string;
  requestContext: RequestContext;
  agentId: string;
  method:
    | 'message/send'
    | 'message/stream'
    | 'tasks/get'
    | 'tasks/list'
    | 'tasks/cancel'
    | 'tasks/resubscribe'
    | 'tasks/pushNotificationConfig/set'
    | 'tasks/pushNotificationConfig/get'
    | 'tasks/pushNotificationConfig/list'
    | 'tasks/pushNotificationConfig/delete'
    | 'agent/getAuthenticatedExtendedCard';
  params?: MessageSendParams | TaskQueryParams | TaskIdParams | Record<string, unknown>;
  taskStore: InMemoryTaskStore;
  pushNotificationStore?: InMemoryPushNotificationStore;
  pushNotificationSender?: DefaultPushNotificationSender;
  logger?: IMastraLogger;
  abortSignal?: AbortSignal;
  protocolVersion?: A2AProtocolVersion;
}): Promise<any> {
  const agent = await getAgentFromSystem({ mastra, agentId });
  const protocolParams = protocolVersion === '1.0' ? normalizeV1Params(params) : params;
  const {
    pushNotificationStore: resolvedPushNotificationStore,
    pushNotificationSender: resolvedPushNotificationSender,
  } = resolvePushNotificationPair({
    pushNotificationStore,
    pushNotificationSender,
  });

  let taskId: string | undefined; // For error context

  try {
    taskId = getTaskIdFromParams(protocolParams);

    // 2. Route based on method
    switch (method) {
      case 'message/send': {
        const result = await handleMessageSend({
          requestId,
          params: protocolParams as MessageSendParams,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          pushNotificationSender: resolvedPushNotificationSender,
          agent,
          agentId,
          logger,
          requestContext,
        });
        return protocolVersion === '1.0' ? convertV1Response(result, method) : result;
      }
      case 'message/stream': {
        const result = await handleMessageStream({
          requestId,
          taskStore,
          params: protocolParams as MessageSendParams,
          pushNotificationStore: resolvedPushNotificationStore,
          pushNotificationSender: resolvedPushNotificationSender,
          agent,
          agentId,
          logger,
          requestContext,
          abortSignal,
        });
        return protocolVersion === '1.0' ? convertV1Stream(result, method) : result;
      }

      case 'tasks/get': {
        const result = await handleTaskGet({
          requestId,
          taskStore,
          agentId,
          taskId: taskId || 'No task ID provided',
        });

        return protocolVersion === '1.0' ? convertV1Response(result, method) : result;
      }
      case 'tasks/list': {
        if (protocolVersion !== '1.0') {
          throw MastraA2AError.methodNotFound(method);
        }
        return handleTaskList({
          requestId,
          taskStore,
          agentId,
          params: protocolParams ?? {},
        });
      }
      case 'tasks/cancel': {
        const result = await handleTaskCancel({
          requestId,
          taskStore,
          pushNotificationSender: resolvedPushNotificationSender,
          agentId,
          taskId: taskId || 'No task ID provided',
          logger,
        });

        return protocolVersion === '1.0' ? convertV1Response(result, method) : result;
      }
      case 'tasks/resubscribe': {
        const result = handleTaskResubscribe({
          requestId,
          taskStore,
          agentId,
          taskId: taskId || 'No task ID provided',
          abortSignal,
        });
        return protocolVersion === '1.0' ? convertV1Stream(result, method) : result;
      }
      case 'tasks/pushNotificationConfig/set':
        return await handleSetTaskPushNotificationConfig({
          requestId,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          agentId,
          params: params as unknown as TaskPushNotificationConfig,
        });
      case 'tasks/pushNotificationConfig/get':
        return await handleGetTaskPushNotificationConfig({
          requestId,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          agentId,
          params: params as GetTaskPushNotificationConfigParams,
        });
      case 'tasks/pushNotificationConfig/list':
        return await handleListTaskPushNotificationConfig({
          requestId,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          agentId,
          params: params as ListTaskPushNotificationConfigParams,
        });
      case 'tasks/pushNotificationConfig/delete':
        return await handleDeleteTaskPushNotificationConfig({
          requestId,
          taskStore,
          pushNotificationStore: resolvedPushNotificationStore,
          agentId,
          params: params as DeleteTaskPushNotificationConfigParams,
        });
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

export type A2AProtocolVersion = '0.3' | '1.0';

export function resolveA2AProtocolVersion(request?: Request): A2AProtocolVersion {
  const version = request?.headers.get('A2A-Version')?.trim();

  if (!version || version === '0.3') {
    return '0.3';
  }

  if (version === '1.0') {
    return '1.0';
  }

  throw MastraA2AError.versionNotSupported(version);
}

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
      pushNotifications: true,
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

    let protocolVersion: A2AProtocolVersion;
    try {
      protocolVersion = resolveA2AProtocolVersion(request);
    } catch (error) {
      return createA2AJsonResponse(normalizeError(error, requestId));
    }

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

    if (method === 'message/stream' || method === 'tasks/resubscribe') {
      return createA2ASSEResponse(result);
    }

    return createA2AJsonResponse(result);
  },
});
