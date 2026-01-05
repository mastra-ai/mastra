import { readFile } from 'node:fs/promises';
import * as https from 'node:https';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import type { Mastra } from '@mastra/core/mastra';
import { Tool } from '@mastra/core/tools';
import { MastraServer } from '@mastra/hono';
import type { HonoBindings, HonoVariables } from '@mastra/hono';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import type { Context, Handler, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timeout } from 'hono/timeout';
import { describeRoute } from 'hono-openapi';
import { normalizeStudioBase } from '../build/utils';
import { handleClientsRefresh, handleTriggerClientsRefresh, isHotReloadDisabled } from './handlers/client';
import { errorHandler } from './handlers/error';
import { healthHandler } from './handlers/health';
import { restartAllActiveWorkflowRunsHandler } from './handlers/restart-active-runs';
import type { ServerBundleOptions } from './types';
import { html } from './welcome';

// Get studio path from env or default to ./playground relative to cwd
const getStudioPath = () => process.env.MASTRA_STUDIO_PATH || './playground';

// Use adapter type definitions
type Bindings = HonoBindings;

type Variables = HonoVariables & {
  clients: Set<{ controller: ReadableStreamDefaultController }>;
};

export function getToolExports(tools: Record<string, Function>[]) {
  try {
    return tools.reduce((acc, toolModule) => {
      Object.entries(toolModule).forEach(([key, tool]) => {
        if (tool instanceof Tool) {
          acc[key] = tool;
        }
      });
      return acc;
    }, {});
  } catch (err: any) {
    console.error(
      `Failed to import tools
reason: ${err.message}
${err.stack.split('\n').slice(1).join('\n')}
    `,
      err,
    );
  }
}

