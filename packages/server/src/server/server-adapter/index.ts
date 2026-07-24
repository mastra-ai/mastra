import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ToolsInput } from '@mastra/core/agent';
import type { FGARouteConfig, FGARouteInfo, IFGAProvider, MastraFGAPermissionInput } from '@mastra/core/auth/ee';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MastraServerBase } from '@mastra/core/server';
import type { ApiRoute, HttpLoggingConfig, ValidationErrorContext, ValidationErrorResponse } from '@mastra/core/server';
import type { ExecutionContext } from 'hono';
import { Hono } from 'hono';
import type { ZodError } from 'zod/v4';
import { z } from 'zod/v4';

import type { InMemoryTaskStore } from '../a2a/store';
import { coreAuthMiddleware } from '../auth/helpers';
import {
  MASTRA_AUTH_MODE_KEY,
  MASTRA_CLIENT_TYPE_HEADER,
  MASTRA_IS_STUDIO_KEY,
  isReservedRequestContextKey,
  isStudioClientTypeHeader,
} from '../constants';
import type { MastraAuthMode } from '../constants';
import { formatZodError } from '../handlers/error';
export { isZodError, type ZodErrorLike } from '../handlers/error';
import { normalizeRoutePath } from '../utils';
import { generateOpenAPIDocument, convertCustomRoutesToOpenAPIPaths } from './openapi-utils';
import type { ServerRoute } from './routes';
import { SERVER_ROUTES, getEffectivePermission } from './routes';
import { getBuiltInRouteFGAConfig } from './routes/fga-manifest';

export * from './routes';
export { redactStreamChunk } from './redact';
export { serializeStreamChunk, type SerializedStreamChunk } from './serialize';
export {
  MASTRA_AUTH_MODE_KEY,
  MASTRA_CLIENT_TYPE_HEADER,
  MASTRA_IS_STUDIO_KEY,
  MASTRA_STUDIO_CLIENT_TYPE,
  isReservedRequestContextKey,
  isStudioClientTypeHeader,
} from '../constants';
export type { MastraAuthMode } from '../constants';

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

function isAbortSignalError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const { code, name } = error as { code?: string; name?: string };
  return name === 'AbortError' || code === 'ABORT_ERR';
}

function isExpectedResponseCloseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const { code } = error as { code?: string };
  return (
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ERR_STREAM_DESTROYED' ||
    code === 'ERR_STREAM_WRITE_AFTER_END' ||
    code === 'ERR_STREAM_PREMATURE_CLOSE'
  );
}

function isResponseClosed(response: { writableEnded?: boolean; destroyed?: boolean }): boolean {
  return Boolean(response.writableEnded || response.destroyed);
}

function isProtectedFGARoute(route: Pick<ServerRoute, 'requiresAuth'>): boolean {
  return route.requiresAuth !== false;
}

function formatRoute(route: Pick<ServerRoute, 'method' | 'path'>): string {
  return `${route.method} ${route.path}`;
}

function getFGAProvider(mastra: any, requestContext?: RequestContext): IFGAProvider | undefined {
  // If we have request context, check auth mode to determine which FGA provider to use
  if (requestContext) {
    const authMode = requestContext.get(MASTRA_AUTH_MODE_KEY);
    if (authMode === 'studio') {
      const studioFga = mastra?.getStudio?.()?.fga;
      if (studioFga) return studioFga as IFGAProvider;
    }
  }
  // Fall back to server FGA
  return mastra?.getServer?.()?.fga as IFGAProvider | undefined;
}

function getFGARouteInfo(route: ServerRoute): FGARouteInfo {
  return {
    path: route.path,
    method: route.method,
    requiresAuth: route.requiresAuth,
    requiresPermission: route.requiresPermission,
    fga: route.fga,
  };
}

function getRoutePermissions(route: ServerRoute): MastraFGAPermissionInput[] {
  return [getEffectivePermission(route), route.fga?.permission]
    .flatMap(value => (Array.isArray(value) ? value : [value]))
    .filter((permission): permission is MastraFGAPermissionInput => Boolean(permission));
}

