import type { Agent } from '@mastra/core/agent';
import type { MastraFGAPermissionInput } from '@mastra/core/auth/ee';
import type { AgentController, Session } from '@mastra/core/harness';
import { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

/**
 * Harness session routes.
 *
 * A Harness registered on a Mastra instance (via `new Mastra({ harnesses })`)
 * exposes its sessions over HTTP so non-terminal clients — e.g. a browser-based
 * MastraCode — can create sessions, send messages, stream events, and drive
 * run-control. Each route resolves its target Harness by id, then operates on a
 * session bound to a `resourceId` (get-or-create, so reconnects resume rather
 * than fork the conversation).
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
 * Resolves a controller by id. `AgentController` is the canonical surface, so
 * this prefers `mastra.getAgentController` and falls back to the legacy
 * `mastra.getHarness` accessor on a miss. Trying both keeps the server working
 * against an older installed `@mastra/core` that predates the rename, and also
 * covers cases where a controller is only registered under one accessor.
 */
function getHarnessOrThrow(
  mastra: {
    getAgentController?: (id: string) => AgentController<any> | undefined;
    getHarness?: (id: string) => AgentController<any> | undefined;
  },
  harnessId: string,
): AgentController<any> {
  const controller = mastra.getAgentController?.(harnessId) ?? mastra.getHarness?.(harnessId);
  if (!controller) {
    throw new HTTPException(404, { message: `agent controller "${harnessId}" not found` });
  }
  return controller;
}

async function getSession(
  harness: AgentController<any>,
  resourceId: string,
  tags?: Record<string, string>,
): Promise<Session<any>> {
  await harness.init();
  return harness.createSession({ resourceId, id: resourceId, ownerId: harness.id, tags });
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const harnessIdPathParams = z.object({ harnessId: z.string() });
const sessionPathParams = z.object({ harnessId: z.string(), resourceId: z.string() });

const createSessionBodySchema = z.object({
  resourceId: z.string(),
  tags: z.record(z.string(), z.string()).optional(),
});
const sendMessageBodySchema = z.object({ message: z.string() });
const steerBodySchema = z.object({ message: z.string() });
const toolApprovalBodySchema = z.object({
  toolCallId: z.string(),
  approved: z.boolean(),
});
const toolSuspensionBodySchema = z.object({
  toolCallId: z.string(),
  // Free-form resume payload. For ask_user this is a string (or string[] for
  // multi-select); for submit_plan it's `{ action, feedback? }`; for
  // request_access it's "Yes"/"No".
  resumeData: z.any(),
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
const threadPathParams = z.object({ harnessId: z.string(), resourceId: z.string(), threadId: z.string() });
const cloneThreadBodySchema = z.object({
  sourceThreadId: z.string().optional(),
  title: z.string().optional(),
});
const listMessagesQuerySchema = z.object({ limit: z.coerce.number().optional() });
/**
 * `tags` arrives as a JSON-encoded object in the query string (query params are
 * flat strings). It scopes the listing to threads whose metadata matches every
 * tag — e.g. `{ projectPath }` so git worktrees sharing a resourceId each see
 * only their own threads. Malformed JSON is treated as "no filter".
 */
const listThreadsQuerySchema = z.object({
  limit: z.coerce.number().optional(),
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
const followUpBodySchema = z.object({ message: z.string() });

const sendNotificationBodySchema = z.object({
  source: z.string(),
  kind: z.string(),
  summary: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  payload: z.any().optional(),
  sourceId: z.string().optional(),
  dedupeKey: z.string().optional(),
  coalesceKey: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const listHarnessesResponseSchema = z.object({
  harnesses: z.array(z.object({ id: z.string() })),
});
const createSessionResponseSchema = z.object({
  harnessId: z.string(),
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
  harnessId: z.string(),
  resourceId: z.string(),
  threadId: z.string().optional(),
  modeId: z.string(),
  modelId: z.string(),
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
const messageContentSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();
const listMessagesResponseSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.array(messageContentSchema),
      createdAt: z.string().optional(),
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
  record: z.any().optional(),
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

export const LIST_HARNESSES_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller',
  responseType: 'json' as const,
  responseSchema: listHarnessesResponseSchema,
  summary: 'List harnesses',
  description: 'Lists the harnesses hosted on this Mastra instance.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra }) => {
    try {
      const ids = new Set<string>();
      if (mastra.listAgentControllers) {
        for (const id of Object.keys(mastra.listAgentControllers())) ids.add(id);
      }
      if (mastra.listHarnesses) {
        for (const id of Object.keys(mastra.listHarnesses())) ids.add(id);
      }
      return { harnesses: Array.from(ids).map(id => ({ id })) };
    } catch (error) {
      return handleError(error, 'error listing agent controllers');
    }
  },
});

export const CREATE_HARNESS_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions',
  responseType: 'json' as const,
  pathParamSchema: harnessIdPathParams,
  bodySchema: createSessionBodySchema,
  responseSchema: createSessionResponseSchema,
  summary: 'Create or resume a harness session',
  description:
    'Creates a session for the given resourceId, or returns the existing one (get-or-create), so reconnects resume the conversation.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, tags }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId, tags);
      return {
        harnessId,
        resourceId,
        threadId: session.thread.getId() ?? undefined,
      };
    } catch (error) {
      return handleError(error, 'error creating harness session');
    }
  },
});

export const STREAM_HARNESS_SESSION_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/sessions/:resourceId/stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  sseFlushOnConnect: true,
  pathParamSchema: sessionPathParams,
  summary: 'Stream harness session events',
  description: 'Subscribes to a session\u2019s event bus and streams events to the client over SSE.',
  tags: ['AgentController', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId, resourceId, abortSignal }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);

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
              controller.enqueue(event);
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
      return handleError(error, 'error streaming harness session');
    }
  },
});

