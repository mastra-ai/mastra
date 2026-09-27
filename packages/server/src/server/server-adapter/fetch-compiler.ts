/**
 * PF-4446: framework-free fetch compiler for Mastra server routes.
 *
 * Pure functions that turn `ServerRoute` objects into Web-standard
 * `(request: Request) => Promise<Response>` handlers. No framework imports,
 * no adapter classes, no `fetch-to-node`: the consumer hosts the compiled
 * handlers directly (`Bun.serve({ routes })`, Effect `BunHttpServer`, or any
 * WinterCG runtime).
 *
 * Parity model: every branch below mirrors an observable behavior of the
 * Fastify (`server-adapters/fastify/src/selected.ts`) or Hono
 * (`server-adapters/hono/src/index.ts`) adapters. Where those two adapters
 * already diverge, the compiler follows the Hono (Web-native) behavior and
 * says so. Anything the shared `_test-utils` suites pin is covered by the
 * fetch parity runner in `./fetch-compiler.test.ts`.
 *
 * Request pipeline order (mirrors Fastify `registerRoute`):
 * auth (headers/query only, before body reads) → bounded body read →
 * body-parse 400 → query/body/path validation 400s → RBAC → FGA →
 * handler → per-`ResponseType` serialization → thrown-error mapping.
 *
 * Documented divergences from the framework adapters:
 * - Unknown `Content-Type` bodies stay `undefined` (Hono behavior). Fastify
 *   answers 415 for unparsable content types; the compiler never does.
 * - `Connection` / `Transfer-Encoding` are never set: connection management
 *   is platform-owned in fetch serving.
 * - `mcp-http` / `mcp-sse` routes answer explicit 501: core's MCP transports
 *   only expose Node (`startHTTP`/`startSSE`) and Hono (`startHonoSSE`)
 *   entries, and the 501 keeps the gap loud instead of shimmed.
 * - The 413 message text is compiler-owned (`status` 413 is the contract;
 *   the shared body-limit suite asserts status + handler-not-called only).
 * - `RequestContext` merge sources: query `requestContext` (GET only, JSON
 *   then base64) is merged before auth; body `requestContext` (POST/PUT
 *   JSON only) is merged after the bounded body read. Adapters merge both
 *   before auth because their parsers run first; the compiler preserves the
 *   fastify auth posture (401 without reading the body) instead.
 */
import { Buffer } from 'node:buffer';
import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { ValidationErrorContext, ValidationErrorResponse } from '@mastra/core/server';
import type { ChunkType } from '@mastra/core/stream';
import type { ZodError } from 'zod';
import type { InMemoryTaskStore } from '../a2a/store';
import { coreAuthMiddleware } from '../auth/helpers';
import {
  MASTRA_AUTH_MODE_KEY,
  MASTRA_CLIENT_TYPE_HEADER,
  MASTRA_IS_STUDIO_KEY,
  isReservedRequestContextKey,
  isStudioClientTypeHeader,
  type MastraAuthMode,
} from '../constants';
import { formatZodError, isZodError } from '../handlers/error';
import { normalizeRoutePath } from '../utils';
import { redactStreamChunk } from './redact';
import type { ServerRoute } from './routes';
import { getEffectivePermission } from './routes/permissions';
import {
  checkRouteFGA,
  getCustomHTTPExceptionResponse,
  normalizeQueryParams,
  parseComplexQueryParams,
} from './selected';
import type { ParsedRequestParams, QueryParamValue } from './selected';
import { serializeStreamChunk } from './serialize';

/** Default aggregate request-body cap. Mirrors the Fastify factory default. */
export const FETCH_COMPILER_DEFAULT_MAX_BODY_SIZE = 1024 * 1024;

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ALL_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

