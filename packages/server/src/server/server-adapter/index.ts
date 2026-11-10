import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ToolsInput } from '@mastra/core/agent';
import { hasPermission } from '@mastra/core/auth/ee';
import type { FGARouteConfig, FGARouteInfo, IFGAProvider, MastraFGAPermissionInput } from '@mastra/core/auth/ee';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MastraServerBase } from '@mastra/core/server';
import type {
  ApiRoute,
  HttpLoggingConfig,
  MastraAuthConfig,
  ValidationErrorContext,
  ValidationErrorResponse,
} from '@mastra/core/server';
import type { ExecutionContext } from 'hono';
import { Hono } from 'hono';
import type { ZodError } from 'zod/v4';
import { z } from 'zod/v4';

import type { InMemoryTaskStore } from '../a2a/store';
import { CustomRouteMatcher } from '../auth/custom-route-matcher';
import {
  authorizeAuthenticatedUser,
  coreAuthMiddleware,
  findMatchingCustomRoute,
  canAccessPublicly,
  isCustomRoutePublic,
  isProtectedCustomRoute,
  pathMatchesPattern,
} from '../auth/helpers';
import {
  MASTRA_AUTH_MODE_KEY,
  MASTRA_AUTH_TOKEN_KEY,
  MASTRA_CLIENT_TYPE_HEADER,
  MASTRA_IS_STUDIO_KEY,
  MASTRA_USER_KEY,
  MASTRA_USER_PERMISSIONS_KEY,
  isReservedRequestContextKey,
  isStudioClientTypeHeader,
} from '../constants';
import type { MastraAuthMode } from '../constants';
import { formatZodError, isZodError } from '../handlers/error';
import { HTTPException } from '../http-exception';
export { isZodError, type ZodErrorLike } from '../handlers/error';
import { normalizeRoutePath } from '../utils';
import type { SetMcpRequestAuth } from './mcp-auth';
import { generateOpenAPIDocument, convertCustomRoutesToOpenAPIPaths } from './openapi-utils';
import type { ServerContext, ServerRoute } from './routes';
import { OPT_IN_ROUTES, SERVER_ROUTES, getEffectivePermission } from './routes';
import { getBuiltInRouteFGAConfig } from './routes/fga-manifest';

export * from './routes';
export { applyMcpRequestAuth, buildMcpAuthInfoFromRequestContext } from './mcp-auth';
export type { McpAuthInfo, SetMcpRequestAuth } from './mcp-auth';
export { propagateRequestAbort } from './mcp-disconnect';
export { convertCustomRoutesToOpenAPIPaths } from './openapi-utils';
export { redactStreamChunk } from './redact';
export { serializeStreamChunk, type SerializedStreamChunk } from './serialize';
export { cancelReaderOnResponseClose, writeWithBackpressure } from './stream-disconnect';
export {
  MASTRA_AUTH_MODE_KEY,
  MASTRA_CLIENT_TYPE_HEADER,
  MASTRA_IS_STUDIO_KEY,
  MASTRA_KNOWLEDGE_PRINCIPALS_KEY,
  MASTRA_STUDIO_CLIENT_TYPE,
  RESERVED_REQUEST_CONTEXT_KEYS,
  isReservedRequestContextKey,
  isStudioClientTypeHeader,
} from '../constants';
export type { MastraAuthMode } from '../constants';

export { WorkflowRegistry, normalizeRoutePath } from '../utils';
export { HTTPException };

export function getCustomHTTPExceptionResponse(error: unknown): Response | undefined {
  if (!(error instanceof HTTPException) || !error.res) {
    return undefined;
  }

  return error.getResponse();
}

/**
 * Response for an HTTPException thrown from a `registerApiRoute` handler, or undefined for
 * any other error (which callers keep behind a generic 500). Duck-typed so an HTTPException
 * from `hono/http-exception`, possibly a separate Hono install, is recognised too.
 */
export function getCustomRouteHTTPExceptionResponse(error: unknown): Response | undefined {
  if (!(error instanceof Error)) return undefined;
  const httpError = error as Error & { status?: unknown; res?: unknown; getResponse?: unknown };
  const status = httpError.status;
  if (
    typeof httpError.getResponse !== 'function' ||
    typeof status !== 'number' ||
    !Number.isInteger(status) ||
    status < 400 ||
    status > 599
  ) {
    return undefined;
  }
  if (httpError.res) return (httpError.getResponse as () => Response).call(httpError);
  return Response.json({ error: httpError.message }, { status });
}

export interface HTTPErrorResponseBody {
  error: string;
  cause?: { failingItems: unknown[] } | { field: string; errors: Array<{ path: string; message: string }> };
}

/**
 * Only allowlisted causes are exposed to clients; any other cause stays server-side:
 * - `cause.failingItems` (dataset schema-update rejections)
 * - `cause.field` + `cause.errors` (schema validation failures), reduced to each error's path and message
 */
function getSafeErrorCause(error: unknown): HTTPErrorResponseBody['cause'] {
  try {
    const raw = error instanceof Error ? error.cause : undefined;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    if (Array.isArray((raw as any).failingItems)) {
      return { failingItems: (raw as any).failingItems };
    }
    const { field, errors } = raw as { field?: unknown; errors?: unknown };
    if (typeof field === 'string' && Array.isArray(errors)) {
      return {
        field,
        errors: errors.flatMap(e =>
          e && typeof e.path === 'string' && typeof e.message === 'string'
            ? [{ path: e.path, message: e.message }]
            : [],
        ),
      };
    }
  } catch {
    // property access threw (e.g. a getter) — omit cause
  }
  return undefined;
}

/**
 * Maps a handler error to the status and JSON body every adapter sends:
 * `error.status` (HTTPException) first, then `error.details.status` (MastraError), else 500.
 */
export function getHTTPErrorResponse(error: unknown): { status: number; body: HTTPErrorResponseBody } {
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (error && typeof error === 'object') {
    if ('status' in error) {
      const cause = getSafeErrorCause(error);
      return { status: (error as any).status, body: { error: message, ...(cause ? { cause } : {}) } };
    }
    if ('details' in error && error.details && typeof error.details === 'object' && 'status' in error.details) {
      return { status: (error.details as any).status, body: { error: message } };
    }
  }

  return { status: 500, body: { error: message } };
}

/**
 * Hono/adapter context key set by the framework-public middleware.
 *
 * When true, the current request targets a route the framework has declared
 * public (via `createPublicRoute()` / `requiresAuth: false`). Adapter authors
 * MUST short-circuit any user-registered middleware for such requests so that
 * users cannot accidentally (or intentionally) 401 routes the framework needs
 * to keep reachable (e.g. Studio sign-in endpoints).
 */
