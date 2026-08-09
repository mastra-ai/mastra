import type { Agent } from '@mastra/core/agent';
import type { AgentController, Session } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
// Type-only import: erased at runtime, so this cannot crash against an older
// @mastra/core that lacks the `./agent-controller` subpath export. Controller
// resolution at runtime goes through mastra.getAgentController?.(), never a
// value import.
import { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

/**
 * AgentController session routes.
 *
 * An AgentController registered on a Mastra instance (via
 * `new Mastra({ agentControllers })`) exposes its sessions over HTTP so
 * non-terminal clients — e.g. a browser-based MastraCode — can create sessions,
 * send messages, stream events, and drive run-control. Each route resolves its
 * target AgentController by id, then operates on a session bound to a
 * `resourceId` (get-or-create, so reconnects resume rather than fork the
 * conversation).
 */

/**
 * Internal thread-metadata keys that `Session.loadMetadata()` reads back as
 * runtime bookkeeping (selected model/mode, observer/reflector config, token
 * usage). They share the flat thread `metadata` bag with user-provided session
 * scoping tags, so they must never be treated as tags here.
 *
 * Mirrors core's `isReservedThreadMetadataKey`; kept local because importing the
 * value from `@mastra/core` would exceed this package's peer-dependency floor.
 */
function isReservedThreadMetadataKey(key: string): boolean {
  return (
    key === 'currentModelId' ||
    key === 'currentModeId' ||
    key === 'observerModelId' ||
    key === 'reflectorModelId' ||
    key === 'observationThreshold' ||
    key === 'reflectionThreshold' ||
    key === 'tokenUsage' ||
    key === 'subagentModelId' ||
    key.startsWith('subagentModelId_') ||
    key.startsWith('modeModelId_')
  );
}

/**
 * Resolves a controller by id via the canonical `mastra.getAgentController`
 * accessor, throwing a 404 if no controller is registered under that id.
 */
function getAgentControllerOrThrow(
  mastra: {
    getAgentController?: (id: string) => AgentController<any> | undefined;
  },
  controllerId: string,
): AgentController<any> {
  const controller = mastra.getAgentController?.(controllerId);
  if (!controller) {
    throw new HTTPException(404, { message: `agent controller "${controllerId}" not found` });
  }
  return controller;
}

async function getSession(
  controller: AgentController<any>,
  resourceId: string,
  options?: { tags?: Record<string, string>; scope?: string; threadId?: string },
  requestContext?: RequestContext,
): Promise<Session<any>> {
  await controller.init();
  const { tags, scope, threadId } = options ?? {};
  // Scoped sessions are independent sessions over the same resource (e.g. one
  // per git worktree), so qualify the stable session id with the scope to keep
  // their identities distinct as well. An exact thread binding doubles as the
  // stable session id when supplied.
  const id = threadId ?? (scope ? `${resourceId}::${scope}` : resourceId);
  return controller.createSession({ resourceId, id, ownerId: controller.id, tags, scope, threadId, requestContext });
}

function ownDetachedSessionTask(session: Session<any>, task: Promise<unknown>): void {
  void task.catch(error => {
    session.emit({
      type: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    });
  });
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const controllerIdPathParams = z.object({ controllerId: z.string() });
const sessionPathParams = z.object({ controllerId: z.string(), resourceId: z.string() });
/**
 * Optional session scope (mirrors `AgentController.createSession`'s `scope`):
 * requests with the same resourceId but different scopes address independent
 * sessions (e.g. one per git worktree). Sent as a `sessionScope` query param
 * on session routes; named to avoid colliding with the model-switch `scope`.
 */
const sessionScopeQuerySchema = z.object({ sessionScope: z.string().optional() });

const createSessionBodySchema = z.object({
  resourceId: z.string(),
  tags: z.record(z.string(), z.string()).optional(),
  threadId: z.string().optional(),
  sessionScope: z.string().optional(),
});
// Server-side attachment limits mirroring the web composer caps (10MB per
// file, 20MB total), adjusted for base64 overhead (~4/3x).
const MAX_FILE_DATA_LENGTH = 14 * 1024 * 1024;
const MAX_TOTAL_FILE_DATA_LENGTH = 28 * 1024 * 1024;
/**
 * Optional client-supplied request context, merged into the server-derived
 * request context by the adapter context middleware (reserved keys are
 * server-controlled). Declared on run-triggering body schemas so the OpenAPI
 * spec documents it.
 */
const bodyRequestContextSchema = z.record(z.string(), z.unknown()).optional();

const sendMessageBodySchema = z.object({
  message: z.string(),
  requestContext: bodyRequestContextSchema,
  // Optional attachments (e.g. pasted images). `data` is base64-encoded.
  files: z
    .array(
      z.object({
        data: z.string().max(MAX_FILE_DATA_LENGTH),
        mediaType: z.string(),
        filename: z.string().optional(),
      }),
    )
    .max(20)
    .refine(files => files.reduce((total, file) => total + file.data.length, 0) <= MAX_TOTAL_FILE_DATA_LENGTH, {
      message: 'Total attachment size exceeds limit',
    })
    .optional(),
});
const steerBodySchema = z.object({ message: z.string(), requestContext: bodyRequestContextSchema });
const signalAttributesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]),
);
const sendSignalBodySchema = z.object({
  id: z.string().optional(),
  content: z.union([
    z.string(),
    z.array(
      z.union([
        z.object({ type: z.literal('text'), text: z.string() }).passthrough(),
        z
          .object({
            type: z.literal('file'),
            data: z.string(),
            mediaType: z.string(),
            filename: z.string().optional(),
          })
          .passthrough(),
      ]),
    ),
  ]),
  ifActive: z.object({ attributes: signalAttributesSchema.optional() }).optional(),
  ifIdle: z.object({ attributes: signalAttributesSchema.optional() }).optional(),
  requestContext: bodyRequestContextSchema,
});
const sendSignalResponseSchema = z.object({
  id: z.string(),
  accepted: z.literal(true),
  runId: z.string().optional(),
  action: z.string().optional(),
});
const toolApprovalBodySchema = z
  .object({
    toolCallId: z.string(),
    approved: z.boolean().optional(),
    decision: z.enum(['approve', 'decline', 'always_allow_category']).optional(),
    declineContext: z.object({ reason: z.string().optional(), message: z.string().optional() }).optional(),
    requestContext: bodyRequestContextSchema,
  })
  .refine(value => value.approved !== undefined || value.decision !== undefined, {
    message: 'approved or decision is required',
  });
