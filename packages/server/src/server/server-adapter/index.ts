import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MastraServerBase } from '@mastra/core/server';
import type { ApiRoute, HttpLoggingConfig } from '@mastra/core/server';
import { Hono } from 'hono';

import type { InMemoryTaskStore } from '../a2a/store';
import { defaultAuthConfig } from '../auth/defaults';
import { canAccessPublicly, checkRules, isDevPlaygroundRequest } from '../auth/helpers';
import { normalizeRoutePath } from '../utils';
import { generateOpenAPIDocument, convertCustomRoutesToOpenAPIPaths } from './openapi-utils';
import { SERVER_ROUTES } from './routes';
import type { ServerRoute } from './routes';

export * from './routes';
export { redactStreamChunk } from './redact';

export { WorkflowRegistry, normalizeRoutePath } from '../utils';

export interface OpenAPIConfig {
  title?: string;
  version?: string;
  description?: string;
  path?: string;
}

export interface BodyLimitOptions {
  maxSize: number;
  onError: (error: unknown) => unknown;
}

export interface StreamOptions {
  /**
   * When true (default), redacts sensitive data from stream chunks
   * (system prompts, tool definitions, API keys) before sending to clients.
   *
   * Set to false to include full request data in stream chunks (useful for
   * debugging or internal services that need access to this data).
   *
   * @default true
   */
  redact?: boolean;
}

/**
 * MCP transport options for configuring MCP HTTP and SSE transports.
 */
export interface MCPOptions {
  /**
   * When true, runs in stateless mode without session management.
   * Ideal for serverless environments (Cloudflare Workers, Vercel Edge, etc.)
   * where you can't maintain persistent connections across requests.
   *
   * @default false
   */
  serverless?: boolean;
  /**
   * Custom session ID generator function.
   */
  sessionIdGenerator?: () => string;
}

/**
 * Query parameter values parsed from HTTP requests.
 * Supports both single values and arrays (for repeated query params like ?tag=a&tag=b).
 */
export type QueryParamValue = string | string[];

/**
 * Parsed request parameters returned by getParams().
 */
export interface ParsedRequestParams {
  urlParams: Record<string, string>;
  queryParams: Record<string, QueryParamValue>;
  body: unknown;
  /**
   * Error that occurred while parsing the request body.
   * When set, the server should return a 400 Bad Request response.
   */
  bodyParseError?: {
    message: string;
  };
}

/**
 * Normalizes query parameters from various HTTP framework formats to a consistent structure.
 * Handles both single string values and arrays (for repeated query params like ?tag=a&tag=b).
 * Reconstructs bracket-notation keys (e.g., `orderBy[field]=createdAt`) into JSON strings
 * so that z.preprocess JSON.parse can handle them.
 * Filters out non-string values that some frameworks may include.
 *
 * @param rawQuery - Raw query parameters from the HTTP framework (may contain strings, arrays, or nested objects)
 * @returns Normalized query parameters as Record<string, string | string[]>
 */
export function normalizeQueryParams(rawQuery: Record<string, unknown>): Record<string, QueryParamValue> {
  const queryParams: Record<string, QueryParamValue> = {};
  // Collect bracket-notation keys: e.g., "orderBy[field]" → parent "orderBy", child "field"
  const bracketGroups: Record<string, Record<string, string>> = {};

  for (const [key, value] of Object.entries(rawQuery)) {
    const bracketMatch = key.match(/^([^[]+)\[([^\]]+)\]$/);
    if (bracketMatch) {
      const parent = bracketMatch[1]!;
      const child = bracketMatch[2]!;
      const strValue = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')[0]
        : typeof value === 'string'
          ? value
          : undefined;
      if (strValue !== undefined) {
        if (!bracketGroups[parent]) {
          bracketGroups[parent] = {};
        }
        bracketGroups[parent]![child] = strValue;
      }
    } else if (typeof value === 'string') {
      queryParams[key] = value;
    } else if (Array.isArray(value)) {
      // Filter to only string values (some frameworks include nested objects)
      const stringValues = value.filter((v): v is string => typeof v === 'string');
      // Convert single-value arrays back to strings for compatibility
      queryParams[key] = stringValues.length === 1 ? stringValues[0]! : stringValues;
    }
  }

  // Merge bracket groups as JSON strings (only if the parent key wasn't already set directly)
  for (const [parent, children] of Object.entries(bracketGroups)) {
    if (!(parent in queryParams)) {
      queryParams[parent] = JSON.stringify(children);
    }
  }

  return queryParams;
}