export const MASTRA_FRAMEWORK_PUBLIC_KEY = '__mastraFrameworkPublic';

/**
 * A pre-computed matcher that returns true if a given (path, method) targets a
 * route the framework has declared public via `requiresAuth: false`.
 *
 * Built once at server-adapter registration time from `SERVER_ROUTES` and the
 * `customRouteAuthConfig` map. Called by each adapter's context middleware to
 * stash a boolean on the per-request context under `MASTRA_FRAMEWORK_PUBLIC_KEY`.
 */
export type FrameworkPublicMatcher = (path: string, method: string) => boolean;

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

const AGENT_CHANNEL_WEBHOOK_PATH = /^\/api\/agents\/([^/]+)\/channels\/([^/]+)\/webhook\/?$/;

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
  /**
   * Sets `req.auth` before the MCP transport reads it, which is what surfaces as
   * `extra.authInfo` inside tool and agent execution.
   *
   * When omitted, the principal resolved by `server.auth` is bridged
   * automatically. Provide this hook when your own middleware performs the
   * verification and you want full control over the resulting `AuthInfo`.
   *
   * The hook only controls `authInfo`. Tools still receive the user,
   * permissions, roles and other reserved values Mastra server auth resolved
   * in their `requestContext`, even when the hook's `authInfo` names a
   * different principal.
   */
  setRequestAuth?: SetMcpRequestAuth;
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

/**
 * Returns `response` with a pass-through body that holds the re-dispatched
 * custom route `request` until that body is fully read, errors or is cancelled.
 *
 * `new Request(url, { signal })` gives the request its own signal and forwards
 * the outer abort to it through a listener that only weakly references the
 * request's controller (nodejs/undici#4068). Once a custom route returns a
 * streaming Response, nothing else holds that inner Request, so a GC can drop
 * it and a client disconnect never reaches `c.req.raw.signal` (#29154).
 *
 * The reference lives on the body because the body is reachable exactly while
 * an adapter is still sending the response. Anything reachable from the outer
 * signal (a WeakMap keyed by it, or an abort listener on it) would leak instead:
 * undici's request finalizer holds the outer signal strongly while the inner
 * controller is alive, so signal -> request -> controller -> signal is never
 * collected when the signal never aborts, as after a normal Express response.
 * An abort ends or cancels the body, which releases the request too.
 */
function retainRequestWhileBodyIsOpen(response: Response, request: Request): Response {
  const source = response.body;
  if (!source) return response;

  const reader = source.getReader();
  const retained: { request?: Request } = { request };
  const release = () => {
    retained.request = undefined;
  };
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            release();
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (error) {
          release();
          controller.error(error);
        }
      },
      cancel(reason) {
        release();
        return reader.cancel(reason);
      },
    },
    // Read from the route's body only when the adapter asks for a chunk.
    { highWaterMark: 0 },
  );
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
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

/** A schema-aware custom route created by `createRoute()`. */
type SchemaCustomApiRoute = Extract<ApiRoute, { readonly _mastraSchemaRoute: true }>;
/** A Hono-style custom route created by `registerApiRoute()`. */
type HonoCustomApiRoute = Exclude<ApiRoute, SchemaCustomApiRoute>;

function isSchemaApiRoute(route: ApiRoute): route is SchemaCustomApiRoute {
  return '_mastraSchemaRoute' in route && route._mastraSchemaRoute === true;
}

