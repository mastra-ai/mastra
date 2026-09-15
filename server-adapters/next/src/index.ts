import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { ApiRoute } from '@mastra/core/server';
import { MastraServer } from '@mastra/hono';
import type { HonoApp } from '@mastra/hono';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';

export interface NextRouteHandlerOptions {
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
   * For example, if you mount at `app/api/[...mastra]/route.ts`, set this to `/api`.
   * @default '/api'
   */
  prefix?: string;
}

/**
 * A Next.js route handler function compatible with App Router.
 */
export type NextRouteHandler = (req: Request) => Response | Promise<Response>;

export interface NextRouteHandlers {
  GET: NextRouteHandler;
  POST: NextRouteHandler;
  PUT: NextRouteHandler;
  DELETE: NextRouteHandler;
  PATCH: NextRouteHandler;
  OPTIONS: NextRouteHandler;
  HEAD: NextRouteHandler;
}

/**
 * Creates Next.js App Router route handlers for a Mastra instance.
 *
 * Mount this in a catch-all route file such as:
 *   `app/api/[...mastra]/route.ts`
 *
 * @example
 * ```ts
 * // app/api/[...mastra]/route.ts
 * import { createNextRouteHandler } from '@mastra/next';
 * import { mastra } from '../../../mastra';
 *
 * export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createNextRouteHandler({
 *   mastra,
 * });
 * ```
 */
export function createNextRouteHandler(options: NextRouteHandlerOptions): NextRouteHandlers {
  const { mastra, tools = {}, prefix = '/api' } = options;

  // Lazily initialize the Hono app so the module-level export works synchronously
  let appPromise: Promise<Hono> | undefined;

  function getApp(): Promise<Hono> {
    if (!appPromise) {
      appPromise = initApp(mastra, tools, prefix);
    }
    return appPromise;
  }

  // Build a handler for each HTTP method
  const handler: NextRouteHandler = async req => {
    const app = await getApp();
    const honoHandler = handle(app);
    return honoHandler(req);
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