export type FetchCompilerDeps = {
  mastra: Mastra;
  /** Route table snapshot exposed to handlers as `serverRoutes`. Defaults to the compiled router list. */
  serverRoutes?: readonly ServerRoute[];
  /** Path prefix the routes are mounted under. Defaults to `'/api'` (adapter parity). */
  prefix?: string;
  /** Adapter-wide body cap (bytes) when a route declares no `maxBodySize`. Defaults to 1 MiB. */
  maxBodySize?: number;
  /** Custom-route auth overrides, keyed by route path. */
  customRouteAuthConfig?: Map<string, boolean>;
  /** Tools exposed to handlers as `registeredTools`. Defaults to `{}`. */
  tools?: ToolsInput;
  taskStore?: InMemoryTaskStore;
  /** Stream chunk redaction. Defaults to `true` (mirrors `streamOptions.redact ?? true`). */
  redact?: boolean;
  /** Override for unmatched dispatch requests. Defaults to a Fastify-compatible 404 shape. */
  onUnknownRoute?: (request: Request) => Response | Promise<Response>;
};

export type FetchRoutePattern = {
  /** The original `:param` pattern. Bun-compatible as-is. */
  pattern: string;
  match: (pathname: string) => Record<string, string> | null;
};

export type FetchCompiledRoute = {
  method: string;
  pattern: FetchRoutePattern;
  handler: (request: Request) => Promise<Response>;
};

export type FetchRouter = {
  routes: FetchCompiledRoute[];
  fetch: (request: Request) => Promise<Response>;
};

export function compileFetchRoutePattern(path: string): FetchRoutePattern {
  const names: string[] = [];
  const source = path
    .split('/')
    .map(segment => {
      if (segment.startsWith(':')) {
        names.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const expression = new RegExp(`^${source}$`);
  return {
    pattern: path,
    match: (pathname: string) => {
      const hit = expression.exec(pathname);
      if (!hit) return null;
      const params: Record<string, string> = {};
      names.forEach((name, index) => {
        params[name] = decodeURIComponent(hit[index + 1] ?? '');
      });
      return params;
    },
  };
}

function stripPrefix(pathname: string, prefix: string): string | null {
  if (!prefix) return pathname;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return null;
}

type HasPermissionFn = (userPerms: string[], required: string) => boolean;
let hasPermissionPromise: Promise<HasPermissionFn | undefined> | undefined;
function loadHasPermission(): Promise<HasPermissionFn | undefined> {
  if (!hasPermissionPromise) {
    hasPermissionPromise = import('@mastra/core/auth/ee')
      // Cast: mirrors the Fastify adapter's untyped dynamic import; the EE
      // subpath has no stable export types across supported core versions.
      .then(module => (module as { hasPermission?: HasPermissionFn }).hasPermission)
      .catch(() => {
        console.error(
          'Failed to load @mastra/core/auth/ee. Permission checks will be skipped. ' +
            'This is expected in environments without the EE auth module.',
        );
        return undefined;
      });
  }
  return hasPermissionPromise;
}

function readQueryRequestContext(url: URL, method: string): Record<string, any> | undefined {
  if (method !== 'GET') return undefined;
  const encoded = url.searchParams.get('requestContext');
  if (typeof encoded !== 'string') return undefined;
  try {
    return JSON.parse(encoded);
  } catch {
    try {
      return JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
    } catch {
      return undefined;
    }
  }
}

function mergeFetchRequestContext(options: {
  mastra: Mastra;
  paramsRequestContext?: Record<string, any>;
  bodyRequestContext?: Record<string, any>;
  getHeader: (name: string) => string | undefined;
}): RequestContext {
  const requestContext = new RequestContext();
  // Order mirrors mergeRequestContext: body first, query params win conflicts.
  for (const source of [options.bodyRequestContext, options.paramsRequestContext]) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, value] of Object.entries(source)) {
      if (isReservedRequestContextKey(key)) continue;
      requestContext.set(key, value);
    }
  }
  if (isStudioClientTypeHeader(options.getHeader(MASTRA_CLIENT_TYPE_HEADER))) {
    requestContext.set(MASTRA_IS_STUDIO_KEY, true);
  }
  return requestContext;
}