export const SEND_HARNESS_MESSAGE_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/messages',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: sendMessageBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Send a message to a harness session',
  description: 'Sends a user message to the session. The reply streams as events on the session\u2019s SSE stream.',
  tags: ['AgentController', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, message }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      void session.sendMessage({ content: message });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error sending harness message');
    }
  },
});

export const ABORT_HARNESS_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/abort',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: ackResponseSchema,
  summary: 'Abort a harness session run',
  description: 'Aborts the in-flight run for the session, if any.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      session.abort();
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error aborting harness session');
    }
  },
});

export const HARNESS_TOOL_APPROVAL_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/tool-approval',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: toolApprovalBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Respond to a harness tool approval',
  description: 'Approves or declines a pending tool call surfaced by the session.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, toolCallId, approved }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      // Resolve the parked approval gate so the session's own run loop drives the
      // continuation and emits its events to subscribers (the open SSE stream).
      // Calling approveToolCall/declineToolCall directly would bypass the gate,
      // leaving the run loop hung and duplicating the resumed stream.
      // Pass toolCallId so a stale request cannot resolve a different pending gate.
      session.respondToToolApproval({ toolCallId, decision: approved ? 'approve' : 'decline' });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error responding to harness tool approval');
    }
  },
});

export const HARNESS_TOOL_SUSPENSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/tool-suspension',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: toolSuspensionBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Respond to a suspended harness tool',
  description:
    'Resumes a suspended interactive tool (ask_user, request_access, submit_plan) with the provided resume data.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, toolCallId, resumeData }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      await session.respondToToolSuspension({ toolCallId, resumeData });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error responding to harness tool suspension');
    }
  },
});

export const STEER_HARNESS_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/steer',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: steerBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Steer the in-flight run',
  description: 'Injects a message into the running turn (interjection) without starting a new run.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, message }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      void session.steer({ content: message });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error steering harness session');
    }
  },
});

export const SWITCH_HARNESS_MODE_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/mode',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: switchModeBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Switch the session mode',
  description: 'Switches the active mode (e.g. build, plan) for the session.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, modeId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      await session.mode.switch({ modeId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error switching harness mode');
    }
  },
});

