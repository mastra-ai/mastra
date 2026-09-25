import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { ApiRoute } from '@mastra/core/server';
import { MastraServer } from '@mastra/hono';
import type { HonoApp } from '@mastra/hono';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { Hono } from 'hono';

/**
 * The part of SvelteKit's `RequestEvent` that the adapter reads. Keeping it structural
 * means the handlers are assignable to SvelteKit's `RequestHandler` without depending on `@sveltejs/kit`.
 */
export interface SvelteKitHandlerContext {
  request: Request;
}

export interface SvelteKitRouteHandlerOptions {
  /**
   * The Mastra instance to serve.
   */
  mastra: Mastra;

  /**
   * Tools to register with the server.
   * @default {}
   */
  tools?: ToolsInput;

  /**
   * API route prefix. Should match the path where the catch-all route is mounted.
   * For example, if you mount at `src/routes/api/[...path]/+server.ts`, set this to `/api`.
   * @default '/api'
   */
  prefix?: string;
}

/**
 * A SvelteKit `+server.ts` request handler.
 */
export type SvelteKitRouteHandler = (event: SvelteKitHandlerContext) => Response | Promise<Response>;

export interface SvelteKitRouteHandlers {
  GET: SvelteKitRouteHandler;
  POST: SvelteKitRouteHandler;
  PUT: SvelteKitRouteHandler;
  DELETE: SvelteKitRouteHandler;
  PATCH: SvelteKitRouteHandler;
  OPTIONS: SvelteKitRouteHandler;
  HEAD: SvelteKitRouteHandler;
}

/**
 * Creates SvelteKit request handlers for a Mastra instance.
 *
 * Mount this in a catch-all (rest parameter) server route file such as:
 *   `src/routes/api/[...path]/+server.ts`
 *
 * @example
 * ```ts
 * // src/routes/api/[...path]/+server.ts
 * import { createSvelteKitRouteHandler } from '@mastra/sveltekit';
 * import { mastra } from '$lib/server/mastra';
 *
 * export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createSvelteKitRouteHandler({
 *   mastra,
 * });
 * ```
 */
export function createSvelteKitRouteHandler(options: SvelteKitRouteHandlerOptions): SvelteKitRouteHandlers {
  const { mastra, tools = {}, prefix = '/api' } = options;

  // Lazily initialize the Hono app so the module-level export works synchronously
  let appPromise: Promise<Hono> | undefined;

  function getApp(): Promise<Hono> {
    appPromise ??= initApp(mastra, tools, prefix).catch((error: unknown) => {
      // Don't cache a failed initialization, so the next request retries instead of failing until restart
      appPromise = undefined;
      throw error;
    });
    return appPromise;
  }

  const handler: SvelteKitRouteHandler = async ({ request }) => {
    const app = await getApp();
    return app.fetch(request);
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
    OPTIONS: handler,
    HEAD: handler,
  };
}

async function initApp(mastra: Mastra, tools: ToolsInput, prefix: string): Promise<Hono> {
  const app = new Hono();

  const serverConfig = mastra.getServer();
  const apiRoutes: ApiRoute[] | undefined = serverConfig?.apiRoutes;

  // Store custom route auth configurations
  const customRouteAuthConfig = new Map<string, boolean>();
  if (apiRoutes) {
    for (const route of apiRoutes) {
      const requiresAuth = route.requiresAuth !== false;
      const routeKey = `${route.method}:${route.path}`;
      customRouteAuthConfig.set(routeKey, requiresAuth);
    }
  }

  const taskStore = new InMemoryTaskStore();

  const bodySizeLimit = serverConfig?.bodySizeLimit ?? 4.5 * 1024 * 1024;

  // Create the MastraServer adapter
  const honoServerAdapter = new MastraServer({
    app: app as unknown as HonoApp,
    mastra,
    tools,
    taskStore,
    bodyLimitOptions: {
      maxSize: bodySizeLimit,
      onError: (_err: unknown) => ({ error: 'Request body too large' }),
    },
    customRouteAuthConfig,
    customApiRoutes: apiRoutes,
    prefix,
    mcpOptions: serverConfig?.mcpOptions,
  });

  // Initialize: registers context middleware, auth, routes, etc.
  await honoServerAdapter.init();

  return app;
}