function getFetchEffectiveAuthConfig(
  mastra: Mastra,
  getHeader: (name: string) => string | undefined,
): { authConfig: unknown; authMode: MastraAuthMode } | null {
  const isStudioRequest = isStudioClientTypeHeader(getHeader(MASTRA_CLIENT_TYPE_HEADER));
  const studioAuth = mastra.getStudio?.()?.auth;
  const serverAuth = mastra.getServer?.()?.auth;

  if (isStudioRequest && studioAuth) {
    return { authConfig: studioAuth, authMode: 'studio' };
  }
  if (serverAuth) {
    return { authConfig: serverAuth, authMode: 'server' };
  }
  return null;
}

export type FetchAuthResult = { status: number; error: string; headers?: Record<string, string> } | null;

export async function checkFetchRouteAuth(
  route: ServerRoute,
  request: Request,
  url: URL,
  requestContext: RequestContext,
  deps: FetchCompilerDeps,
): Promise<FetchAuthResult> {
  const getHeader = (name: string) => request.headers.get(name) ?? undefined;
  const effectiveAuth = getFetchEffectiveAuthConfig(deps.mastra, getHeader);
  if (!effectiveAuth) return null;
  requestContext.set(MASTRA_AUTH_MODE_KEY, effectiveAuth.authMode);

  if (route.requiresAuth === false) {
    return null;
  }

  const authHeader = getHeader('authorization');
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
  if (!token) {
    token = url.searchParams.get('apiKey') || null;
  }

  const result = await coreAuthMiddleware({
    path: url.pathname,
    method: request.method,
    getHeader,
    mastra: deps.mastra,
    authConfig: effectiveAuth.authConfig as never,
    customRouteAuthConfig: deps.customRouteAuthConfig,
    requestContext,
    rawRequest: request,
    token,
    buildAuthorizeContext: () => request,
    requiresAuth: route.requiresAuth,
  });

  if (result.action === 'next') {
    if (result.headers) {
      return { status: 200, error: '', headers: result.headers as Record<string, string> };
    }
    return null;
  }
  const errorBody = result.body as { error?: string } | undefined;
  return { status: result.status, error: errorBody?.error ?? 'Access denied', headers: result.headers as
    | Record<string, string>
    | undefined };
}

class FetchBodyTooLargeError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(`Request body exceeds the ${limit}-byte limit`);
    this.name = 'FetchBodyTooLargeError';
    this.limit = limit;
  }
}

async function readBoundedBytes(request: Request, limit: number): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const declaredSize = Number.parseInt(declared, 10);
    if (Number.isFinite(declaredSize) && declaredSize > limit) {
      throw new FetchBodyTooLargeError(limit);
    }
  }
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > limit) {
          await reader.cancel().catch(() => undefined);
          throw new FetchBodyTooLargeError(limit);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

async function parseFetchFormData(formData: FormData): Promise<Record<string, any>> {
  const body: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      body[key] = Buffer.from(await value.arrayBuffer());
    } else if (typeof value === 'string') {
      try {
        body[key] = JSON.parse(value);
      } catch {
        body[key] = value;
      }
    } else {
      body[key] = value;
    }
  }
  return body;
}

function formDataByteSize(formData: FormData): number {
  let total = 0;
  for (const value of formData.values()) {
    if (value instanceof File) total += value.size;
    else if (typeof value === 'string') total += value.length;
  }
  return total;
}