const toolSuspensionBodySchema = z.object({
  toolCallId: z.string(),
  // Free-form resume payload. For ask_user this is a string (or string[] for
  // multi-select); for submit_plan it's `{ action, feedback? }`; for
  // request_access it's "Yes"/"No".
  resumeData: z.unknown(),
  requestContext: bodyRequestContextSchema,
});
const switchModeBodySchema = z.object({ modeId: z.string() });
const switchModelBodySchema = z.object({
  modelId: z.string(),
  scope: z.enum(['global', 'thread']).optional(),
  modeId: z.string().optional(),
});
const switchThreadBodySchema = z.object({ threadId: z.string() });
const createThreadBodySchema = z.object({ title: z.string().optional() });
const setThreadSettingBodySchema = z.object({ key: z.string().min(1), value: z.unknown() });
const planApprovalBodySchema = z.object({
  toolCallId: z.string().min(1),
  submittedPath: z.string().min(1),
  action: z.enum(['approved', 'rejected']),
  feedback: z.string().optional(),
});
const renameThreadBodySchema = z.object({ title: z.string() });
const threadPathParams = z.object({ controllerId: z.string(), resourceId: z.string(), threadId: z.string() });
const cloneThreadBodySchema = z.object({
  sourceThreadId: z.string().optional(),
  title: z.string().optional(),
});
const cloneThreadToCurrentResourceBodySchema = z.object({
  threadId: z.string(),
  expectedResourceId: z.string(),
  expectedProjectPath: z.string(),
});
const listMessagesQuerySchema = z.object({ limit: z.coerce.number().optional(), sessionScope: z.string().optional() });
/**
 * `tags` arrives as a JSON-encoded object in the query string (query params are
 * flat strings). It scopes the listing to threads whose metadata matches every
 * tag — e.g. `{ projectPath }` so git worktrees sharing a resourceId each see
 * only their own threads. Malformed JSON is treated as "no filter".
 */
const listThreadsQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  sessionScope: z.string().optional(),
  allResources: z
    .enum(['true', 'false'])
    .transform(value => value === 'true')
    .optional(),
  tags: z
    .preprocess(value => {
      if (typeof value !== 'string' || value.length === 0) return undefined;
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }, z.record(z.string(), z.string()).optional())
    .optional(),
});
const followUpBodySchema = z.object({ message: z.string(), requestContext: bodyRequestContextSchema });

const sendNotificationBodySchema = z.object({
  source: z.string(),
  kind: z.string(),
  summary: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  payload: z.unknown().optional(),
  sourceId: z.string().optional(),
  dedupeKey: z.string().optional(),
  coalesceKey: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const listAgentControllersResponseSchema = z.object({
  agentControllers: z.array(z.object({ id: z.string() })),
});
const createSessionResponseSchema = z.object({
  controllerId: z.string(),
  resourceId: z.string(),
  threadId: z.string().optional(),
});
const ackResponseSchema = z.object({ ok: z.boolean() });
/**
 * Status-line relevant slice of the session's observational-memory progress.
 * Mirrors the TUI status line: `msg pending/threshold ↓removal` (the active
 * message window before an observation fires) and `mem observed/reflection
 * ↓savings` (accumulated observations before a reflection fires).
 */
const omProgressSummarySchema = z.object({
  status: z.string(),
  pendingTokens: z.number(),
  threshold: z.number(),
  thresholdPercent: z.number(),
  observationTokens: z.number(),
  reflectionThreshold: z.number(),
  reflectionThresholdPercent: z.number(),
  /** Tokens the next observation will remove from the message window. */
  projectedMessageRemoval: z.number(),
  /** Tokens the next reflection is projected to save. */
  projectedReflectionSavings: z.number(),
});
const sessionSettingsSchema = z.object({
  yolo: z.boolean(),
  /** Session override only — absent when the session inherits a configured default. */
  thinkingLevel: z.enum(['off', 'low', 'medium', 'high', 'xhigh', 'max']).optional(),
  notifications: z.enum(['off', 'bell', 'system', 'both']),
  smartEditing: z.boolean(),
  observerModelId: z.string().optional(),
  reflectorModelId: z.string().optional(),
  observationThreshold: z.number().optional(),
  reflectionThreshold: z.number().optional(),
  cavemanObservations: z.boolean().optional(),
  observeAttachments: z.union([z.literal('auto'), z.boolean()]).optional(),
  subagentModelId: z.string().optional(),
  subagentModels: z.record(z.string(), z.string()).optional(),
  projectPath: z.string().optional(),
  configDir: z.string().optional(),
  pluginCommandPaths: z.array(z.string()).optional(),
  escapeAsCancel: z.boolean().optional(),
  tasks: z.array(z.unknown()).optional(),
  activePlan: z.unknown().optional(),
});
const sessionStateResponseSchema = z.object({
  controllerId: z.string(),
  resourceId: z.string(),
  threadId: z.string().optional(),
  modeId: z.string(),
  modelId: z.string(),
  runId: z.string().optional(),
  traceId: z.string().optional(),
  grants: z
    .object({
      categories: z.array(z.enum(['read', 'edit', 'execute', 'mcp', 'other'])),
      tools: z.array(z.string()),
    })
    .optional(),
  /** Whether the agent is currently executing a run (for initial UI hydration). */
  running: z.boolean().optional(),
  omProgress: omProgressSummarySchema.optional(),
  tokenUsage: z.record(z.string(), z.unknown()).optional(),
  settings: sessionSettingsSchema.optional(),
  /** Canonical display state with Map fields converted to JSON records. */
  displayState: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(z.unknown()),
});
const listModesResponseSchema = z.object({
  modes: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      metadata: z.object({ color: z.string().optional() }).optional(),
    }),
  ),
});
const listThreadsResponseSchema = z.object({
  threads: z.array(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      resourceId: z.string().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      /** The session scoping tags stamped on this thread (e.g. `{ projectPath }`). */
      tags: z.record(z.string(), z.string()).optional(),
      /** Full server-owned thread metadata used by rich clients for settings and clone provenance. */
      metadata: z.record(z.string(), z.unknown()).optional(),
      /** Whether a run is currently executing on this thread ('active') or not ('idle'). */
      state: z.enum(['active', 'idle']).optional(),
    }),
  ),
});
const threadResponseSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  resourceId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
const messagePartSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();
// Mirrors the persisted `MastraMessageContentV2` shape (AI-SDK-v4 `UIMessage`-style):
// `format: 2` plus a nested `parts` array, with optional companion fields preserved.
const messageContentV2Schema = z
  .object({
    format: z.literal(2),
    parts: z.array(messagePartSchema),
  })
  .passthrough();
const listMessagesResponseSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'system', 'tool', 'signal']),
      content: messageContentV2Schema,
      createdAt: z.string().optional(),
      threadId: z.string().optional(),
      resourceId: z.string().optional(),
      type: z.string().optional(),
    }),
  ),
});
const listModelsResponseSchema = z.object({
  models: z.array(
    z.object({
      id: z.string(),
      provider: z.string(),
      modelName: z.string(),
      hasApiKey: z.boolean(),
      apiKeyEnvVar: z.string().optional(),
      useCount: z.number(),
    }),
  ),
});
const workspaceStatusResponseSchema = z.object({
  hasWorkspace: z.boolean(),
  isReady: z.boolean(),
});
const skillResponseSchema = z.object({
  name: z.string(),
  path: z.string(),
  description: z.string(),
  instructions: z.string(),
  source: z.unknown(),
  references: z.array(z.string()),
  scripts: z.array(z.string()),
  assets: z.array(z.string()),
  license: z.string().optional(),
  compatibility: z.unknown().optional(),
  'user-invocable': z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const omRecordResponseSchema = z.object({
  record: z.unknown().optional(),
});
const permissionPolicyEnum = z.enum(['allow', 'ask', 'deny']);
const toolCategoryEnum = z.enum(['read', 'edit', 'execute', 'mcp', 'other']);
const permissionRulesResponseSchema = z.object({
  categories: z.record(z.string(), permissionPolicyEnum).optional(),
  tools: z.record(z.string(), permissionPolicyEnum).optional(),
});
const setCategoryPermissionBodySchema = z.object({
  category: toolCategoryEnum,
  policy: permissionPolicyEnum,
});
const setToolPermissionBodySchema = z.object({
  toolName: z.string(),
  policy: permissionPolicyEnum,
});
const setOMModelBodySchema = z.object({
  role: z.enum(['observer', 'reflector']),
  modelId: z.string().min(1),
});
const setSubagentModelBodySchema = z.object({
  modelId: z.string().min(1),
  agentType: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const LIST_AGENT_CONTROLLERS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller',
  responseType: 'json' as const,
  responseSchema: listAgentControllersResponseSchema,
  summary: 'List agent controllers',
  description: 'Lists the agent controllers hosted on this Mastra instance.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra }) => {
    try {
      const ids = new Set<string>();
      if (mastra.listAgentControllers) {
        for (const id of Object.keys(mastra.listAgentControllers())) ids.add(id);
      }
      return { agentControllers: Array.from(ids).map(id => ({ id })) };
    } catch (error) {
      return handleError(error, 'error listing agent controllers');
    }
  },
});

export const CREATE_AGENT_CONTROLLER_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions',
  responseType: 'json' as const,
  pathParamSchema: controllerIdPathParams,
  bodySchema: createSessionBodySchema,
  responseSchema: createSessionResponseSchema,
  summary: 'Create or resume a controller session',
  description:
    'Creates a session for the given resourceId, or returns the existing one (get-or-create), so reconnects resume the conversation.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, tags, threadId, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { tags, scope: sessionScope, threadId }, requestContext);
      return {
        controllerId,
        resourceId: session.identity.getResourceId(),
        threadId: session.thread.getId() ?? undefined,
      };
    } catch (error) {
      return handleError(error, 'error creating controller session');
    }
  },
});

/**
 * Session `error` events carry an `Error` instance whose `message`/`name` are
 * non-enumerable, so JSON serialization in the SSE adapter would send
 * `"error": {}` and clients could only render a generic "Error". Flatten the
 * Error into a plain object so the actual failure reaches the client.
 *
 * `display_state_changed` Maps JSON-serialize to `{}`; convert them to plain
 * records so wire clients get the tool state the in-process TUI sees.
 */
function toWireDisplayState(displayState: object): Record<string, unknown> {
  const wireDisplayState: Record<string, unknown> = { ...displayState };
  for (const [key, value] of Object.entries(wireDisplayState)) {
    if (value instanceof Map) wireDisplayState[key] = Object.fromEntries(value);
  }
  return wireDisplayState;
}

function toWireEvent(event: unknown): unknown {
  if (typeof event !== 'object' || event === null) return event;
  const { type } = event as { type?: unknown };
  if (type === 'error' && (event as { error?: unknown }).error instanceof Error) {
    const error = (event as { error: Error }).error;
    return { ...event, error: { name: error.name, message: error.message } };
  }
  if (type === 'display_state_changed') {
    const { displayState } = event as { displayState?: unknown };
    if (typeof displayState !== 'object' || displayState === null) return event;
    return { ...event, displayState: toWireDisplayState(displayState) };
  }
  return event;
}

export const STREAM_AGENT_CONTROLLER_SESSION_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId/stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  sseFlushOnConnect: true,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  summary: 'Stream controller session events',
  description: 'Subscribes to a session\u2019s event bus and streams events to the client over SSE.',
  tags: ['AgentController', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, abortSignal, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);

      let cleanedUp = false;
      let heartbeat: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe: (() => void) | undefined;
      const clearHeartbeat = () => {
        if (heartbeat) {
          clearTimeout(heartbeat);
          heartbeat = undefined;
        }
      };
      const cleanup = (controller?: ReadableStreamDefaultController) => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearHeartbeat();
        unsubscribe?.();
        if (controller) {
          try {
            controller.close();
          } catch {}
        }
      };

      // The stream yields raw event objects plus `:`-prefixed SSE comments
      // (heartbeats); the server adapter frames events and passes comments
      // through verbatim.
      return new ReadableStream<unknown>({
        start(controller) {
          const scheduleHeartbeat = () => {
            if (cleanedUp) return;
            clearHeartbeat();
            heartbeat = setTimeout(() => {
              heartbeat = undefined;
              if (cleanedUp) return;
              try {
                controller.enqueue(': heartbeat\n\n');
              } catch {
                cleanup();
                return;
              }
              scheduleHeartbeat();
            }, 25_000);
          };

          unsubscribe = session.subscribe(event => {
            if (cleanedUp) return;
            try {
              // Enqueue the raw event object. The server adapter is responsible
              // for SSE framing (`data: <json>\n\n`); enqueuing a pre-framed
              // string here would double-encode it.
              const wireEvent = toWireEvent(event);
              controller.enqueue(
                event.type === 'agent_start'
                  ? {
                      ...(wireEvent as Record<string, unknown>),
                      ...(session.getCurrentRunId() ? { runId: session.getCurrentRunId() } : {}),
                      ...(session.run.getTraceId() ? { traceId: session.run.getTraceId() } : {}),
                    }
                  : wireEvent,
              );
              scheduleHeartbeat();
            } catch {
              cleanup();
            }
          });

          const abortCleanup = () => cleanup(controller);
          abortSignal?.addEventListener('abort', abortCleanup, { once: true });
          scheduleHeartbeat();
        },
        cancel() {
          cleanup();
        },
      });
    } catch (error) {
      return handleError(error, 'error streaming controller session');
    }
  },
});