/**
 * Abstract base class for server adapters that handle HTTP requests.
 *
 * This class extends `MastraServerBase` to inherit app storage functionality
 * and provides the framework for registering routes, middleware, and handling requests.
 *
 * Framework-specific adapters in @mastra/hono and @mastra/express extend this class
 * (both named `MastraServer` in their respective packages) and implement the abstract
 * methods for their specific framework.
 *
 * @template TApp - The type of the server app (e.g., Hono, Express Application)
 * @template TRequest - The type of the request object
 * @template TResponse - The type of the response object
 */
export abstract class MastraServer<TApp, TRequest, TResponse> extends MastraServerBase<TApp> {
  protected mastra: Mastra;
  protected bodyLimitOptions?: BodyLimitOptions;
  protected tools?: ToolsInput;
  protected prefix?: string;
  protected openapiPath?: string;
  protected taskStore?: InMemoryTaskStore;
  protected customRouteAuthConfig?: Map<string, boolean>;
  protected streamOptions: StreamOptions;
  protected httpLoggingConfig?: HttpLoggingConfig;
  protected customApiRoutes?: ApiRoute[];
  protected mcpOptions?: MCPOptions;
  private customRouteHandler:
    | ((request: Request, env?: { requestContext?: RequestContext }) => Promise<Response>)
    | null = null;

  constructor({
    app,
    mastra,
    bodyLimitOptions,
    tools,
    prefix = '/api',
    openapiPath = '',
    taskStore,
    customRouteAuthConfig,
    streamOptions,
    customApiRoutes,
    mcpOptions,
  }: {
    app: TApp;
    mastra: Mastra;
    bodyLimitOptions?: BodyLimitOptions;
    tools?: ToolsInput;
    prefix?: string;
    openapiPath?: string;
    taskStore?: InMemoryTaskStore;
    customRouteAuthConfig?: Map<string, boolean>;
    streamOptions?: StreamOptions;
    customApiRoutes?: ApiRoute[];
    /**
     * MCP transport options applied to all MCP HTTP and SSE routes.
     * Individual routes can override these via MCPHttpTransportResult.mcpOptions.
     */
    mcpOptions?: MCPOptions;
  }) {
    super({ app, name: 'MastraServer' });
    this.mastra = mastra;
    this.bodyLimitOptions = bodyLimitOptions;
    this.tools = tools;
    this.prefix = normalizeRoutePath(prefix);
    this.openapiPath = openapiPath;
    this.taskStore = taskStore;
    this.customRouteAuthConfig = customRouteAuthConfig;
    this.streamOptions = { redact: true, ...streamOptions };
    this.customApiRoutes = customApiRoutes;
    this.mcpOptions = mcpOptions;

    // Parse HTTP logging configuration
    const serverConfig = mastra.getServer();
    this.httpLoggingConfig = this.parseLoggingConfig(serverConfig?.build?.apiReqLogs);

    // Automatically register this adapter with Mastra so getServerApp() works
    mastra.setMastraServer(this);
  }

  /**
   * Parses the apiReqLogs configuration into a normalized HttpLoggingConfig.
   * @param config - The raw config value from server.build.apiReqLogs
   * @returns Normalized HttpLoggingConfig or undefined if disabled
   */
  private parseLoggingConfig(config?: boolean | HttpLoggingConfig): HttpLoggingConfig | undefined {
    if (config === true) {
      // Default configuration when enabled with just `true`
      return {
        enabled: true,
        level: 'info',
        redactHeaders: ['authorization', 'cookie'],
      };
    }
    if (typeof config === 'object' && config.enabled) {
      // Merge user config with defaults
      return {
        enabled: true,
        level: config.level || 'info',
        excludePaths: config.excludePaths,
        includeHeaders: config.includeHeaders,
        includeQueryParams: config.includeQueryParams,
        redactHeaders: [...new Set([...['authorization', 'cookie'], ...(config.redactHeaders || [])])],
      };
    }
    return undefined;
  }

