import type { Harness, Session } from '@mastra/core/harness';
import { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
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

function getHarnessOrThrow(mastra: { getHarness: (id: string) => Harness<any> | undefined }, harnessId: string): Harness<any> {
  const harness = mastra.getHarness(harnessId);
  if (!harness) {
    throw new HTTPException(404, { message: `harness "${harnessId}" not found` });
  }
  return harness;
}

async function getSession(harness: Harness<any>, resourceId: string): Promise<Session<any>> {
  await harness.init();
  return harness.createSession({ resourceId });
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const harnessIdPathParams = z.object({ harnessId: z.string() });
const sessionPathParams = z.object({ harnessId: z.string(), resourceId: z.string() });

const createSessionBodySchema = z.object({ resourceId: z.string() });
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

const listHarnessesResponseSchema = z.object({
  harnesses: z.array(z.object({ id: z.string() })),
});
const createSessionResponseSchema = z.object({
  harnessId: z.string(),
  resourceId: z.string(),
  threadId: z.string().optional(),
});
const ackResponseSchema = z.object({ ok: z.boolean() });
const sessionStateResponseSchema = z.object({
  harnessId: z.string(),
  resourceId: z.string(),
  threadId: z.string().optional(),
  modeId: z.string(),
  modelId: z.string(),
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
    }),
  ),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const LIST_HARNESSES_ROUTE = createRoute({
  method: 'GET',
  path: '/harness',
  responseType: 'json' as const,
  responseSchema: listHarnessesResponseSchema,
  summary: 'List harnesses',
  description: 'Lists the harnesses hosted on this Mastra instance.',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:read',
  handler: async ({ mastra }) => {
    try {
      const harnesses = mastra.listHarnesses();
      return { harnesses: Object.keys(harnesses).map(id => ({ id })) };
    } catch (error) {
      return handleError(error, 'error listing harnesses');
    }
  },
});

export const CREATE_HARNESS_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:harnessId/sessions',
  responseType: 'json' as const,
  pathParamSchema: harnessIdPathParams,
  bodySchema: createSessionBodySchema,
  responseSchema: createSessionResponseSchema,
  summary: 'Create or resume a harness session',
  description:
    'Creates a session for the given resourceId, or returns the existing one (get-or-create), so reconnects resume the conversation.',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:execute',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
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
  path: '/harness/:harnessId/sessions/:resourceId/stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  sseFlushOnConnect: true,
  pathParamSchema: sessionPathParams,
  summary: 'Stream harness session events',
  description: 'Subscribes to a session\u2019s event bus and streams events to the client over SSE.',
  tags: ['Harness', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'harness:read',
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

      return new ReadableStream<string>({
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
              controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
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
  path: '/harness/:harnessId/sessions/:resourceId/messages',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: sendMessageBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Send a message to a harness session',
  description: 'Sends a user message to the session. The reply streams as events on the session\u2019s SSE stream.',
  tags: ['Harness', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'harness:execute',
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
  path: '/harness/:harnessId/sessions/:resourceId/abort',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: ackResponseSchema,
  summary: 'Abort a harness session run',
  description: 'Aborts the in-flight run for the session, if any.',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:execute',
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
  path: '/harness/:harnessId/sessions/:resourceId/tool-approval',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: toolApprovalBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Respond to a harness tool approval',
  description: 'Approves or declines a pending tool call surfaced by the session.',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:execute',
  handler: async ({ mastra, harnessId, resourceId, approved }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      // Resolve the parked approval gate so the session's own run loop drives the
      // continuation and emits its events to subscribers (the open SSE stream).
      // Calling approveToolCall/declineToolCall directly would bypass the gate,
      // leaving the run loop hung and duplicating the resumed stream.
      session.respondToToolApproval({ decision: approved ? 'approve' : 'decline' });
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error responding to harness tool approval');
    }
  },
});

export const HARNESS_TOOL_SUSPENSION_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:harnessId/sessions/:resourceId/tool-suspension',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: toolSuspensionBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Respond to a suspended harness tool',
  description:
    'Resumes a suspended interactive tool (ask_user, request_access, submit_plan) with the provided resume data.',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:execute',
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
  path: '/harness/:harnessId/sessions/:resourceId/steer',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: steerBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Steer the in-flight run',
  description: 'Injects a message into the running turn (interjection) without starting a new run.',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:execute',
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
  path: '/harness/:harnessId/sessions/:resourceId/mode',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: switchModeBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Switch the session mode',
  description: 'Switches the active mode (e.g. build, plan) for the session.',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:execute',
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
  path: '/harness/:harnessId/sessions/:resourceId/model',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: switchModelBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Switch the session model',
  description: 'Switches the model for the session, scoped to the thread by default.',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:execute',
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
  path: '/harness/:harnessId/sessions/:resourceId/thread',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  bodySchema: switchThreadBodySchema,
  responseSchema: ackResponseSchema,
  summary: 'Switch the session thread',
  description: 'Switches the session to an existing thread (rebinding its stream and state).',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:execute',
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
  path: '/harness/:harnessId/sessions/:resourceId',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: sessionStateResponseSchema,
  summary: 'Get session state',
  description: 'Returns the current mode, model, and thread for the session (for initial UI hydration).',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:read',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      return {
        harnessId,
        resourceId,
        threadId: session.thread.getId() ?? undefined,
        modeId: session.mode.get(),
        modelId: session.model.get(),
      };
    } catch (error) {
      return handleError(error, 'error reading harness session state');
    }
  },
});

export const LIST_HARNESS_MODES_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:harnessId/modes',
  responseType: 'json' as const,
  pathParamSchema: harnessIdPathParams,
  responseSchema: listModesResponseSchema,
  summary: 'List harness modes',
  description: 'Lists the modes configured on the harness (e.g. build, plan).',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:read',
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
  path: '/harness/:harnessId/sessions/:resourceId/threads',
  responseType: 'json' as const,
  pathParamSchema: sessionPathParams,
  responseSchema: listThreadsResponseSchema,
  summary: 'List session threads',
  description: 'Lists the threads for the session\u2019s resource.',
  tags: ['Harness'],
  requiresAuth: true,
  requiresPermission: 'harness:read',
  handler: async ({ mastra, harnessId, resourceId }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      const threads = await session.thread.list();
      return {
        threads: threads.map(t => ({
          id: t.id,
          title: t.title,
          updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : undefined,
        })),
      };
    } catch (error) {
      return handleError(error, 'error listing harness threads');
    }
  },
});