export const SEND_AGENT_CONTROLLER_MESSAGE_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/messages',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: sendMessageBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Send a message to a controller session',
  description: 'Sends a user message to the session. The reply streams as events on the session\u2019s SSE stream.',
  tags: ['AgentController', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, message, files, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      // Forward the server middleware's requestContext so identity injected in
      // `server.middleware` reaches dynamic instructions and tools (same as the
      // plain agent message route).
      ownDetachedSessionTask(session, session.sendMessage({ content: message, files, requestContext }));
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error sending controller message');
    }
  },
});

export const SEND_AGENT_CONTROLLER_SIGNAL_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/signals',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: sendSignalBodySchema,
  responseSchema: sendSignalResponseSchema,
  summary: 'Send a controller user signal',
  description: 'Preserves active/idle delivery attributes and structured text/file parts.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({
    mastra,
    controllerId,
    resourceId,
    sessionScope,
    id,
    content,
    ifActive,
    ifIdle,
    requestContext,
  }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const signal = session.sendSignal({ id, content, ifActive, ifIdle, requestContext }, { requireDelivery: true });
      const accepted = await signal.accepted;
      return { id: signal.id, ...accepted };
    } catch (error) {
      return handleError(error, 'error sending controller signal');
    }
  },
});

export const ABORT_AGENT_CONTROLLER_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/abort',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: ackResponseSchema,
  summary: 'Abort a controller session run',
  description: 'Aborts the in-flight run for the session, if any.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      session.abort();
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error aborting controller session');
    }
  },
});

export const AGENT_CONTROLLER_TOOL_APPROVAL_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/tool-approval',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: toolApprovalBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Respond to a controller tool approval',
  description: 'Approves or declines a pending tool call surfaced by the session.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({
    mastra,
    controllerId,
    resourceId,
    sessionScope,
    toolCallId,
    approved,
    decision,
    declineContext,
    requestContext,
  }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      // Resolve the parked approval gate so the session's own run loop drives the
      // continuation and emits its events to subscribers (the open SSE stream).
      // Calling approveToolCall/declineToolCall directly would bypass the gate,
      // leaving the run loop hung and duplicating the resumed stream.
      // Pass toolCallId so a stale request cannot resolve a different pending gate.
      const accepted = session.respondToToolApproval({
        toolCallId,
        decision: decision ?? (approved ? 'approve' : 'decline'),
        declineContext,
        requestContext,
      });
      if (!accepted) {
        throw new HTTPException(409, { message: 'The requested tool approval is no longer pending' });
      }
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error responding to controller tool approval');
    }
  },
});

export const AGENT_CONTROLLER_TOOL_SUSPENSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/tool-suspension',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: toolSuspensionBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Respond to a suspended controller tool',
  description:
    'Resumes a suspended interactive tool (ask_user, request_access, submit_plan) with the provided resume data.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, toolCallId, resumeData, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const accepted = await session.respondToToolSuspension({ toolCallId, resumeData, requestContext });
      if (!accepted) {
        throw new HTTPException(409, { message: 'The requested tool suspension is no longer pending' });
      }
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error responding to controller tool suspension');
    }
  },
});

export const STEER_AGENT_CONTROLLER_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/steer',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: steerBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Steer the in-flight run',
  description: 'Injects a message into the running turn (interjection) without starting a new run.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, message, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      ownDetachedSessionTask(session, session.steer({ content: message, requestContext }));
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error steering controller session');
    }
  },
});

export const SWITCH_AGENT_CONTROLLER_MODE_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/mode',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: switchModeBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Switch the session mode',
  description: 'Switches the active mode (e.g. build, plan) for the session.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, modeId, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await session.mode.switch({ modeId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error switching controller mode');
    }
  },
});

export const SWITCH_AGENT_CONTROLLER_MODEL_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/model',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: switchModelBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Switch the session model',
  description: 'Switches the model for the session, scoped to the thread by default.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, modelId, scope, modeId, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await session.model.switch({ modelId, scope, modeId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error switching controller model');
    }
  },
});

export const SWITCH_AGENT_CONTROLLER_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/thread',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: switchThreadBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Switch the session thread',
  description: 'Switches the session to an existing thread (rebinding its stream and state).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, threadId, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      if (session.thread.getId() !== threadId) {
        await session.thread.switch({ threadId });
      }
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error switching controller thread');
    }
  },
});

export const DETACH_AGENT_CONTROLLER_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/thread/detach',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: ackResponseSchema,
  summary: 'Detach the active controller thread',
  description: 'Clears the session thread binding without deleting the thread.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      session.thread.detachFromCurrent();
      await session.thread.clearAndReleaseLock();
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error detaching controller thread');
    }
  },
});

export const SET_AGENT_CONTROLLER_THREAD_SETTING_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:controllerId/sessions/:resourceId/thread/setting',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: setThreadSettingBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Set active thread metadata',
  description: 'Persists one rich-client setting in the active thread metadata.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, key, value, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await session.thread.setSetting({ key, value });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting controller thread metadata');
    }
  },
});

