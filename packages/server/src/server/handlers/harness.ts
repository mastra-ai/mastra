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
const toolApprovalBodySchema = z.object({
  toolCallId: z.string(),
  approved: z.boolean(),
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
  handler: async ({ mastra, harnessId, resourceId, toolCallId, approved }) => {
    try {
      const harness = getHarnessOrThrow(mastra, harnessId);
      const session = await getSession(harness, resourceId);
      if (approved) {
        await session.approveToolCall({ toolCallId });
      } else {
        await session.declineToolCall({ toolCallId });
      }
      return { ok: true };
    } catch (error) {
      return handleError(error, 'error responding to harness tool approval');
    }
  },
});