  /**
   * Determines if a request to the given path should be logged.
   * @param path - The request path to check
   * @returns true if the request should be logged, false otherwise
   */
  protected shouldLogRequest(path: string): boolean {
    if (!this.httpLoggingConfig?.enabled) {
      return false;
    }

    // Uses segment-aware matching so '/health' excludes '/health' and '/health/deep' but not '/healthcheck'
    const excludePaths = this.httpLoggingConfig.excludePaths || [];
    return !excludePaths.some((excluded: string) => path === excluded || path.startsWith(excluded + '/'));
  }

  protected mergeRequestContext({
    paramsRequestContext,
    bodyRequestContext,
  }: {
    paramsRequestContext?: Record<string, any>;
    bodyRequestContext?: Record<string, any>;
  }): RequestContext {
    const requestContext = new RequestContext();
    if (bodyRequestContext) {
      for (const [key, value] of Object.entries(bodyRequestContext)) {
        requestContext.set(key, value);
      }
    }
    if (paramsRequestContext) {
      for (const [key, value] of Object.entries(paramsRequestContext)) {
        requestContext.set(key, value);
      }
    }
    return requestContext;
  }

  /**
   * Check if the current request should be authenticated/authorized.
   * Returns null if auth passes, or an error response if it fails.
   *
   * This method encapsulates the complete auth flow:
   * 1. Check if route requires auth (route.requiresAuth)
   * 2. Check if it's a dev playground request
   * 3. Check if path is publicly accessible
   * 4. Perform authentication (verify token)
   * 5. Perform authorization (check rules, authorizeUser, authorize)
   */
  protected async checkRouteAuth(
    route: ServerRoute,
    context: {
      path: string;
      method: string;
      getHeader: (name: string) => string | undefined;
      getQuery: (name: string) => string | undefined;
      requestContext: RequestContext;
    },
  ): Promise<{ status: number; error: string } | null> {
    const authConfig = this.mastra.getServer()?.auth;

    // No auth config means no auth required
    if (!authConfig) {
      return null;
    }

    // Check route-level requiresAuth flag first (explicit per-route setting)
    // Default to true (protected) if not specified for backwards compatibility
    if (route.requiresAuth === false) {
      return null; // Route explicitly opts out of auth
    }

    // Dev playground bypass
    if (isDevPlaygroundRequest(context.path, context.method, context.getHeader, authConfig)) {
      return null;
    }

    // Check if path is publicly accessible via auth config patterns
    if (canAccessPublicly(context.path, context.method, authConfig)) {
      return null;
    }

    // --- Authentication ---
    const authHeader = context.getHeader('authorization');
    let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
      token = context.getQuery('apiKey') || null;
    }

    if (!token) {
      return { status: 401, error: 'Authentication required' };
    }