export async function parseFetchRequestParams(
  route: ServerRoute,
  request: Request,
  url: URL,
  urlParams: Record<string, string>,
  deps: FetchCompilerDeps,
): Promise<ParsedRequestParams> {
  const queryParams: Record<string, QueryParamValue> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    queryParams[key] = (
      values.length > 1 ? values : (values[0] as QueryParamValue)
    ) as QueryParamValue;
  }
  const normalizedQuery = normalizeQueryParams(queryParams);

  let body: unknown;
  let bodyParseError: { message: string } | undefined;
  let rawBody: string | Uint8Array | undefined;

  if (BODY_METHODS.has(request.method.toUpperCase())) {
    const contentType = request.headers.get('content-type') ?? '';
    const limit = route.maxBodySize ?? deps.maxBodySize ?? FETCH_COMPILER_DEFAULT_MAX_BODY_SIZE;

    if (route.skipBodyParse) {
      rawBody = await readBoundedBytes(request, limit);
      return { urlParams, queryParams: normalizedQuery, body, bodyParseError, rawBody };
    }

    if (contentType.includes('multipart/form-data')) {
      const declared = request.headers.get('content-length');
      if (declared !== null) {
        const declaredSize = Number.parseInt(declared, 10);
        if (Number.isFinite(declaredSize) && declaredSize > limit) {
          throw new FetchBodyTooLargeError(limit);
        }
      }
      try {
        const formData = await request.formData();
        if (formDataByteSize(formData) > limit) {
          throw new FetchBodyTooLargeError(limit);
        }
        body = await parseFetchFormData(formData);
      } catch (error) {
        deps.mastra.getLogger()?.error('Failed to parse multipart form data', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
        if (error instanceof FetchBodyTooLargeError) throw error;
        if (error instanceof Error && error.message.toLowerCase().includes('size')) throw error;
        bodyParseError = {
          message: error instanceof Error ? error.message : 'Failed to parse multipart form data',
        };
      }
    } else if (contentType.includes('application/json')) {
      const bytes = await readBoundedBytes(request, limit);
      const bodyText = new TextDecoder().decode(bytes);
      if (bodyText && bodyText.trim().length > 0) {
        try {
          body = JSON.parse(bodyText);
        } catch (error) {
          deps.mastra.getLogger()?.error('Failed to parse JSON body', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
          bodyParseError = {
            message: error instanceof Error ? error.message : 'Invalid JSON in request body',
          };
        }
      }
    }
  }

  return { urlParams, queryParams: normalizedQuery, body, bodyParseError, rawBody };
}

const FETCH_CONTEXT_LABELS: Record<ValidationErrorContext, string> = {
  query: 'query parameters',
  body: 'request body',
  path: 'path parameters',
};

function resolveFetchValidationError(
  mastra: Mastra,
  route: ServerRoute,
  error: ZodError,
  context: ValidationErrorContext,
): ValidationErrorResponse {
  const hook = route.onValidationError ?? mastra.getServer?.()?.onValidationError;

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
    body: formatZodError(error, FETCH_CONTEXT_LABELS[context]),
  };
}

function jsonResponse(body: unknown, status: number, headers?: Headers): Response {
  return Response.json(body, { status, headers });
}

function checkFetchRoutePermission(
  mastra: Mastra,
  route: ServerRoute,
  userPermissions: string[] | undefined,
  hasPermissionFn: HasPermissionFn,
  requestContext: RequestContext,
): { status: number; error: string; message: string } | null {
  const authMode = requestContext.get(MASTRA_AUTH_MODE_KEY) as MastraAuthMode | undefined;
  const rbacProvider =
    authMode === 'studio' ? (mastra.getStudio?.()?.rbac ?? mastra.getServer?.()?.rbac) : mastra.getServer?.()?.rbac;
  if (!rbacProvider) return null;
  const requiredPermission = getEffectivePermission(route);
  if (!requiredPermission) return null;
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

function applyPendingHeaders(target: Headers, pending: Headers): void {
  pending.forEach((value, key) => {
    target.set(key, value);
  });
}

function mapThrownError(mastra: Mastra, route: ServerRoute, error: unknown): Response {
  const customResponse = getCustomHTTPExceptionResponse(error);
  if (customResponse) return customResponse;
  const statusCode =
    (error as { status?: unknown })?.status ??
    (error as { details?: { status?: unknown } })?.details?.status;
  const status =
    typeof statusCode === 'number' && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
      ? statusCode
      : 500;
  if (status >= 500 || (typeof statusCode === 'number' && (statusCode < 100 || statusCode > 599))) {
    mastra.getLogger()?.error('Error handling request', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      path: route.path,
      method: route.method,
    });
  }
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  return Response.json({ error: message }, { status });
}