export const SWITCH_HARNESS_MODEL_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/model',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: switchModelBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Switch the session model',
  description: 'Switches the model for the session, scoped to the thread by default.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, modelId, scope, modeId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      await session.model.switch({ modelId, scope, modeId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error switching harness model');
    }
  },
});

export const SWITCH_HARNESS_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/thread',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: switchThreadBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Switch the session thread',
  description: 'Switches the session to an existing thread (rebinding its stream and state).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, threadId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      await session.thread.switch({ threadId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error switching harness thread');
    }
  },
});

export const GET_HARNESS_SESSION_STATE_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/sessions/:resourceId',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: sessionStateResponseSchema,
  summary: 'Get session state',
  description: 'Returns the current mode, model, and thread for the session (for initial UI hydration).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const ds = session.displayState.get();
      const om = ds.omProgress;
      const reflectionSavings =
        om.buffered.reflection.inputObservationTokens - om.buffered.reflection.observationTokens;
      const st = session.state.get() as Record<string, unknown>;
      const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
        allowed.includes(value as T) ? (value as T) : fallback;
      return {
        harnessId,
        resourceId,
        threadId: session.thread.getId() ?? undefined,
        modeId: session.mode.get(),
        modelId: session.model.get(),
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
      return handleError(error, 'error reading harness session state');
    }
  },
});

export const LIST_HARNESS_MODES_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/modes',
  responseType: 'json' as const,
  pathParamSchema: harnessIdPathParams,
  responseSchema: listModesResponseSchema,
  summary: 'List harness modes',
  description: 'Lists the modes configured on the harness (e.g. build, plan).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      return {
        modes: harness.listModes().map(mode => ({ id: mode.id, name: mode.name })),
      };
    } catch (error) {
      return handleError(error, 'error listing harness modes');
    }
  },
});

export const LIST_HARNESS_THREADS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/sessions/:resourceId/threads',
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
  handler: async ({ mastra, harnessId, resourceId, limit, tags }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
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
      // never shows worktree B's threads. Mirrors the harness's tag-aware
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
      return {
        threads: limited.map(t => {
          const threadTags = getTags(t);
          return {
            id: t.id,
            title: t.title,
            tags: Object.keys(threadTags).length > 0 ? threadTags : undefined,
            updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : undefined,
          };
        }),
      };
    } catch (error) {
      return handleError(error, 'error listing harness threads');
    }
  },
});

export const SEND_HARNESS_NOTIFICATION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/notifications',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
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
    harnessId,
    resourceId,
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
  }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
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
      return handleError(error, 'error sending harness notification');
    }
  },
});

// ---------------------------------------------------------------------------
// Thread lifecycle
// ---------------------------------------------------------------------------

export const CREATE_HARNESS_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/threads',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: createThreadBodySchema,
  responseSchema: threadResponseSchema,
  summary: 'Create a new thread',
  description: 'Creates a new thread in the session (unbinds the previous thread, binds the new one).',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, title }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const thread = await session.thread.create({ title });
      return {
        id: thread.id,
        title: thread.title,
        resourceId: thread.resourceId,
        createdAt: thread.createdAt instanceof Date ? thread.createdAt.toISOString() : undefined,
        updatedAt: thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : undefined,
      };
    } catch (error) {
      return handleError(error, 'error creating harness thread');
    }
  },
});

export const DELETE_HARNESS_THREAD_ROUTE = createRoute({
  method: 'DELETE',
  path: '/agent-controller/:harnessId/sessions/:resourceId/threads/:threadId',
  responseType: 'json' as const,
  pathParamSchema: threadPathParams,
  responseSchema: ackResponseSchema,
  summary: 'Delete a thread',
  description: 'Deletes a thread. If the deleted thread is the active one, the session is unbound.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, threadId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      await session.thread.delete({ threadId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error deleting harness thread');
    }
  },
});