export async function createHonoServer(
  mastra: Mastra,
  options: ServerBundleOptions = {
    tools: {},
  },
) {
  // Create typed Hono app
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
  const server = mastra.getServer();
  const a2aTaskStore = new InMemoryTaskStore();
  const routes = server?.apiRoutes;

  // Store custom route auth configurations
  const customRouteAuthConfig = new Map<string, boolean>();

  if (routes) {
    for (const route of routes) {
      // By default, routes require authentication unless explicitly set to false
      const requiresAuth = route.requiresAuth !== false;
      const routeKey = `${route.method}:${route.path}`;
      customRouteAuthConfig.set(routeKey, requiresAuth);
    }
  }

  // Set up error handling - use custom onError handler if provided, otherwise use default
  const customOnError = server?.onError;
  app.onError((err, c) => {
    if (customOnError) {
      return customOnError(err, c);
    }
    return errorHandler(err, c, options.isDev);
  });

  // Define body limit options
  const bodyLimitOptions = {
    maxSize: server?.bodySizeLimit ?? 4.5 * 1024 * 1024, // 4.5 MB,
    onError: () => ({ error: 'Request body too large' }),
  };

  // Create server adapter with all configuration
  const honoServerAdapter = new MastraServer({
    app,
    mastra,
    tools: options.tools,
    taskStore: a2aTaskStore,
    bodyLimitOptions,
    openapiPath: '/openapi.json',
    customRouteAuthConfig,
  });

  // Register context middleware FIRST - this sets mastra, requestContext, tools, taskStore in context
  // Cast needed due to Hono type variance - safe because registerContextMiddleware is generic
  honoServerAdapter.registerContextMiddleware();

  // Apply custom server middleware from Mastra instance
  const serverMiddleware = mastra.getServerMiddleware?.();

  if (serverMiddleware && serverMiddleware.length > 0) {
    for (const m of serverMiddleware) {
      app.use(m.path, m.handler);
    }
  }

  //Global cors config
  if (server?.cors === false) {
    app.use('*', timeout(server?.timeout ?? 3 * 60 * 1000));
  } else {
    const corsConfig = {
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: false,
      maxAge: 3600,
      ...server?.cors,
      allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-client-type', ...(server?.cors?.allowHeaders ?? [])],
      exposeHeaders: ['Content-Length', 'X-Requested-With', ...(server?.cors?.exposeHeaders ?? [])],
    };
    app.use('*', timeout(server?.timeout ?? 3 * 60 * 1000), cors(corsConfig));
  }

  // Health check endpoint (before auth middleware so it's publicly accessible)
  app.get(
    '/health',
    describeRoute({
      description: 'Health check endpoint',
      tags: ['system'],
      responses: {
        200: {
          description: 'Service is healthy',
        },
      },
    }),
    healthHandler,
  );

  // Register auth middleware (authentication and authorization)
  // This is handled by the server adapter now
  honoServerAdapter.registerAuthMiddleware();

  if (server?.middleware) {
    const normalizedMiddlewares = Array.isArray(server.middleware) ? server.middleware : [server.middleware];
    const middlewares = normalizedMiddlewares.map(middleware => {
      if (typeof middleware === 'function') {
        return {
          path: '*',
          handler: middleware,
        };
      }

      return middleware;
    });

    for (const middleware of middlewares) {
      app.use(middleware.path, middleware.handler);
    }
  }

  if (routes) {
    for (const route of routes) {
      const middlewares: MiddlewareHandler[] = [];

      if (route.middleware) {
        middlewares.push(...(Array.isArray(route.middleware) ? route.middleware : [route.middleware]));
      }
      if (route.openapi) {
        middlewares.push(describeRoute(route.openapi));
      }

      const handler = 'handler' in route ? route.handler : await route.createHandler({ mastra });

      // Register route using app.on() which supports dynamic method/path registration
      // Hono's H type (Handler | MiddlewareHandler) is internal, so we use Handler
      // which is compatible at runtime since both accept (context, next)
      const allHandlers: Handler[] = [...middlewares, handler];
      if (route.method === 'ALL') {
        app.all(route.path, allHandlers[0]!, ...allHandlers.slice(1));
      } else {
        app.on(route.method, route.path, allHandlers[0]!, ...allHandlers.slice(1));
      }
    }
  }

  if (server?.build?.apiReqLogs) {
    app.use(logger());
  }

  // Register adapter routes (adapter was created earlier with configuration)
  // Cast needed due to Hono type variance - safe because registerRoutes is generic
  await honoServerAdapter.registerRoutes();

  if (options?.isDev || server?.build?.swaggerUI) {
    app.get(
      '/swagger-ui',
      describeRoute({
        hide: true,
      }),
      swaggerUI({ url: '/openapi.json' }),
    );
  }

  if (options?.isDev) {
    app.post(
      '/__restart-active-workflow-runs',
      describeRoute({
        hide: true,
      }),
      restartAllActiveWorkflowRunsHandler,
    );
  }

  const serverOptions = mastra.getServer();
  const studioBasePath = normalizeStudioBase(serverOptions?.studioBase ?? '/');

  if (options?.playground) {
    // SSE endpoint for refresh notifications
    app.get(
      `${studioBasePath}/refresh-events`,
      describeRoute({
        hide: true,
      }),
      handleClientsRefresh,
    );

    // Trigger refresh for all clients
    app.post(
      `${studioBasePath}/__refresh`,
      describeRoute({
        hide: true,
      }),
      handleTriggerClientsRefresh,
    );

    // Check hot reload status
    app.get(
      `${studioBasePath}/__hot-reload-status`,
      describeRoute({
        hide: true,
      }),
      (c: Context) => {
        return c.json({
          disabled: isHotReloadDisabled(),
          timestamp: new Date().toISOString(),
        });
      },
    );
    // Playground routes - these should come after API routes
    // Serve static assets from playground directory
    // Note: Vite builds with base: './' so all asset URLs are relative
    // The <base href> tag in index.html handles path resolution for the SPA
    const studioPath = getStudioPath();
    app.use(
      `${studioBasePath}/assets/*`,
      serveStatic({
        root: join(studioPath, 'assets'),
        rewriteRequestPath: path => {
          // Remove the basePath AND /assets prefix to get the actual file path
          // Example: /custom-path/assets/style.css -> /style.css -> ./playground/assets/style.css
          let rewritten = path;
          if (studioBasePath && rewritten.startsWith(studioBasePath)) {
            rewritten = rewritten.slice(studioBasePath.length);
          }
          // Remove the /assets prefix since root is already './playground/assets'
          if (rewritten.startsWith('/assets')) {
            rewritten = rewritten.slice('/assets'.length);
          }
          return rewritten;
        },
      }),
    );
  }

  // Dynamic HTML handler - this must come before static file serving
  app.get('*', async (c, next) => {
    const requestPath = c.req.path;

    // Skip if it's an API route
    if (
      requestPath.startsWith('/api/') ||
      requestPath.startsWith('/swagger-ui') ||
      requestPath.startsWith('/openapi.json')
    ) {
      return await next();
    }

    // Skip if it's an asset file (has extension other than .html)
    if (requestPath.includes('.') && !requestPath.endsWith('.html')) {
      return await next();
    }

    // Only serve playground for routes matching the configured base path
    const isPlaygroundRoute =
      studioBasePath === '' || requestPath === studioBasePath || requestPath.startsWith(`${studioBasePath}/`);
    if (options?.playground && isPlaygroundRoute) {
      // For HTML routes, serve index.html with dynamic replacements
      const studioPath = getStudioPath();
      let indexHtml = await readFile(join(studioPath, 'index.html'), 'utf-8');

      // Inject the server configuration information
      const port = serverOptions?.port ?? (Number(process.env.PORT) || 4111);
      const hideCloudCta = process.env.MASTRA_HIDE_CLOUD_CTA === 'true';
      const host = serverOptions?.host ?? 'localhost';
      const key =
        serverOptions?.https?.key ??
        (process.env.MASTRA_HTTPS_KEY ? Buffer.from(process.env.MASTRA_HTTPS_KEY, 'base64') : undefined);
      const cert =
        serverOptions?.https?.cert ??
        (process.env.MASTRA_HTTPS_CERT ? Buffer.from(process.env.MASTRA_HTTPS_CERT, 'base64') : undefined);
      const protocol = key && cert ? 'https' : 'http';

      indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_HOST%%'`, `'${host}'`);
      indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_PORT%%'`, `'${port}'`);
      indexHtml = indexHtml.replace(`'%%MASTRA_HIDE_CLOUD_CTA%%'`, `'${hideCloudCta}'`);
      indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_PROTOCOL%%'`, `'${protocol}'`);
      // Inject the base path for frontend routing
      // The <base href> tag uses this to resolve all relative URLs correctly
      indexHtml = indexHtml.replaceAll('%%MASTRA_STUDIO_BASE_PATH%%', studioBasePath);

      return c.newResponse(indexHtml, 200, { 'Content-Type': 'text/html' });
    }

    return c.newResponse(html, 200, { 'Content-Type': 'text/html' });
  });

  if (options?.playground) {
    // Serve extra static files from playground directory (this comes after HTML handler)
    const studioPath = getStudioPath();
    const playgroundPath = studioBasePath ? `${studioBasePath}/*` : '*';
    app.use(
      playgroundPath,
      serveStatic({
        root: studioPath,
        rewriteRequestPath: path => {
          // Remove the basePath prefix if present
          if (studioBasePath && path.startsWith(studioBasePath)) {
            return path.slice(studioBasePath.length);
          }
          return path;
        },
      }),
    );
  }

  return app;
}