async function resolveRouteFGAConfig(
  fgaProvider: IFGAProvider,
  route: ServerRoute,
  requestContext: RequestContext,
  params: Record<string, unknown>,
): Promise<FGARouteConfig | null | undefined> {
  if (route.fga) {
    return route.fga;
  }

  const resolvedConfig = await fgaProvider.resolveRouteFGA?.({
    route: getFGARouteInfo(route),
    params,
    requestContext,
  });
  if (resolvedConfig) {
    return resolvedConfig;
  }

  return getBuiltInRouteFGAConfig(route);
}

function getSchemaTypeName(schema: z.ZodTypeAny): string | undefined {
  const schemaDef = (schema as any)?._def ?? (schema as any)?.def;
  return schemaDef?.typeName ?? schemaDef?.type;
}

function unwrapOptionalNullable(schema: z.ZodTypeAny): z.ZodTypeAny {
  let inner = schema;
  let typeName = getSchemaTypeName(inner);

  while (
    typeName === 'ZodOptional' ||
    typeName === 'ZodNullable' ||
    typeName === 'optional' ||
    typeName === 'nullable'
  ) {
    const innerDef = (inner as any)?._def ?? (inner as any)?.def;
    if (!innerDef?.innerType) {
      return inner;
    }
    inner = innerDef.innerType;
    typeName = getSchemaTypeName(inner);
  }

  return inner;
}

