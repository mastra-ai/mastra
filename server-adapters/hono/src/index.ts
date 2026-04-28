import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';

import type { MCPHttpTransportResult, MCPSseTransportResult } from '@mastra/server/handlers/mcp';
import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';
import {
  MastraServer as MastraServerBase,
  normalizeQueryParams,
  redactStreamChunk,
} from '@mastra/server/server-adapter';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context, HonoRequest, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { stream } from 'hono/streaming';
import { ZodError } from 'zod';
export { createAuthMiddleware } from './auth-middleware';
export type { HonoAuthMiddlewareOptions } from './auth-middleware';
// Browser stream setup (Hono-specific WebSocket implementation)
export { setupBrowserStream } from './browser-stream';

type HasPermissionFn = (userPerms: string[], required: string) => boolean;
let _hasPermissionPromise: Promise<HasPermissionFn | undefined> | undefined;
function loadHasPermission(): Promise<HasPermissionFn | undefined> {
  if (!_hasPermissionPromise) {
    _hasPermissionPromise = import('@mastra/core/auth/ee')
      .then(m => m.hasPermission)
      .catch(() => {
        console.error(
          '[@mastra/hono] Auth features require @mastra/core >= 1.6.0. Please upgrade: npm install @mastra/core@latest',
        );
        return undefined;
      });
  }
  return _hasPermissionPromise;
}

// Export type definitions for Hono app configuration
export type HonoVariables = {
  mastra: Mastra;
  requestContext: RequestContext;
  registeredTools: ToolsInput;
  abortSignal: AbortSignal;
  taskStore: InMemoryTaskStore;
  customRouteAuthConfig?: Map<string, boolean>;
  cachedBody?: unknown;
};

export type HonoBindings = {};

/**
 * Generic handler function type compatible across Hono versions.
 * Uses a minimal signature that all Hono middleware handlers satisfy.
 */
type HonoRouteHandler = (...args: any[]) => any;

/**
 * Minimal interface representing what MastraServer needs from a Hono app.
 * This allows any Hono app instance to be passed without strict generic matching,
 * avoiding the version mismatch issues that occur with Hono's strict generic types.
 */
export interface HonoApp {
  use(path: string, ...handlers: HonoRouteHandler[]): unknown;
  get(path: string, ...handlers: HonoRouteHandler[]): unknown;
  post(path: string, ...handlers: HonoRouteHandler[]): unknown;
  put(path: string, ...handlers: HonoRouteHandler[]): unknown;
  delete(path: string, ...handlers: HonoRouteHandler[]): unknown;
  patch(path: string, ...handlers: HonoRouteHandler[]): unknown;
  all(path: string, ...handlers: HonoRouteHandler[]): unknown;
}