    let user: unknown;
    try {
      if (typeof authConfig.authenticateToken === 'function') {
        // Note: We pass null as request since adapters have different request types
        // If specific request is needed, authenticateToken can use data from token
        user = await authConfig.authenticateToken(token, null as any);
      } else {
        return { status: 401, error: 'No token verification method configured' };
      }

      if (!user) {
        return { status: 401, error: 'Invalid or expired token' };
      }

      context.requestContext.set('user', user);
    } catch (err) {
      this.mastra.getLogger()?.error('Authentication error', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      });
      return { status: 401, error: 'Invalid or expired token' };
    }

    // --- Authorization ---

    // Check authorizeUser (simplified authorization)
    if ('authorizeUser' in authConfig && typeof authConfig.authorizeUser === 'function') {
      try {
        const isAuthorized = await authConfig.authorizeUser(user, null as any);
        if (!isAuthorized) {
          return { status: 403, error: 'Access denied' };
        }
        return null; // Authorization passed
      } catch (err) {
        this.mastra.getLogger()?.error('Authorization error in authorizeUser', {
          error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        });
        return { status: 500, error: 'Authorization error' };
      }
    }

    // Check authorize (path/method-based authorization)
    if ('authorize' in authConfig && typeof authConfig.authorize === 'function') {
      try {
        const isAuthorized = await authConfig.authorize(context.path, context.method, user, null as any);
        if (!isAuthorized) {
          return { status: 403, error: 'Access denied' };
        }
        return null; // Authorization passed
      } catch (err) {
        this.mastra.getLogger()?.error('Authorization error in authorize', {
          error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
          path: context.path,
          method: context.method,
        });
        return { status: 500, error: 'Authorization error' };
      }
    }

    // Check custom rules
    if ('rules' in authConfig && authConfig.rules && authConfig.rules.length > 0) {
      const isAuthorized = await checkRules(authConfig.rules, context.path, context.method, user);
      if (isAuthorized) {
        return null; // Authorization passed
      }
      return { status: 403, error: 'Access denied' };
    }

    // Check default rules
    if (defaultAuthConfig.rules && defaultAuthConfig.rules.length > 0) {
      const isAuthorized = await checkRules(defaultAuthConfig.rules, context.path, context.method, user);
      if (isAuthorized) {
        return null; // Authorization passed
      }
    }

    return { status: 403, error: 'Access denied' };
  }

  abstract stream(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract getParams(route: ServerRoute, request: TRequest): Promise<ParsedRequestParams>;
  abstract sendResponse(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract registerRoute(app: TApp, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void>;
  abstract registerContextMiddleware(): void;
  abstract registerAuthMiddleware(): void;
  abstract registerHttpLoggingMiddleware(): void;

  async init() {
    this.registerContextMiddleware();
    this.registerAuthMiddleware();
    this.registerHttpLoggingMiddleware();
    await this.registerCustomApiRoutes();
    await this.registerRoutes();
  }

  /**
   * Override in adapters to register custom API routes defined via registerApiRoute().
   * Called by init() between registerAuthMiddleware() and registerRoutes().
   */
  async registerCustomApiRoutes(): Promise<void> {
    // Default no-op. Adapters override this to register custom routes
    // using their framework-specific middleware.
  }

  /**
   * Creates an internal Hono sub-app with all custom API routes registered.
   * Stores the handler on this instance for use by handleCustomRouteRequest().
   * Returns true if custom routes were found and registered.
   */
  protected async buildCustomRouteHandler(): Promise<boolean> {
    const routes = this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes;
    if (!routes || routes.length === 0) return false;

    const NOT_FOUND_HEADER = 'x-mastra-custom-route-not-found';
    const mastra = this.mastra;

    const app = new Hono<{
      Bindings: { requestContext?: RequestContext };
      Variables: { mastra: Mastra; requestContext: RequestContext };
    }>();

    // Internal context middleware — sets variables that custom route handlers expect
    app.use('*', async (c, next) => {
      c.set('mastra', mastra);
      c.set('requestContext', c.env?.requestContext ?? new RequestContext());
      await next();
    });

    // Register each custom route
    for (const route of routes) {
      const handler =
        'handler' in route && route.handler
          ? route.handler
          : 'createHandler' in route
            ? await route.createHandler({ mastra })
            : undefined;
      if (!handler) continue;

      const middlewares: any[] = [];
      if (route.middleware) {
        middlewares.push(...(Array.isArray(route.middleware) ? route.middleware : [route.middleware]));
      }

      const allHandlers = [...middlewares, handler];
      if (route.method === 'ALL') {
        app.all(route.path, allHandlers[0]!, ...allHandlers.slice(1));
      } else {
        app.on(route.method, route.path, allHandlers[0]!, ...allHandlers.slice(1));
      }
    }

    // Mark unmatched requests so the adapter bridge can fall through to next()
    app.notFound(() => new Response(null, { status: 404, headers: { [NOT_FOUND_HEADER]: 'true' } }));

    this.customRouteHandler = async (request, env) => app.fetch(request, env);
    return true;
  }

  /**
   * Forwards a request to the internal custom route handler.
   * Returns the Response if a custom route matched, or null to fall through.
   * Used by non-Hono adapter bridges.
   */
  protected async handleCustomRouteRequest(
    url: string,
    method: string,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
    requestContext?: RequestContext,
  ): Promise<Response | null> {
    if (!this.customRouteHandler) return null;

    const fetchHeaders = new Headers();
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') fetchHeaders.set(key, value);
      else if (Array.isArray(value))
        value.forEach(v => {
          fetchHeaders.append(key, v);
        });
    }

    const init: RequestInit = { method, headers: fetchHeaders };
    if (['POST', 'PUT', 'PATCH'].includes(method) && body !== undefined) {
      const contentType = (typeof headers['content-type'] === 'string' ? headers['content-type'] : '') || '';
      if (contentType.includes('application/json')) {
        init.body = JSON.stringify(body);
      } else if (typeof body === 'string') {
        init.body = body;
      } else if (body instanceof ArrayBuffer || body instanceof Uint8Array || body instanceof ReadableStream) {
        init.body = body as any;
      }
    }

    const request = new globalThis.Request(url, init);
    const response = await this.customRouteHandler(request, { requestContext });

    if (response.headers.get('x-mastra-custom-route-not-found') === 'true') return null;
    return response;
  }

  /**
   * Pipes a custom route Response to a Node.js ServerResponse (http.ServerResponse).
   * Works with Koa (ctx.res), Express (res), and Fastify (reply.raw).
   */
  protected async writeCustomRouteResponse(
    response: Response,
    nodeRes: {
      writeHead(status: number, headers: Record<string, string | string[]>): void;
      write(chunk: unknown): void;
      end(data?: string): void;
    },
  ): Promise<void> {
    const headers: Record<string, string | string[]> = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') {
        headers[key] = value;
      }
    });
    const setCookies = response.headers.getSetCookie?.();
    if (setCookies && setCookies.length > 0) {
      headers['set-cookie'] = setCookies;
    }
    nodeRes.writeHead(response.status, headers);

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          nodeRes.write(value);
        }
      } finally {
        nodeRes.end();
      }
    } else {
      nodeRes.end(await response.text());
    }
  }

  async registerOpenAPIRoute(app: TApp, config: OpenAPIConfig = {}, { prefix }: { prefix?: string }): Promise<void> {
    const {
      title = 'Mastra API',
      version = '1.0.0',
      description = 'Mastra Server API',
      path = '/openapi.json',
    } = config;

    const openApiSpec = generateOpenAPIDocument(SERVER_ROUTES, {
      title,
      version,
      description,
    });

    // Set the servers field so Swagger UI knows routes are served under the prefix
    if (prefix) {
      openApiSpec.servers = [{ url: prefix }];
    }

    // Merge custom API routes into the OpenAPI spec
    if (this.customApiRoutes && this.customApiRoutes.length > 0) {
      const customPaths = convertCustomRoutesToOpenAPIPaths(this.customApiRoutes);
      openApiSpec.paths = { ...openApiSpec.paths, ...customPaths };
    }

    const openApiRoute: ServerRoute = {
      method: 'GET',
      path,
      responseType: 'json',
      handler: async () => openApiSpec,
    };

    await this.registerRoute(app, openApiRoute, { prefix });
  }

  async registerRoutes(): Promise<void> {
    // Register routes sequentially to maintain order - important for routers where
    // more specific routes (e.g., /versions/compare) must be registered before
    // parameterized routes (e.g., /versions/:versionId)
    for (const route of SERVER_ROUTES) {
      await this.registerRoute(this.app, route, { prefix: this.prefix });
    }

    if (this.openapiPath) {
      await this.registerOpenAPIRoute(
        this.app,
        {
          title: 'Mastra API',
          version: '1.0.0',
          description: 'Mastra Server API',
          path: this.openapiPath,
        },
        { prefix: this.prefix },
      );
    }
  }

  async parsePathParams(route: ServerRoute, params: Record<string, string>): Promise<Record<string, any>> {
    const pathParamSchema = route.pathParamSchema;
    if (!pathParamSchema) {
      return params;
    }

    return pathParamSchema.parseAsync(params);
  }

  async parseQueryParams(route: ServerRoute, params: Record<string, QueryParamValue>): Promise<Record<string, any>> {
    const queryParamSchema = route.queryParamSchema;
    if (!queryParamSchema) {
      return params;
    }

    return queryParamSchema.parseAsync(params);
  }

  async parseBody(route: ServerRoute, body: unknown): Promise<unknown> {
    const bodySchema = route.bodySchema;
    if (!bodySchema) {
      return body;
    }

    return bodySchema.parseAsync(body);
  }
}
