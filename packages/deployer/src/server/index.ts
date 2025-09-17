import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import * as https from 'node:https';
import { join } from 'path/posix';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import type { Mastra } from '@mastra/core/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { Telemetry } from '@mastra/core/telemetry';
import { Tool } from '@mastra/core/tools';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timeout } from 'hono/timeout';
import { describeRoute, openAPISpecs } from 'hono-openapi';
import { getAgentCardByIdHandler, getAgentExecutionHandler } from './handlers/a2a';
import { authenticationMiddleware, authorizationMiddleware } from './handlers/auth';
import { handleClientsRefresh, handleTriggerClientsRefresh, isHotReloadDisabled } from './handlers/client';
import { errorHandler } from './handlers/error';
import { rootHandler } from './handlers/root';
import { agentBuilderRouter } from './handlers/routes/agent-builder/router';
import { getModelProvidersHandler } from './handlers/routes/agents/handlers';
import { agentsRouterDev, agentsRouter } from './handlers/routes/agents/router';
import { logsRouter } from './handlers/routes/logs/router';
import { mcpRouter } from './handlers/routes/mcp/router';
import { memoryRoutes } from './handlers/routes/memory/router';
import { vNextNetworksRouter } from './handlers/routes/networks/router';
import { observabilityRouter } from './handlers/routes/observability/router';
import { scoresRouter } from './handlers/routes/scores/router';
import { telemetryRouter } from './handlers/routes/telemetry/router';
import { toolsRouter } from './handlers/routes/tools/router';
import { vectorRouter } from './handlers/routes/vector/router';
import { workflowsRouter } from './handlers/routes/workflows/router';
import type { ServerBundleOptions } from './types';
import { html } from './welcome.js';

type Bindings = {};