async function writeFetchStreamResponse(
  route: ServerRoute,
  result: unknown,
  deps: FetchCompilerDeps,
  pendingHeaders: Headers,
): Promise<Response> {
  const streamFormat = route.streamFormat || 'stream';
  const headers = new Headers();
  applyPendingHeaders(headers, pendingHeaders);
  if (streamFormat === 'sse') {
    headers.set('Content-Type', 'text/event-stream');
    headers.set('Cache-Control', 'no-cache');
    headers.set('X-Accel-Buffering', 'no');
  } else {
    headers.set('Content-Type', 'text/plain');
  }

  const source: ReadableStream<unknown> =
    result instanceof ReadableStream ? result : (result as { fullStream: ReadableStream<unknown> }).fullStream;
  const encoder = new TextEncoder();
  const redact = deps.redact ?? true;
  const flushOnConnect = streamFormat === 'sse' && route.sseFlushOnConnect;

  // Client disconnect cancels `framed` through the platform: the cancel
  // propagates to `source`, whose own cancel logic observes the abort. This
  // replaces the adapters' manual close/error → reader.cancel() wiring.
  const framed = source.pipeThrough(
    new TransformStream<unknown, Uint8Array>({
      start(controller) {
        if (flushOnConnect) {
          controller.enqueue(encoder.encode(': connected\n\n'));
        }
      },
      async transform(value, controller) {
        if (!value) return;
        if (value instanceof Uint8Array) {
          controller.enqueue(value);
          return;
        }
        if (streamFormat === 'sse' && typeof value === 'string' && value.startsWith(':')) {
          controller.enqueue(encoder.encode(value));
          return;
        }
        const redacted = redact ? redactStreamChunk(value as ChunkType) : value;
        const serialized = serializeStreamChunk(redacted);
        if (!serialized.ok) {
          deps.mastra.getLogger()?.error('Failed to serialize stream chunk, skipping', {
            path: route.path,
            chunkType: (redacted as { type?: string })?.type,
            error: serialized.error.message,
          });
          return;
        }
        if (streamFormat === 'sse') {
          controller.enqueue(encoder.encode(`data: ${serialized.json}\n\n`));
        } else {
          controller.enqueue(encoder.encode(serialized.json + '\u001e'));
        }
      },
    }),
  );

  return new Response(framed as ReadableStream<Uint8Array>, { status: 200, headers });
}

