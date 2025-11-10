import { readFile } from 'fs/promises';
import * as https from 'node:https';
import { join } from 'path/posix';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import type { Mastra } from '@mastra/core/mastra';
import { Tool } from '@mastra/core/tools';
import { HonoServerAdapter } from '@mastra/hono';
import type { HonoBindings, HonoVariables } from '@mastra/hono';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timeout } from 'hono/timeout';
import { describeRoute } from 'hono-openapi';
import { authenticationMiddleware, authorizationMiddleware } from './handlers/auth';
import { handleClientsRefresh, handleTriggerClientsRefresh, isHotReloadDisabled } from './handlers/client';
import { errorHandler } from './handlers/error';
import type { ServerBundleOptions } from './types';
import { html } from './welcome.js';

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

  app.onError((err, c) => errorHandler(err, c, options.isDev));

  // Create server adapter with all configuration
  const honoServerAdapter = new HonoServerAdapter({
    mastra,
    tools: options.tools,
    taskStore: a2aTaskStore,
    customRouteAuthConfig,
    playground: options.playground,
    isDev: options.isDev,
  });

  // Configure hono context - using adapter middleware
  app.use('*', honoServerAdapter.createContextMiddleware());

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

  // Run AUTH middlewares after CORS middleware
  app.use('*', authenticationMiddleware);
  app.use('*', authorizationMiddleware);

  const bodyLimitOptions = {
    maxSize: server?.bodySizeLimit ?? 4.5 * 1024 * 1024, // 4.5 MB,
    onError: (c: Context) => c.json({ error: 'Request body too large' }, 413),
  };

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

      if (route.method === 'GET') {
        app.get(route.path, ...middlewares, handler);
      } else if (route.method === 'POST') {
        app.post(route.path, ...middlewares, handler);
      } else if (route.method === 'PUT') {
        app.put(route.path, ...middlewares, handler);
      } else if (route.method === 'DELETE') {
        app.delete(route.path, ...middlewares, handler);
      } else if (route.method === 'PATCH') {
        app.patch(route.path, ...middlewares, handler);
      } else if (route.method === 'ALL') {
        app.all(route.path, ...middlewares, handler);
      }
    }
  }

  if (server?.build?.apiReqLogs) {
    app.use(logger());
  }

  // TODO: add option to exclude openapi route from server adapter
  if (options?.isDev || server?.build?.openAPIDocs || server?.build?.swaggerUI) {
    // app.get(
    //   '/openapi.json',
    //   openAPISpecs(app, {
    //     includeEmptyPaths: true,
    //     documentation: {
    //       info: { title: 'Mastra API', version: '1.0.0', description: 'Mastra API' },
    //     },
    //   }),
    // );
  }

  // Register adapter routes (adapter was created earlier with configuration)
  // Cast needed due to Hono type variance - safe because registerRoutes is generic
  await honoServerAdapter.registerRoutes(app as any, { openapiPath: '/openapi.json' });

  if (options?.isDev || server?.build?.swaggerUI) {
    app.get(
      '/swagger-ui',
      describeRoute({
        hide: true,
      }),
      swaggerUI({ url: '/openapi.json' }),
    );
  }

  if (options?.playground) {
    // SSE endpoint for refresh notifications
    app.get(
      '/refresh-events',
      describeRoute({
        hide: true,
      }),
      handleClientsRefresh,
    );

    // Trigger refresh for all clients
    app.post(
      '/__refresh',
      describeRoute({
        hide: true,
      }),
      handleTriggerClientsRefresh,
    );

    // Check hot reload status
    app.get(
      '/__hot-reload-status',
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
    // Serve assets with specific MIME types
    app.use('/assets/*', async (c, next) => {
      const path = c.req.path;
      if (path.endsWith('.js')) {
        c.header('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        c.header('Content-Type', 'text/css');
      }
      await next();
    });

    // Serve static assets from playground directory
    app.use(
      '/assets/*',
      serveStatic({
        root: './playground/assets',
      }),
    );
  }

  // Dynamic HTML handler - this must come before static file serving
  app.get('*', async (c, next) => {
    // Skip if it's an API route
    if (
      c.req.path.startsWith('/api/') ||
      c.req.path.startsWith('/swagger-ui') ||
      c.req.path.startsWith('/openapi.json')
    ) {
      return await next();
    }

    // Skip if it's an asset file (has extension other than .html)
    const path = c.req.path;
    if (path.includes('.') && !path.endsWith('.html')) {
      return await next();
    }

    if (options?.playground) {
      // For HTML routes, serve index.html with dynamic replacements
      let indexHtml = await readFile(join(process.cwd(), './playground/index.html'), 'utf-8');

      // Inject the server port information
      const serverOptions = mastra.getServer();
      const port = serverOptions?.port ?? (Number(process.env.PORT) || 4111);
      const hideCloudCta = process.env.MASTRA_HIDE_CLOUD_CTA === 'true';
      const host = serverOptions?.host ?? 'localhost';

      indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_HOST%%'`, `'${host}'`);
      indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_PORT%%'`, `'${port}'`);
      indexHtml = indexHtml.replace(`'%%MASTRA_HIDE_CLOUD_CTA%%'`, `'${hideCloudCta}'`);

      return c.newResponse(indexHtml, 200, { 'Content-Type': 'text/html' });
    }

    return c.newResponse(html, 200, { 'Content-Type': 'text/html' });
  });

  if (options?.playground) {
    // Serve extra static files from playground directory (this comes after HTML handler)
    app.use(
      '*',
      serveStatic({
        root: './playground',
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
      logger.info(` Mastra API running on port ${protocol}://${host}:${port}/api`);
      if (options?.playground) {
        const playgroundUrl = `${protocol}://${host}:${port}`;
        logger.info(`👨‍💻 Playground available at ${playgroundUrl}`);
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