function parseComplexQueryParams(
  queryParamSchema: z.ZodTypeAny,
  params: Record<string, QueryParamValue>,
): Record<string, QueryParamValue | unknown> {
  if (!(queryParamSchema instanceof z.ZodObject)) {
    return params;
  }

  const parsedParams: Record<string, QueryParamValue | unknown> = { ...params };
  const shape = queryParamSchema.shape as Record<string, z.ZodTypeAny>;

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const rawValue = parsedParams[key];
    if (typeof rawValue !== 'string') {
      continue;
    }

    const unwrappedField = unwrapOptionalNullable(fieldSchema);
    const typeName = getSchemaTypeName(unwrappedField);
    const isComplex =
      typeName === 'ZodObject' ||
      typeName === 'ZodArray' ||
      typeName === 'ZodRecord' ||
      typeName === 'object' ||
      typeName === 'array' ||
      typeName === 'record';

    if (!isComplex) {
      continue;
    }

    try {
      parsedParams[key] = JSON.parse(rawValue);
    } catch {
      // Keep original string; schema validation will surface a clear error.
    }
  }

  return parsedParams;
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
    | ((
        request: Request,
        env?: { requestContext?: RequestContext },
        executionCtx?: ExecutionContext,
      ) => Promise<Response>)
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
        if (isReservedRequestContextKey(key)) continue;
        requestContext.set(key, value);
      }
    }
    if (paramsRequestContext) {
      for (const [key, value] of Object.entries(paramsRequestContext)) {
        if (isReservedRequestContextKey(key)) continue;
        requestContext.set(key, value);
      }
    }
    return requestContext;
  }

  protected applyRequestMetadataToContext({
    requestContext,
    getHeader,
  }: {
    requestContext: RequestContext;
    getHeader: (name: string) => string | undefined;
  }): void {
    if (isStudioClientTypeHeader(getHeader(MASTRA_CLIENT_TYPE_HEADER))) {
      requestContext.set(MASTRA_IS_STUDIO_KEY, true);
    }
  }

  /**
   * Determines which auth configuration to use for the current request.
   *
   * Request routing logic:
   * 1. If `x-mastra-client-type: studio` header is present AND `studio.auth` is configured:
   *    → Use studio auth (for internal team members accessing Studio UI)
   * 2. If studio header is present but `studio.auth` is NOT configured:
   *    → No auth required (Studio development mode)
   * 3. Otherwise:
   *    → Use server auth (for external customers calling API)
   *
   * Security note: The header is only for routing - auth validation happens
   * via session cookies/tokens. If someone spoofs the studio header but doesn't
   * have a valid studio session, they'll get a 401 (not fall back to server auth).
   */
  protected getEffectiveAuthConfig(
    getHeader: (name: string) => string | undefined,
  ): { authConfig: unknown; authMode: MastraAuthMode } | null {
    const isStudioRequest = isStudioClientTypeHeader(getHeader(MASTRA_CLIENT_TYPE_HEADER));
    const studioAuth = this.mastra.getStudio?.()?.auth;
    const serverAuth = this.mastra.getServer()?.auth;

    // Dual auth is opt-in: if studio.auth is configured, Studio requests use it exclusively
    if (isStudioRequest && studioAuth) {
      return { authConfig: studioAuth, authMode: 'studio' };
    }

    // Otherwise (non-studio request, OR studio request without studio.auth configured),
    // fall back to server.auth for backward compatibility
    if (serverAuth) {
      return { authConfig: serverAuth, authMode: 'server' };
    }

    // No auth configured
    return null;
  }

  /**
   * Gets the effective RBAC provider for the current request based on auth mode.
   */
  protected getEffectiveRBACProvider(requestContext: RequestContext) {
    const authMode = requestContext.get(MASTRA_AUTH_MODE_KEY) as MastraAuthMode | undefined;

    if (authMode === 'studio') {
      return this.mastra.getStudio?.()?.rbac ?? this.mastra.getServer()?.rbac;
    }

    return this.mastra.getServer()?.rbac;
  }

  /**
   * Gets the effective FGA provider for the current request based on auth mode.
   */
  protected getEffectiveFGAProvider(requestContext: RequestContext) {
    const authMode = requestContext.get(MASTRA_AUTH_MODE_KEY) as MastraAuthMode | undefined;

    if (authMode === 'studio') {
      return this.mastra.getStudio?.()?.fga ?? this.mastra.getServer()?.fga;
    }

    return this.mastra.getServer()?.fga;
  }

  /**
   * Check if the current request should be authenticated/authorized.
   * Returns null if auth passes, or an error response if it fails.
   *
   * This is a thin wrapper around coreAuthMiddleware that:
   * 1. Routes to the correct auth provider (studio vs server) based on request headers
   * 2. Handles route-level requiresAuth opt-out (not available in global middleware)
   * 3. Delegates all other auth logic to coreAuthMiddleware
   * 4. Translates the AuthResult into the {status, error} format adapters expect
   *
   * Security: When `x-mastra-client-type: studio` header is present and studio auth
   * is configured, we ONLY use studio auth. If authentication fails, we return 401
   * and redirect to login - we do NOT fall back to server auth. This prevents
   * external users from spoofing the studio header to access Studio UI.
   */
  protected async checkRouteAuth(
    route: ServerRoute,
    context: {
      path: string;
      method: string;
      getHeader: (name: string) => string | undefined;
      getQuery: (name: string) => string | undefined;
      requestContext: RequestContext;
      /** Raw Request object for cookie-based auth providers */
      request?: Request;
      /** Build framework-specific context for authorize() callback */
      buildAuthorizeContext?: () => unknown;
    },
  ): Promise<{ status: number; error: string; headers?: Record<string, string> } | null> {
    // Determine which auth config to use based on request type
    const effectiveAuth = this.getEffectiveAuthConfig(context.getHeader);

    // No auth config means no auth required
    if (!effectiveAuth) {
      return null;
    }

    const { authConfig, authMode } = effectiveAuth;

    // Store auth mode in request context for downstream RBAC/FGA provider selection
    context.requestContext.set(MASTRA_AUTH_MODE_KEY, authMode);

    // Check route-level requiresAuth flag first (explicit per-route setting)
    // This opt-out is route-specific and not available in the global middleware
    if (route.requiresAuth === false) {
      return null;
    }

    // Extract token from headers/query
    const authHeader = context.getHeader('authorization');
    let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      token = context.getQuery('apiKey') || null;
    }

    const fallbackHeaders = new Headers();
    for (const headerName of ['authorization', 'cookie']) {
      const headerValue = context.getHeader(headerName);
      if (headerValue) {
        fallbackHeaders.set(headerName, headerValue);
      }
    }

    // Delegate to coreAuthMiddleware for all auth logic
    const result = await coreAuthMiddleware({
      path: context.path,
      method: context.method,
      getHeader: context.getHeader,
      mastra: this.mastra,
      authConfig: authConfig as any,
      customRouteAuthConfig: this.customRouteAuthConfig,
      requestContext: context.requestContext,
      rawRequest:
        context.request ??
        new Request(`http://localhost${context.path}`, { method: context.method, headers: fallbackHeaders }),
      token,
      buildAuthorizeContext: context.buildAuthorizeContext ?? (() => null),
      requiresAuth: route.requiresAuth,
    });

    if (result.action === 'next') {
      // Pass through any refresh headers (e.g. Set-Cookie from transparent session refresh)
      if (result.headers) {
        return { status: 200, error: '', headers: result.headers };
      }
      return null;
    }

    // Translate AuthResult error to the {status, error} format adapters expect
    const errorBody = result.body as { error?: string } | undefined;
    return { status: result.status, error: errorBody?.error ?? 'Access denied', headers: result.headers };
  }

  /**
   * Check if the user has the required permission for a route.
   *
   * Uses convention-based permission derivation:
   * 1. If route has explicit `requiresPermission`, use that
   * 2. Otherwise, derive permission from path/method (e.g., GET /agents → agents:read)
   * 3. Routes with `requiresAuth: false` skip permission checks
   *
   * When the route specifies an array of permissions, the user needs ANY ONE
   * of them (logical OR).
   *
   * @param route - The route being accessed
   * @param userPermissions - The user's permissions from the request context
   * @returns Error response if permission denied, null if allowed
   */
  /**
   * Check if the user has the required permission for a route.
   *
   * Uses convention-based permission derivation:
   * 1. If route has explicit `requiresPermission`, use that
   * 2. Otherwise, derive permission from path/method (e.g., GET /agents → agents:read)
   * 3. Routes with `requiresAuth: false` skip permission checks
   *
   * Permission checks use the RBAC provider that corresponds to the auth mode
   * (studio vs server) that was used for authentication.
   *
   * @param route - The route being accessed
   * @param userPermissions - The user's permissions from the request context
   * @param hasPermissionFn - Function to check if user permissions match required permission
   * @param requestContext - Request context to determine which RBAC provider to use
   * @returns Error response if permission denied, null if allowed
   */
  protected checkRoutePermission(
    route: ServerRoute,
    userPermissions: string[] | undefined,
    hasPermissionFn: (userPerms: string[], required: string) => boolean,
    requestContext?: RequestContext,
  ): { status: number; error: string; message: string } | null {
    // If RBAC is not configured, skip permission checks entirely
    // Auth-only mode = authenticated users get full access
    const rbacProvider = requestContext ? this.getEffectiveRBACProvider(requestContext) : this.mastra.getServer()?.rbac;

    if (!rbacProvider) {
      return null;
    }

    // Get the effective permission (explicit or derived)
    const requiredPermission = getEffectivePermission(route);

    // No permission required (public route or couldn't derive)
    if (!requiredPermission) {
      return null;
    }

    // Check if user has the required permission(s)
    // When an array is provided, user needs ANY ONE of them (logical OR)
    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasAny = userPermissions && permissions.some(perm => hasPermissionFn(userPermissions, perm));

    if (!hasAny) {
      return {
        status: 403,
        error: 'Forbidden',
        message: `Missing required permission: ${permissions.join(' or ')}`,
      };
    }

    return null;
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
    await this.validateEELicense();
    await this.validateAgentBuilderLicense();
    await this.validateFGAPolicyCoverage();
    await this.registerCustomApiRoutes();
    await this.registerRoutes();
  }

  /**
   * Validate that EE features have a valid license in production.
   * Throws if RBAC or FGA is configured without a valid license outside dev/test environments.
   */
  async validateEELicense(): Promise<void> {
    const serverConfig = this.mastra.getServer();
    const studioConfig = this.mastra.getStudio?.();
    // Check both server and studio configs for EE features
    const configuredFeatures = [
      serverConfig?.rbac || studioConfig?.rbac ? 'RBAC' : null,
      serverConfig?.fga || studioConfig?.fga ? 'FGA' : null,
    ].filter((feature): feature is string => feature !== null);

    if (configuredFeatures.length === 0) return;

    try {
      const { isEEEnabled } = await import('@mastra/core/auth/ee');
      if (!isEEEnabled()) {
        const featureList = configuredFeatures.join(' and ');
        throw new Error(
          `[mastra/auth-ee] ${featureList} ${configuredFeatures.length === 1 ? 'is' : 'are'} configured but no valid EE license was found.\n` +
            `${featureList} ${configuredFeatures.length === 1 ? 'requires' : 'require'} a Mastra Enterprise License for production use.\n` +
            'Set the MASTRA_EE_LICENSE environment variable with your license key.\n' +
            'Learn more: https://github.com/mastra-ai/mastra/blob/main/ee/LICENSE',
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('[mastra/auth-ee]')) {
        throw err;
      }
      // @mastra/core/auth/ee module not available; EE authorization cannot function.
      throw new Error(
        `[mastra/auth-ee] ${configuredFeatures.join(' and ')} ${configuredFeatures.length === 1 ? 'is' : 'are'} configured but the EE module (@mastra/core/auth/ee) could not be loaded.\n` +
          'Ensure @mastra/core is updated to a version that includes EE support.',
      );
    }
  }

  /**
   * Validate that an Agent Builder configuration has a valid EE license.
   * Throws if the editor is configured with builder support but no valid EE license is available.
   */
  async validateAgentBuilderLicense(): Promise<void> {
    const editor = this.mastra.getEditor();
    if (!editor?.hasEnabledBuilderConfig?.()) return;

    try {
      const { isEEEnabled, captureEEEvent, getEETelemetryFallbackDistinctId, getSafeLicenseSummary } =
        await import('@mastra/core/auth/ee');
      if (!isEEEnabled()) {
        throw new Error(
          '[mastra/auth-ee] Agent Builder is configured but no valid EE license was found.\n' +
            'Agent Builder requires a Mastra Enterprise License for production use.\n' +
            'Set the MASTRA_EE_LICENSE environment variable with your license key.\n' +
            'Learn more: https://github.com/mastra-ai/mastra/blob/main/ee/LICENSE',
        );
      }

      try {
        const license = getSafeLicenseSummary();
        captureEEEvent('ee_feature_used', license.anonymousId || getEETelemetryFallbackDistinctId(), {
          feature: 'builder',
          license_valid: license.valid,
          license_hash: license.licenseHash,
          is_dev_environment: license.isDevEnvironment,
        });
      } catch {
        // Telemetry must never affect server startup.
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('[mastra/auth-ee]')) {
        throw err;
      }
      // @mastra/core/auth/ee module not available — Agent Builder cannot function
      throw new Error(
        '[mastra/auth-ee] Agent Builder is configured but the EE module (@mastra/core/auth/ee) could not be loaded.\n' +
          'Ensure @mastra/core is updated to a version that includes EE support.',
      );
    }
  }

  /**
   * Validate route-level FGA policy coverage when an FGA provider opts into
   * startup checks.
   */
  async validateFGAPolicyCoverage(): Promise<void> {
    const serverConfig = this.mastra.getServer();
    const studioConfig = this.mastra.getStudio?.();
    // Check both server and studio FGA providers
    const fgaProvider = serverConfig?.fga ?? studioConfig?.fga;
    if (!fgaProvider) return;

    const customRoutes = (this.customApiRoutes ?? serverConfig?.apiRoutes ?? []).filter(
      route => !route._mastraInternal,
    );
    const routes = [...SERVER_ROUTES, ...customRoutes] as ServerRoute[];

    if (fgaProvider.validatePermissions) {
      const permissions = [...new Set(routes.flatMap(route => getRoutePermissions(route)))];
      await fgaProvider.validatePermissions(permissions);
    }

    const auditMode = fgaProvider.auditProtectedRoutes ?? (fgaProvider.requireForProtectedRoutes ? 'warn' : false);
    if (!auditMode || fgaProvider.resolveRouteFGA) return;

    const missingRoutes = routes.filter(
      route => isProtectedFGARoute(route) && !route.fga && !getBuiltInRouteFGAConfig(route),
    );

    if (missingRoutes.length === 0) return;

    const routeList = missingRoutes.map(route => formatRoute(route as ServerRoute));
    const message =
      `[mastra/auth-ee] FGA is configured but ${missingRoutes.length} protected route` +
      `${missingRoutes.length === 1 ? ' is' : 's are'} missing FGA metadata: ${routeList.join(', ')}`;

    if (auditMode === 'error') {
      throw new Error(message);
    }

    this.mastra.getLogger()?.warn(message, {
      routes: routeList,
      count: missingRoutes.length,
    });
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
   * Validates that no custom route path collides with the built-in route prefix.
   * Throws if any route path starts with the server's `apiPrefix`.
   */
  protected validateCustomRoutePaths(routes: ApiRoute[]): void {
    const prefix = this.prefix ?? '';
    if (!prefix) return;
    for (const route of routes) {
      if (route._mastraInternal) continue;
      if (route.path.startsWith(`${prefix}/`) || route.path === prefix) {
        throw new Error(
          `Custom API route "${route.path}" must not start with "${prefix}" — ` +
            `that path is reserved for built-in Mastra routes. ` +
            `Choose a different path (e.g. "${route.path.replace(prefix, '/custom')}").`,
        );
      }
    }
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

    // Propagate the server's onError handler so errors from custom route handlers
    // are caught here (not swallowed by Hono's default plain-text 500).
    const serverOnError = this.mastra.getServer()?.onError;
    app.onError((err, c) => {
      if (serverOnError) {
        return serverOnError(err, c as unknown as Parameters<typeof serverOnError>[1]);
      }
      // Log before responding — otherwise the error is invisible on the server
      // and the client only ever sees an opaque 500.
      this.mastra.getLogger()?.error(`Custom route handler failed: ${c.req.method} ${c.req.path}`, {
        method: c.req.method,
        path: c.req.path,
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
      return c.json({ error: 'Internal Server Error' }, 500);
    });

    this.validateCustomRoutePaths(routes);

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

    // Forward the platform execution context (e.g. Cloudflare Workers' `waitUntil`)
    // into the internal app so custom route handlers can keep background work
    // alive after the response is sent. Without this third arg, serverless
    // runtimes freeze the invocation on return and kill any in-flight work.
    this.customRouteHandler = async (request, env, executionCtx) => app.fetch(request, env, executionCtx);
    return true;
  }

  /**
   * Forwards a request to the internal custom route handler.
   * Returns the Response if a custom route matched, or null to fall through.
   */
  protected async handleCustomRouteRequest(
    url: string,
    method: string,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
    requestContext?: RequestContext,
    signal?: AbortSignal,
    executionCtx?: ExecutionContext,
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

    const init: RequestInit = { method, headers: fetchHeaders, signal };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && body !== undefined) {
      if (body instanceof ArrayBuffer || body instanceof Uint8Array || body instanceof ReadableStream) {
        init.body = body as any;
        if (body instanceof ReadableStream) {
          (init as any).duplex = 'half';
        }
      } else {
        const contentType = (typeof headers['content-type'] === 'string' ? headers['content-type'] : '') || '';
        if (contentType.includes('application/json')) {
          init.body = JSON.stringify(body);
        } else if (typeof body === 'string') {
          init.body = body;
        }
      }
    }

    const request = new globalThis.Request(url, init);
    const response = await this.customRouteHandler(request, { requestContext }, executionCtx);

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
      writableEnded?: boolean;
      destroyed?: boolean;
    } & NodeJS.WritableStream,
    signal?: AbortSignal,
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
    if (isResponseClosed(nodeRes)) {
      await response.body?.cancel();
      return;
    }
    nodeRes.writeHead(response.status, headers);

    if (response.body) {
      let responseBodyError: unknown;
      let responseBodyErrorAfterResponseClosed = false;
      try {
        const responseStream = Readable.fromWeb(response.body as any);
        // This listener must run before pipeline's cleanup so source errors are
        // not mistaken for client disconnects after pipeline destroys nodeRes.
        responseStream.once('error', error => {
          responseBodyError = error;
          responseBodyErrorAfterResponseClosed = isResponseClosed(nodeRes);
        });
        if (signal) {
          await pipeline(responseStream, nodeRes, { signal });
        } else {
          await pipeline(responseStream, nodeRes);
        }
      } catch (error) {
        const expectedSignalAbort =
          signal?.aborted && isAbortSignalError(error) && (!responseBodyError || responseBodyErrorAfterResponseClosed);
        const expectedResponseClose =
          (!responseBodyError || responseBodyErrorAfterResponseClosed) &&
          isResponseClosed(nodeRes) &&
          isExpectedResponseCloseError(error);
        // Request cancellation is expected unless the response body already reported its own error.
        if (!expectedSignalAbort && !expectedResponseClose) {
          throw error;
        }
      }
    } else {
      const text = await response.text();
      if (!isResponseClosed(nodeRes)) {
        nodeRes.end(text);
      }
    }
  }

  /**
   * Builds the OpenAPI spec object with servers field and custom route paths.
   */
  private buildOpenAPISpec(config: { title: string; version: string; description: string }, prefix?: string): any {
    const openApiSpec = generateOpenAPIDocument(SERVER_ROUTES, config);

    if (prefix) {
      openApiSpec.servers = [{ url: prefix }];
    }

    // Custom routes are served at root (/), not under the API prefix — add per-path servers override.
    const allCustomRoutes = this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes;
    if (allCustomRoutes && allCustomRoutes.length > 0) {
      const customPaths = convertCustomRoutesToOpenAPIPaths(allCustomRoutes);
      if (prefix) {
        for (const pathKey of Object.keys(customPaths)) {
          if (!customPaths[pathKey].servers) {
            customPaths[pathKey].servers = [{ url: '/' }];
          }
        }
      }
      openApiSpec.paths = { ...openApiSpec.paths, ...customPaths };
    }

    return openApiSpec;
  }

  async registerOpenAPIRoute(app: TApp, config: OpenAPIConfig = {}, { prefix }: { prefix?: string }): Promise<void> {
    const {
      title = 'Mastra API',
      version = '1.0.0',
      description = 'Mastra Server API',
      path = '/openapi.json',
    } = config;

    const openApiSpec = this.buildOpenAPISpec({ title, version, description }, prefix);

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
      const specConfig = {
        title: 'Mastra API',
        version: '1.0.0',
        description: 'Mastra Server API',
      };

      await this.registerOpenAPIRoute(this.app, { ...specConfig, path: this.openapiPath }, { prefix: this.prefix });
    }
  }

  async parsePathParams(route: ServerRoute, params: Record<string, string>): Promise<Record<string, any>> {
    const pathParamSchema = route.pathParamSchema;
    if (!pathParamSchema) {
      return params;
    }

    return pathParamSchema.parseAsync(params) as Promise<Record<string, any>>;
  }

  async parseQueryParams(route: ServerRoute, params: Record<string, QueryParamValue>): Promise<Record<string, any>> {
    const queryParamSchema = route.queryParamSchema;
    if (!queryParamSchema) {
      return params;
    }

    const normalizedParams = parseComplexQueryParams(queryParamSchema as z.ZodTypeAny, params);
    return queryParamSchema.parseAsync(normalizedParams) as Promise<Record<string, any>>;
  }

  async parseBody(route: ServerRoute, body: unknown): Promise<unknown> {
    const bodySchema = route.bodySchema;
    if (!bodySchema) {
      return body;
    }

    return bodySchema.parseAsync(body);
  }

  private static readonly CONTEXT_LABELS: Record<ValidationErrorContext, string> = {
    query: 'query parameters',
    body: 'request body',
    path: 'path parameters',
  };

  protected resolveValidationError(
    route: ServerRoute,
    error: ZodError,
    context: ValidationErrorContext,
  ): ValidationErrorResponse {
    const hook = route.onValidationError ?? this.mastra.getServer()?.onValidationError;

    if (hook) {
      try {
        const result = hook(error, context);
        if (result) {
          return result;
        }
      } catch (hookError) {
        this.mastra.getLogger()?.error('Error in custom onValidationError hook', {
          error: hookError instanceof Error ? { message: hookError.message, stack: hookError.stack } : hookError,
        });
      }
    }

    return {
      status: 400,
      body: formatZodError(error, MastraServer.CONTEXT_LABELS[context]),
    };
  }
}