export function compileFetchRouteHandler(route: ServerRoute, deps: FetchCompilerDeps): (request: Request) => Promise<Response> {
  const prefix = normalizeRoutePath(deps.prefix ?? '/api');
  return async (request: Request): Promise<Response> => {
    const pendingHeaders = new Headers();
    try {
      const url = new URL(request.url);
      const paramsRequestContext = readQueryRequestContext(url, request.method);
      const requestContext = mergeFetchRequestContext({
        mastra: deps.mastra,
        paramsRequestContext,
        getHeader: name => request.headers.get(name) ?? undefined,
      });

      const authError = await checkFetchRouteAuth(route, request, url, requestContext, deps);
      if (authError?.headers) {
        for (const [key, value] of Object.entries(authError.headers)) pendingHeaders.set(key, value);
      }
      if (authError && authError.error) {
        return jsonResponse({ error: authError.error }, authError.status, pendingHeaders);
      }

      const rest = stripPrefix(url.pathname, prefix) ?? url.pathname;
      const pattern = compileFetchRoutePattern(route.path);
      const urlParams = pattern.match(rest) ?? {};
      let params: ParsedRequestParams;
      try {
        params = await parseFetchRequestParams(route, request, url, urlParams, deps);
      } catch (error) {
        if (error instanceof FetchBodyTooLargeError) {
          return jsonResponse(
            { statusCode: 413, error: 'Payload Too Large', message: error.message },
            413,
            pendingHeaders,
          );
        }
        throw error;
      }
      if (params.bodyParseError) {
        return jsonResponse(
          {
            error: 'Invalid request body',
            issues: [{ field: 'body', message: params.bodyParseError.message }],
          },
          400,
          pendingHeaders,
        );
      }

      if (request.method === 'POST' || request.method === 'PUT') {
        const contentType = request.headers.get('content-type') ?? '';
        if (contentType.includes('application/json') && params.body && typeof params.body === 'object') {
          const nested = (params.body as { requestContext?: Record<string, any> }).requestContext;
          if (nested && typeof nested === 'object') {
            for (const [key, value] of Object.entries(nested)) {
              if (isReservedRequestContextKey(key)) continue;
              requestContext.set(key, value);
            }
          }
        }
      }

      try {
        if (route.queryParamSchema) {
          params.queryParams = (await route.queryParamSchema.parseAsync(
            parseComplexQueryParams(
              route.queryParamSchema as import('zod/v4').ZodTypeAny,
              params.queryParams,
            ),
          )) as Record<string, QueryParamValue>;
        }
      } catch (error) {
        if (isZodError(error)) {
          const resolved = resolveFetchValidationError(deps.mastra, route, error, 'query');
          return jsonResponse(resolved.body, resolved.status, pendingHeaders);
        }
        return jsonResponse(
          {
            error: 'Invalid query parameters',
            issues: [{ field: 'query', message: error instanceof Error ? error.message : 'Invalid query parameters' }],
          },
          400,
          pendingHeaders,
        );
      }

      try {
        if (route.bodySchema) {
          params.body = await route.bodySchema.parseAsync(params.body);
        }
      } catch (error) {
        if (isZodError(error)) {
          const resolved = resolveFetchValidationError(deps.mastra, route, error, 'body');
          return jsonResponse(resolved.body, resolved.status, pendingHeaders);
        }
        return jsonResponse(
          {
            error: 'Invalid request body',
            issues: [{ field: 'body', message: error instanceof Error ? error.message : 'Invalid request body' }],
          },
          400,
          pendingHeaders,
        );
      }

      try {
        if (route.pathParamSchema) {
          const validated = await route.pathParamSchema.parseAsync(params.urlParams);
          params.urlParams = (validated ?? {}) as Record<string, string>;
        }
      } catch (error) {
        if (isZodError(error)) {
          const resolved = resolveFetchValidationError(deps.mastra, route, error, 'path');
          return jsonResponse(resolved.body, resolved.status, pendingHeaders);
        }
        return jsonResponse(
          {
            error: 'Invalid path parameters',
            issues: [{ field: 'path', message: error instanceof Error ? error.message : 'Invalid path parameters' }],
          },
          400,
          pendingHeaders,
        );
      }

      const handlerParams = {
        ...(params.urlParams as Record<string, any>),
        ...(params.queryParams as Record<string, any>),
        ...(typeof params.body === 'object' && params.body !== null ? (params.body as Record<string, any>) : {}),
        requestContext,
        mastra: deps.mastra,
        registeredTools: deps.tools || {},
        taskStore: deps.taskStore,
        abortSignal: request.signal,
        routePrefix: prefix,
        serverRoutes: deps.serverRoutes ?? [],
        getHeader: (name: string) => request.headers.get(name) ?? undefined,
        getHeaders: () => {
          const headers: Record<string, string | string[]> = {};
          request.headers.forEach((value, key) => {
            headers[key] = value;
          });
          return headers;
        },
        rawBody: params.rawBody,
        requestBody: params.body,
        requestPathParams: params.urlParams,
        // Built-in handlers (e.g. auth) read ctx.request as a WHATWG Request.
        // Adapters memoize a converted copy; the compiler passes the native one.
        request,
      };

      const hasAuth = deps.mastra.getStudio?.()?.auth || deps.mastra.getServer?.()?.auth;
      if (hasAuth) {
        const hasPermission = await loadHasPermission();
        if (hasPermission) {
          const userPermissions = requestContext.get('mastra__userPermissions') as string[] | undefined;
          const permissionError = checkFetchRoutePermission(
            deps.mastra,
            route,
            userPermissions,
            hasPermission,
            requestContext,
          );
          if (permissionError) {
            return jsonResponse(
              { error: permissionError.error, message: permissionError.message },
              permissionError.status,
              pendingHeaders,
            );
          }
        }
      }

      const fgaError = await checkRouteFGA(deps.mastra, route, requestContext, {
        ...(params.urlParams as Record<string, unknown>),
        ...(params.queryParams as Record<string, unknown>),
        ...(typeof params.body === 'object' && params.body !== null ? (params.body as Record<string, unknown>) : {}),
      });
      if (fgaError) {
        return jsonResponse(
          { error: fgaError.error, message: fgaError.message },
          fgaError.status,
          pendingHeaders,
        );
      }

      const result = await route.handler(handlerParams);
      return await sendFetchResult(route, result, deps, pendingHeaders);
    } catch (error) {
      return mapThrownError(deps.mastra, route, error);
    }
  };
}

