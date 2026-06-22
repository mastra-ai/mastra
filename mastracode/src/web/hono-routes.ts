import type { Mastra } from '@mastra/core/mastra';

/**
 * Mounts the `@mastra/server` harness routes on a Hono app and provides a
 * generic route-handler binding. Shared by the production web server
 * ({@link ./server.ts}) and the scenario test harness so both exercise the
 * same routing path.
 *
 * The browser client (`@mastra/client-js`) prefixes requests with `/api`, so
 * routes are mounted under `/api/...`.
 */

export interface HonoLike {
  get(path: string, handler: (c: any) => Promise<Response> | Response): void;
  post(path: string, handler: (c: any) => Promise<Response> | Response): void;
  put(path: string, handler: (c: any) => Promise<Response> | Response): void;
  delete(path: string, handler: (c: any) => Promise<Response> | Response): void;
}

export interface ServerRouteLike {
  method: string;
  path: string;
  responseType?: string;
  handler: (args: any) => Promise<unknown> | unknown;
}

/** Mount every harness route from `routes` onto `app`, bound to `mastra`. */
export function mountHarnessRoutes(app: HonoLike, routes: ServerRouteLike[], mastra: Mastra): void {
  for (const route of routes) {
    if (typeof route.path !== 'string' || !route.path.includes('harness')) continue;
    const honoPath = `/api${route.path}`; // MastraClient prefixes /api
    const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
    app[method](honoPath, (c: any) => invokeRoute(route, c, mastra));
  }
}

/**
 * Generic Hono → route-handler binding. Mirrors how the real Hono server
 * adapter calls a route: collect path + query + body params, invoke the
 * handler, then stream (SSE) or JSON-encode the result.
 */
export async function invokeRoute(route: ServerRouteLike, c: any, mastra: Mastra): Promise<Response> {
  const params: Record<string, unknown> = { mastra, ...c.req.param() };
  const url = new URL(c.req.url);
  for (const [key, value] of url.searchParams.entries()) {
    params[key] = value;
  }
  const method = route.method.toUpperCase();
  if (method === 'POST' || method === 'PUT') {
    try {
      Object.assign(params, await c.req.json());
    } catch {
      /* no body */
    }
  }

  if (route.responseType === 'stream') {
    const abortController = new AbortController();
    params.abortSignal = abortController.signal;
    c.req.raw.signal?.addEventListener('abort', () => abortController.abort(), { once: true });
    const stream = (await route.handler(params)) as ReadableStream<string>;
    return new Response(encodeStream(stream), {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  }

  const result = await route.handler(params);
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
}

/** The stream handler yields strings; encode them to bytes for the Response. */
export function encodeStream(stream: ReadableStream<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(value));
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}
