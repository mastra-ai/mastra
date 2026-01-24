import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import type { MastraAdmin, AdminLogger } from '@mastra/admin';
import { ConsoleAdminLogger } from '@mastra/admin';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timeout } from 'hono/timeout';

import { errorHandler } from './middleware/error-handler';
import { createRequestLoggerMiddleware } from './middleware/request-logger';
import { ADMIN_SERVER_ROUTES } from './routes';
import type {
  AdminServerConfig,
  ResolvedAdminServerConfig,
  ServerStatus,
  AdminServerContext,
  AdminServerRoute,
  CorsOptions,
} from './types';

/**
 * Hono context variables for AdminServer.
 */
interface AdminServerVariables {
  admin: MastraAdmin;
  userId?: string;
  teamId?: string;
  requestId: string;
  abortSignal: AbortSignal;
}

/**
 * Default logger for AdminServer route handlers.
 */
const serverLogger: AdminLogger = new ConsoleAdminLogger('AdminServer');

/**
 * AdminServer - HTTP API server for MastraAdmin.
 *
 * This class wraps MastraAdmin with a Hono HTTP server, following the same
 * pattern as @mastra/server wrapping Mastra. It's a thin HTTP layer that
 * delegates all business logic to MastraAdmin.
 *
 * @example
 * ```typescript
 * import { MastraAdmin } from '@mastra/admin';
 * import { AdminServer } from '@mastra/admin-server';
 *
 * const admin = new MastraAdmin({
 *   licenseKey: 'dev',
 *   storage: new PostgresAdminStorage({ ... }),
 * });
 * await admin.init();
 *
 * const server = new AdminServer({
 *   admin,
 *   port: 3000,
 *   host: '0.0.0.0',
 * });
 * await server.start();
 * ```
 */
export class AdminServer {
  private readonly app: Hono<{ Variables: AdminServerVariables }>;
  private readonly config: ResolvedAdminServerConfig;
  private readonly admin: MastraAdmin;
  private server?: ServerType;
  private startTime?: Date;

  constructor(config: AdminServerConfig) {
    this.config = this.resolveConfig(config);
    this.admin = config.admin;
    this.app = new Hono<{ Variables: AdminServerVariables }>();

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Resolve configuration with defaults.
   */
  private resolveConfig(config: AdminServerConfig): ResolvedAdminServerConfig {
    return {
      admin: config.admin,
      port: config.port ?? 3000,
      host: config.host ?? 'localhost',
      basePath: config.basePath ?? '/api',
      cors: config.cors ?? {
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Team-Id'],
        credentials: true,
      },
      rateLimit: config.rateLimit,
      timeout: config.timeout ?? 30000,
      maxBodySize: config.maxBodySize ?? 10 * 1024 * 1024, // 10MB
      enableBuildWorker: config.enableBuildWorker ?? true,
      buildWorkerIntervalMs: config.buildWorkerIntervalMs ?? 5000,
      enableHealthWorker: config.enableHealthWorker ?? true,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? 30000,
      enableWebSocket: config.enableWebSocket ?? true,
      enableRequestLogging: config.enableRequestLogging ?? process.env['NODE_ENV'] !== 'production',
      onError: config.onError,
    };
  }

  /**
   * Setup middleware.
   */
  private setupMiddleware(): void {
    const { cors: corsConfig } = this.config;

    // CORS
    if (corsConfig) {
      this.app.use('*', cors(this.convertCorsConfig(corsConfig)));
    }

    // Timeout
    this.app.use('*', timeout(this.config.timeout));

    // Request logging
    if (this.config.enableRequestLogging) {
      this.app.use('*', createRequestLoggerMiddleware());
    }

    // Error handler
    this.app.onError((err, c) => {
      if (this.config.onError) {
        const result = this.config.onError(err, {
          path: c.req.path,
          method: c.req.method,
          userId: c.get('userId'),
          teamId: c.get('teamId'),
        });
        if (result) return result;
      }
      return errorHandler(err, c);
    });

    // Context middleware - sets admin instance
    this.app.use('*', async (c, next) => {
      c.set('admin', this.admin);
      c.set('abortSignal', c.req.raw.signal);
      return next();
    });
  }

  /**
   * Convert CorsOptions to Hono cors middleware config.
   */
  private convertCorsConfig(config: CorsOptions): Parameters<typeof cors>[0] {
    return {
      origin:
        typeof config.origin === 'function'
          ? origin => ((config.origin as (origin: string) => boolean)(origin) ? origin : null)
          : (config.origin as string | string[]),
      allowMethods: config.allowMethods,
      allowHeaders: config.allowHeaders,
      exposeHeaders: config.exposeHeaders,
      maxAge: config.maxAge,
      credentials: config.credentials,
    };
  }

  /**
   * Setup routes.
   */
  private setupRoutes(): void {
    const { basePath } = this.config;

    // Health check (no auth required) - outside of basePath
    this.app.get('/health', c => c.json({ status: 'ok' }));

    // Readiness check (no auth required) - outside of basePath
    this.app.get('/ready', async c => {
      const isReady = await this.checkReadiness();
      return c.json({ ready: isReady }, isReady ? 200 : 503);
    });

    // Register all API routes
    for (const route of ADMIN_SERVER_ROUTES) {
      this.registerRoute(route, basePath);
    }
  }

  /**
   * Register a single route.
   */
  private registerRoute(route: AdminServerRoute, basePath: string): void {
    const path = `${basePath}${route.path}`;
    const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';

    this.app[method](path, async c => {
      try {
        // Build context
        const context: AdminServerContext = {
          admin: this.admin,
          userId: c.get('userId') ?? '',
          teamId: c.get('teamId'),
          abortSignal: c.get('abortSignal'),
          logger: serverLogger,
        };

        // Parse and validate params
        const urlParams = c.req.param();
        const queryParams = c.req.query();
        let body: unknown;

        if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
          body = await c.req.json().catch(() => ({}));
        }

        // Validate with Zod schemas if defined
        let validatedPath: Record<string, string> = urlParams;
        let validatedQuery: Record<string, string> = queryParams;
        let validatedBody: unknown = body;

        if (route.pathParamSchema) {
          validatedPath = route.pathParamSchema.parse(urlParams) as Record<string, string>;
        }
        if (route.queryParamSchema) {
          validatedQuery = route.queryParamSchema.parse(queryParams) as Record<string, string>;
        }
        if (route.bodySchema && body) {
          validatedBody = route.bodySchema.parse(body);
        }

        // Call handler
        const result = await route.handler({
          ...context,
          ...validatedPath,
          ...validatedQuery,
          ...(typeof validatedBody === 'object' ? validatedBody : {}),
        } as Parameters<typeof route.handler>[0]);

        // Handle response types
        if (route.responseType === 'stream') {
          return this.handleStreamResponse(result);
        }

        return c.json(result as object, 200);
      } catch (error) {
        return errorHandler(error as Error, c);
      }
    });
  }