export const RESPOND_AGENT_CONTROLLER_PLAN_APPROVAL_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/plan-approval',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: planApprovalBodySchema,
  responseSchema: z.object({ title: z.string(), plan: z.string() }),
  summary: 'Respond to a submitted plan',
  description: 'Reads, optionally archives, and resumes a submit_plan suspension on the server host.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext, ...input }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const pending = session.suspensions.get({ toolCallId: input.toolCallId });
      if (pending?.toolName !== 'submit_plan') {
        throw new HTTPException(409, { message: 'The requested plan approval is no longer pending' });
      }
      return await controller.respondToPlanApproval(session, input);
    } catch (error) {
      return handleError(error, 'error responding to submitted plan');
    }
  },
});

export const GET_AGENT_CONTROLLER_SESSION_STATE_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: sessionStateResponseSchema,
  summary: 'Get session state',
  description: 'Returns the current mode, model, and thread for the session (for initial UI hydration).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const ds = session.displayState.get();
      const om = ds.omProgress;
      const reflectionSavings =
        om.buffered.reflection.inputObservationTokens - om.buffered.reflection.observationTokens;
      const st = session.state.get() as Record<string, unknown>;
      const threadId = session.thread.getId() ?? undefined;
      const messages = threadId ? await session.thread.listMessages({ threadId }) : [];
      const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
        allowed.includes(value as T) ? (value as T) : fallback;
      const oneOfOptional = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
        allowed.includes(value as T) ? (value as T) : undefined;
      return {
        controllerId,
        resourceId: session.identity.getResourceId(),
        threadId,
        modeId: session.mode.get(),
        modelId: session.model.get(),
        runId: session.getCurrentRunId() ?? undefined,
        traceId: session.run.getTraceId() ?? undefined,
        grants: session.getGrants(),
        running: ds.isRunning === true,
        omProgress: {
          status: om.status,
          pendingTokens: om.pendingTokens,
          threshold: om.threshold,
          thresholdPercent: om.thresholdPercent,
          observationTokens: om.observationTokens,
          reflectionThreshold: om.reflectionThreshold,
          reflectionThresholdPercent: om.reflectionThresholdPercent,
          projectedMessageRemoval: om.buffered.observations.projectedMessageRemoval,
          projectedReflectionSavings: reflectionSavings > 0 ? reflectionSavings : 0,
        },
        tokenUsage: ds.tokenUsage as unknown as Record<string, unknown>,
        settings: {
          yolo: st.yolo === true,
          // No session override → omit, so clients don't mistake an inherited
          // configured default (resolved at request time) for an explicit 'off'.
          thinkingLevel: oneOfOptional(st.thinkingLevel, ['off', 'low', 'medium', 'high', 'xhigh', 'max'] as const),
          notifications: oneOf(st.notifications, ['off', 'bell', 'system', 'both'] as const, 'off'),
          smartEditing: st.smartEditing !== false,
          observerModelId: typeof st.observerModelId === 'string' ? st.observerModelId : undefined,
          reflectorModelId: typeof st.reflectorModelId === 'string' ? st.reflectorModelId : undefined,
          observationThreshold: typeof st.observationThreshold === 'number' ? st.observationThreshold : undefined,
          reflectionThreshold: typeof st.reflectionThreshold === 'number' ? st.reflectionThreshold : undefined,
          cavemanObservations: typeof st.cavemanObservations === 'boolean' ? st.cavemanObservations : undefined,
          observeAttachments:
            st.observeAttachments === 'auto'
              ? ('auto' as const)
              : typeof st.observeAttachments === 'boolean'
                ? st.observeAttachments
                : undefined,
          subagentModelId: typeof st.subagentModelId === 'string' ? st.subagentModelId : undefined,
          subagentModels: Object.fromEntries(
            Object.entries(st)
              .filter(([key, value]) => key.startsWith('subagentModelId_') && typeof value === 'string')
              .map(([key, value]) => [key.slice('subagentModelId_'.length), value as string]),
          ),
          projectPath: typeof st.projectPath === 'string' ? st.projectPath : undefined,
          configDir: typeof st.configDir === 'string' ? st.configDir : undefined,
          pluginCommandPaths: Array.isArray(st.pluginCommandPaths)
            ? st.pluginCommandPaths.filter((value): value is string => typeof value === 'string')
            : undefined,
          escapeAsCancel: typeof st.escapeAsCancel === 'boolean' ? st.escapeAsCancel : undefined,
          tasks: Array.isArray(st.tasks) ? st.tasks : undefined,
          activePlan: st.activePlan,
        },
        displayState: toWireDisplayState(ds),
        messages,
      };
    } catch (error) {
      return handleError(error, 'error reading controller session state');
    }
  },
});

export const LIST_AGENT_CONTROLLER_MODES_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/modes',
  responseType: 'json' as const,
  pathParamSchema: controllerIdPathParams,
  responseSchema: listModesResponseSchema,
  summary: 'List controller modes',
  description: 'Lists the modes configured on the controller (e.g. build, plan).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      return {
        modes: controller.listModes().map(mode => ({
          id: mode.id,
          name: mode.name,
          description: mode.description,
          metadata: typeof mode.metadata?.color === 'string' ? { color: mode.metadata.color } : undefined,
        })),
      };
    } catch (error) {
      return handleError(error, 'error listing controller modes');
    }
  },
});