export class MastraServer extends MastraServerBase<HonoApp, HonoRequest, Context> {
  createContextMiddleware(): MiddlewareHandler {
    return async (c, next) => {
      // Patch req.json() to prevent "Body is unusable" errors when the body is read multiple times
      // e.g. by middleware and then by an agent.
      const originalJson = c.req.json.bind(c.req);
      let jsonPromise: Promise<any> | undefined;

      c.req.json = () => {
        if (!jsonPromise) {
          jsonPromise = originalJson().then(body => {
            // Cache in context if needed explicitly, though the promise memoization handles the reuse
            c.set('cachedBody', body);
            return body;
          });
        }
        return jsonPromise;
      };

      // Parse request context from request body and add to context

      let bodyRequestContext: Record<string, any> | undefined;
      let paramsRequestContext: Record<string, any> | undefined;

      // Parse request context from request body (POST/PUT)
      if (c.req.method === 'POST' || c.req.method === 'PUT') {
        const contentType = c.req.header('content-type');
        const contentLength = c.req.header('content-length');
        // Only parse if content-type is JSON and body is not empty
        if (contentType?.includes('application/json') && contentLength !== '0') {
          try {
            const body = (await c.req.raw.clone().json()) as { requestContext?: Record<string, any> };
            if (body.requestContext) {
              bodyRequestContext = body.requestContext;
            }
          } catch {
            // Body parsing failed, continue without body
          }
        }
      }

      // Parse request context from query params (GET)
      if (c.req.method === 'GET') {
        try {
          const encodedRequestContext = c.req.query('requestContext');
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

      // Add relevant contexts to hono context
      c.set('requestContext', requestContext);
      c.set('mastra', this.mastra);
      c.set('registeredTools', this.tools || {});
      c.set('taskStore', this.taskStore);
      c.set('abortSignal', c.req.raw.signal);
      c.set('customRouteAuthConfig', this.customRouteAuthConfig);

      return next();
    };
  }
  async stream(route: ServerRoute, res: Context, result: { fullStream: ReadableStream }): Promise<any> {
    const streamFormat = route.streamFormat || 'stream';

    if (streamFormat === 'sse') {
      res.header('Content-Type', 'text/event-stream');
      res.header('Cache-Control', 'no-cache');
      res.header('Connection', 'keep-alive');
      res.header('X-Accel-Buffering', 'no');
    } else {
      res.header('Content-Type', 'text/plain');
    }
    res.header('Transfer-Encoding', 'chunked');

    return stream(
      res,
      async stream => {
        const readableStream = result instanceof ReadableStream ? result : result.fullStream;
        const reader = readableStream.getReader();

        stream.onAbort(() => {
          void reader.cancel('request aborted');
        });

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
              // Optionally redact sensitive data (system prompts, tool definitions, API keys) before sending to the client
              const shouldRedact = this.streamOptions?.redact ?? true;
              const outputValue = shouldRedact ? redactStreamChunk(value) : value;
              if (streamFormat === 'sse') {
                await stream.write(`data: ${JSON.stringify(outputValue)}\n\n`);
              } else {
                await stream.write(JSON.stringify(outputValue) + '\x1E');
              }
            }
          }

          if (streamFormat === 'sse') {
            await stream.write('data: [DONE]\n\n');
          }
        } catch (error) {
          this.mastra.getLogger()?.error('Error in stream processing', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
        } finally {
          await stream.close();
        }
      },
      async err => {
        this.mastra.getLogger()?.error('Stream error callback', {
          error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        });
      },
    );
  }

  async getParams(route: ServerRoute, request: HonoRequest): Promise<ParsedRequestParams> {
    const urlParams = request.param();
    // Use queries() to get all values for repeated params (e.g., ?tags=a&tags=b -> { tags: ['a', 'b'] })
    const queryParams = normalizeQueryParams(request.queries());
    let body: unknown;
    let bodyParseError: { message: string } | undefined;

    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH' || route.method === 'DELETE') {
      const contentType = request.header('content-type') || '';

      if (contentType.includes('multipart/form-data')) {
        try {
          const formData = await request.formData();
          body = await this.parseFormData(formData);
        } catch (error) {
          this.mastra.getLogger()?.error('Failed to parse multipart form data', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
          // Re-throw size limit errors, let others fall through to validation
          if (error instanceof Error && error.message.toLowerCase().includes('size')) {
            throw error;
          }
          bodyParseError = {
            message: error instanceof Error ? error.message : 'Failed to parse multipart form data',
          };
        }
      } else if (contentType.includes('application/json')) {
        // Clone the request to read the body text first
        // This allows us to check if there's actual content before parsing
        const clonedReq = request.raw.clone();
        const bodyText = await clonedReq.text();

        if (bodyText && bodyText.trim().length > 0) {
          // There's actual content - try to parse it as JSON
          try {
            body = JSON.parse(bodyText);
          } catch (error) {
            this.mastra.getLogger()?.error('Failed to parse JSON body', {
              error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            });
            // Track JSON parse error to return 400 Bad Request
            bodyParseError = {
              message: error instanceof Error ? error.message : 'Invalid JSON in request body',
            };
          }
        }
        // Empty body is ok - body remains undefined
      }
    }
    return { urlParams, queryParams, body, bodyParseError };
  }