type Variables = {
  mastra: Mastra;
  runtimeContext: RuntimeContext;
  clients: Set<{ controller: ReadableStreamDefaultController }>;
  tools: Record<string, Tool>;
  taskStore: InMemoryTaskStore;
  playground: boolean;
  isDev: boolean;
  customRouteAuthConfig?: Map<string, boolean>;
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

  // Middleware
  app.use('*', async function setTelemetryInfo(c, next) {
    const requestId = c.req.header('x-request-id') ?? randomUUID();
    const span = Telemetry.getActiveSpan();
    if (span) {
      span.setAttribute('http.request_id', requestId);
      span.updateName(`${c.req.method} ${c.req.path}`);

      const newCtx = Telemetry.setBaggage({
        'http.request_id': { value: requestId },
      });

      await new Promise(resolve => {
        Telemetry.withContext(newCtx, async () => {
          await next();
          resolve(true);
        });
      });
    } else {
      await next();
    }
  });

  app.onError((err, c) => errorHandler(err, c, options.isDev));

  // Configure hono context
  // Configure hono context
  app.use('*', async function setContext(c, next) {
    // Parse runtime context from request body and add to context
    let runtimeContext = new RuntimeContext();
    // Parse runtime context from request body and add to context
    if (c.req.method === 'POST' || c.req.method === 'PUT') {
      const contentType = c.req.header('content-type');
      if (contentType?.includes('application/json')) {
        try {
          const clonedReq = c.req.raw.clone();
          const body = (await clonedReq.json()) as { runtimeContext?: Record<string, any> };
          if (body.runtimeContext) {
            runtimeContext = new RuntimeContext(Object.entries(body.runtimeContext));
          }
        } catch {
          // Body parsing failed, continue without body
        }
      }
    }

    // Parse runtime context from query params and add to context
    if (c.req.method === 'GET') {
      try {
        const encodedRuntimeContext = c.req.query('runtimeContext');
        if (encodedRuntimeContext) {
          let parsedRuntimeContext: Record<string, any> | undefined;
          // Try JSON first
          try {
            parsedRuntimeContext = JSON.parse(encodedRuntimeContext);
          } catch {
            // Fallback to base64(JSON)
            try {
              const json = Buffer.from(encodedRuntimeContext, 'base64').toString('utf-8');
              parsedRuntimeContext = JSON.parse(json);
            } catch {
              // ignore if still invalid
            }
          }

          if (parsedRuntimeContext && typeof parsedRuntimeContext === 'object') {
            runtimeContext = new RuntimeContext([...runtimeContext.entries(), ...Object.entries(parsedRuntimeContext)]);
          }
        }
      } catch {
        // ignore query parsing errors
      }
    }

    // Add relevant contexts to hono context
    c.set('runtimeContext', runtimeContext);
    c.set('mastra', mastra);
    c.set('tools', options.tools);
    c.set('taskStore', a2aTaskStore);
    c.set('playground', options.playground === true);
    c.set('isDev', options.isDev === true);
    c.set('customRouteAuthConfig', customRouteAuthConfig);
    return next();
  });

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

  /**
   * A2A
   */

  app.get(
    '/.well-known/:agentId/agent-card.json',
    describeRoute({
      description: 'Get agent configuration',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Agent configuration',
        },
      },
    }),
    getAgentCardByIdHandler,
  );

  app.post(
    '/a2a/:agentId',
    describeRoute({
      description: 'Execute agent via A2A protocol',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                method: {
                  type: 'string',
                  enum: ['message/send', 'message/stream', 'tasks/get', 'tasks/cancel'],
                  description: 'The A2A protocol method to execute',
                },
                params: {
                  type: 'object',
                  oneOf: [
                    {
                      // MessageSendParams
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                          description: 'Unique identifier for the task being initiated or continued',
                        },
                        sessionId: {
                          type: 'string',
                          description: 'Optional identifier for the session this task belongs to',
                        },
                        message: {
                          type: 'object',
                          description: 'The message content to send to the agent for processing',
                        },
                        pushNotification: {
                          type: 'object',
                          nullable: true,
                          description:
                            'Optional pushNotification information for receiving notifications about this task',
                        },
                        historyLength: {
                          type: 'integer',
                          nullable: true,
                          description:
                            'Optional parameter to specify how much message history to include in the response',
                        },
                        metadata: {
                          type: 'object',
                          nullable: true,
                          description: 'Optional metadata associated with sending this message',
                        },
                      },
                      required: ['id', 'message'],
                    },
                    {
                      // TaskQueryParams
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'The unique identifier of the task' },
                        historyLength: {
                          type: 'integer',
                          nullable: true,
                          description: 'Optional history length to retrieve for the task',
                        },
                        metadata: {
                          type: 'object',
                          nullable: true,
                          description: 'Optional metadata to include with the operation',
                        },
                      },
                      required: ['id'],
                    },
                    {
                      // TaskIdParams
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'The unique identifier of the task' },
                        metadata: {
                          type: 'object',
                          nullable: true,
                          description: 'Optional metadata to include with the operation',
                        },
                      },
                      required: ['id'],
                    },
                  ],
                },
              },
              required: ['method', 'params'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'A2A response',
        },
        400: {
          description: 'Missing or invalid request parameters',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    getAgentExecutionHandler,
  );

  // API routes
  app.get(
    '/api',
    describeRoute({
      description: 'Get API status',
      tags: ['system'],
      responses: {
        200: {
          description: 'Success',
        },
      },
    }),
    rootHandler,
  );

  // Providers route
  app.get(
    '/api/model-providers',
    describeRoute({
      description: 'Get all model providers with available keys',
      tags: ['agents'],
      responses: {
        200: {
          description: 'All model providers with available keys',
        },
      },
    }),
    getModelProvidersHandler,
  );

  // Agents routes
  app.route('/api/agents', agentsRouter(bodyLimitOptions));
  // Networks routes
  app.route('/api/networks', vNextNetworksRouter(bodyLimitOptions));

  if (options.isDev) {
    app.route('/api/agents', agentsRouterDev(bodyLimitOptions));
  }

  // MCP server routes
  app.route('/api/mcp', mcpRouter(bodyLimitOptions));
  // Network Memory routes
  app.route('/api/memory', memoryRoutes(bodyLimitOptions));
  // Telemetry routes
  app.route('/api/telemetry', telemetryRouter());
  // Observability routes
  app.route('/api/observability', observabilityRouter());
  // Legacy Workflow routes
  app.route('/api/workflows', workflowsRouter(bodyLimitOptions));
  // Log routes
  app.route('/api/logs', logsRouter());
  // Scores routes
  app.route('/api/scores', scoresRouter(bodyLimitOptions));
  // Agent builder routes
  app.route('/api/agent-builder', agentBuilderRouter(bodyLimitOptions));
  // Tool routes
  app.route('/api/tools', toolsRouter(bodyLimitOptions, options.tools));
  // Vector routes
  app.route('/api/vector', vectorRouter(bodyLimitOptions));

  if (options?.isDev || server?.build?.openAPIDocs || server?.build?.swaggerUI) {
    app.get(
      '/openapi.json',
      openAPISpecs(app, {
        includeEmptyPaths: true,
        documentation: {
          info: { title: 'Mastra API', version: '1.0.0', description: 'Mastra API' },
        },
      }),
    );
  }

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
      indexHtml = indexHtml.replace(
        `'%%MASTRA_TELEMETRY_DISABLED%%'`,
        `${Boolean(process.env.MASTRA_TELEMETRY_DISABLED)}`,
      );

      // Inject the server port information
      const serverOptions = mastra.getServer();
      const port = serverOptions?.port ?? (Number(process.env.PORT) || 4111);
      const host = serverOptions?.host ?? 'localhost';

      indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_HOST%%'`, `'${host}'`);
      indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_PORT%%'`, `'${port}'`);

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
