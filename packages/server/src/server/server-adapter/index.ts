import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MastraServerBase } from '@mastra/core/server';
import type { InMemoryTaskStore } from '../a2a/store';
import { defaultAuthConfig } from '../auth/defaults';
import { canAccessPublicly, checkRules, isDevPlaygroundRequest } from '../auth/helpers';
import { generateOpenAPIDocument } from './openapi-utils';
import { SERVER_ROUTES } from './routes';
import type { ServerRoute } from './routes';

export * from './routes';
export { redactStreamChunk } from './redact';

export { WorkflowRegistry } from '../utils';

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
}

/**
 * Normalizes query parameters from various HTTP framework formats to a consistent structure.
 * Handles both single string values and arrays (for repeated query params like ?tag=a&tag=b).
 * Filters out non-string values that some frameworks may include.
 *
 * @param rawQuery - Raw query parameters from the HTTP framework (may contain strings, arrays, or nested objects)
 * @returns Normalized query parameters as Record<string, string | string[]>
 */
export function normalizeQueryParams(rawQuery: Record<string, unknown>): Record<string, QueryParamValue> {
  const queryParams: Record<string, QueryParamValue> = {};
  for (const [key, value] of Object.entries(rawQuery)) {
    if (typeof value === 'string') {
      queryParams[key] = value;
    } else if (Array.isArray(value)) {
      // Filter to only string values (some frameworks include nested objects)
      const stringValues = value.filter((v): v is string => typeof v === 'string');
      // Convert single-value arrays back to strings for compatibility
      queryParams[key] = stringValues.length === 1 ? stringValues[0]! : stringValues;
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

  constructor({
    app,
    mastra,
    bodyLimitOptions,
    tools,
    prefix = '',
    openapiPath = '',
    taskStore,
    customRouteAuthConfig,
    streamOptions,
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
  }) {
    super({ app, name: 'MastraServer' });
    this.mastra = mastra;
    this.bodyLimitOptions = bodyLimitOptions;
    this.tools = tools;
    this.prefix = prefix;
    this.openapiPath = openapiPath;
    this.taskStore = taskStore;
    this.customRouteAuthConfig = customRouteAuthConfig;
    this.streamOptions = { redact: true, ...streamOptions };

    // Automatically register this adapter with Mastra so getServerApp() works
    mastra.setMastraServer(this);
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
      console.error(err);
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
        console.error(err);
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
        console.error(err);
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

  async init() {
    this.registerContextMiddleware();
    this.registerAuthMiddleware();
    await this.registerRoutes();
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