  /**
   * Parse FormData into a plain object, converting File objects to Buffers.
   */
  private async parseFormData(formData: FormData): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
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

  async sendResponse(route: ServerRoute, response: Context, result: unknown, prefix?: string): Promise<any> {
    const resolvedPrefix = prefix ?? this.prefix ?? '';

    // Apply refresh headers from transparent session refresh (e.g. Set-Cookie after token refresh)
    if (result && typeof result === 'object' && '__refreshHeaders' in result) {
      const refreshHeaders = (result as any).__refreshHeaders as Record<string, string>;
      for (const [key, value] of Object.entries(refreshHeaders)) {
        response.header(key, value);
      }
      delete (result as any).__refreshHeaders;
    }

    if (route.responseType === 'json') {
      return response.json(result as any, 200);
    } else if (route.responseType === 'stream') {
      return this.stream(route, response, result as { fullStream: ReadableStream });
    } else if (route.responseType === 'datastream-response') {
      const fetchResponse = result as globalThis.Response;
      return fetchResponse;
    } else if (route.responseType === 'mcp-http') {
      // MCP Streamable HTTP transport
      const { server, httpPath, mcpOptions: routeMcpOptions } = result as MCPHttpTransportResult;
      const { req, res } = toReqRes(response.req.raw);

      // Merge class-level mcpOptions with route-specific options (route takes precedence)
      const options = { ...this.mcpOptions, ...routeMcpOptions };

      // Do NOT await startHTTP — let it run in the background so SSE
      // notifications stream to the client as they are written.
      // toFetchResponse resolves when headers are sent, not when the body finishes.
      server
        .startHTTP({
          url: new URL(response.req.url),
          httpPath: `${resolvedPrefix}${httpPath}`,
          req,
          res,
          options: Object.keys(options).length > 0 ? options : undefined,
        })
        .catch((e: unknown) => {
          this.mastra.getLogger()?.error('[MCP HTTP] Error in background startHTTP:', {
            error: e instanceof Error ? { message: e.message, stack: e.stack } : e,
          });
          try {
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
          } catch {
            // Response stream already closed or destroyed - nothing more to do
          }
        });

      return await toFetchResponse(res);
    } else if (route.responseType === 'mcp-sse') {
      // MCP SSE transport
      const { server, ssePath, messagePath } = result as MCPSseTransportResult;

      try {
        return await server.startHonoSSE({
          url: new URL(response.req.url),
          ssePath: `${resolvedPrefix}${ssePath}`,
          messagePath: `${resolvedPrefix}${messagePath}`,
          context: response,
        });
      } catch {
        return response.json({ error: 'Error handling MCP SSE request' }, 500);
      }
    } else {
      return response.status(500);
    }
  }