export async function createNodeServer(mastra: Mastra, options: ServerBundleOptions = { tools: {} }) {
  const app = await createHonoServer(mastra, options);
  const serverOptions = mastra.getServer();

  const key =
    serverOptions?.https?.key ??
    (process.env.MASTRA_HTTPS_KEY ? Buffer.from(process.env.MASTRA_HTTPS_KEY, 'base64') : undefined);
  const cert =
    serverOptions?.https?.cert ??
    (process.env.MASTRA_HTTPS_CERT ? Buffer.from(process.env.MASTRA_HTTPS_CERT, 'base64') : undefined);
  const isHttpsEnabled = Boolean(key && cert);

  const host = serverOptions?.host ?? 'localhost';
  const port = serverOptions?.port ?? (Number(process.env.PORT) || 4111);
  const protocol = isHttpsEnabled ? 'https' : 'http';

  const server = serve(
    {
      fetch: app.fetch,
      port,
      hostname: serverOptions?.host,
      ...(isHttpsEnabled
        ? {
            createServer: https.createServer,
            serverOptions: {
              key,
              cert,
            },
          }
        : {}),
    },
    () => {
      const logger = mastra.getLogger();
      logger.info(` Mastra API running on ${protocol}://${host}:${port}/api`);
      if (options?.playground) {
        const studioBasePath = normalizeStudioBase(serverOptions?.studioBase ?? '/');
        const studioUrl = `${protocol}://${host}:${port}${studioBasePath}`;
        logger.info(`👨‍💻 Studio available at ${studioUrl}`);
      }

      if (process.send) {
        process.send({
          type: 'server-ready',
          port,
          host,
        });
      }
    },
  );

  await mastra.startEventEngine();

  return server;
}
