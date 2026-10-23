import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpContext, Router } from '@adonisjs/core/http';
import type { MiddlewareFn, NextFn, ParsedNamedMiddleware } from '@adonisjs/core/types/http';
import { Busboy } from '@fastify/busboy';
import type { RequestContext } from '@mastra/core/request-context';
import { findMatchingCustomRoute, isProtectedCustomRoute } from '@mastra/server/auth';
import type { MCPHttpTransportResult, MCPSseTransportResult } from '@mastra/server/handlers/mcp';
import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';
import {
  MastraServer as MastraServerBase,
  checkRouteFGA,
  getCustomHTTPExceptionResponse,
  getHTTPErrorResponse,
  isSafeObjectKey,
  isZodError,
  normalizeQueryParams,
  redactStreamChunk,
  serializeStreamChunk,
} from '@mastra/server/server-adapter';
import { toWebRequest } from './utils';
export { createAuthMiddleware } from './auth-middleware';
export type { AdonisAuthMiddlewareOptions } from './auth-middleware';

type HasPermissionFn = (userPerms: string[], required: string) => boolean;
type RouteMiddleware = MiddlewareFn | ParsedNamedMiddleware;
type BaseOptions = ConstructorParameters<typeof MastraServerBase<Router, HttpContext, HttpContext>>[0];

export type MastraServerOptions = BaseOptions & {
  /**
   * AdonisJS route middleware applied to every route Mastra registers (built-in and custom
   * API routes). Runs before Mastra's own auth checks, e.g. `[middleware.auth()]`.
   */
  routeMiddleware?: RouteMiddleware | RouteMiddleware[];
};

type BodyResult = {
  /** Parsed body handed to Mastra handlers */
  body?: unknown;
  /** Raw body bytes, kept so custom API routes receive the original payload */
  raw?: Buffer | string;
  /**
   * Multipart parts already parsed by the AdonisJS bodyparser. Only custom API routes need
   * them re-encoded, so encoding happens lazily in `handleCustomRoute`.
   */
  multipartParts?: Array<{ name: string; value: string | Buffer; fileName?: string }>;
  parseError?: { message: string };
  tooLarge?: boolean;
};

type RequestState = BodyResult & {
  requestContext: RequestContext;
  abortSignal: AbortSignal;
};

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

class BodyTooLargeError extends Error {
  constructor(limit: number) {
    super(`Request body too large (max: ${limit} bytes)`);
  }
}

let _hasPermissionPromise: Promise<HasPermissionFn | undefined> | undefined;
function loadHasPermission(): Promise<HasPermissionFn | undefined> {
  if (!_hasPermissionPromise) {
    _hasPermissionPromise = import('@mastra/core/auth/ee')
      .then(m => m.hasPermission)
      .catch(() => {
        console.error(
          '[@mastra/adonisjs] Auth features require @mastra/core >= 1.6.0. Please upgrade: npm install @mastra/core@latest',
        );
        return undefined;
      });
  }
  return _hasPermissionPromise;
}

const httpContexts = new WeakMap<RequestContext, HttpContext>();

/**
 * Returns the AdonisJS `HttpContext` of the request that created `requestContext`.
 *
 * Mastra passes `requestContext` to tools, workflow steps and agent hooks, so this is how
 * Mastra code reaches the AdonisJS request (e.g. `ctx.auth.user`). The HttpContext is kept
 * out of the RequestContext itself because RequestContext values can be serialized into
 * workflow snapshots and traces.
 */
export function getHttpContext(requestContext: RequestContext | undefined): HttpContext | undefined {
  return requestContext ? httpContexts.get(requestContext) : undefined;
}

function getHeader(ctx: HttpContext, name: string): string | undefined {
  const value = ctx.request.request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(', ') : value;
}

function getQuery(ctx: HttpContext): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  const search = new URLSearchParams(ctx.request.parsedUrl.query ?? '');
  for (const [key, value] of search) {
    if (!isSafeObjectKey(key)) continue;
    const existing = query[key];
    if (existing === undefined) query[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else query[key] = [existing, value];
  }
  return query;
}

function getPath(ctx: HttpContext): string {
  return ctx.request.parsedUrl.pathname || '/';
}

function getPathParams(ctx: HttpContext): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [name, value] of Object.entries(ctx.params ?? {})) {
    if (typeof value !== 'string') continue;
    try {
      params[name] = decodeURIComponent(value);
    } catch {
      params[name] = value;
    }
  }
  return params;
}