  async registerRoute(
    app: HonoApp,
    route: ServerRoute,
    { prefix: prefixParam }: { prefix?: string } = {},
  ): Promise<void> {
    // Default prefix to this.prefix if not provided, or empty string
    const prefix = prefixParam ?? this.prefix ?? '';

    // Determine if body limits should be applied
    const shouldApplyBodyLimit = this.bodyLimitOptions && ['POST', 'PUT', 'PATCH'].includes(route.method.toUpperCase());

    // Get the body size limit for this route (route-specific or default)
    const maxSize = route.maxBodySize ?? this.bodyLimitOptions?.maxSize;

    // Build middleware array
    const middlewares: MiddlewareHandler[] = [];

    if (shouldApplyBodyLimit && maxSize && this.bodyLimitOptions) {
      middlewares.push(
        bodyLimit({
          maxSize,
          onError: this.bodyLimitOptions.onError as any,
        }),
      );
    }

    app[route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'all'](
      `${prefix}${route.path}`,
      ...middlewares,
      async (c: Context) => {
        // Check route-level authentication/authorization
        const authResult = await this.checkRouteAuth(route, {
          path: c.req.path,
          method: c.req.method,
          getHeader: name => c.req.header(name),
          getQuery: name => c.req.query(name),
          requestContext: c.get('requestContext'),
          request: c.req.raw,
          buildAuthorizeContext: () => c,
        });

        if (authResult) {
          // Apply any refresh headers (e.g. Set-Cookie from transparent session refresh)
          if (authResult.headers) {
            for (const [key, value] of Object.entries(authResult.headers)) {
              c.header(key, value as string);
            }
          }

          // If this is an auth error (not just a success-with-headers), return error response
          if (authResult.error) {
            return c.json({ error: authResult.error }, authResult.status as any);
          }
        }

        const params = await this.getParams(route, c.req);

        // Return 400 Bad Request if body parsing failed (e.g., malformed JSON)
        if (params.bodyParseError) {
          return c.json(
            {
              error: 'Invalid request body',
              issues: [{ field: 'body', message: params.bodyParseError.message }],
            },
            400,
          );
        }

        if (params.queryParams) {
          try {
            params.queryParams = await this.parseQueryParams(route, params.queryParams);
          } catch (error) {
            this.mastra.getLogger()?.error('Error parsing query params', {
              error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            });
            if (error instanceof ZodError) {
              const { status, body } = this.resolveValidationError(route, error, 'query');
              return c.json(body as any, status as any);
            }
            return c.json(
              {
                error: 'Invalid query parameters',
                issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
              },
              400,
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
            if (error instanceof ZodError) {
              const { status, body } = this.resolveValidationError(route, error, 'body');
              return c.json(body as any, status as any);
            }
            return c.json(
              {
                error: 'Invalid request body',
                issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
              },
              400,
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
            if (error instanceof ZodError) {
              const { status, body } = this.resolveValidationError(route, error, 'path');
              return c.json(body as any, status as any);
            }
            return c.json(
              {
                error: 'Invalid path parameters',
                issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
              },
              400,
            );
          }
        }

        const handlerParams = {
          ...params.urlParams,
          ...params.queryParams,
          ...(typeof params.body === 'object' ? params.body : {}),
          requestContext: c.get('requestContext'),
          mastra: this.mastra,
          registeredTools: c.get('registeredTools'),
          taskStore: c.get('taskStore'),
          abortSignal: c.get('abortSignal'),
          routePrefix: prefix,
          request: c.req.raw, // Standard Request object with headers/cookies
        };

        // Check route permission requirement (EE feature)
        // Uses convention-based permission derivation: permissions are auto-derived
        // from route path/method unless explicitly set or route is public
        const authConfig = this.mastra.getServer()?.auth;
        if (authConfig) {
          const hasPermission = await loadHasPermission();
          if (hasPermission) {
            const userPermissions = c.get('requestContext').get('userPermissions') as string[] | undefined;
            const permissionError = this.checkRoutePermission(route, userPermissions, hasPermission);

            if (permissionError) {
              return c.json(
                {
                  error: permissionError.error,
                  message: permissionError.message,
                },
                permissionError.status as any,
              );
            }
          }
        }

        try {
          const result = await route.handler(handlerParams);
          return this.sendResponse(route, c, result, prefix);
        } catch (error) {
          this.mastra.getLogger()?.error('Error calling handler', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            path: route.path,
            method: route.method,
          });
          // Check if it's an HTTPException or MastraError with a status code
          if (error && typeof error === 'object') {
            // Check for direct status property (HTTPException)
            if ('status' in error) {
              const status = (error as any).status;
              let safeCause: { failingItems: unknown[] } | undefined;
              try {
                const raw = error instanceof Error ? error.cause : undefined;
                if (
                  raw &&
                  typeof raw === 'object' &&
                  !Array.isArray(raw) &&
                  'failingItems' in raw &&
                  Array.isArray((raw as any).failingItems)
                ) {
                  safeCause = { failingItems: (raw as any).failingItems };
                }
              } catch {
                // serialization or access error — omit cause
              }
              return c.json(
                {
                  error: error instanceof Error ? error.message : 'Unknown error',
                  ...(safeCause ? { cause: safeCause } : {}),
                },
                status,
              );
            }
            // Check for MastraError with status in details
            if ('details' in error && error.details && typeof error.details === 'object' && 'status' in error.details) {
              const status = (error.details as any).status;
              return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, status);
            }
          }
          return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
        }
      },
    );
  }