export const LIST_AGENT_CONTROLLER_THREADS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId/threads',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: listThreadsQuerySchema,
  responseSchema: listThreadsResponseSchema,
  summary: 'List session threads',
  description:
    'Lists the threads for the session\u2019s resource, most-recently-updated first. Pass `limit` to return only the newest N (e.g. for a sidebar). Pass `tags` (a JSON-encoded object) to scope the list to threads matching every tag \u2014 e.g. `{ projectPath }` so git worktrees sharing a resourceId each see only their own threads.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, limit, tags, allResources, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const threads = await session.thread.list({
        allResources,
        ...(tags ? { metadata: tags } : {}),
      });
      // A thread's metadata mixes the session scoping tags (stamped at creation,
      // e.g. `projectPath`) with internal session bookkeeping that
      // `Session.loadMetadata()` reads back (selected model/mode, observer/
      // reflector config, token usage). Return only the string-valued scoping
      // tags, skipping reserved internal keys so they never leak out as "tags"
      // or become matchable via the `tags` filter.
      const getTags = (t: { metadata?: unknown }): Record<string, string> => {
        const metadata = (t.metadata as Record<string, unknown> | undefined) ?? {};
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
          if (typeof value === 'string' && !isReservedThreadMetadataKey(key)) result[key] = value;
        }
        return result;
      };
      // A single resourceId can be shared across git worktrees of the same repo
      // (the id is derived from the git URL). When tags are supplied, scope to
      // threads whose metadata matches every tag and drop the rest, so worktree A
      // never shows worktree B's threads. Mirrors the controller's tag-aware
      // selection and the TUI's worktree-strict listing. Reserved internal keys
      // are ignored as filter tags so callers can't match on session bookkeeping.
      const tagEntries = tags ? Object.entries(tags).filter(([key]) => !isReservedThreadMetadataKey(key)) : [];
      const scoped =
        tagEntries.length > 0
          ? threads.filter(t => {
              const metadata = (t.metadata as Record<string, unknown> | undefined) ?? {};
              return tagEntries.every(([key, value]) => metadata[key] === value);
            })
          : threads;
      const toTime = (t: { updatedAt?: Date; createdAt?: Date }) => (t.updatedAt ?? t.createdAt)?.getTime() ?? 0;
      const sorted = [...scoped].sort((a, b) => toTime(b) - toTime(a));
      const max = Number(limit);
      const limited = Number.isFinite(max) && max > 0 ? sorted.slice(0, max) : sorted;
      // Thread run state comes from the agent thread-stream runtime (the same
      // per-thread active/idle tracking the signals `ifIdle` path uses). It is
      // keyed by resourceId + threadId, so it covers runs started by any
      // session on this resource — including sessions scoped to other git
      // worktrees — letting one listing report activity across all of them.
      const agent = controller.getCurrentAgent(session);
      return {
        threads: limited.map(t => {
          const threadTags = getTags(t);
          return {
            id: t.id,
            title: t.title,
            resourceId: t.resourceId,
            tags: Object.keys(threadTags).length > 0 ? threadTags : undefined,
            metadata: t.metadata,
            createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : undefined,
            updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : undefined,
            state: agent.getActiveThreadRunId({ resourceId, threadId: t.id }) ? ('active' as const) : ('idle' as const),
          };
        }),
      };
    } catch (error) {
      return handleError(error, 'error listing controller threads');
    }
  },
});

export const SEND_AGENT_CONTROLLER_NOTIFICATION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/notifications',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: sendNotificationBodySchema,
  responseSchema: z.object({
    accepted: z.boolean(),
    notificationId: z.string().optional(),
    decision: z.string().optional(),
    runId: z.string().optional(),
  }),
  summary: 'Send a notification signal to a session',
  description:
    'Delivers a notification to the session\u2019s current agent/thread. The agent\u2019s delivery policy determines whether the notification wakes an idle thread, is summarised, or is persisted for later.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({
    mastra,
    controllerId,
    resourceId,
    sessionScope,
    source,
    kind,
    summary,
    priority,
    payload,
    sourceId,
    dedupeKey,
    coalesceKey,
    attributes,
    metadata,
    requestContext,
  }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const result = await session.sendNotificationSignal({
        source,
        kind,
        summary,
        priority,
        payload,
        sourceId,
        dedupeKey,
        coalesceKey,
        attributes: attributes as Record<string, string | number | boolean | null | undefined> | undefined,
        metadata,
      });
      return {
        accepted: result.accepted !== undefined,
        notificationId: result.record?.id,
        decision: result.decision?.action,
        runId: result.runId,
      };
    } catch (error) {
      return handleError(error, 'error sending controller notification');
    }
  },
});

// ---------------------------------------------------------------------------
// Thread lifecycle
// ---------------------------------------------------------------------------

export const CREATE_AGENT_CONTROLLER_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/threads',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: createThreadBodySchema,
  responseSchema: threadResponseSchema,
  summary: 'Create a new thread',
  description: 'Creates a new thread in the session (unbinds the previous thread, binds the new one).',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, title, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const thread = await session.thread.create({ title });
      return {
        id: thread.id,
        title: thread.title,
        resourceId: thread.resourceId,
        createdAt: thread.createdAt instanceof Date ? thread.createdAt.toISOString() : undefined,
        updatedAt: thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : undefined,
      };
    } catch (error) {
      return handleError(error, 'error creating controller thread');
    }
  },
});

export const DELETE_AGENT_CONTROLLER_THREAD_ROUTE = createRoute({
  method: 'DELETE',
  path: '/agent-controller/:controllerId/sessions/:resourceId/threads/:threadId',
  responseType: 'json' as const,
  pathParamSchema: threadPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: ackResponseSchema,
  summary: 'Delete a thread',
  description: 'Deletes a thread. If the deleted thread is the active one, the session is unbound.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, threadId, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await session.thread.delete({ threadId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error deleting controller thread');
    }
  },
});

export const RENAME_AGENT_CONTROLLER_THREAD_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:controllerId/sessions/:resourceId/threads/:threadId',
  responseType: 'json' as const,
  pathParamSchema: threadPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: renameThreadBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Rename a thread',
  description: 'Renames the specified thread.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, threadId, title, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      // Ensure the thread is the active one (switch if not)
      if (session.thread.getId() !== threadId) {
        await session.thread.switch({ threadId });
      }
      await session.thread.rename({ title });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error renaming controller thread');
    }
  },
});

export const CLONE_AGENT_CONTROLLER_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/threads/clone',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: cloneThreadBodySchema,
  responseSchema: threadResponseSchema,
  summary: 'Clone a thread',
  description: 'Clones a thread (and its messages). The session binds to the new clone.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, sourceThreadId, title, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const thread = await session.thread.clone({ sourceThreadId, title });
      return {
        id: thread.id,
        title: thread.title,
        resourceId: thread.resourceId,
        createdAt: thread.createdAt instanceof Date ? thread.createdAt.toISOString() : undefined,
        updatedAt: thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : undefined,
      };
    } catch (error) {
      return handleError(error, 'error cloning controller thread');
    }
  },
});