function isSizeError(error: unknown): boolean {
  return error instanceof BodyTooLargeError || (error instanceof Error && /size|too large/i.test(error.message));
}

function parseFieldValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Read the raw request stream, stopping as soon as `limit` bytes are exceeded. */
function readRawBody(req: IncomingMessage, limit: number | undefined): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
    };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (limit !== undefined && size > limit) {
        cleanup();
        // Keep draining so the client can read the 413 response
        req.resume();
        reject(new BodyTooLargeError(limit));
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

/**
 * Mastra server adapter for AdonisJS v6.
 *
 * `app` is the AdonisJS router. Every Mastra route is registered as a regular AdonisJS route,
 * so `init()` must run before the router is committed (i.e. from a preload file such as
 * `start/routes.ts`).
 *
 * @example
 * ```ts
 * // start/routes.ts
 * import router from '@adonisjs/core/services/router'
 * import { MastraServer } from '@mastra/adonisjs'
 * import { mastra } from '#mastra/index'
 *
 * const server = new MastraServer({ app: router, mastra })
 * await server.init()
 * ```
 */
export class MastraServer extends MastraServerBase<Router, HttpContext, HttpContext> {
  private readonly routeMiddleware: RouteMiddleware[];
  private readonly requestStates = new WeakMap<HttpContext, RequestState>();

  constructor({ routeMiddleware, ...options }: MastraServerOptions) {
    super(options);
    this.routeMiddleware = routeMiddleware
      ? Array.isArray(routeMiddleware)
        ? routeMiddleware
        : [routeMiddleware]
      : [];
  }

  /**
   * Build (once per request) the Mastra state for an AdonisJS request: the body, the
   * RequestContext and the abort signal.
   */
  private async getRequestState(ctx: HttpContext, maxBodySize?: number): Promise<RequestState> {
    const existing = this.requestStates.get(ctx);
    if (existing) return existing;

    const bodyResult = await this.readBody(ctx, maxBodySize);
    const method = ctx.request.method();

    let bodyRequestContext: Record<string, any> | undefined;
    if ((method === 'POST' || method === 'PUT') && bodyResult.body && typeof bodyResult.body === 'object') {
      const value = (bodyResult.body as { requestContext?: unknown }).requestContext;
      if (value && typeof value === 'object') {
        bodyRequestContext = value as Record<string, any>;
      }
    }

    let paramsRequestContext: Record<string, any> | undefined;
    const encodedRequestContext = getQuery(ctx).requestContext;
    if (typeof encodedRequestContext === 'string') {
      try {
        paramsRequestContext = JSON.parse(encodedRequestContext);
      } catch {
        try {
          paramsRequestContext = JSON.parse(Buffer.from(encodedRequestContext, 'base64').toString('utf-8'));
        } catch {
          // ignore invalid request context
        }
      }
    }

    const requestContext = this.mergeRequestContext({ paramsRequestContext, bodyRequestContext });
    this.applyRequestMetadataToContext({ requestContext, getHeader: name => getHeader(ctx, name) });
    httpContexts.set(requestContext, ctx);

    // Abort the run when the client disconnects. Listen on the response: once a body parser
    // has consumed the request, the request's own 'close' event no longer signals a disconnect.
    const controller = new AbortController();
    const res = ctx.response.response;
    res.once('close', () => {
      if (!res.writableFinished) {
        controller.abort();
      }
    });

    const state: RequestState = { ...bodyResult, requestContext, abortSignal: controller.signal };
    this.requestStates.set(ctx, state);
    return state;
  }

  /**
   * Read the request body. Works both when the AdonisJS bodyparser middleware already
   * consumed the stream (the default AdonisJS setup) and when it did not (bodyparser not
   * installed, content types it ignores, or `multipart.processManually` routes).
   *
   * When the bodyparser already consumed the request, it buffered up to its own limits in
   * `config/bodyparser.ts` before Mastra's limit is checked here. Keep those limits at or
   * below `bodyLimitOptions.maxSize` to cap buffering at Mastra's limit.
   */
  private async readBody(ctx: HttpContext, limit: number | undefined): Promise<BodyResult> {
    const method = ctx.request.method();
    if (!BODY_METHODS.has(method)) return {};

    const contentLength = getHeader(ctx, 'content-length');
    if (limit !== undefined && contentLength && parseInt(contentLength, 10) > limit) {
      return { tooLarge: true };
    }

    const contentType = getHeader(ctx, 'content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');
    const isJson = contentType.includes('json');
    const req = ctx.request.request;

    if (req.readableEnded) {
      return this.readParsedBody(ctx, limit, isMultipart, isJson);
    }

    let raw: Buffer;
    try {
      raw = await readRawBody(req, limit);
    } catch (error) {
      if (error instanceof BodyTooLargeError) return { tooLarge: true };
      return { parseError: { message: error instanceof Error ? error.message : 'Failed to read request body' } };
    }

    if (isMultipart) {
      try {
        return { body: await this.parseMultipartFormData(raw, contentType, limit), raw };
      } catch (error) {
        this.mastra.getLogger()?.error('Failed to parse multipart form data', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
        if (isSizeError(error)) return { tooLarge: true };
        return {
          raw,
          parseError: { message: error instanceof Error ? error.message : 'Failed to parse multipart form data' },
        };
      }
    }

    if (raw.length === 0) return {};

    if (isJson) {
      try {
        return { body: JSON.parse(raw.toString('utf-8')), raw };
      } catch (error) {
        return { raw, parseError: { message: error instanceof Error ? error.message : 'Invalid JSON' } };
      }
    }

    if (contentType.startsWith('text/') || contentType.includes('x-www-form-urlencoded')) {
      return { body: raw.toString('utf-8'), raw };
    }

    return { raw };
  }

  /** Body already parsed by the AdonisJS bodyparser middleware. */
  private async readParsedBody(
    ctx: HttpContext,
    limit: number | undefined,
    isMultipart: boolean,
    isJson: boolean,
  ): Promise<BodyResult> {
    const parsed = ctx.request.body();

    if (isMultipart) {
      const fields: Record<string, unknown> = {};
      const parts: NonNullable<BodyResult['multipartParts']> = [];
      let size = 0;
      for (const [key, value] of Object.entries(parsed ?? {})) {
        if (!isSafeObjectKey(key)) continue;
        fields[key] = parseFieldValue(value);
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        size += Buffer.byteLength(text);
        parts.push({ name: key, value: text });
      }
      for (const [key, value] of Object.entries(ctx.request.allFiles())) {
        if (!isSafeObjectKey(key)) continue;
        const files = Array.isArray(value) ? value : [value];
        const buffers: Buffer[] = [];
        for (const file of files) {
          size += file.size ?? 0;
          if (limit !== undefined && size > limit) return { tooLarge: true };
          if (!file.tmpPath) continue;
          const buffer = await readFile(file.tmpPath);
          buffers.push(buffer);
          parts.push({ name: key, value: buffer, fileName: file.clientName });
        }
        if (buffers.length > 0) {
          fields[key] = buffers.length === 1 ? buffers[0] : buffers;
        }
      }
      if (limit !== undefined && size > limit) return { tooLarge: true };

      return { body: fields, multipartParts: parts };
    }

    const raw = ctx.request.raw() ?? undefined;
    if (limit !== undefined && raw && Buffer.byteLength(raw) > limit) {
      return { tooLarge: true };
    }

    if (isJson) {
      return { body: raw ? parsed : undefined, raw };
    }
    if (typeof raw === 'string') {
      // Text bodies: the bodyparser keeps the payload in raw() and sets body() to {}
      return { body: raw, raw };
    }
    return { body: parsed, raw };
  }

  private parseMultipartFormData(
    raw: Buffer,
    contentType: string,
    maxFileSize?: number,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const result: Record<string, unknown> = {};

      const busboy = new Busboy({
        headers: { 'content-type': contentType },
        limits: maxFileSize ? { fileSize: maxFileSize } : undefined,
      });

      busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream) => {
        const chunks: Buffer[] = [];
        let limitExceeded = false;

        file.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.on('limit', () => {
          limitExceeded = true;
          reject(new Error(`File size limit exceeded${maxFileSize ? ` (max: ${maxFileSize} bytes)` : ''}`));
        });

        file.on('end', () => {
          if (!limitExceeded && isSafeObjectKey(fieldname)) {
            result[fieldname] = Buffer.concat(chunks);
          }
        });
      });

      busboy.on('field', (fieldname: string, value: string) => {
        if (isSafeObjectKey(fieldname)) {
          result[fieldname] = parseFieldValue(value);
        }
      });

      busboy.on('finish', () => resolve(result));
      busboy.on('error', (error: Error) => reject(error));

      busboy.end(raw);
    });
  }

  private sendJson(ctx: HttpContext, status: number, body: unknown): void {
    ctx.response.status(status);
    ctx.response.header('Content-Type', 'application/json; charset=utf-8');
    ctx.response.send(body === undefined ? 'null' : JSON.stringify(body));
  }

  private sendBodyTooLarge(ctx: HttpContext, route: { maxBodySize?: number }): void {
    let errorResponse: unknown = { error: 'Request body too large' };
    if (route.maxBodySize === undefined && this.bodyLimitOptions) {
      try {
        errorResponse = this.bodyLimitOptions.onError(errorResponse);
      } catch {
        // Fall back to the default response.
      }
    }
    this.sendJson(ctx, 413, errorResponse);
  }

  /** Headers already set on the AdonisJS response (e.g. CORS), for responses Mastra writes itself. */
  private getPendingHeaders(ctx: HttpContext): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(ctx.response.getHeaders())) {
      if (value === undefined) continue;
      headers[key] = Array.isArray(value) ? value.map(String) : String(value);
    }
    return headers;
  }

  private async checkPermissions(
    route: ServerRoute,
    requestContext: RequestContext,
  ): Promise<{ status: number; error: string; message: string } | null> {
    const hasAuth = this.mastra.getStudio?.()?.auth || this.mastra.getServer()?.auth;
    if (!hasAuth) return null;
    const hasPermission = await loadHasPermission();
    if (!hasPermission) return null;
    const userPermissions = requestContext.get('mastra__userPermissions') as string[] | undefined;
    return this.checkRoutePermission(route, userPermissions, hasPermission, requestContext);
  }

  /**
   * Try to handle an error using the `server.onError` hook.
   * @returns true if the error was handled and the response was set on ctx
   */
  private async handleOnError(err: unknown, ctx: HttpContext): Promise<boolean> {
    const onError = this.mastra.getServer()?.onError;
    if (!onError) return false;

    const error = err instanceof Error ? err : new Error(String(err));
    const shimContext = {
      json: (data: unknown, status: number = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      req: {
        path: getPath(ctx),
        method: ctx.request.method(),
        header: (name: string) => getHeader(ctx, name),
        url: ctx.request.url(true),
      },
    };

    try {
      const response = await onError(error, shimContext as any);
      ctx.response.status(response.status);
      response.headers.forEach((value, name) => ctx.response.header(name, value));
      ctx.response.send(Buffer.from(await response.arrayBuffer()));
      return true;
    } catch (onErrorErr) {
      this.mastra.getLogger()?.error('Error in custom onError handler', {
        error: onErrorErr instanceof Error ? { message: onErrorErr.message, stack: onErrorErr.stack } : onErrorErr,
      });
      return false;
    }
  }

  private async handleRoute(route: ServerRoute, prefix: string, ctx: HttpContext): Promise<void> {
    const state = await this.getRequestState(ctx, route.maxBodySize ?? this.bodyLimitOptions?.maxSize);
    if (state.tooLarge) {
      this.sendBodyTooLarge(ctx, route);
      return;
    }

    const authError = await this.checkRouteAuth(route, {
      path: getPath(ctx),
      method: ctx.request.method(),
      getHeader: name => getHeader(ctx, name),
      getQuery: name => {
        const value = getQuery(ctx)[name];
        return Array.isArray(value) ? value[0] : value;
      },
      requestContext: state.requestContext,
      request: toWebRequest(ctx),
      buildAuthorizeContext: () => ctx,
    });

    if (authError) {
      if (authError.headers) {
        for (const [key, value] of Object.entries(authError.headers)) {
          ctx.response.header(key, value);
        }
      }
      if (authError.error) {
        this.sendJson(ctx, authError.status, { error: authError.error });
        return;
      }
    }

    const params = await this.getParams(route, ctx);

    if (params.bodyParseError) {
      this.sendJson(ctx, 400, {
        error: 'Invalid request body',
        issues: [{ field: 'body', message: params.bodyParseError.message }],
      });
      return;
    }

    if (params.queryParams) {
      try {
        params.queryParams = await this.parseQueryParams(route, params.queryParams);
      } catch (error) {
        this.mastra.getLogger()?.error('Error parsing query params', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
        if (isZodError(error)) {
          const resolved = this.resolveValidationError(route, error, 'query');
          this.sendJson(ctx, resolved.status, resolved.body);
          return;
        }
        this.sendJson(ctx, 400, {
          error: 'Invalid query parameters',
          issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
        });
        return;
      }
    }

    if (params.body !== undefined || route.bodySchema) {
      try {
        params.body = await this.parseBody(route, params.body);
      } catch (error) {
        this.mastra.getLogger()?.error('Error parsing body', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
        if (isZodError(error)) {
          const resolved = this.resolveValidationError(route, error, 'body');
          this.sendJson(ctx, resolved.status, resolved.body);
          return;
        }
        this.sendJson(ctx, 400, {
          error: 'Invalid request body',
          issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
        });
        return;
      }
    }

    if (params.urlParams) {
      try {
        params.urlParams = await this.parsePathParams(route, params.urlParams);
      } catch (error) {
        this.mastra.getLogger()?.error('Error parsing path params', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
        if (isZodError(error)) {
          const resolved = this.resolveValidationError(route, error, 'path');
          this.sendJson(ctx, resolved.status, resolved.body);
          return;
        }
        this.sendJson(ctx, 400, {
          error: 'Invalid path parameters',
          issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
        });
        return;
      }
    }

    const bodyParams = params.body && typeof params.body === 'object' ? (params.body as Record<string, unknown>) : {};
    // Path params last, matching the FGA input below, so the handler acts on the resource FGA checked.
    const handlerParams = {
      ...params.queryParams,
      ...bodyParams,
      ...params.urlParams,
      requestContext: state.requestContext,
      mastra: this.mastra,
      registeredTools: this.tools || {},
      taskStore: this.taskStore,
      abortSignal: state.abortSignal,
      routePrefix: prefix,
      request: toWebRequest(ctx),
    };

    const permissionError = await this.checkPermissions(route, state.requestContext);
    if (permissionError) {
      this.sendJson(ctx, permissionError.status, { error: permissionError.error, message: permissionError.message });
      return;
    }

    // Path params last so query/body values cannot change which resource FGA checks.
    const fgaError = await checkRouteFGA(this.mastra, route, state.requestContext, {
      ...params.queryParams,
      ...bodyParams,
      ...params.urlParams,
    });
    if (fgaError) {
      this.sendJson(ctx, fgaError.status, { error: fgaError.error, message: fgaError.message });
      return;
    }

    try {
      const result = await route.handler(handlerParams);
      await this.sendResponse(route, ctx, result, prefix);
    } catch (error) {
      await this.handleRouteError(error, route, ctx);
    }
  }

  private async handleRouteError(error: unknown, route: ServerRoute, ctx: HttpContext): Promise<void> {
    const httpStatus =
      error && typeof error === 'object' ? ((error as any).status ?? (error as any).details?.status) : undefined;
    const isClientError = typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500;
    if (!isClientError) {
      // 501 means an optional capability isn't provided by the configured storage or core: expected, not a server fault.
      const logLevel = httpStatus === 501 ? 'warn' : 'error';
      this.mastra.getLogger()?.[logLevel]('Error calling handler', {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        path: route.path,
        method: route.method,
      });
    }

    if (ctx.response.response.headersSent) {
      ctx.response.response.end();
      return;
    }

    const customResponse = getCustomHTTPExceptionResponse(error);
    if (customResponse) {
      ctx.response.status(customResponse.status);
      customResponse.headers.forEach((value, name) => ctx.response.header(name, value));
      ctx.response.send(Buffer.from(await customResponse.arrayBuffer()));
      return;
    }

    const errorResponse = getHTTPErrorResponse(error);

    if (await this.handleOnError(error, ctx)) {
      return;
    }

    this.sendJson(ctx, errorResponse.status, errorResponse.body);
  }

  async stream(route: ServerRoute, ctx: HttpContext, result: { fullStream: ReadableStream }): Promise<void> {
    const res = ctx.response.response;
    const streamFormat = route.streamFormat || 'stream';

    const streamHeaders =
      streamFormat === 'sse'
        ? {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          }
        : {
            'Content-Type': 'text/plain',
          };

    res.writeHead(200, {
      ...this.getPendingHeaders(ctx),
      ...streamHeaders,
      'Transfer-Encoding': 'chunked',
    });

    if (streamFormat === 'sse' && route.sseFlushOnConnect) {
      res.write(': connected\n\n');
    }

    const readableStream = result instanceof ReadableStream ? result : result.fullStream;
    const reader = readableStream.getReader();

    res.on('close', () => {
      void reader.cancel('request aborted').catch(() => {});
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          if (streamFormat === 'sse' && typeof value === 'string' && value.startsWith(':')) {
            res.write(value);
            continue;
          }

          // Redact sensitive data (system prompts, tool definitions, API keys) unless disabled
          const shouldRedact = this.streamOptions?.redact ?? true;
          const outputValue = shouldRedact ? redactStreamChunk(value) : value;
          // A chunk that can't be serialized must not kill the stream — skip it and keep streaming
          const serialized = serializeStreamChunk(outputValue);
          if (!serialized.ok) {
            this.mastra.getLogger()?.error('Failed to serialize stream chunk, skipping', {
              path: route.path,
              chunkType: (outputValue as { type?: string })?.type,
              error: serialized.error.message,
            });
            continue;
          }
          if (streamFormat === 'sse') {
            res.write(`data: ${serialized.json}\n\n`);
          } else {
            res.write(serialized.json + '\x1E');
          }
        }
      }
    } catch (error) {
      this.mastra.getLogger()?.error('Error in stream processing', {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });
    } finally {
      res.end();
    }
  }

  async getParams(route: ServerRoute, ctx: HttpContext): Promise<ParsedRequestParams> {
    const state = await this.getRequestState(ctx, route.maxBodySize ?? this.bodyLimitOptions?.maxSize);
    return {
      urlParams: getPathParams(ctx),
      queryParams: normalizeQueryParams(getQuery(ctx)),
      body: state.body,
      bodyParseError: state.parseError,
    };
  }

  async sendResponse(route: ServerRoute, ctx: HttpContext, result: unknown, prefix?: string): Promise<void> {
    const resolvedPrefix = prefix ?? this.prefix ?? '';
    const res = ctx.response.response;

    // Apply refresh headers from transparent session refresh (e.g. Set-Cookie after token refresh)
    if (result && typeof result === 'object' && '__refreshHeaders' in result) {
      const refreshHeaders = (result as any).__refreshHeaders as Record<string, string>;
      for (const [key, value] of Object.entries(refreshHeaders)) {
        ctx.response.header(key, value);
      }
      delete (result as any).__refreshHeaders;
    }

    if (route.responseType === 'json') {
      this.sendJson(ctx, 200, result ?? null);
    } else if (route.responseType === 'stream') {
      await this.stream(route, ctx, result as { fullStream: ReadableStream });
    } else if (route.responseType === 'datastream-response') {
      const fetchResponse = result as globalThis.Response;
      const headers = this.getPendingHeaders(ctx);
      fetchResponse.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') headers[key] = value;
      });
      const setCookies = fetchResponse.headers.getSetCookie?.() ?? [];
      if (setCookies.length > 0) headers['set-cookie'] = setCookies;
      res.writeHead(fetchResponse.status, headers);

      if (!fetchResponse.body) {
        res.end();
        return;
      }

      const reader = fetchResponse.body.getReader();
      const onResError = (err: unknown) => {
        this.mastra.getLogger()?.error('Error writing datastream response', {
          error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        });
        void reader.cancel('response write error').catch(() => {});
      };
      const onResClose = () => {
        void reader.cancel('request aborted').catch(() => {});
      };
      res.once('error', onResError);
      res.once('close', onResClose);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (error) {
        this.mastra.getLogger()?.error('Error in datastream processing', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
      } finally {
        res.off('error', onResError);
        res.off('close', onResClose);
        res.end();
      }
    } else if (route.responseType === 'mcp-http') {
      const { server, httpPath, mcpOptions: routeMcpOptions } = result as MCPHttpTransportResult;
      const rawReq = this.getMcpRequest(ctx);

      try {
        // Route-specific options take precedence over class-level mcpOptions
        const options = { ...this.mcpOptions, ...routeMcpOptions };
        await server.startHTTP({
          url: new URL(ctx.request.url(true), `http://${getHeader(ctx, 'host') ?? 'localhost'}`),
          httpPath: `${resolvedPrefix}${httpPath}`,
          req: rawReq,
          res,
          options: Object.keys(options).length > 0 ? options : undefined,
        });
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal server error' },
              id: null,
            }),
          );
        }
      }
    } else if (route.responseType === 'mcp-sse') {
      const { server, ssePath, messagePath } = result as MCPSseTransportResult;
      const rawReq = this.getMcpRequest(ctx);

      try {
        await server.startSSE({
          url: new URL(ctx.request.url(true), `http://${getHeader(ctx, 'host') ?? 'localhost'}`),
          ssePath: `${resolvedPrefix}${ssePath}`,
          messagePath: `${resolvedPrefix}${messagePath}`,
          req: rawReq,
          res,
        });
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Error handling MCP SSE request' }));
        }
      }
    } else {
      this.sendJson(ctx, 500, { error: 'Unsupported response type' });
    }
  }

  /** The raw request with the already-read body attached, so the MCP transport does not re-read the stream. */
  private getMcpRequest(ctx: HttpContext): IncomingMessage & { body?: unknown } {
    const rawReq = ctx.request.request as IncomingMessage & { body?: unknown };
    const state = this.requestStates.get(ctx);
    if (state?.body !== undefined) {
      rawReq.body = state.body;
    }
    return rawReq;
  }

  private addRoute(app: Router, method: string, path: string, handler: (ctx: HttpContext) => Promise<void>): void {
    const upper = method.toUpperCase();
    const adonisRoute =
      upper === 'ALL' ? app.any(path, handler) : app.route(path, upper === 'GET' ? ['GET', 'HEAD'] : [upper], handler);
    for (const middleware of this.routeMiddleware) {
      adonisRoute.use(middleware);
    }
  }

  async registerRoute(
    app: Router,
    route: ServerRoute,
    { prefix: prefixParam }: { prefix?: string } = {},
  ): Promise<void> {
    const prefix = prefixParam ?? this.prefix ?? '';
    this.addRoute(app, route.method, `${prefix}${route.path}` || '/', ctx => this.handleRoute(route, prefix, ctx));
  }

  async registerCustomApiRoutes(): Promise<void> {
    const routes = await this.registerSchemaApiRoutes();
    if (!(await this.buildCustomRouteHandler(routes))) return;

    const registered = new Set<string>();
    for (const route of routes) {
      const path = toAdonisPattern(route.path);
      const key = `${route.method}:${path}`;
      if (registered.has(key)) continue;
      registered.add(key);
      this.addRoute(this.app, route.method, path, ctx => this.handleCustomRoute(ctx));
    }
  }

  private async handleCustomRoute(ctx: HttpContext): Promise<void> {
    const path = getPath(ctx);
    const method = ctx.request.method();
    // GET routes also answer HEAD. Auth config and route matching are keyed by GET,
    // so resolve HEAD as GET here or HEAD would skip auth/RBAC/FGA.
    const routeMethod = method === 'HEAD' ? 'GET' : method;
    const matchedRoute = findMatchingCustomRoute(
      path,
      routeMethod,
      this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes,
    );

    const state = await this.getRequestState(ctx, this.bodyLimitOptions?.maxSize);
    if (state.tooLarge) {
      this.sendBodyTooLarge(ctx, {});
      return;
    }

    const shouldRunCustomRouteAuth = isProtectedCustomRoute(path, routeMethod, this.customRouteAuthConfig);
    const shouldRunCustomRouteFGA = !!matchedRoute?.route.fga;

    if (shouldRunCustomRouteAuth || shouldRunCustomRouteFGA) {
      const serverRoute: ServerRoute = {
        method: (matchedRoute?.route.method ?? routeMethod) as any,
        path: matchedRoute?.route.path ?? path,
        responseType: 'json',
        handler: async () => {},
        requiresAuth: matchedRoute?.route.requiresAuth,
        requiresPermission: matchedRoute?.route.requiresPermission,
        fga: matchedRoute?.route.fga,
      };

      if (shouldRunCustomRouteAuth) {
        const authError = await this.checkRouteAuth(serverRoute, {
          path,
          method: routeMethod,
          getHeader: name => getHeader(ctx, name),
          getQuery: name => {
            const value = getQuery(ctx)[name];
            return Array.isArray(value) ? value[0] : value;
          },
          requestContext: state.requestContext,
          request: toWebRequest(ctx),
          buildAuthorizeContext: () => ctx,
        });

        if (authError) {
          if (authError.headers) {
            for (const [key, value] of Object.entries(authError.headers)) {
              ctx.response.header(key, value);
            }
          }
          if (authError.error) {
            this.sendJson(ctx, authError.status, { error: authError.error });
            return;
          }
        }
      }

      const permissionError = await this.checkPermissions(serverRoute, state.requestContext);
      if (permissionError) {
        this.sendJson(ctx, permissionError.status, { error: permissionError.error, message: permissionError.message });
        return;
      }

      // Path params last: the custom handler reads them from the URL, so query/body
      // values must not be able to change which resource FGA checks.
      const fgaError = await checkRouteFGA(this.mastra, serverRoute, state.requestContext, {
        ...getQuery(ctx),
        ...(state.body && typeof state.body === 'object' && !Buffer.isBuffer(state.body)
          ? (state.body as Record<string, unknown>)
          : {}),
        ...(matchedRoute?.params ?? {}),
      });
      if (fgaError) {
        this.sendJson(ctx, fgaError.status, { error: fgaError.error, message: fgaError.message });
        return;
      }
    }

    const headers = { ...ctx.request.request.headers } as Record<string, string | string[] | undefined>;
    let raw = state.raw;
    if (state.multipartParts) {
      // The bodyparser consumed the stream, so re-encode the parsed parts with a fresh boundary.
      const formData = new FormData();
      for (const part of state.multipartParts) {
        if (typeof part.value === 'string') formData.append(part.name, part.value);
        else formData.append(part.name, new Blob([part.value]), part.fileName);
      }
      const encoded = new Response(formData);
      raw = Buffer.from(await encoded.arrayBuffer());
      headers['content-type'] = encoded.headers.get('content-type') ?? undefined;
      delete headers['content-length'];
    }
    const contentType = String(headers['content-type'] ?? '');
    const body =
      raw === undefined
        ? undefined
        : contentType.includes('json') && state.body !== undefined
          ? state.body
          : typeof raw === 'string'
            ? raw
            : new Uint8Array(raw);

    const request = ctx.request;
    const response = await this.handleCustomRouteRequest(
      `${request.protocol()}://${request.host() ?? 'localhost'}${request.url(true)}`,
      method,
      headers,
      body,
      state.requestContext,
      state.abortSignal,
    );
    if (!response) {
      this.sendJson(ctx, 404, { error: 'Not Found' });
      return;
    }

    const res = ctx.response.response;
    for (const [name, value] of Object.entries(this.getPendingHeaders(ctx))) {
      if (!response.headers.has(name)) res.setHeader(name, value);
    }
    await this.writeCustomRouteResponse(response, res, state.abortSignal);
  }

  registerContextMiddleware(): void {
    // Mastra state is built per route in getRequestState(): AdonisJS route handlers run after
    // the bodyparser middleware, and Mastra must not touch requests for non-Mastra routes.
  }

  registerAuthMiddleware(): void {
    // Auth is handled per-route in registerRoute() and registerCustomApiRoutes()
  }

  registerHttpLoggingMiddleware(): void {
    if (!this.httpLoggingConfig?.enabled) {
      return;
    }

    const server = this;

    // Router-level middleware applies to every route when the router is committed,
    // including application routes registered after Mastra's.
    class MastraHttpLoggerMiddleware {
      handle(ctx: HttpContext, next: NextFn) {
        server.logRequest(ctx);
        return next();
      }
    }

    this.app.use([async () => ({ default: MastraHttpLoggerMiddleware })]);
  }

  private logRequest(ctx: HttpContext): void {
    const path = getPath(ctx);
    if (!this.shouldLogRequest(path)) return;

    const start = Date.now();
    const method = ctx.request.method();
    const res: ServerResponse = ctx.response.response;

    const log = () => {
      res.off('finish', log);
      res.off('close', log);
      const duration = Date.now() - start;
      const status = res.statusCode;
      const level = this.httpLoggingConfig?.level || 'info';

      const logData: Record<string, any> = {
        method,
        path,
        status,
        duration: `${duration}ms`,
      };

      if (this.httpLoggingConfig?.includeQueryParams) {
        logData.query = getQuery(ctx);
      }

      if (this.httpLoggingConfig?.includeHeaders) {
        const headers: Record<string, unknown> = { ...ctx.request.request.headers };
        const redactHeaders = this.httpLoggingConfig.redactHeaders || [];
        redactHeaders.forEach((h: string) => {
          const key = h.toLowerCase();
          if (headers[key] !== undefined) {
            headers[key] = '[REDACTED]';
          }
        });
        logData.headers = headers;
      }

      this.logger[level](`${method} ${path} ${status} ${duration}ms`, logData);
    };

    res.once('finish', log);
    res.once('close', log);
  }
}

/**
 * Convert a Hono custom route path to an AdonisJS route pattern. Hono regex constraints
 * (`:id{[0-9]+}`) are dropped and wildcards become AdonisJS wildcards; the internal Hono app
 * still applies the exact pattern and answers 404 when it does not match.
 */
function toAdonisPattern(path: string): string {
  const segments = path.split('/');
  const result: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    if (segment === '*' || segment.includes('*')) {
      result.push('*');
      break;
    }
    result.push(segment.replace(/\{.*\}$/, ''));
  }
  return result.join('/') || '/';
}

export type { NextFn };