  /**
   * Handle stream responses (SSE).
   */
  private handleStreamResponse(result: unknown): Response {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const iterable = result as AsyncIterable<unknown>;
          for await (const chunk of iterable) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  /**
   * Check if the server is ready to accept requests.
   */
  private async checkReadiness(): Promise<boolean> {
    try {
      // Check license validity
      const licenseInfo = this.admin.getLicenseInfo();
      if (!licenseInfo.valid) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start the HTTP server.
   */
  async start(): Promise<void> {
    const { port, host, basePath } = this.config;

    return new Promise(resolve => {
      this.server = serve(
        {
          fetch: this.app.fetch,
          port,
          hostname: host,
        },
        () => {
          console.info(`AdminServer listening on http://${host}:${port}`);
          console.info(`API available at http://${host}:${port}${basePath}`);
          console.info(`Health check at http://${host}:${port}/health`);
          console.info(`Readiness check at http://${host}:${port}/ready`);

          this.startTime = new Date();
          resolve();
        },
      );
    });
  }

  /**
   * Stop the server gracefully.
   */
  async stop(): Promise<void> {
    console.info('AdminServer shutting down...');

    // Close HTTP server
    if (this.server) {
      this.server.close();
    }

    console.info('AdminServer stopped');
  }

  /**
   * Get the underlying Hono app for customization.
   */
  getApp(): Hono<{ Variables: AdminServerVariables }> {
    return this.app;
  }

  /**
   * Get the MastraAdmin instance.
   */
  getAdmin(): MastraAdmin {
    return this.admin;
  }

  /**
   * Check if server is healthy.
   */
  isHealthy(): boolean {
    return this.server !== undefined;
  }

  /**
   * Get server status.
   */
  getStatus(): ServerStatus {
    const uptime = this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0;

    return {
      running: this.isHealthy(),
      uptime,
      buildWorkerActive: false, // Will be implemented in Phase 5
      healthWorkerActive: false, // Will be implemented in Phase 5
      wsConnectionCount: 0, // Will be implemented in Phase 4
      port: this.config.port,
      host: this.config.host,
    };
  }
}