export const CLONE_AGENT_CONTROLLER_THREAD_TO_CURRENT_RESOURCE_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/threads/clone-to-current-resource',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: cloneThreadToCurrentResourceBodySchema,
  responseSchema: threadResponseSchema,
  summary: 'Clone a cross-resource project thread',
  description: 'Validates project identity and clones a thread from another resource into the current resource.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({
    mastra,
    controllerId,
    resourceId,
    sessionScope,
    threadId,
    expectedResourceId,
    expectedProjectPath,
    requestContext,
  }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const thread = await session.thread.cloneToCurrentResource({ threadId, expectedResourceId, expectedProjectPath });
      return {
        id: thread.id,
        title: thread.title,
        resourceId: thread.resourceId,
        createdAt: thread.createdAt instanceof Date ? thread.createdAt.toISOString() : undefined,
        updatedAt: thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : undefined,
      };
    } catch (error) {
      return handleError(error, 'error cloning controller thread into current resource');
    }
  },
});

export const LIST_AGENT_CONTROLLER_THREAD_MESSAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId/threads/:threadId/messages',
  responseType: 'json' as const,
  pathParamSchema: threadPathParams,
  queryParamSchema: listMessagesQuerySchema,
  responseSchema: listMessagesResponseSchema,
  summary: 'List thread messages',
  description: 'Lists messages for a specific thread. Returns most recent messages first.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, threadId, limit, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const messages = await session.thread.listMessages({ threadId, limit });
      return {
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content as { format: 2; parts: Array<{ type: string; [key: string]: unknown }> },
          createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : undefined,
          threadId: m.threadId,
          resourceId: m.resourceId,
          type: m.type,
        })),
      };
    } catch (error) {
      return handleError(error, 'error listing controller thread messages');
    }
  },
});

// ---------------------------------------------------------------------------
// Follow-up
// ---------------------------------------------------------------------------

export const FOLLOW_UP_AGENT_CONTROLLER_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/follow-up',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: followUpBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Queue a follow-up message',
  description:
    'Queues a follow-up message. If the session is idle it sends immediately; if a run is active it queues for after completion.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, message, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      ownDetachedSessionTask(session, session.followUp({ content: message, requestContext }));
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error queuing controller follow-up');
    }
  },
});

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export const LIST_AGENT_CONTROLLER_MODELS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/models',
  responseType: 'json' as const,
  pathParamSchema: controllerIdPathParams,
  responseSchema: listModelsResponseSchema,
  summary: 'List available models',
  description: 'Lists all models available on this controller (with auth status and use counts).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      await controller.init();
      const models = await controller.listAvailableModels();
      return {
        models: models.map(m => ({
          id: m.id,
          provider: m.provider,
          modelName: m.modelName,
          hasApiKey: m.hasApiKey,
          apiKeyEnvVar: m.apiKeyEnvVar,
          useCount: m.useCount,
        })),
      };
    } catch (error) {
      return handleError(error, 'error listing controller models');
    }
  },
});

// ---------------------------------------------------------------------------
// Workspace status
// ---------------------------------------------------------------------------

export const GET_AGENT_CONTROLLER_WORKSPACE_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/workspace',
  responseType: 'json' as const,
  pathParamSchema: controllerIdPathParams,
  responseSchema: workspaceStatusResponseSchema,
  summary: 'Get workspace status',
  description: 'Returns whether the controller has a workspace configured and whether it is ready.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      await controller.init();
      return {
        hasWorkspace: controller.hasWorkspace(),
        isReady: controller.isWorkspaceReady(),
      };
    } catch (error) {
      return handleError(error, 'error reading controller workspace status');
    }
  },
});

export const LIST_AGENT_CONTROLLER_SKILLS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId/skills',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: z.object({ skills: z.array(skillResponseSchema) }),
  summary: 'List controller workspace skills',
  description: 'Lists the skills resolved by the server-owned workspace for this session.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const workspace = controller.getWorkspace() ?? (await controller.resolveWorkspace({ session }));
      if (!workspace?.skills) return { skills: [] };
      const skillsManager = workspace.skills;
      const metadata = await skillsManager.list();
      const skills = (await Promise.all(metadata.map(skill => skillsManager.get(skill.path)))).filter(
        skill => skill !== null,
      );
      return { skills };
    } catch (error) {
      return handleError(error, 'error listing controller workspace skills');
    }
  },
});

// ---------------------------------------------------------------------------
// Observational Memory
// ---------------------------------------------------------------------------

export const GET_AGENT_CONTROLLER_OM_RECORD_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId/om',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: omRecordResponseSchema,
  summary: 'Get observational memory record',
  description: 'Returns the current observational memory record for the session\u2019s thread/resource.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const record = await controller.getObservationalMemoryRecord(session);
      return { record: record ?? undefined };
    } catch (error) {
      return handleError(error, 'error reading controller OM record');
    }
  },
});

// ---------------------------------------------------------------------------
// Resource identity
// ---------------------------------------------------------------------------

export const SET_AGENT_CONTROLLER_RESOURCE_ID_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/resource',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: z.object({ newResourceId: z.string() }),
  responseSchema: ackResponseSchema,
  summary: 'Change the session resource ID',
  description: 'Updates the session\u2019s resource identity (e.g. when a user logs in).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, newResourceId, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await controller.setResourceId(session, { resourceId: newResourceId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting controller resource ID');
    }
  },
});

export const GET_AGENT_CONTROLLER_RESOURCE_IDS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId/resources',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: z.object({ resourceIds: z.array(z.string()) }),
  summary: 'Get known resource IDs',
  description: 'Lists the resource IDs known to this session (from threads).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const resourceIds = await controller.getKnownResourceIds(session);
      return { resourceIds };
    } catch (error) {
      return handleError(error, 'error listing controller resource IDs');
    }
  },
});

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

const setGoalBodySchema = z.object({
  objective: z.string(),
  judgeModelId: z.string().optional(),
  maxRuns: z.number().optional(),
});
const updateGoalBodySchema = z.object({
  judgeModelId: z.string().optional(),
  maxRuns: z.number().optional(),
  status: z.enum(['active', 'paused', 'done']).optional(),
  pausedReason: z.string().optional(),
});
const goalRecordSchema = z.object({
  id: z.string().optional(),
  objective: z.string(),
  status: z.enum(['active', 'paused', 'done']),
  runsUsed: z.number(),
  maxRuns: z.number().optional(),
  judgeModelId: z.string().optional(),
  startedAt: z.number(),
  updatedAt: z.number(),
  pausedReason: z.string().optional(),
  activeDurationMs: z.number().optional(),
});
const goalResponseSchema = z.object({ goal: goalRecordSchema.optional() });

function getAgentForSession(controller: AgentController<any>, session: Session<any>): Agent {
  return controller.getCurrentAgent(session);
}

