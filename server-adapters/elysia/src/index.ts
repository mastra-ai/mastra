import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { findMatchingCustomRoute, isProtectedCustomRoute } from '@mastra/server/auth';
import type { MCPHttpTransportResult, MCPSseTransportResult } from '@mastra/server/handlers/mcp';
import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';
import {
  MastraServer as MastraServerBase,
  checkRouteFGA,
  isZodError,
  normalizeQueryParams,
  redactStreamChunk,
  serializeStreamChunk,
} from '@mastra/server/server-adapter';
import type { AnyElysia, MaybePromise } from 'elysia';
import type Elysia from 'elysia';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
export { createAuthMiddleware } from './auth-middleware';
export type { ElysiaAuthMiddlewareOptions } from './auth-middleware';

// Export helper functions for OpenAPI integration
export { getMastraOpenAPIDoc, clearMastraOpenAPICache } from './helper';

/**
 * Normalizes route path parameters to position-based names (:p0, :p1, ...)
 * to avoid Elysia router conflicts when different routes use different
 * parameter names at the same path segment position (e.g. :agentId vs
 * :storedAgentId under /stored/agents/...).
 * Returns the normalized path and the original parameter names in order.
 */
function normalizeRouteParams(path: string): { normalizedPath: string; paramNames: string[] } {
  const paramNames: string[] = [];
  const normalizedPath = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, paramName: string) => {
    paramNames.push(paramName);
    return `:p${paramNames.length - 1}`;
  });
  return { normalizedPath, paramNames };
}

/**
 * Remaps Elysia's parsed params from position-based names (p0, p1, ...)
 * back to the original parameter names expected by the route handler.
 */
function remapParams(rawParams: Record<string, string>, paramNames: string[]): Record<string, string> {
  if (paramNames.length === 0) return rawParams;
  const result: Record<string, string> = {};
  paramNames.forEach((paramName, i) => {
    const key = `p${i}`;
    if (key in rawParams) {
      result[paramName] = rawParams[key] as string;
    }
  });
  return result;
}