  async registerCustomApiRoutes(): Promise<void> {
    if (!(await this.buildCustomRouteHandler())) return;

    const routes = this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes ?? [];

    for (const route of routes) {
      const serverRoute: ServerRoute = {
        method: route.method as any,
        path: route.path,
        responseType: 'json',
        handler: async () => {},
        requiresAuth: route.requiresAuth,
      };

      const routeHandler: MiddlewareHandler = async (c: Context) => {
        // Per-route auth check (same pattern as registerRoute)
        const authError = await this.checkRouteAuth(serverRoute, {
          path: c.req.path,
          method: c.req.method,
          getHeader: name => c.req.header(name),
          getQuery: name => c.req.query(name),
          requestContext: c.get('requestContext'),
          request: c.req.raw,
          buildAuthorizeContext: () => c,
        });

        if (authError) {
          if (authError.headers) {
            for (const [key, value] of Object.entries(authError.headers)) {
              c.header(key, value as string);
            }
          }
          if (authError.error) {
            return c.json({ error: authError.error }, authError.status as any);
          }
        }

        const authConfig = this.mastra.getServer()?.auth;
        if (authConfig) {
          const hasPermission = await loadHasPermission();
          if (hasPermission) {
            const userPermissions = c.get('requestContext').get('userPermissions') as string[] | undefined;
            const permissionError = this.checkRoutePermission(serverRoute, userPermissions, hasPermission);
            if (permissionError) {
              return c.json(
                { error: permissionError.error, message: permissionError.message },
                permissionError.status as any,
              );
            }
          }
        }

        const reqHeaders: Record<string, string | string[] | undefined> = {};
        c.req.raw.headers.forEach((v, k) => {
          reqHeaders[k] = v;
        });
        const response = await this.handleCustomRouteRequest(
          c.req.url,
          c.req.method,
          reqHeaders,
          c.req.raw.body,
          c.get('requestContext'),
        );
        if (!response) {
          return c.json({ error: 'Not Found' }, 404);
        }
        return response;
      };

      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'all';
      this.app[method](route.path, routeHandler);
    }
  }

  registerContextMiddleware(): void {
    this.app.use('*', this.createContextMiddleware());
  }

  registerAuthMiddleware(): void {
    // Auth is handled per-route in registerRoute() and registerCustomApiRoutes()
    // No global middleware needed
  }

  registerHttpLoggingMiddleware(): void {
    if (!this.httpLoggingConfig?.enabled) {
      return;
    }

    this.app.use('*', async (c, next) => {
      if (!this.shouldLogRequest(c.req.path)) {
        return next();
      }

      const start = Date.now();
      const method = c.req.method;
      const path = c.req.path;

      await next();

      const duration = Date.now() - start;
      const status = c.res.status;
      const level = this.httpLoggingConfig?.level || 'info';

      const logData: Record<string, any> = {
        method,
        path,
        status,
        duration: `${duration}ms`,
      };

      if (this.httpLoggingConfig?.includeQueryParams) {
        logData.query = c.req.query();
      }

      if (this.httpLoggingConfig?.includeHeaders) {
        const headers = Object.fromEntries(c.req.raw.headers.entries());
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