export const GET_AGENT_CONTROLLER_GOAL_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId/goal',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: goalResponseSchema,
  summary: 'Get the current goal',
  description: 'Returns the active/paused/done goal objective for the session\u2019s thread, if any.',
  tags: ['AgentController', 'Goals'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const threadId = session.thread.getId();
      if (!threadId) return { goal: undefined };
      const agent = getAgentForSession(controller, session);
      const record = await agent.getObjective({ threadId });
      return { goal: record ?? undefined };
    } catch (error) {
      return handleError(error, 'error reading controller goal');
    }
  },
});

export const SET_AGENT_CONTROLLER_GOAL_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/goal',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: setGoalBodySchema,
  responseSchema: goalResponseSchema,
  summary: 'Set a goal',
  description:
    'Sets a new objective for the session\u2019s thread. The agent\u2019s in-loop goal judge evaluates progress after each turn.',
  tags: ['AgentController', 'Goals'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({
    mastra,
    controllerId,
    resourceId,
    sessionScope,
    objective,
    judgeModelId,
    maxRuns,
    requestContext,
  }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const threadId = session.thread.getId();
      if (!threadId) throw new HTTPException(400, { message: 'session has no active thread' });
      const agent = getAgentForSession(controller, session);
      const record = await agent.setObjective(objective, {
        threadId,
        resourceId: session.identity.getResourceId(),
        ...(judgeModelId ? { judgeModelId } : {}),
        ...(maxRuns != null ? { maxRuns } : {}),
      });
      return { goal: record ?? undefined };
    } catch (error) {
      return handleError(error, 'error setting controller goal');
    }
  },
});

export const UPDATE_AGENT_CONTROLLER_GOAL_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:controllerId/sessions/:resourceId/goal',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: updateGoalBodySchema,
  responseSchema: goalResponseSchema,
  summary: 'Update goal options',
  description: 'Updates the judge model, max runs, or status of the active goal. No-op when no goal is set.',
  tags: ['AgentController', 'Goals'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({
    mastra,
    controllerId,
    resourceId,
    sessionScope,
    judgeModelId,
    maxRuns,
    status,
    pausedReason,
    requestContext,
  }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const threadId = session.thread.getId();
      if (!threadId) throw new HTTPException(400, { message: 'session has no active thread' });
      const agent = getAgentForSession(controller, session);
      const record = await agent.updateObjectiveOptions({
        threadId,
        ...(judgeModelId !== undefined ? { judgeModelId } : {}),
        ...(maxRuns !== undefined ? { maxRuns } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(pausedReason !== undefined ? { pausedReason } : {}),
      });
      return { goal: record ?? undefined };
    } catch (error) {
      return handleError(error, 'error updating controller goal');
    }
  },
});

export const CLEAR_AGENT_CONTROLLER_GOAL_ROUTE = createRoute({
  method: 'DELETE',
  path: '/agent-controller/:controllerId/sessions/:resourceId/goal',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: ackResponseSchema,
  summary: 'Clear the goal',
  description: 'Removes the active goal from the session\u2019s thread.',
  tags: ['AgentController', 'Goals'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const threadId = session.thread.getId();
      if (!threadId) throw new HTTPException(400, { message: 'session has no active thread' });
      const agent = getAgentForSession(controller, session);
      await agent.clearObjective({ threadId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error clearing controller goal');
    }
  },
});

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const GET_AGENT_CONTROLLER_PERMISSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId/permissions',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  responseSchema: permissionRulesResponseSchema,
  summary: 'Get permission rules',
  description: 'Returns the current permission rules (per-category and per-tool policies) for the session.',
  tags: ['AgentController', 'Permissions'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const rules = session.permissions.getRules();
      return {
        categories: rules.categories as Record<string, 'allow' | 'ask' | 'deny'> | undefined,
        tools: rules.tools as Record<string, 'allow' | 'ask' | 'deny'> | undefined,
      };
    } catch (error) {
      return handleError(error, 'error getting controller permissions');
    }
  },
});

export const SET_AGENT_CONTROLLER_CATEGORY_PERMISSION_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:controllerId/sessions/:resourceId/permissions/category',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: setCategoryPermissionBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Set permission for a tool category',
  description: 'Sets the approval policy (allow/ask/deny) for all tools in a category.',
  tags: ['AgentController', 'Permissions'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, category, policy, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await session.permissions.setForCategory({ category, policy });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting controller category permission');
    }
  },
});

export const SET_AGENT_CONTROLLER_TOOL_PERMISSION_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:controllerId/sessions/:resourceId/permissions/tool',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: setToolPermissionBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Set permission for a specific tool',
  description:
    'Sets the approval policy (allow/ask/deny) for a specific tool by name. Per-tool overrides take precedence over category policies.',
  tags: ['AgentController', 'Permissions'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, toolName, policy, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await session.permissions.setForTool({ toolName, policy });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting controller tool permission');
    }
  },
});

export const SET_AGENT_CONTROLLER_OM_MODEL_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:controllerId/sessions/:resourceId/om/model',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: setOMModelBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Set an observational-memory model',
  description: 'Applies and persists the observer or reflector model on the server-owned session.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, role, modelId, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await session.om[role].switchModel({ modelId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting controller observational-memory model');
    }
  },
});

export const SET_AGENT_CONTROLLER_SUBAGENT_MODEL_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:controllerId/sessions/:resourceId/subagents/model',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: setSubagentModelBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Set a subagent model',
  description: 'Applies and persists the global or agent-type-specific subagent model on the server-owned session.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, modelId, agentType, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await session.subagents.model.set({ modelId, agentType });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting controller subagent model');
    }
  },
});

// ---------------------------------------------------------------------------
// Session State
// ---------------------------------------------------------------------------

const setSessionStateBodySchema = z.object({ state: z.record(z.string(), z.unknown()) });

export const SET_AGENT_CONTROLLER_SESSION_STATE_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:controllerId/sessions/:resourceId/state',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  queryParamSchema: sessionScopeQuerySchema,
  bodySchema: setSessionStateBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Set session state',
  description:
    'Merges the provided key-value pairs into the session state. Existing keys not in the payload are preserved.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, controllerId, resourceId, sessionScope, state, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      await session.state.set(state as Record<string, unknown>);
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting controller session state');
    }
  },
});