export const RENAME_HARNESS_THREAD_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:harnessId/sessions/:resourceId/threads/:threadId',
  responseType: 'json' as const,
  pathParamSchema: threadPathParams,
  bodySchema: renameThreadBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Rename a thread',
  description: 'Renames the specified thread.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, threadId, title }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      // Ensure the thread is the active one (switch if not)
      if (session.thread.getId() !== threadId) {
        await session.thread.switch({ threadId });
      }
      await session.thread.rename({ title });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error renaming harness thread');
    }
  },
});

export const CLONE_HARNESS_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/threads/clone',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: cloneThreadBodySchema,
  responseSchema: threadResponseSchema,
  summary: 'Clone a thread',
  description: 'Clones a thread (and its messages). The session binds to the new clone.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, sourceThreadId, title }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const thread = await session.thread.clone({ sourceThreadId, title });
      return {
        id: thread.id,
        title: thread.title,
        resourceId: thread.resourceId,
        createdAt: thread.createdAt instanceof Date ? thread.createdAt.toISOString() : undefined,
        updatedAt: thread.updatedAt instanceof Date ? thread.updatedAt.toISOString() : undefined,
      };
    } catch (error) {
      return handleError(error, 'error cloning harness thread');
    }
  },
});

export const LIST_HARNESS_THREAD_MESSAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/sessions/:resourceId/threads/:threadId/messages',
  responseType: 'json' as const,
  pathParamSchema: threadPathParams,
  queryParamSchema: listMessagesQuerySchema,
  responseSchema: listMessagesResponseSchema,
  summary: 'List thread messages',
  description: 'Lists messages for a specific thread. Returns most recent messages first.',
  tags: ['AgentController', 'Threads'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId, resourceId, threadId, limit }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const messages = await session.thread.listMessages({ threadId, limit });
      return {
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content as Array<{ type: string; [key: string]: unknown }>,
          createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : undefined,
        })),
      };
    } catch (error) {
      return handleError(error, 'error listing harness thread messages');
    }
  },
});

// ---------------------------------------------------------------------------
// Follow-up
// ---------------------------------------------------------------------------

export const FOLLOW_UP_HARNESS_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/follow-up',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: followUpBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Queue a follow-up message',
  description:
    'Queues a follow-up message. If the session is idle it sends immediately; if a run is active it queues for after completion.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, message }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      void session.followUp({ content: message });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error queuing harness follow-up');
    }
  },
});

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export const LIST_HARNESS_MODELS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/models',
  responseType: 'json' as const,
  pathParamSchema: harnessIdPathParams,
  responseSchema: listModelsResponseSchema,
  summary: 'List available models',
  description: 'Lists all models available on this harness (with auth status and use counts).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      await harness.init();
      const models = await harness.listAvailableModels();
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
      return handleError(error, 'error listing harness models');
    }
  },
});

// ---------------------------------------------------------------------------
// Workspace status
// ---------------------------------------------------------------------------

export const GET_HARNESS_WORKSPACE_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/workspace',
  responseType: 'json' as const,
  pathParamSchema: harnessIdPathParams,
  responseSchema: workspaceStatusResponseSchema,
  summary: 'Get workspace status',
  description: 'Returns whether the harness has a workspace configured and whether it is ready.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      await harness.init();
      return {
        hasWorkspace: harness.hasWorkspace(),
        isReady: harness.isWorkspaceReady(),
      };
    } catch (error) {
      return handleError(error, 'error reading harness workspace status');
    }
  },
});

// ---------------------------------------------------------------------------
// Observational Memory
// ---------------------------------------------------------------------------

export const GET_HARNESS_OM_RECORD_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/sessions/:resourceId/om',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: omRecordResponseSchema,
  summary: 'Get observational memory record',
  description: 'Returns the current observational memory record for the session\u2019s thread/resource.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const record = await harness.getObservationalMemoryRecord(session);
      return { record: record ?? undefined };
    } catch (error) {
      return handleError(error, 'error reading harness OM record');
    }
  },
});

// ---------------------------------------------------------------------------
// Resource identity
// ---------------------------------------------------------------------------

