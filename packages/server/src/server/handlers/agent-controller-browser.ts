import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { BrowserViewerEvent } from '@mastra/core/browser';
import { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getEffectiveResourceId, getEffectiveThreadId } from './utils';

const pathParamSchema = z.object({ controllerId: z.string(), resourceId: z.string() });
const queryParamSchema = z.object({
  sessionScope: z.string().optional(),
  sessionThreadId: z.string().min(1),
  incarnation: z.string().min(1),
});
const preferences = z.object({
  width: z.number().int().min(240).max(3840),
  height: z.number().int().min(160).max(2160),
  deviceScaleFactor: z.number().min(1).max(2),
  locale: z
    .string()
    .min(2)
    .max(64)
    .refine(value => {
      try {
        return Intl.getCanonicalLocales(value).length === 1;
      } catch {
        return false;
      }
    }),
});
export const browserViewerCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('preferences'), preferences }),
  z.object({
    type: z.literal('navigate'),
    url: z
      .string()
      .max(8192)
      .refine(value => {
        try {
          return ['https:', 'http:'].includes(new URL(value).protocol) || value === 'about:blank';
        } catch {
          return false;
        }
      }),
  }),
  z.object({ type: z.enum(['back', 'forward', 'reload', 'new-tab']) }),
  z.object({ type: z.enum(['switch-tab', 'close-tab']), index: z.number().int().min(0).max(1000) }),
  z.object({ type: z.literal('text'), text: z.string().max(65536) }),
  z.object({
    type: z.literal('mouse'),
    event: z.object({
      type: z.enum(['mousePressed', 'mouseReleased', 'mouseMoved', 'mouseWheel']),
      x: z.number().min(0).max(3840),
      y: z.number().min(0).max(2160),
      button: z.enum(['left', 'right', 'middle', 'none']).optional(),
      clickCount: z.number().int().min(0).max(3).optional(),
      deltaX: z.number().min(-10000).max(10000).optional(),
      deltaY: z.number().min(-10000).max(10000).optional(),
      modifiers: z.number().int().min(0).max(15).optional(),
    }),
  }),
  z.object({
    type: z.literal('keyboard'),
    event: z.object({
      type: z.enum(['keyDown', 'keyUp', 'char']),
      key: z.string().max(100).optional(),
      code: z.string().max(100).optional(),
      text: z.string().max(100).optional(),
      modifiers: z.number().int().min(0).max(15).optional(),
      windowsVirtualKeyCode: z.number().int().min(0).max(255).optional(),
    }),
  }),
]);

/** Read-only resolution: never create a Session or launch a billable browser to watch it. */
export async function resolveControllerBrowser(args: {
  mastra: Mastra;
  controllerId: string;
  resourceId: string;
  sessionScope?: string;
  sessionThreadId: string;
  incarnation: string;
  requestContext?: RequestContext;
}) {
  const { mastra, controllerId, resourceId, sessionScope, sessionThreadId, incarnation, requestContext } = args;
  if (
    getEffectiveResourceId(requestContext, resourceId) !== resourceId ||
    getEffectiveThreadId(requestContext, sessionThreadId) !== sessionThreadId
  ) {
    throw new HTTPException(404, { message: 'Browser not found' });
  }
  const controller = mastra.getAgentController(controllerId);
  const session = await controller?.getSessionByResource(resourceId, sessionScope);
  if (!session || session.identity.getResourceId() !== resourceId || session.thread.getId() !== sessionThreadId) {
    throw new HTTPException(404, { message: 'Browser not found' });
  }
  const thread = await session.thread.getById({ threadId: sessionThreadId });
  const browser = session.browser;
  if (
    thread?.resourceId !== resourceId ||
    !browser?.isBrowserRunning(sessionThreadId) ||
    browser.getActivityState().incarnation !== incarnation
  ) {
    throw new HTTPException(404, { message: 'Browser not found' });
  }
  return browser.getViewer(sessionThreadId);
}

export const COMMAND_AGENT_CONTROLLER_BROWSER_ROUTE = createRoute({
  method: 'POST',
  path: '/agent-controller/:controllerId/sessions/:resourceId/browser/commands',
  responseType: 'json',
  pathParamSchema,
  queryParamSchema,
  bodySchema: browserViewerCommandSchema,
  summary: 'Control the existing session browser',
  tags: ['AgentController', 'Browser'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:execute',
  handler: async args => {
    const viewer = await resolveControllerBrowser(args);
    await viewer.command(browserViewerCommandSchema.parse(args), args.incarnation);
    return { ok: true };
  },
});

export const STREAM_AGENT_CONTROLLER_BROWSER_ROUTE = createRoute({
  method: 'GET',
  path: '/agent-controller/:controllerId/sessions/:resourceId/browser/stream',
  responseType: 'stream',
  streamFormat: 'sse',
  sseFlushOnConnect: true,
  pathParamSchema,
  queryParamSchema,
  summary: 'Watch the existing session browser',
  tags: ['AgentController', 'Browser'],
  requiresAuth: true,
  requiresPermission: 'agent-controller:read',
  handler: async args => {
    const viewer = await resolveControllerBrowser(args);
    let release: (() => Promise<void>) | undefined;
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let pendingFrame: BrowserViewerEvent | undefined;
    let pendingState: BrowserViewerEvent | undefined;
    let output: ReadableStreamDefaultController<unknown>;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      args.abortSignal?.removeEventListener('abort', abort);
      pendingFrame = pendingState = undefined;
      void release?.();
    };
    const abort = () => {
      cleanup();
      try {
        output.close();
      } catch {}
    };
    const stream = new ReadableStream<unknown>(
      {
        start(controller) {
          output = controller;
          args.abortSignal?.addEventListener('abort', abort, { once: true });
          if (args.abortSignal?.aborted) abort();
        },
        pull(controller) {
          if (closed) return;
          if (pendingState) {
            controller.enqueue(pendingState);
            pendingState = undefined;
          } else if (pendingFrame) {
            controller.enqueue(pendingFrame);
            pendingFrame = undefined;
          }
        },
        cancel: cleanup,
      },
      { highWaterMark: 1 },
    );
    if (closed) return stream;
    try {
      release = await viewer.subscribe(event => {
        if (closed) return;
        if (event.type === 'closed' || event.type === 'error') {
          output.enqueue(event);
          abort();
          return;
        }
        if ((output.desiredSize ?? 0) > 0) {
          if (event.type === 'frame') pendingFrame = undefined;
          else pendingState = undefined;
          output.enqueue(event);
        } else if (event.type === 'frame') pendingFrame = event;
        else pendingState = event;
      });
      if (closed) await release();
      else
        heartbeat = setInterval(() => {
          if ((output.desiredSize ?? 0) > 0) output.enqueue(': heartbeat\n\n');
        }, 25_000);
      return stream;
    } catch (error) {
      cleanup();
      throw error;
    }
  },
});
