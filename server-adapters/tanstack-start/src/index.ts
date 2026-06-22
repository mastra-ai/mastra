import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { ApiRoute } from '@mastra/core/server';
import { MastraServer } from '@mastra/hono';
import type { HonoApp } from '@mastra/hono';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { Hono } from 'hono';

/**
 * Context provided to each TanStack Start server route handler.
 */
export interface StartHandlerContext {
  request: Request;
  params: Record<string, string>;
}

export interface StartRouteHandlerOptions {
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
   * For example, if you mount at `src/routes/api/$.ts`, set this to `/api`.
   * @default '/api'
   */
  prefix?: string;
}

/**
 * A TanStack Start server route handler function.
 */
export type StartRouteHandler = (ctx: StartHandlerContext) => Response | Promise<Response>;

export interface StartRouteHandlers {
  GET: StartRouteHandler;
  POST: StartRouteHandler;
  PUT: StartRouteHandler;
  DELETE: StartRouteHandler;
  PATCH: StartRouteHandler;
  OPTIONS: StartRouteHandler;
  HEAD: StartRouteHandler;
}

/**
 * Creates TanStack Start server route handlers for a Mastra instance.
 *
 * Mount this in a catch-all (splat) server route file such as:
 *   `src/routes/api/$.ts`
 *
 * @example
 * ```ts
 * // src/routes/api/$.ts
 * import { createFileRoute } from '@tanstack/react-router';
 * import { createStartRouteHandler } from '@mastra/tanstack-start';
 * import { mastra } from '../../mastra';
 *
 * export const Route = createFileRoute('/api/$')({
 *   server: {
 *     handlers: createStartRouteHandler({ mastra }),
 *   },
 * });
 * ```
 */
export function createStartRouteHandler(options: StartRouteHandlerOptions): StartRouteHandlers {
  const { mastra, tools = {}, prefix = '/api' } = options;

  // Lazily initialize the Hono app so the module-level export works synchronously
  let appPromise: Promise<Hono> | undefined;

  function getApp(): Promise<Hono> {
    if (!appPromise) {
      appPromise = initApp(mastra, tools, prefix);
    }
    return appPromise;
  }

  const handler: StartRouteHandler = async ({ request }) => {
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
