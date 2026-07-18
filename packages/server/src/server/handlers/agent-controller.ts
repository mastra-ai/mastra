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
  options?: { tags?: Record<string, string>; scope?: string },
  requestContext?: RequestContext,
): Promise<Session<any>> {
  await controller.init();
  const { tags, scope } = options ?? {};
  // Scoped sessions are independent sessions over the same resource (e.g. one
  // per git worktree), so qualify the stable session id with the scope to keep
  // their identities distinct as well.
  const id = scope ? `${resourceId}::${scope}` : resourceId;
  return controller.createSession({ resourceId, id, ownerId: controller.id, tags, scope, requestContext });
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
const toolApprovalBodySchema = z.object({
  toolCallId: z.string(),
  approved: z.boolean(),
  requestContext: bodyRequestContextSchema,
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
const renameThreadBodySchema = z.object({ title: z.string() });
const threadPathParams = z.object({ controllerId: z.string(), resourceId: z.string(), threadId: z.string() });
const cloneThreadBodySchema = z.object({
  sourceThreadId: z.string().optional(),
  title: z.string().optional(),
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
  thinkingLevel: z.enum(['off', 'low', 'medium', 'high', 'xhigh']),
  notifications: z.enum(['off', 'bell', 'system', 'both']),
  smartEditing: z.boolean(),
});
const sessionStateResponseSchema = z.object({
  controllerId: z.string(),
  resourceId: z.string(),
  threadId: z.string().optional(),
  modeId: z.string(),
  modelId: z.string(),
  /** Whether the agent is currently executing a run (for initial UI hydration). */
  running: z.boolean().optional(),
  omProgress: omProgressSummarySchema.optional(),
  tokenUsage: z.record(z.string(), z.unknown()).optional(),
  settings: sessionSettingsSchema.optional(),
});
const listModesResponseSchema = z.object({
  modes: z.array(z.object({ id: z.string(), name: z.string().optional() })),
});
const listThreadsResponseSchema = z.object({
  threads: z.array(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      updatedAt: z.string().optional(),
      /** The session scoping tags stamped on this thread (e.g. `{ projectPath }`). */
      tags: z.record(z.string(), z.string()).optional(),
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
      useCount: z.number(),
    }),
  ),
});
const workspaceStatusResponseSchema = z.object({
  hasWorkspace: z.boolean(),
  isReady: z.boolean(),
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
  handler: async ({ mastra, controllerId, resourceId, sessionScope, tags, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { tags, scope: sessionScope }, requestContext);
      return {
        controllerId,
        resourceId,
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
 */
function toWireEvent(event: unknown): unknown {
  if (
    typeof event === 'object' &&
    event !== null &&
    (event as { type?: unknown }).type === 'error' &&
    (event as { error?: unknown }).error instanceof Error
  ) {
    const error = (event as { error: Error }).error;
    return { ...event, error: { name: error.name, message: error.message } };
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
              controller.enqueue(toWireEvent(event));
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
      void session.sendMessage({ content: message, files, requestContext });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error sending controller message');
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
  handler: async ({ mastra, controllerId, resourceId, sessionScope, toolCallId, approved, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      // Resolve the parked approval gate so the session's own run loop drives the
      // continuation and emits its events to subscribers (the open SSE stream).
      // Calling approveToolCall/declineToolCall directly would bypass the gate,
      // leaving the run loop hung and duplicating the resumed stream.
      // Pass toolCallId so a stale request cannot resolve a different pending gate.
      session.respondToToolApproval({ toolCallId, decision: approved ? 'approve' : 'decline', requestContext });
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
      await session.respondToToolSuspension({ toolCallId, resumeData, requestContext });
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
      void session.steer({ content: message, requestContext });
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
      const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
        allowed.includes(value as T) ? (value as T) : fallback;
      return {
        controllerId,
        resourceId,
        threadId: session.thread.getId() ?? undefined,
        modeId: session.mode.get(),
        modelId: session.model.get(),
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
          thinkingLevel: oneOf(st.thinkingLevel, ['off', 'low', 'medium', 'high', 'xhigh'] as const, 'off'),
          notifications: oneOf(st.notifications, ['off', 'bell', 'system', 'both'] as const, 'off'),
          smartEditing: st.smartEditing !== false,
        },
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
        modes: controller.listModes().map(mode => ({ id: mode.id, name: mode.name })),
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
  handler: async ({ mastra, controllerId, resourceId, sessionScope, limit, tags, requestContext }) => {
    try {
      const controller = getAgentControllerOrThrow(mastra, controllerId);
      const session = await getSession(controller, resourceId, { scope: sessionScope }, requestContext);
      const threads = await session.thread.list();
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
            tags: Object.keys(threadTags).length > 0 ? threadTags : undefined,
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
      void session.followUp({ content: message, requestContext });
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