export function getFGAProvider(mastra: any, requestContext?: RequestContext): IFGAProvider | undefined {
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
  params: Record<string, unknown>,
): Record<string, unknown> {
  if (!(queryParamSchema instanceof z.ZodObject)) {
    return params;
  }

  const parsedParams: Record<string, unknown> = { ...params };
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
 * Property names that must never be written onto objects built from untrusted
 * input: assigning them can mutate the object's prototype chain.
 */
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Returns whether `key` is safe to use as a property name when building an
 * object from untrusted input (query strings, form fields, etc.).
 */
export function isSafeObjectKey(key: string): boolean {
  return !UNSAFE_OBJECT_KEYS.has(key);
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
      if (strValue !== undefined && isSafeObjectKey(parent) && isSafeObjectKey(child)) {
        if (!Object.hasOwn(bracketGroups, parent)) {
          bracketGroups[parent] = {};
        }
        bracketGroups[parent]![child] = strValue;
      }
    } else if (typeof value === 'string') {
      if (isSafeObjectKey(key)) {
        queryParams[key] = value;
      }
    } else if (Array.isArray(value)) {
      if (!isSafeObjectKey(key)) {
        continue;
      }
      // Filter to only string values (some frameworks include nested objects)
      const stringValues = value.filter((v): v is string => typeof v === 'string');
      // Convert single-value arrays back to strings for compatibility
      queryParams[key] = stringValues.length === 1 ? stringValues[0]! : stringValues;
    }
  }

  // Merge bracket groups as JSON strings (only if the parent key wasn't already set directly)
  for (const [parent, children] of Object.entries(bracketGroups)) {
    if (!Object.hasOwn(queryParams, parent)) {
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
  /** Request bodies cannot set agent scopes: handlers strip `scopes`, and `mastra__scopes` is a reserved key. */
  readonly reservesAgentScopes = true;

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
  /** Mirrors the custom-route app's router so auth can ask which route a request runs. */
  private customRouteMatcher: CustomRouteMatcher<{
    method: string;
    path: string;
    handlerCount: number;
    route: HonoCustomApiRoute;
  }> | null = null;

  /**
   * Whether custom (non-schema) API routes were registered. Adapters use this
   * at request time to decide if they need to preserve a pristine copy of the
   * request body for the custom-route bridge.
   */
  protected get hasCustomRouteHandler(): boolean {
    return this.customRouteHandler !== null;
  }

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
    registerDispatchAdapter(mastra, {
      prefix: this.prefix,
      getCustomRouteAuthConfig: () => this.customRouteAuthConfig,
      getCustomApiRoutes: () => this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes ?? [],
      checkRouteRBAC: (route, requestContext) => this.checkRouteRBAC(route, requestContext),
    });
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

  /** Warn when a request looks like an agent channel webhook whose route was never registered. */
  protected warnIfUnregisteredChannelWebhook(path: string, method: string, status: number): void {
    if (status !== 404 || method.toUpperCase() !== 'POST') return;

    const match = AGENT_CHANNEL_WEBHOOK_PATH.exec(path);
    if (!match) return;

    const routes = this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes;
    if (findMatchingCustomRoute(path, method.toUpperCase(), routes)) return;

    const agentId = match[1]!;
    const platform = match[2]!;
    const platformLabel = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(platform)
      ? platform
          .split(/[-_]/)
          .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join(' ')
      : 'channel';
    this.mastra
      .getLogger()
      ?.warn(
        `Received a ${platformLabel} webhook, but this agent doesn't have a ${platformLabel} adapter. Add one to the agent's channels.adapters configuration and restart the server.`,
        { agentId, platform },
      );
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
    return resolveEffectiveAuthConfig(this.mastra, getHeader);
  }

  /**
   * Gets the effective RBAC provider for the current request based on auth mode.
   *
   * @deprecated Never consulted by route permission checks, so overriding it has no effect.
   * Override `checkRoutePermission` to change how a route's permission is decided.
   */
  protected getEffectiveRBACProvider(requestContext: RequestContext) {
    return getEffectiveRBACProvider(this.mastra, requestContext);
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
      /** Overrides the server's custom route auth map for this check. */
      customRouteAuthConfig?: Map<string, boolean>;
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
      customRouteAuthConfig: context.customRouteAuthConfig ?? this.customRouteAuthConfig,
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
    requestContext: RequestContext,
  ): { status: number; error: string; message: string } | null {
    return getRoutePermissionError(this.mastra, route, userPermissions, hasPermissionFn, requestContext);
  }

  /**
   * RBAC check for a route this adapter serves. Skipped when no auth is configured;
   * otherwise decided by `checkRoutePermission`, so a subclass override of it still applies.
   */
  protected checkRouteRBAC(route: ServerRoute, requestContext: RequestContext): RouteAuthorizationError | null {
    if (!this.mastra.getStudio?.()?.auth && !this.mastra.getServer()?.auth) {
      return null;
    }
    const userPermissions = requestContext.get(MASTRA_USER_PERMISSIONS_KEY) as string[] | undefined;
    return this.checkRoutePermission(route, userPermissions, hasPermission, requestContext);
  }

  /** RBAC (`checkRouteRBAC`) then FGA on the parsed params, after authentication and validation. */
  protected async authorizeRoute(
    route: ServerRoute,
    params: Record<string, unknown>,
    requestContext: RequestContext,
  ): Promise<RouteAuthorizationError | null> {
    return (
      this.checkRouteRBAC(route, requestContext) ?? (await checkRouteFGA(this.mastra, route, requestContext, params))
    );
  }

  /**
   * Build a matcher that answers "is this (path, method) a framework-public
   * route?" — i.e. registered with `requiresAuth: false`.
   *
   * Adapters call this once at registration time and use the returned function
   * inside their context middleware to stash a boolean on the per-request
   * context under `MASTRA_FRAMEWORK_PUBLIC_KEY`. That boolean is then read by
   * per-user-middleware wrappers to short-circuit user middleware for
   * framework-public routes, guaranteeing that user middleware cannot 401
   * routes the framework declared public (e.g. Studio sign-in endpoints).
   *
   * The matcher considers:
   *   - Built-in `SERVER_ROUTES` entries with `requiresAuth === false`
   *     (paths joined with the adapter's configured `prefix`).
   *   - Custom user API routes registered with `requiresAuth: false` via the
   *     `customRouteAuthConfig` map.
   */
  getFrameworkPublicMatcher(): FrameworkPublicMatcher {
    const prefix = this.prefix ?? '';

    const publicRoutes = SERVER_ROUTES.filter(r => r.requiresAuth === false).map(r => ({
      method: r.method.toUpperCase(),
      pattern: `${prefix}${r.path}`,
    }));

    return (path: string, method: string): boolean => {
      const upperMethod = method.toUpperCase();

      for (const r of publicRoutes) {
        if ((r.method === upperMethod || r.method === 'ALL') && pathMatchesPattern(path, r.pattern)) {
          return true;
        }
      }

      // Read `customRouteAuthConfig` at request time, not at matcher build
      // time: adapters constructed without an explicit map only populate it
      // later, in registerCustomApiRoutes(), after the context middleware has
      // already built this matcher.
      return isCustomRoutePublic(path, upperMethod, this.customRouteAuthConfig);
    };
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
    this.validateAuthResourceScoping();
    this.registerUserMiddleware();
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
      const { isEEEnabled } = await import('@mastra/core/auth/ee');
      if (!isEEEnabled()) {
        throw new Error(
          '[mastra/auth-ee] Agent Builder is configured but no valid EE license was found.\n' +
            'Agent Builder requires a Mastra Enterprise License for production use.\n' +
            'Set the MASTRA_EE_LICENSE environment variable with your license key.\n' +
            'Learn more: https://github.com/mastra-ai/mastra/blob/main/ee/LICENSE',
        );
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
   * Warn when `server.auth` is configured without `mapUserToResourceId`.
   *
   * Without it, MASTRA_RESOURCE_ID_KEY is never set in the request context, so
   * built-in routes fall back to the client-supplied resource ID (for example
   * `memory.resource`) and ownership checks run against a caller-chosen value.
   */
  validateAuthResourceScoping(): void {
    const auth = this.mastra.getServer()?.auth as { mapUserToResourceId?: unknown } | undefined;
    if (!auth || typeof auth.mapUserToResourceId === 'function') return;

    this.mastra
      .getLogger()
      ?.warn(
        '[mastra/auth] server.auth is configured without mapUserToResourceId. ' +
          'Memory, thread and workflow ownership checks will trust the resource ID supplied by the client ' +
          "(e.g. memory.resource in the request body), so an authenticated user can read or write another user's threads. " +
          'Configure server.auth.mapUserToResourceId to derive the resource ID from the authenticated user.',
      );
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
   * Register user-provided middleware from the Mastra config (`server.middleware`)
   * and from `mastra.setServerMiddleware()`. Called by init() between
   * registerAuthMiddleware() and registerHttpLoggingMiddleware().
   *
   * Mastra middleware handlers use Hono's `(c, next)` signature, so only
   * Hono-based adapters can run them. Those adapters override this method and
   * MUST wrap each handler with `skipIfFrameworkPublic` (exported by
   * `@mastra/hono`) so user middleware cannot block framework-public routes.
   * The default implementation warns when middleware is configured so the
   * config is not silently ignored on adapters that cannot honor it.
   */
  registerUserMiddleware(): void {
    const instanceMiddleware = this.mastra.getServerMiddleware?.() ?? [];
    const configMiddleware = this.mastra.getServer()?.middleware;
    const hasConfigMiddleware = Array.isArray(configMiddleware) ? configMiddleware.length > 0 : !!configMiddleware;
    if (instanceMiddleware.length === 0 && !hasConfigMiddleware) return;

    this.mastra
      .getLogger()
      ?.warn(
        'Mastra server middleware (`server.middleware` or `setServerMiddleware()`) is configured, but this server adapter cannot run Hono middleware handlers. The configured middleware will not run — register middleware through your server framework instead.',
      );
  }

  /**
   * Override in adapters to register custom API routes defined via registerApiRoute().
   * Called by init() between registerAuthMiddleware() and registerRoutes().
   */
  async registerCustomApiRoutes(): Promise<void> {
    // Default no-op. Adapters override this to register custom routes
    // using their framework-specific middleware.
  }

  /** Ensures every custom route has an auth entry without overriding supplied values. */
  private initializeCustomRouteAuthConfig(routes: ApiRoute[]): void {
    this.customRouteAuthConfig ??= new Map();
    for (const route of routes) {
      const routeKey = `${route.method}:${route.path}`;
      if (!this.customRouteAuthConfig.has(routeKey)) {
        this.customRouteAuthConfig.set(routeKey, route.requiresAuth !== false);
      }
    }
  }

  /**
   * Registers schema-aware custom routes through the adapter's native route pipeline.
   * Returns the remaining Hono-style routes for the custom-route bridge.
   */
  protected async registerSchemaApiRoutes(): Promise<HonoCustomApiRoute[]> {
    const routes = this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes ?? [];
    this.validateCustomRoutePaths(routes);
    this.initializeCustomRouteAuthConfig(routes);

    const schemaRoutes = routes.filter(isSchemaApiRoute);
    for (const route of schemaRoutes) {
      // Opt-in built-in routes are first-party: Studio and the client SDK call them under the API prefix,
      // so they mount there like any built-in route. Other custom routes mount at the root.
      // Matched by identity: a cloned route object lands back at the root.
      const prefix = (OPT_IN_ROUTES as readonly unknown[]).includes(route) ? this.prefix : '';
      await this.registerRoute(this.app, route as unknown as ServerRoute, { prefix });
    }

    return routes.filter((route): route is HonoCustomApiRoute => !isSchemaApiRoute(route));
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
  protected async buildCustomRouteHandler(routes: HonoCustomApiRoute[]): Promise<boolean> {
    if (routes.length === 0) return false;

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
      const httpExceptionResponse = getCustomRouteHTTPExceptionResponse(err);
      if (httpExceptionResponse) return httpExceptionResponse;
      // Log before responding — otherwise the error is invisible on the server
      // and the client only ever sees an opaque 500.
      this.mastra.getLogger()?.error(`Custom route handler failed: ${c.req.method} ${c.req.path}`, {
        method: c.req.method,
        path: c.req.path,
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
      return c.json({ error: 'Internal Server Error' }, 500);
    });

    // Register each custom route
    const matcherEntries: Array<{ method: string; path: string; handlerCount: number; route: HonoCustomApiRoute }> = [];
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
      matcherEntries.push({ method: route.method, path: route.path, handlerCount: allHandlers.length, route });
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
    this.customRouteMatcher = new CustomRouteMatcher(matcherEntries);
    return true;
  }

  /**
   * Returns the custom route the custom-route app will run for `url` (the same URL
   * passed to `handleCustomRouteRequest`), with its decoded path params, or
   * undefined if none will.
   */
  protected matchCustomRoute(
    url: string,
    method: string,
  ): { route: HonoCustomApiRoute; params: Record<string, string> } | undefined {
    if (!this.customRouteMatcher) return undefined;
    try {
      const match = this.customRouteMatcher.matchUrl(url, method);
      return match ? { route: match.entry.route, params: match.params } : undefined;
    } catch {
      // The custom-route app can't parse or route this request either.
      return undefined;
    }
  }

  /**
   * Works out what auth applies to a request before it's forwarded to the
   * custom-route app. The route that decides is the one the app will dispatch
   * `dispatchUrl` to, not the route the outer framework matched, because the two
   * routers can disagree on precedence, case, trailing slashes and encoding.
   *
   * `requestPath` is the path passed to `checkRouteAuth`. When the dispatched route
   * requires auth, the returned `customRouteAuthConfig` marks that path protected so
   * the auth middleware can't skip auth on it. `fallbackRoute` is used when the app
   * won't dispatch the request (it 404s and nothing runs); pass the framework's own
   * route when there is one so its auth still applies.
   */
  protected resolveCustomRouteAuth(
    dispatchUrl: string,
    method: string,
    requestPath: string,
    fallbackRoute?: HonoCustomApiRoute,
  ): {
    match?: { route: HonoCustomApiRoute; params: Record<string, string> };
    requiresAuth: boolean;
    serverRoute: ServerRoute;
    customRouteAuthConfig?: Map<string, boolean>;
  } {
    const match = this.matchCustomRoute(dispatchUrl, method);
    const route = match?.route ?? fallbackRoute;

    const requiresAuth = route
      ? (this.customRouteAuthConfig?.get(`${route.method}:${route.path}`) ?? route.requiresAuth !== false)
      : isProtectedCustomRoute(requestPath, method, this.customRouteAuthConfig);

    const serverRoute: ServerRoute = {
      method: (route?.method ?? method) as any,
      path: route?.path ?? requestPath,
      responseType: 'json',
      handler: async () => {},
      // An explicit requiresAuth: true keeps its meaning; otherwise the auth middleware
      // decides from the path, which the map below forces to protected.
      requiresAuth: requiresAuth ? (route?.requiresAuth === true ? true : undefined) : false,
      requiresPermission: route?.requiresPermission,
      fga: route?.fga,
    };

    let customRouteAuthConfig: Map<string, boolean> | undefined;
    if (requiresAuth) {
      customRouteAuthConfig = new Map(this.customRouteAuthConfig ?? []);
      customRouteAuthConfig.set(`${method.toUpperCase()}:${requestPath}`, true);
    }

    return { match, requiresAuth, serverRoute, customRouteAuthConfig };
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
    return signal ? retainRequestWhileBodyIsOpen(response, request) : response;
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
      const componentSchemas = openApiSpec.components?.schemas ?? Object.create(null);
      // Opt-in built-in routes are mounted under the API prefix (see registerSchemaApiRoutes), so they keep the
      // top-level server; every other custom route is served at the root.
      const isPrefixed = (route: ApiRoute) => (OPT_IN_ROUTES as readonly unknown[]).includes(route);
      const customPaths = convertCustomRoutesToOpenAPIPaths(
        allCustomRoutes.filter(route => !isPrefixed(route)),
        componentSchemas,
      );
      const prefixedPaths = convertCustomRoutesToOpenAPIPaths(allCustomRoutes.filter(isPrefixed), componentSchemas);
      if (Object.keys(componentSchemas).length > 0) {
        openApiSpec.components = { ...openApiSpec.components, schemas: componentSchemas };
      }
      if (prefix) {
        for (const pathKey of Object.keys(customPaths)) {
          if (!customPaths[pathKey].servers) {
            customPaths[pathKey].servers = [{ url: '/' }];
          }
        }
      }
      Object.assign(customPaths, prefixedPaths);
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
    return parseRoutePathParams(route, params);
  }

  async parseQueryParams(route: ServerRoute, params: Record<string, QueryParamValue>): Promise<Record<string, any>> {
    return parseRouteQueryParams(route, params);
  }

  async parseBody(route: ServerRoute, body: unknown): Promise<unknown> {
    return parseRouteBody(route, body);
  }

  protected resolveValidationError(
    route: ServerRoute,
    error: ZodError,
    context: ValidationErrorContext,
  ): ValidationErrorResponse {
    return resolveRouteValidationError(this.mastra, route, error, context);
  }
}

/**
 * The RBAC provider for the auth mode the request was authenticated with
 * (studio vs server).
 */
export function getEffectiveRBACProvider(mastra: Mastra, requestContext: RequestContext) {
  const authMode = requestContext.get(MASTRA_AUTH_MODE_KEY) as MastraAuthMode | undefined;

  if (authMode === 'studio') {
    return mastra.getStudio?.()?.rbac ?? mastra.getServer()?.rbac;
  }

  return mastra.getServer()?.rbac;
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
 * of them (logical OR). Without an RBAC provider, authenticated users get full access.
 *
 * @returns Error response if permission denied, null if allowed
 */
export function getRoutePermissionError(
  mastra: Mastra,
  route: ServerRoute,
  userPermissions: string[] | undefined,
  hasPermissionFn: (userPerms: string[], required: string) => boolean,
  requestContext: RequestContext,
): { status: number; error: string; message: string } | null {
  if (!getEffectiveRBACProvider(mastra, requestContext)) {
    return null;
  }

  const requiredPermission = getEffectivePermission(route);
  if (!requiredPermission) {
    return null;
  }

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

export async function parseRoutePathParams(
  route: ServerRoute,
  params: Record<string, unknown>,
): Promise<Record<string, any>> {
  const pathParamSchema = route.pathParamSchema;
  if (!pathParamSchema) {
    return params;
  }

  return pathParamSchema.parseAsync(params) as Promise<Record<string, any>>;
}

export async function parseRouteQueryParams(
  route: ServerRoute,
  params: Record<string, unknown>,
): Promise<Record<string, any>> {
  const queryParamSchema = route.queryParamSchema;
  if (!queryParamSchema) {
    return params;
  }

  const normalizedParams = parseComplexQueryParams(queryParamSchema as z.ZodTypeAny, params);
  return queryParamSchema.parseAsync(normalizedParams) as Promise<Record<string, any>>;
}

export async function parseRouteBody(route: ServerRoute, body: unknown): Promise<unknown> {
  const bodySchema = route.bodySchema;
  if (!bodySchema) {
    return body;
  }

  if (body === undefined) {
    const omitted = await bodySchema.safeParseAsync(undefined);
    if (omitted.success) return omitted.data;
    // Preserve bodyless object requests with optional/defaulted fields, but keep
    // the original missing-input error if the compatibility fallback also fails.
    const schemaType = getSchemaTypeName(unwrapOptionalNullable(bodySchema));
    if (schemaType === 'object' || schemaType === 'ZodObject') {
      const emptyObject = await bodySchema.safeParseAsync({});
      if (emptyObject.success) return emptyObject.data;
    }
    throw omitted.error;
  }

  return bodySchema.parseAsync(body);
}

const VALIDATION_CONTEXT_LABELS: Record<ValidationErrorContext, string> = {
  query: 'query parameters',
  body: 'request body',
  path: 'path parameters',
};

export function resolveRouteValidationError(
  mastra: Mastra,
  route: ServerRoute,
  error: ZodError,
  context: ValidationErrorContext,
): ValidationErrorResponse {
  const hook = route.onValidationError ?? mastra.getServer()?.onValidationError;

  if (hook) {
    try {
      const result = hook(error, context);
      if (result) {
        return result;
      }
    } catch (hookError) {
      mastra.getLogger()?.error('Error in custom onValidationError hook', {
        error: hookError instanceof Error ? { message: hookError.message, stack: hookError.stack } : hookError,
      });
    }
  }

  return {
    status: 400,
    body: formatZodError(error, VALIDATION_CONTEXT_LABELS[context]),
  };
}

type RouteAuthorizationError = { status: number; error: string; message: string };

/**
 * Check the route's RBAC permission (explicit `requiresPermission` or derived from
 * path/method) against the permissions `checkRouteAuth` stored in the request context.
 * Skipped when no auth or no RBAC provider is configured, matching what adapters enforce.
 * Uses the studio RBAC provider for studio-authenticated requests.
 * Returns null if allowed, or a 403 error object if denied.
 */
export function checkRouteRBAC(
  mastra: Mastra,
  route: ServerRoute,
  requestContext: RequestContext,
): RouteAuthorizationError | null {
  if (!mastra.getStudio?.()?.auth && !mastra.getServer()?.auth) {
    return null;
  }

  const userPermissions = requestContext.get(MASTRA_USER_PERMISSIONS_KEY) as string[] | undefined;
  return getRoutePermissionError(mastra, route, userPermissions, hasPermission, requestContext);
}

/**
 * Run the route authorization adapters enforce after authentication and schema
 * validation: RBAC (`checkRouteRBAC`) then FGA (`checkRouteFGA`) on the parsed params.
 * Returns null if allowed, or a 403 error object if denied.
 */
export async function authorizeRoute(
  mastra: Mastra,
  route: ServerRoute,
  params: Record<string, unknown>,
  requestContext: RequestContext,
): Promise<RouteAuthorizationError | null> {
  return checkRouteRBAC(mastra, route, requestContext) ?? (await checkRouteFGA(mastra, route, requestContext, params));
}

export interface DispatchRouteInput {
  pathParams?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
}

export type DispatchRouteResult = { ok: true; result: unknown } | { ok: false; status: number; body: unknown };

/** What `dispatchRoute` needs to know about an adapter serving a Mastra instance's routes over HTTP. */
export interface DispatchAdapterInfo {
  /** The prefix built-in routes are served under, as request paths reach server auth (e.g. `/api`). */
  prefix?: string;
  getCustomRouteAuthConfig?: () => Map<string, boolean> | undefined;
  getCustomApiRoutes?: () => ApiRoute[];
  /** The adapter's own RBAC check, so its overrides also apply in-process. */
  checkRouteRBAC?: (route: ServerRoute, requestContext: RequestContext) => RouteAuthorizationError | null;
}

const dispatchAdapters = new WeakMap<Mastra, DispatchAdapterInfo[]>();

/**
 * Tell `dispatchRoute` where an adapter serves a Mastra instance's routes. Adapters built on
 * `MastraServer` register themselves; adapters that are not must call this.
 */
export function registerDispatchAdapter(mastra: Mastra, info: DispatchAdapterInfo): void {
  const adapters = dispatchAdapters.get(mastra) ?? [];
  adapters.push(info);
  dispatchAdapters.set(mastra, adapters);
}

/**
 * The adapter whose HTTP paths a dispatched route is authorized against: the one serving
 * `routePrefix` when given, otherwise the only one registered. `prefix` is undefined when that
 * cannot be told: several adapters and no `routePrefix`, a `routePrefix` none of the registered
 * adapters serves (a custom route's own `routePrefix` is empty, for one), or nothing to go on.
 */
function resolveDispatchAdapter(
  mastra: Mastra,
  routePrefix: string | undefined,
): { prefix: string | undefined; adapter?: DispatchAdapterInfo } {
  const adapters = dispatchAdapters.get(mastra) ?? [];
  if (routePrefix === undefined) {
    return adapters.length === 1
      ? { prefix: normalizeRoutePath(adapters[0]!.prefix ?? ''), adapter: adapters[0] }
      : { prefix: undefined };
  }
  const prefix = normalizeRoutePath(routePrefix);
  const serving = adapters.filter(adapter => normalizeRoutePath(adapter.prefix ?? '') === prefix);
  if (adapters.length > 0 && serving.length === 0) {
    return { prefix: undefined };
  }
  return { prefix, adapter: serving.length === 1 ? serving[0] : undefined };
}

/** Studio auth for Studio requests when `studio.auth` is configured, otherwise `server.auth`. */
function resolveEffectiveAuthConfig(
  mastra: Mastra,
  getHeader: (name: string) => string | undefined,
): { authConfig: unknown; authMode: MastraAuthMode } | null {
  const isStudioRequest = isStudioClientTypeHeader(getHeader(MASTRA_CLIENT_TYPE_HEADER));
  const studioAuth = mastra.getStudio?.()?.auth;
  const serverAuth = mastra.getServer()?.auth;

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

const ROUTE_PATH_PARAM = /\/:([A-Za-z0-9_]+)(\?)?/g;

/**
 * A URL can only carry a path param as a non-empty segment, and `.` / `..` segments are
 * resolved away before routing. Anything else names a path no HTTP request to this route
 * has, so it is rejected instead of being authorized as some other path.
 */
function findInvalidPathParams(
  path: string,
  pathParams: Record<string, unknown>,
): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];
  for (const [, name, optional] of path.matchAll(ROUTE_PATH_PARAM)) {
    const value = pathParams[name!];
    if (value === undefined && optional) continue;
    if (typeof value !== 'string' || value === '') {
      issues.push({ field: name!, message: 'Path parameter must be a non-empty string' });
    } else if (value === '.' || value === '..') {
      issues.push({ field: name!, message: 'Path parameter cannot be "." or ".."' });
    }
  }
  return issues;
}

/** Fill `:param` / `:param?` segments of a route path the way a client would put them in a URL. */
function fillRoutePath(path: string, pathParams: Record<string, unknown>): string {
  return path.replace(ROUTE_PATH_PARAM, (_segment, name: string) => {
    const value = pathParams[name];
    return value === undefined ? '' : `/${encodeURIComponent(String(value))}`;
  });
}

/** Where the in-process pipeline deliberately differs between `dispatchRoute` and `invokeRoute`. */
interface RoutePipelinePolicy {
  /**
   * Skip auth for paths server auth declares public (and for the dev playground). When false,
   * every route that requires auth needs an authenticated user.
   */
  honorPublicPaths: boolean;
  /** Path params override same-named query/body fields, instead of the adapters' path < query < body. */
  pathParamsWin: boolean;
  /**
   * The path server auth's hooks are asked about. `adapter`: under the prefix of the adapter
   * serving the routes (custom routes unprefixed, with their auth config), refusing path params
   * no URL could carry and refusing to run when that prefix is not known. `apiPrefix`: always
   * under `server.apiPrefix`, each `:param` replaced in place.
   */
  authPath: 'adapter' | 'apiPrefix';
  /** Order inputs are validated in, which decides the error reported when several are invalid. */
  validationOrder: 'query-body-path' | 'path-query-body';
  /** A schema failing with something other than a ZodError: answer 400, or let it throw. */
  nonZodParseError: 'respond' | 'throw';
  /** Answer with the `Response` an HTTPException carries, instead of the standard error body. */
  customErrorResponses: boolean;
  /** Handlers only see the server context the caller passed, never same-named request fields. */
  reserveServerContext: boolean;
}

const DISPATCH_ROUTE_POLICY: RoutePipelinePolicy = {
  honorPublicPaths: true,
  pathParamsWin: true,
  authPath: 'adapter',
  validationOrder: 'query-body-path',
  nonZodParseError: 'respond',
  customErrorResponses: true,
  reserveServerContext: true,
};

/** `invokeRoute`'s contract as it shipped; changing any of these changes a public API. */
const INVOKE_ROUTE_POLICY: RoutePipelinePolicy = {
  honorPublicPaths: false,
  pathParamsWin: false,
  authPath: 'apiPrefix',
  validationOrder: 'path-query-body',
  nonZodParseError: 'throw',
  customErrorResponses: false,
  reserveServerContext: false,
};

/**
 * The path-scoped half of `checkRouteAuth` for a route run in-process: `requiresAuth: false`,
 * protected/public path handling, then `authorizeUser` / `authorize` / `rules` / the RBAC
 * default rules, all evaluated against the route's own request path and method.
 * Uses the user Mastra server auth already put in the request context; never re-authenticates.
 */
async function checkDispatchedRouteAuth(
  route: ServerRoute,
  pathParams: Record<string, unknown>,
  context: ServerContext,
  policy: RoutePipelinePolicy,
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  if (route.requiresAuth === false) {
    return null;
  }

  const { mastra, requestContext } = context;
  const outerHeaders = context.request?.headers;
  const getHeader = (name: string) => outerHeaders?.get(name) ?? undefined;
  const studioAuth = mastra.getStudio?.()?.auth;
  const serverAuth = mastra.getServer()?.auth;

  // Only the user Mastra server auth resolved counts; the legacy `user` key can be
  // written by code outside it (such as an MCP server's own auth mapper).
  const user = requestContext.get(MASTRA_USER_KEY);
  if (!policy.honorPublicPaths && (studioAuth || serverAuth) && !user) {
    return { status: 401, body: { error: 'Authentication required' } };
  }

  // Use the auth config the caller was authenticated with (recorded by checkRouteAuth);
  // only fall back to the request's client-type header when no mode was recorded.
  const authMode = requestContext.get(MASTRA_AUTH_MODE_KEY) as MastraAuthMode | undefined;
  const recordedAuth = authMode === 'studio' ? studioAuth : authMode === 'server' ? serverAuth : undefined;
  const authConfig = (recordedAuth ?? resolveEffectiveAuthConfig(mastra, getHeader)?.authConfig) as
    | MastraAuthConfig
    | undefined;
  if (!authConfig) {
    return null;
  }

  // Server auth's authorization hooks see the route's own HTTP path, not the
  // path of whatever request (such as an MCP call) is running it.
  const method = route.method;
  let path: string | undefined;
  let customRouteAuthConfig: Map<string, boolean> | undefined;
  if (policy.authPath === 'adapter') {
    const { prefix, adapter } = resolveDispatchAdapter(mastra, context.routePrefix);
    customRouteAuthConfig = adapter?.getCustomRouteAuthConfig?.();
    const customRoutes = adapter?.getCustomApiRoutes?.() ?? mastra.getServer()?.apiRoutes ?? [];
    // Opt-in built-in routes are listed as custom routes but served under the prefix.
    const isUnprefixed =
      customRoutes.includes(route as unknown as ApiRoute) && !(OPT_IN_ROUTES as readonly unknown[]).includes(route);
    if (isUnprefixed || prefix !== undefined) {
      path = `${isUnprefixed ? '' : prefix}${fillRoutePath(route.path, pathParams)}` || '/';
    }
  } else {
    const apiPrefix = normalizeRoutePath(mastra.getServer()?.apiPrefix ?? '/api');
    path = `${apiPrefix}${route.path.replace(/:(\w+)/g, (_, name: string) =>
      encodeURIComponent(String(pathParams[name] ?? '')),
    )}`;
  }

  // Unlike an HTTP request, a path outside the protected patterns is not let through: the
  // path here is rebuilt, and a wrong prefix must not turn auth off. Only paths declared
  // public skip auth, plus the dev playground when no auth provider is configured.
  if (policy.honorPublicPaths && path !== undefined) {
    const isDevPlayground =
      typeof authConfig.authenticateToken !== 'function' &&
      process.env.MASTRA_DEV === 'true' &&
      getHeader('x-mastra-dev-playground') === 'true';
    const isPublic =
      !route.requiresAuth &&
      (canAccessPublicly(path, method, authConfig) || isCustomRoutePublic(path, method, customRouteAuthConfig));
    if (isDevPlayground || isPublic) {
      return null;
    }
  }

  if (!user) {
    return { status: 401, body: { error: 'Invalid or expired token' } };
  }

  if (path === undefined) {
    throw new Error(
      `dispatchRoute cannot tell which path ${method} ${route.path} is served under, so it cannot apply server auth to it. ` +
        'Set `routePrefix` in the context to the prefix the server adapter serves its built-in routes under (such as "/api").',
    );
  }

  // Hooks get the caller's own headers when the request is forwarded, otherwise the token it authenticated with.
  const token = requestContext.get(MASTRA_AUTH_TOKEN_KEY);
  const headers =
    outerHeaders ?? (typeof token === 'string' && token ? { authorization: `Bearer ${token}` } : undefined);

  return authorizeAuthenticatedUser({
    path,
    method,
    user,
    mastra,
    authConfig,
    customRouteAuthConfig,
    requestContext,
    rawRequest: new Request(`http://localhost${path}`, { method, headers }),
    buildAuthorizeContext: () => null,
  });
}

/** The one in-process pipeline behind `dispatchRoute` and `invokeRoute`: path-scoped auth → validate → RBAC → FGA → handler. */
async function runRoutePipeline(
  route: ServerRoute,
  input: DispatchRouteInput,
  context: ServerContext,
  policy: RoutePipelinePolicy,
): Promise<DispatchRouteResult> {
  const { mastra, requestContext } = context;

  if (policy.authPath === 'adapter') {
    const issues = findInvalidPathParams(route.path, input.pathParams ?? {});
    if (issues.length > 0) {
      return { ok: false, status: 400, body: { error: 'Invalid path parameters', issues } };
    }
  }

  const pathAuthError = await checkDispatchedRouteAuth(route, input.pathParams ?? {}, context, policy);
  if (pathAuthError) {
    return { ok: false, ...pathAuthError };
  }

  const validate = async <T>(
    kind: ValidationErrorContext,
    label: string,
    parse: () => Promise<T>,
  ): Promise<{ value: T } | { error: DispatchRouteResult }> => {
    try {
      return { value: await parse() };
    } catch (error) {
      if (isZodError(error)) {
        const { status, body } = resolveRouteValidationError(mastra, route, error, kind);
        return { error: { ok: false, status, body } };
      }
      if (policy.nonZodParseError === 'throw') {
        throw error;
      }
      return {
        error: {
          ok: false,
          status: 400,
          body: {
            error: `Invalid ${label}`,
            issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
          },
        },
      };
    }
  };

  const parsed: { query?: Record<string, any>; body?: unknown; path?: Record<string, any> } = { body: input.body };
  const steps = {
    query: async () => {
      const result = await validate('query', 'query parameters', () => parseRouteQueryParams(route, input.query ?? {}));
      if ('error' in result) return result.error;
      parsed.query = result.value;
    },
    body: async () => {
      if (input.body === undefined && !route.bodySchema) return;
      const result = await validate('body', 'request body', () => parseRouteBody(route, input.body));
      if ('error' in result) return result.error;
      parsed.body = result.value;
    },
    path: async () => {
      const result = await validate('path', 'path parameters', () =>
        parseRoutePathParams(route, input.pathParams ?? {}),
      );
      if ('error' in result) return result.error;
      parsed.path = result.value;
    },
  };
  const order =
    policy.validationOrder === 'path-query-body'
      ? ([steps.path, steps.query, steps.body] as const)
      : ([steps.query, steps.body, steps.path] as const);
  for (const step of order) {
    const validationError = await step();
    if (validationError) return validationError;
  }
  const { body } = parsed;

  const params = {
    ...(policy.pathParamsWin ? {} : parsed.path),
    ...parsed.query,
    ...(typeof body === 'object' ? body : {}),
    ...(policy.pathParamsWin ? parsed.path : {}),
  };

  // With an adapter serving the routes, its own RBAC check runs so subclass overrides apply here too.
  const adapter =
    policy.authPath === 'adapter' ? resolveDispatchAdapter(mastra, context.routePrefix).adapter : undefined;
  const authError = adapter?.checkRouteRBAC
    ? (adapter.checkRouteRBAC(route, requestContext) ?? (await checkRouteFGA(mastra, route, requestContext, params)))
    : await authorizeRoute(mastra, route, params, requestContext);
  if (authError) {
    return { ok: false, status: authError.status, body: { error: authError.error, message: authError.message } };
  }

  try {
    // HTTP adapters always set every server-context field, so request fields never stand in for them.
    const serverContext: ServerContext = policy.reserveServerContext
      ? {
          registeredTools: undefined,
          taskStore: undefined,
          routePrefix: undefined,
          request: undefined,
          ...context,
        }
      : context;
    return { ok: true, result: await route.handler({ ...params, ...serverContext }) };
  } catch (error) {
    const customResponse = policy.customErrorResponses ? getCustomHTTPExceptionResponse(error) : undefined;
    if (customResponse) {
      const text = await customResponse.text();
      let responseBody: unknown = text;
      try {
        responseBody = JSON.parse(text);
      } catch {
        // non-JSON custom response body stays as text
      }
      return { ok: false, status: customResponse.status, body: responseBody };
    }
    const { status, body: errorBody } = getHTTPErrorResponse(error);
    return { ok: false, status, body: errorBody };
  }
}

/**
 * Invoke a route in-process, enforcing what an adapter enforces for an HTTP request to it,
 * and never allowing more than that request would:
 *
 * 1. Path params must be what a URL can carry: a non-empty string for every `:param` (optional
 *    `:param?` may be left out), and never `.` or `..`. Anything else is a 400.
 * 2. Path-scoped authorization from `checkRouteAuth`, evaluated against the route's own
 *    path (the serving adapter's prefix + filled path params) and method: `requiresAuth: false`,
 *    public paths, and `authorizeUser` / `authorize` / `rules` / the RBAC default rules.
 *    Authentication is not repeated: the user (`MASTRA_USER_KEY`), permissions, and auth mode
 *    must already be in `context.requestContext` from the caller's authenticated request, and
 *    the auth config used is the one recorded there (`studio.auth` or `server.auth`), falling
 *    back to the request's client-type header only when none was recorded. `authorizeUser`
 *    receives the same `{ raw, headers, header() }` shape as over HTTP, wrapping a synthetic
 *    `Request` for the route's path/method with the caller's headers (no body).
 * 3. Schema validation: query, then body, then path params.
 * 4. RBAC (the serving adapter's `checkRoutePermission`), then FGA (`checkRouteFGA`) on the
 *    parsed params.
 * 5. `route.handler` with the parsed params and `context`.
 *
 * The prefix comes from the adapter serving the Mastra instance. With several adapters, set
 * `context.routePrefix` to the one whose paths apply; with none registered it is required.
 * When the prefix cannot be told, or `routePrefix` is one no registered adapter serves, a
 * caller without a user gets 401 and the call otherwise throws rather than guess a path.
 *
 * It is stricter than HTTP in three ways. With auth configured, a route needs a user unless
 * its path is declared public; a path merely outside the `protected` patterns is not let
 * through. Path params win over same-named query or body fields, so authorization and the
 * handler act on the resource named in the path. And request fields never stand in for
 * server context (`request`, `routePrefix`, `registeredTools`, `taskStore`) left out of `context`.
 *
 * Failures resolve to the status and JSON body an adapter would send; successful calls
 * return the raw handler result (streams are not converted).
 *
 * `invokeRoute` runs the same pipeline for JSON routes with a stricter contract: it never
 * skips auth for public paths and answers with `{ status, body }`.
 */
export async function dispatchRoute(
  route: ServerRoute,
  input: DispatchRouteInput,
  context: ServerContext,
): Promise<DispatchRouteResult> {
  return runRoutePipeline(route, input, context, DISPATCH_ROUTE_POLICY);
}

export interface InvokeRouteOptions {
  mastra: Mastra;
  /**
   * The caller's request context, already authenticated by Mastra (an HTTP route,
   * or an MCP request bridged by `applyMcpRequestAuth`). Its user, permissions and
   * auth mode decide what the caller may do.
   */
  requestContext: RequestContext;
  pathParams?: Record<string, string>;
  query?: Record<string, QueryParamValue>;
  body?: unknown;
  abortSignal?: AbortSignal;
}

/** What the route would have answered over HTTP. */
export interface InvokeRouteResult {
  status: number;
  body: unknown;
}

/**
 * Runs a server route in-process as the caller, with the checks its HTTP
 * endpoint applies on every adapter: authentication, auth's `authorizeUser`,
 * `authorize` and `rules` (against the route's path under `apiPrefix`), input
 * validation, RBAC permission and FGA. Lets code outside an HTTP request (such
 * as an MCP tool) reuse a route without proxying through the HTTP server.
 *
 * Authentication is not re-run: when server or studio auth is configured, the
 * request context must already carry the user Mastra server auth resolved
 * (`MASTRA_USER_KEY`), otherwise the call is refused with 401.
 *
 * Only JSON routes are supported; other response types throw. The handler gets
 * the parsed params, `mastra`, `requestContext` and `abortSignal`, but not the
 * HTTP-only `request`, `registeredTools`, `taskStore` or `routePrefix`, so
 * routes that read those are not suitable.
 *
 * Shares its pipeline with `dispatchRoute`, which follows the HTTP request more
 * closely (public paths, the adapter's prefix, custom error responses), passes a
 * full `ServerContext` and returns raw handler results.
 */
export async function invokeRoute(route: ServerRoute, options: InvokeRouteOptions): Promise<InvokeRouteResult> {
  if (route.responseType !== 'json') {
    throw new Error(
      `invokeRoute only runs JSON routes; ${route.method} ${route.path} answers with '${route.responseType}'`,
    );
  }

  const result = await runRoutePipeline(
    route,
    { pathParams: options.pathParams, query: options.query, body: options.body },
    {
      mastra: options.mastra,
      requestContext: options.requestContext,
      abortSignal: options.abortSignal ?? new AbortController().signal,
    },
    INVOKE_ROUTE_POLICY,
  );
  return result.ok ? { status: 200, body: result.result } : { status: result.status, body: result.body };
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