export const SET_HARNESS_RESOURCE_ID_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/resource',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: z.object({ newResourceId: z.string() }),
  responseSchema: ackResponseSchema,
  summary: 'Change the session resource ID',
  description: 'Updates the session\u2019s resource identity (e.g. when a user logs in).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, newResourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      await harness.setResourceId(session, { resourceId: newResourceId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting harness resource ID');
    }
  },
});

export const GET_HARNESS_RESOURCE_IDS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/sessions/:resourceId/resources',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: z.object({ resourceIds: z.array(z.string()) }),
  summary: 'Get known resource IDs',
  description: 'Lists the resource IDs known to this session (from threads).',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const resourceIds = await harness.getKnownResourceIds(session);
      return { resourceIds };
    } catch (error) {
      return handleError(error, 'error listing harness resource IDs');
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

function getAgentForSession(harness: AgentController<any>, session: Session<any>): Agent {
  return harness.getCurrentAgent(session);
}

export const GET_HARNESS_GOAL_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/sessions/:resourceId/goal',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: goalResponseSchema,
  summary: 'Get the current goal',
  description: 'Returns the active/paused/done goal objective for the session\u2019s thread, if any.',
  tags: ['AgentController', 'Goals'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const threadId = session.thread.getId();
      if (!threadId) return { goal: undefined };
      const agent = getAgentForSession(harness, session);
      const record = await agent.getObjective({ threadId });
      return { goal: record ?? undefined };
    } catch (error) {
      return handleError(error, 'error reading harness goal');
    }
  },
});

export const SET_HARNESS_GOAL_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:harnessId/sessions/:resourceId/goal',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: setGoalBodySchema,
  responseSchema: goalResponseSchema,
  summary: 'Set a goal',
  description:
    'Sets a new objective for the session\u2019s thread. The agent\u2019s in-loop goal judge evaluates progress after each turn.',
  tags: ['AgentController', 'Goals'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, objective, judgeModelId, maxRuns }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const threadId = session.thread.getId();
      if (!threadId) throw new HTTPException(400, { message: 'session has no active thread' });
      const agent = getAgentForSession(harness, session);
      const record = await agent.setObjective(objective, {
        threadId,
        resourceId: session.identity.getResourceId(),
        ...(judgeModelId ? { judgeModelId } : {}),
        ...(maxRuns != null ? { maxRuns } : {}),
      });
      return { goal: record ?? undefined };
    } catch (error) {
      return handleError(error, 'error setting harness goal');
    }
  },
});

export const UPDATE_HARNESS_GOAL_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:harnessId/sessions/:resourceId/goal',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: updateGoalBodySchema,
  responseSchema: goalResponseSchema,
  summary: 'Update goal options',
  description: 'Updates the judge model, max runs, or status of the active goal. No-op when no goal is set.',
  tags: ['AgentController', 'Goals'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, judgeModelId, maxRuns, status }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const threadId = session.thread.getId();
      if (!threadId) throw new HTTPException(400, { message: 'session has no active thread' });
      const agent = getAgentForSession(harness, session);
      const record = await agent.updateObjectiveOptions({
        threadId,
        ...(judgeModelId !== undefined ? { judgeModelId } : {}),
        ...(maxRuns !== undefined ? { maxRuns } : {}),
        ...(status !== undefined ? { status } : {}),
      });
      return { goal: record ?? undefined };
    } catch (error) {
      return handleError(error, 'error updating harness goal');
    }
  },
});