/**
 * Check FGA authorization for an HTTP route.
 * Returns null if authorized or FGA not configured, or an error object if denied.
 */
export async function checkRouteFGA(
  mastra: any,
  route: ServerRoute,
  requestContext: RequestContext,
  params: Record<string, unknown>,
): Promise<{ status: number; error: string; message: string } | null> {
  // Use request context to determine which FGA provider to use (studio vs server)
  const fgaProvider = getFGAProvider(mastra, requestContext);
  if (!fgaProvider) return null;

  const fgaConfig = await resolveRouteFGAConfig(fgaProvider, route, requestContext, params);
  if (!fgaConfig) {
    if (fgaProvider.requireForProtectedRoutes && isProtectedFGARoute(route)) {
      return {
        status: 403,
        error: 'Forbidden',
        message: 'FGA authorization denied: route FGA metadata is required',
      };
    }
    return null;
  }

  const user = requestContext?.get('user');
  if (!user) {
    return {
      status: 403,
      error: 'Forbidden',
      message: 'FGA authorization denied: authenticated user is required',
    };
  }

  const resourceId =
    typeof fgaConfig.resourceId === 'function'
      ? fgaConfig.resourceId(params, { requestContext })
      : fgaConfig.resourceId || (fgaConfig.resourceIdParam ? (params[fgaConfig.resourceIdParam] as string) : undefined);
  if (!fgaConfig.resourceType || !resourceId) {
    return {
      status: 403,
      error: 'Forbidden',
      message: 'FGA authorization denied: route FGA metadata is incomplete',
    };
  }
  const effectivePermission = route.path ? getEffectivePermission(route) : null;
  const permission =
    fgaConfig.permission ||
    effectivePermission ||
    `${getFGAResourcePermissionSlug(fgaConfig.resourceType)}:${deriveFGAAction(route.method)}`;

  const authorized = await fgaProvider.check(user, {
    resource: { type: fgaConfig.resourceType, id: resourceId },
    permission,
    context: { resourceId, requestContext },
  });

  if (!authorized) {
    return {
      status: 403,
      error: 'Forbidden',
      message: `FGA authorization denied: cannot ${permission} on ${fgaConfig.resourceType}:${resourceId}`,
    };
  }

  return null;
}

function deriveFGAAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'read';
    case 'DELETE':
      return 'delete';
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return 'write';
    default:
      return 'read';
  }
}

function getFGAResourcePermissionSlug(resourceType: string): string {
  const resourcePermissionSlugs: Record<string, string> = {
    agent: 'agents',
    workflow: 'workflows',
    tool: 'tools',
    thread: 'memory',
  };

  return resourcePermissionSlugs[resourceType] ?? resourceType;
}