async function createForwardRequest(ctx: any): Promise<Request> {
  const request = ctx.request as Request;
  const method = request.method;

  if (method === 'GET' || method === 'HEAD') {
    return request;
  }

  const headers = new Headers(request.headers);
  let body: any;

  if (ctx.body !== undefined) {
    if (typeof ctx.body === 'string' || ctx.body instanceof FormData || ctx.body instanceof Blob) {
      body = ctx.body;
    } else {
      body = JSON.stringify(ctx.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }
  } else if (!request.bodyUsed) {
    const bodyBuffer = await request.clone().arrayBuffer();
    if (bodyBuffer.byteLength > 0) {
      body = bodyBuffer;
    }
  }

  headers.delete('content-length');

  return new Request(request.url, {
    method,
    headers,
    body,
    signal: request.signal,
    ...(body ? { duplex: 'half' as const } : {}),
  } as RequestInit);
}

function createSafeReadableStream(body: ReadableStream<Uint8Array> | null): ReadableStream<Uint8Array> | null {
  if (!body) return null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch {
        // Preserve chunks already sent before upstream stream errors.
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}

type HasPermissionFn = (userPerms: string[], required: string) => boolean;
let _hasPermissionPromise: Promise<HasPermissionFn | undefined> | undefined;
function loadHasPermission(): Promise<HasPermissionFn | undefined> {
  if (!_hasPermissionPromise) {
    _hasPermissionPromise = import('@mastra/core/auth/ee')
      .then(m => m.hasPermission)
      .catch(() => {
        console.error(
          '[@mastra/elysia] Auth features require @mastra/core >= 1.6.0. Please upgrade: npm install @mastra/core@latest',
        );
        return undefined;
      });
  }
  return _hasPermissionPromise;
}

// Export type definitions for Elysia app configuration
export interface ElysiaContext {
  mastra: Mastra;
  requestContext: RequestContext;
  registeredTools: ToolsInput;
  abortSignal: AbortSignal;
  taskStore: InMemoryTaskStore;
  customRouteAuthConfig?: Map<string, boolean>;
}

/**
 * Minimal interface representing what MastraServer needs from an Elysia app.
 * This allows any Elysia app instance to be passed without strict generic matching.
 */
export interface ElysiaApp {
  use(instance: MaybePromise<AnyElysia>): ElysiaApp;
  derive(callback: (context: any) => any | Promise<any>): ElysiaApp;
  get(path: string, handler: any, options?: any): ElysiaApp;
  post(path: string, handler: any, options?: any): ElysiaApp;
  put(path: string, handler: any, options?: any): ElysiaApp;
  delete(path: string, handler: any, options?: any): ElysiaApp;
  patch(path: string, handler: any, options?: any): ElysiaApp;
  all(path: string, handler: any, options?: any): ElysiaApp;
  onAfterHandle(handler: (context: any) => any): ElysiaApp;
  onError(handler: (context: any) => any): ElysiaApp;
}

export class MastraServer extends MastraServerBase<Elysia, Request, Response> {
  createContextMiddleware() {
    return async (ctx: any) => {
      // Parse request context from request body and query params
      let bodyRequestContext: Record<string, any> | undefined;
      let paramsRequestContext: Record<string, any> | undefined;

      // Parse request context from request body (POST/PUT/PATCH)
      if (ctx.request.method === 'POST' || ctx.request.method === 'PUT' || ctx.request.method === 'PATCH') {
        const contentType = ctx.request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          try {
            const body = (ctx.body ?? (await ctx.request.clone().json())) as { requestContext?: Record<string, any> };
            if (body.requestContext) {
              bodyRequestContext = body.requestContext;
            }
          } catch {
            // Body parsing failed, continue without body
          }
        }
      }

      // Parse request context from query params (GET)
      if (ctx.request.method === 'GET') {
        try {
          // Elysia pre-parses query params into ctx.query
          const encodedRequestContext = ctx.query?.requestContext;
          if (encodedRequestContext) {
            // Try JSON first
            try {
              paramsRequestContext = JSON.parse(encodedRequestContext);
            } catch {
              // Fallback to base64(JSON)
              try {
                const json = Buffer.from(encodedRequestContext, 'base64').toString('utf-8');
                paramsRequestContext = JSON.parse(json);
              } catch {
                // ignore if still invalid
              }
            }
          }
        } catch {
          // ignore query parsing errors
        }
      }

      const requestContext = this.mergeRequestContext({ paramsRequestContext, bodyRequestContext });
      this.applyRequestMetadataToContext({
        requestContext,
        getHeader: (name: string) => ctx.request.headers.get(name) || undefined,
      });

      // Add relevant contexts to Elysia context
      return {
        requestContext,
        mastra: this.mastra,
        registeredTools: this.tools || {},
        taskStore: this.taskStore,
        abortSignal: ctx.request.signal,
        customRouteAuthConfig: this.customRouteAuthConfig,
      };
    };
  }

  async stream(route: ServerRoute, _res: Response, result: { fullStream: ReadableStream }): Promise<any> {
    const streamFormat = route.streamFormat || 'stream';
    const encoder = new TextEncoder();

    const headers: Record<string, string> =
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

    const stream = new ReadableStream({
      start: async controller => {
        const readableStream = result instanceof ReadableStream ? result : result.fullStream;
        const reader = readableStream.getReader();

        try {
          if (streamFormat === 'sse' && route.sseFlushOnConnect) {
            controller.enqueue(encoder.encode(': connected\n\n'));
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
              // SSE comment passthrough — strings starting with ':' are written as-is
              if (streamFormat === 'sse' && typeof value === 'string' && value.startsWith(':')) {
                controller.enqueue(encoder.encode(value));
                continue;
              }

              // Optionally redact sensitive data (system prompts, tool definitions, API keys) before sending to the client
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
                controller.enqueue(encoder.encode(`data: ${serialized.json}\n\n`));
              } else {
                controller.enqueue(encoder.encode(serialized.json + '\x1E'));
              }
            }
          }

          if (streamFormat === 'sse') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          }
          controller.close();
        } catch (error) {
          this.mastra.getLogger()?.error('Error in stream processing', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
          controller.error(error);
        } finally {
          await reader.cancel();
        }
      },
    });

    return new Response(stream, { headers });
  }

  async getParams(route: ServerRoute, request: Request): Promise<ParsedRequestParams> {
    const url = new URL(request.url);

    // URL params - extract from request context if available (Elysia stores params in ctx)
    // Params may be normalized (p0, p1, ...) — remap back to original names from route path
    const { paramNames } = normalizeRouteParams(route.path);
    const rawUrlParams: Record<string, string> = (request as any).params || (request as any).ctx?.params || {};
    const urlParams = paramNames.length > 0 ? remapParams(rawUrlParams, paramNames) : rawUrlParams;

    // Query params - parse from URL
    const queryParams = normalizeQueryParams(Object.fromEntries(url.searchParams));

    let body: unknown;
    let bodyParseError: { message: string } | undefined;

    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH' || route.method === 'DELETE') {
      const contentType = request.headers.get('content-type') || '';

      if (contentType.includes('multipart/form-data')) {
        try {
          const formData = await request.formData();
          body = await this.parseFormData(formData);
        } catch (error) {
          this.mastra.getLogger()?.error('Failed to parse multipart form data', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
          // Re-throw size limit errors
          if (error instanceof Error && error.message.toLowerCase().includes('size')) {
            throw error;
          }
          bodyParseError = {
            message: error instanceof Error ? error.message : 'Failed to parse multipart form data',
          };
        }
      } else if (contentType.includes('application/json')) {
        const clonedReq = request.clone();
        const bodyText = await clonedReq.text();

        if (bodyText && bodyText.trim().length > 0) {
          try {
            body = JSON.parse(bodyText);
          } catch (error) {
            this.mastra.getLogger()?.error('Failed to parse JSON body', {
              error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            });
            bodyParseError = {
              message: error instanceof Error ? error.message : 'Invalid JSON in request body',
            };
          }
        }
      }
    }

    return { urlParams, queryParams, body, bodyParseError };
  }

  /**
   * Parse FormData into a plain object, converting File objects to Buffers.
   * Handles both native FormData and Elysia's pre-parsed object format.
   */
  private async parseFormData(data: FormData | Record<string, unknown>): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    // Handle native FormData
    if (data instanceof FormData) {
      for (const [key, value] of data.entries()) {
        if (value instanceof File) {
          const arrayBuffer = await value.arrayBuffer();
          result[key] = Buffer.from(arrayBuffer);
        } else if (typeof value === 'string') {
          // Try to parse JSON strings (like 'options')
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    // Handle Elysia's pre-parsed object format
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'arrayBuffer' in value && typeof value.arrayBuffer === 'function') {
        const arrayBuffer = await value.arrayBuffer();
        result[key] = Buffer.from(arrayBuffer);
      } else if (typeof value === 'string') {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  async sendResponse(route: ServerRoute, response: Response, result: unknown, prefix?: string): Promise<any> {
    const resolvedPrefix = prefix ?? this.prefix ?? '';

    // Apply refresh headers from transparent session refresh (e.g. Set-Cookie after token refresh)
    const refreshHeaders: Record<string, string> = {};
    if (result && typeof result === 'object' && '__refreshHeaders' in result) {
      const headers = (result as any).__refreshHeaders as Record<string, string>;
      for (const [key, value] of Object.entries(headers)) {
        refreshHeaders[key] = value;
      }
      delete (result as any).__refreshHeaders;
    }

    if (route.responseType === 'json') {
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...refreshHeaders },
      });
    } else if (route.responseType === 'stream') {
      return this.stream(route, response, result as { fullStream: ReadableStream });
    } else if (route.responseType === 'datastream-response') {
      const fetchResponse = result as globalThis.Response;
      const headers = new Headers(fetchResponse.headers);
      headers.delete('Transfer-Encoding');
      return new Response(createSafeReadableStream(fetchResponse.body), {
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers,
      });
    } else if (route.responseType === 'mcp-http') {
      // MCP Streamable HTTP transport
      const { server, httpPath, mcpOptions: routeMcpOptions } = result as MCPHttpTransportResult;

      const request = response as any; // Elysia context
      const forwardRequest = await createForwardRequest(request);
      const { req, res } = toReqRes(forwardRequest);

      const options = { ...this.mcpOptions, ...routeMcpOptions };

      // Do NOT await startHTTP — let it run in the background so SSE
      // notifications stream to the client as they are written.
      // toFetchResponse resolves when headers are sent, not when the body finishes.
      server
        .startHTTP({
          url: new URL(forwardRequest.url),
          httpPath: `${resolvedPrefix}${httpPath}`,
          req,
          res,
          options: Object.keys(options).length > 0 ? options : undefined,
        })
        .catch((e: unknown) => {
          this.mastra.getLogger()?.error('[MCP HTTP] Error in background startHTTP:', {
            error: e instanceof Error ? { message: e.message, stack: e.stack } : e,
          });
        });

      const mcpResponse = await toFetchResponse(res);
      const headers = new Headers(mcpResponse.headers);
      headers.delete('Transfer-Encoding');
      return new Response(createSafeReadableStream(mcpResponse.body), {
        status: mcpResponse.status,
        statusText: mcpResponse.statusText,
        headers,
      });
    } else if (route.responseType === 'mcp-sse') {
      const { server, ssePath, messagePath } = result as MCPSseTransportResult;
      const request = response as any; // Elysia context
      const forwardRequest = await createForwardRequest(request);
      const { req, res } = toReqRes(forwardRequest);

      server
        .startSSE({
          url: new URL(forwardRequest.url),
          ssePath: `${resolvedPrefix}${ssePath}`,
          messagePath: `${resolvedPrefix}${messagePath}`,
          req,
          res,
        })
        .catch((e: unknown) => {
          this.mastra.getLogger()?.error('[MCP SSE] Error in background startSSE:', {
            error: e instanceof Error ? { message: e.message, stack: e.stack } : e,
          });
        });

      const sseResponse = await toFetchResponse(res);
      const headers = new Headers(sseResponse.headers);
      headers.delete('Transfer-Encoding');
      return new Response(createSafeReadableStream(sseResponse.body), {
        status: sseResponse.status,
        statusText: sseResponse.statusText,
        headers,
      });
    } else {
      return new Response(null, { status: 500 });
    }
  }

  async registerRoute(
    app: ElysiaApp,
    route: ServerRoute,
    { prefix: prefixParam }: { prefix?: string } = {},
  ): Promise<void> {
    const prefix = prefixParam ?? this.prefix ?? '';
    const fullPath = `${prefix}${route.path}`;
    const { normalizedPath, paramNames } = normalizeRouteParams(fullPath);

    const handler = async (ctx: any) => {
      // Check route-level authentication/authorization
      const authError = await this.checkRouteAuth(route, {
        path: ctx.request.url ? new URL(ctx.request.url).pathname : ctx.path,
        method: ctx.request.method,
        getHeader: (name: string) => ctx.request.headers.get(name) || undefined,
        getQuery: (name: string) => ctx.query?.[name],
        requestContext: ctx.requestContext,
        request: ctx.request,
        buildAuthorizeContext: () => ctx,
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.error }), {
          status: authError.status,
          headers: { 'Content-Type': 'application/json', ...authError.headers },
        });
      }

      const authConfig = this.mastra.getServer()?.auth;
      if (authConfig) {
        const hasPermission = await loadHasPermission();
        if (hasPermission) {
          const userPermissions = ctx.requestContext.get('userPermissions') as string[] | undefined;
          const permissionError = this.checkRoutePermission(route, userPermissions, hasPermission);
          if (permissionError) {
            return new Response(JSON.stringify({ error: permissionError.error, message: permissionError.message }), {
              status: permissionError.status,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
      }

      // Extract params - remap from normalized param names back to original
      const rawParams = ctx.params || {};
      const urlParams = paramNames.length > 0 ? remapParams(rawParams, paramNames) : rawParams;
      const queryParams = normalizeQueryParams(ctx.query || {});
      let body: unknown;
      let bodyParseError: { message: string } | undefined;

      if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH' || route.method === 'DELETE') {
        const maxSize = route.maxBodySize ?? this.bodyLimitOptions?.maxSize;
        const contentLength = ctx.request.headers.get('content-length');
        if (this.bodyLimitOptions && maxSize && contentLength && parseInt(contentLength, 10) > maxSize) {
          let errorResponse: unknown = { error: 'Request body too large' };
          try {
            errorResponse = this.bodyLimitOptions.onError({ error: 'Request body too large' });
          } catch {
            // Fall back to the default error response.
          }
          return new Response(JSON.stringify(errorResponse), {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const contentType = ctx.request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
          try {
            // Elysia pre-parses multipart form data
            body = ctx.body ? await this.parseFormData(ctx.body) : undefined;
          } catch (error) {
            this.mastra.getLogger()?.error('Failed to parse multipart form data', {
              error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            });
            if (error instanceof Error && error.message.toLowerCase().includes('size')) {
              throw error;
            }
            bodyParseError = {
              message: error instanceof Error ? error.message : 'Failed to parse multipart form data',
            };
          }
        } else if (contentType.includes('application/json')) {
          // Elysia pre-parses JSON body
          body = ctx.body;

          // Validate that body is valid JSON if provided
          if (body === undefined && contentType.includes('application/json')) {
            const bodyText = await ctx.request.clone().text();
            if (bodyText && bodyText.trim().length > 0) {
              try {
                body = JSON.parse(bodyText);
              } catch (error) {
                this.mastra.getLogger()?.error('Failed to parse JSON body', {
                  error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
                });
                bodyParseError = {
                  message: error instanceof Error ? error.message : 'Invalid JSON in request body',
                };
              }
            }
          }
        }
      }

      const params = { urlParams, queryParams, body, bodyParseError };

      // Return 400 Bad Request if body parsing failed
      if (params.bodyParseError) {
        return new Response(
          JSON.stringify({
            error: 'Invalid request body',
            issues: [{ field: 'body', message: params.bodyParseError.message }],
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (params.queryParams) {
        try {
          params.queryParams = await this.parseQueryParams(route, params.queryParams);
        } catch (error) {
          this.mastra.getLogger()?.error('Error parsing query params', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
          if (isZodError(error)) {
            const { status, body } = this.resolveValidationError(route, error, 'query');
            return new Response(JSON.stringify(body), {
              status,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(
            JSON.stringify({
              error: 'Invalid query parameters',
              issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
      }

      if (params.body) {
        try {
          params.body = await this.parseBody(route, params.body);
        } catch (error) {
          this.mastra.getLogger()?.error('Error parsing body', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
          if (isZodError(error)) {
            const { status, body } = this.resolveValidationError(route, error, 'body');
            return new Response(JSON.stringify(body), {
              status,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(
            JSON.stringify({
              error: 'Invalid request body',
              issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
      }

      // Parse path params through pathParamSchema for type coercion (e.g., z.coerce.number())
      if (params.urlParams) {
        try {
          params.urlParams = await this.parsePathParams(route, params.urlParams);
        } catch (error) {
          this.mastra.getLogger()?.error('Error parsing path params', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
          if (isZodError(error)) {
            const { status, body } = this.resolveValidationError(route, error, 'path');
            return new Response(JSON.stringify(body), {
              status,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(
            JSON.stringify({
              error: 'Invalid path parameters',
              issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
      }

      const fgaError = await checkRouteFGA(this.mastra, route, ctx.requestContext, {
        ...params.urlParams,
        ...params.queryParams,
        ...(typeof params.body === 'object' ? params.body : {}),
      });
      if (fgaError) {
        return new Response(JSON.stringify({ error: fgaError.error, message: fgaError.message }), {
          status: fgaError.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const handlerParams = {
        ...params.urlParams,
        ...params.queryParams,
        ...(typeof params.body === 'object' ? params.body : {}),
        requestContext: ctx.requestContext,
        mastra: ctx.mastra,
        registeredTools: ctx.registeredTools,
        taskStore: ctx.taskStore,
        abortSignal: ctx.abortSignal,
        routePrefix: prefix,
        request: ctx.request,
      };

      try {
        const result = await route.handler(handlerParams);
        return this.sendResponse(route, ctx as any, result, prefix);
      } catch (error) {
        this.mastra.getLogger()?.error('Error calling handler', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          path: route.path,
          method: route.method,
        });

        // Check if it's an error with a status code
        if (error && typeof error === 'object') {
          if ('status' in error) {
            const status = (error as any).status;
            return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
              status,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          if ('details' in error && error.details && typeof error.details === 'object' && 'status' in error.details) {
            const status = (error.details as any).status;
            return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
              status,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    };

    // Register the route using Elysia's method chaining
    const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'all';
    app[method](normalizedPath, handler);
  }

  async registerCustomApiRoutes(): Promise<void> {
    if (!(await this.buildCustomRouteHandler())) return;

    const routes = this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes ?? [];

    for (const route of routes) {
      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'all';
      const { normalizedPath: customNormalizedPath } = normalizeRouteParams(route.path);
      (this.app as ElysiaApp)[method](customNormalizedPath, async (ctx: any) => {
        const path = new URL(ctx.request.url).pathname;
        const requestMethod = ctx.request.method;
        const matchedRoute = findMatchingCustomRoute(
          path,
          requestMethod,
          this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes,
        );
        const shouldRunCustomRouteAuth = isProtectedCustomRoute(path, requestMethod, this.customRouteAuthConfig);
        const shouldRunCustomRouteFGA = !!matchedRoute?.route.fga;

        if (shouldRunCustomRouteAuth || shouldRunCustomRouteFGA) {
          const serverRoute: ServerRoute = {
            method: (matchedRoute?.route.method ?? requestMethod) as any,
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
              method: requestMethod,
              getHeader: (name: string) => ctx.request.headers.get(name) || undefined,
              getQuery: (name: string) => ctx.query?.[name],
              requestContext: ctx.requestContext,
              request: ctx.request,
              buildAuthorizeContext: () => ctx,
            });

            if (authError) {
              return new Response(JSON.stringify({ error: authError.error }), {
                status: authError.status,
                headers: { 'Content-Type': 'application/json', ...authError.headers },
              });
            }

            const authConfig = this.mastra.getServer()?.auth;
            if (authConfig) {
              const hasPermission = await loadHasPermission();
              if (hasPermission) {
                const userPermissions = ctx.requestContext.get('userPermissions') as string[] | undefined;
                const permissionError = this.checkRoutePermission(serverRoute, userPermissions, hasPermission);
                if (permissionError) {
                  return new Response(
                    JSON.stringify({ error: permissionError.error, message: permissionError.message }),
                    {
                      status: permissionError.status,
                      headers: { 'Content-Type': 'application/json' },
                    },
                  );
                }
              }
            }
          }

          const fgaError = await checkRouteFGA(this.mastra, serverRoute, ctx.requestContext, {
            ...(matchedRoute?.params ?? {}),
            ...(ctx.query as Record<string, string>),
            ...(typeof ctx.body === 'object' && ctx.body !== null ? ctx.body : {}),
          });
          if (fgaError) {
            return new Response(JSON.stringify({ error: fgaError.error, message: fgaError.message }), {
              status: fgaError.status,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        const headers: Record<string, string | string[] | undefined> = {};
        ctx.request.headers.forEach((value: string, key: string) => {
          headers[key] = value;
        });

        const response = await this.handleCustomRouteRequest(
          ctx.request.url,
          ctx.request.method,
          headers,
          ctx.body,
          ctx.requestContext,
          ctx.request.signal,
        );

        if (!response) {
          return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return response;
      });
    }
  }

  registerContextMiddleware(): void {
    this.app.derive(this.createContextMiddleware());
  }

  registerAuthMiddleware(): void {
    // Auth is handled per-route in registerRoute() and registerCustomApiRoutes()
    // No global middleware needed

    // Register global error handler to catch Elysia body parsing errors
    // and return structured JSON responses instead of plain text "Bad Request"
    this.app.onError((ctx: any) => {
      const error = ctx.error;
      const status = error?.status ?? error?.code ?? 500;
      const message = error?.message ?? 'Internal server error';

      // Body parsing / validation errors from Elysia are 400s
      const httpStatus = typeof status === 'number' && status >= 400 && status < 500 ? status : 500;

      return new Response(
        JSON.stringify({
          error: httpStatus < 500 ? message : 'Internal server error',
          ...(httpStatus < 500 ? { issues: [] } : {}),
        }),
        {
          status: httpStatus,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
  }

  registerHttpLoggingMiddleware(): void {
    if (!this.httpLoggingConfig?.enabled) {
      return;
    }

    this.app.derive(async (ctx: any) => {
      const path = new URL(ctx.request.url).pathname;
      if (!this.shouldLogRequest(path)) {
        return {};
      }

      return {
        httpLogStart: Date.now(),
      };
    });

    this.app.onAfterHandle((ctx: any) => {
      const path = new URL(ctx.request.url).pathname;
      if (!this.shouldLogRequest(path)) {
        return;
      }

      const duration = Date.now() - (ctx.httpLogStart ?? Date.now());
      const method = ctx.request.method;
      const status = ctx.response?.status ?? ctx.set?.status ?? 200;
      const level = this.httpLoggingConfig?.level || 'info';

      const logData: Record<string, any> = {
        method,
        path,
        status,
        duration: `${duration}ms`,
      };

      if (this.httpLoggingConfig?.includeQueryParams) {
        logData.query = ctx.query || {};
      }

      if (this.httpLoggingConfig?.includeHeaders) {
        const headers = Object.fromEntries(ctx.request.headers.entries());
        const redactHeaders = this.httpLoggingConfig.redactHeaders || [];
        redactHeaders.forEach(h => {
          const key = h.toLowerCase();
          if (headers[key] !== undefined) {
            headers[key] = '[REDACTED]';
          }
        });
        logData.headers = headers;
      }

      this.logger[level](`${method} ${path} ${status} ${duration}ms`, logData);
    });
  }
}