async function sendFetchResult(
  route: ServerRoute,
  result: unknown,
  deps: FetchCompilerDeps,
  pendingHeaders: Headers,
): Promise<Response> {
  const headers = new Headers();
  applyPendingHeaders(headers, pendingHeaders);
  let payload: unknown = result;
  if (payload && typeof payload === 'object' && '__refreshHeaders' in (payload as Record<string, unknown>)) {
    const { __refreshHeaders, ...rest } = payload as Record<string, unknown> & {
      __refreshHeaders: Record<string, string>;
    };
    for (const [key, value] of Object.entries(__refreshHeaders)) headers.set(key, value);
    payload = rest;
  }

  if (route.responseType === 'json') {
    return Response.json(payload, { status: 200, headers });
  }
  if (route.responseType === 'stream') {
    return writeFetchStreamResponse(route, payload, deps, headers);
  }
  if (route.responseType === 'datastream-response') {
    const fetchResponse = payload as globalThis.Response;
    const merged = new Headers(headers);
    fetchResponse.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'content-length' || lower === 'transfer-encoding') return;
      merged.set(key, value);
    });
    return new Response(fetchResponse.body, { status: fetchResponse.status, headers: merged });
  }
  if (route.responseType === 'mcp-http' || route.responseType === 'mcp-sse') {
    return jsonResponse(
      { error: 'MCP transports are not served by the fetch compiler yet (PF-4446 follow-up)' },
      501,
      headers,
    );
  }
  return new Response(null, { status: 500, headers });
}

export function compileFetchRouter(routes: readonly ServerRoute[], deps: FetchCompilerDeps): FetchRouter {
  const snapshot = Object.freeze([...routes]);
  const routerDeps: FetchCompilerDeps = { ...deps, serverRoutes: deps.serverRoutes ?? snapshot };
  const compiled: FetchCompiledRoute[] = [];
  for (const route of routes) {
    const methods =
      route.method.toUpperCase() === 'ALL' ? [...ALL_METHODS] : [route.method.toUpperCase()];
    for (const method of methods) {
      if (compiled.some(entry => entry.method === method && entry.pattern.pattern === route.path)) {
        continue;
      }
      compiled.push({
        method,
        pattern: compileFetchRoutePattern(route.path),
        handler: compileFetchRouteHandler(route, routerDeps),
      });
    }
  }
  const prefix = normalizeRoutePath(deps.prefix ?? '/api');
  return {
    routes: compiled,
    fetch: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const rest = stripPrefix(url.pathname, prefix);
      if (rest !== null) {
        const method = request.method.toUpperCase();
        for (const entry of compiled) {
          if (entry.method !== method) continue;
          if (entry.pattern.match(rest) !== null) {
            return entry.handler(request);
          }
        }
      }
      if (deps.onUnknownRoute) return deps.onUnknownRoute(request);
      return Response.json(
        {
          message: `Route ${request.method}:${url.pathname} not found`,
          error: 'Not Found',
          statusCode: 404,
        },
        { status: 404 },
      );
    },
  };
}