export const CLEAR_HARNESS_GOAL_ROUTE = createRoute({
  method: 'DELETE',
  path: '/agent-controller/:harnessId/sessions/:resourceId/goal',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: ackResponseSchema,
  summary: 'Clear the goal',
  description: 'Removes the active goal from the session\u2019s thread.',
  tags: ['AgentController', 'Goals'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const threadId = session.thread.getId();
      if (!threadId) throw new HTTPException(400, { message: 'session has no active thread' });
      const agent = getAgentForSession(harness, session);
      await agent.clearObjective({ threadId });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error clearing harness goal');
    }
  },
});

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const GET_HARNESS_PERMISSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:harnessId/sessions/:resourceId/permissions',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: permissionRulesResponseSchema,
  summary: 'Get permission rules',
  description: 'Returns the current permission rules (per-category and per-tool policies) for the session.',
  tags: ['AgentController', 'Permissions'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const rules = session.permissions.getRules();
      return {
        categories: rules.categories as Record<string, 'allow' | 'ask' | 'deny'> | undefined,
        tools: rules.tools as Record<string, 'allow' | 'ask' | 'deny'> | undefined,
      };
    } catch (error) {
      return handleError(error, 'error getting harness permissions');
    }
  },
});

export const SET_HARNESS_CATEGORY_PERMISSION_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:harnessId/sessions/:resourceId/permissions/category',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: setCategoryPermissionBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Set permission for a tool category',
  description: 'Sets the approval policy (allow/ask/deny) for all tools in a category.',
  tags: ['AgentController', 'Permissions'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, category, policy }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      await session.permissions.setForCategory({ category, policy });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting harness category permission');
    }
  },
});

export const SET_HARNESS_TOOL_PERMISSION_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:harnessId/sessions/:resourceId/permissions/tool',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: setToolPermissionBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Set permission for a specific tool',
  description:
    'Sets the approval policy (allow/ask/deny) for a specific tool by name. Per-tool overrides take precedence over category policies.',
  tags: ['AgentController', 'Permissions'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, toolName, policy }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      await session.permissions.setForTool({ toolName, policy });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting harness tool permission');
    }
  },
});

// ---------------------------------------------------------------------------
// Session State
// ---------------------------------------------------------------------------

const setSessionStateBodySchema = z.object({ state: z.record(z.string(), z.unknown()) });

export const SET_HARNESS_SESSION_STATE_ROUTE = createRoute({
  method: 'PUT',
  path: '/agent-controller/:harnessId/sessions/:resourceId/state',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: setSessionStateBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Set session state',
  description:
    'Merges the provided key-value pairs into the session state. Existing keys not in the payload are preserved.',
  tags: ['AgentController'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async ({ mastra, harnessId, resourceId, state }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      await session.state.set(state as Record<string, unknown>);
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error setting harness session state');
    }
  },
});

// ---------------------------------------------------------------------------
// Agent Controller surface (alias of the Harness surface)
// ---------------------------------------------------------------------------

/**
 * `Harness` was renamed to `AgentController`. The route handlers in this module
 * are the canonical `AgentController` surface — they resolve controllers via the
 * version-safe `getAgentController`-first accessor in `getHarnessOrThrow`.
 *
 * To keep the legacy `/harness/...` API working for backwards compatibility,
 * each canonical route is mirrored: only its metadata is rewritten (path prefix,
 * OpenAPI tag, permission resource). The handler is shared verbatim, so both
 * surfaces resolve through the same canonical accessor.
 */
export function mirrorAgentControllerRouteAsHarness(route: ServerRoute): ServerRoute {
  const rewriteTag = (tag: string): string => (tag === 'AgentController' ? 'Harness' : tag);
  const rewritePermission = (perm: MastraFGAPermissionInput): MastraFGAPermissionInput =>
    typeof perm === 'string' && perm.startsWith('agent-controller:')
      ? (`harness:${perm.slice('agent-controller:'.length)}` as MastraFGAPermissionInput)
      : perm;

  return {
    ...route,
    path: route.path.replace(/^\/agent-controller/, '/harness'),
    openapi: route.openapi ? { ...route.openapi, tags: route.openapi.tags?.map(rewriteTag) } : route.openapi,
    requiresPermission: Array.isArray(route.requiresPermission)
      ? route.requiresPermission.map(rewritePermission)
      : route.requiresPermission !== undefined
        ? rewritePermission(route.requiresPermission)
        : undefined,
  } as ServerRoute;
}
