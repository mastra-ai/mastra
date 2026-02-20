import { Busboy } from '@fastify/busboy';
import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { formatZodError } from '@mastra/server/handlers/error';
import type { MCPHttpTransportResult, MCPSseTransportResult } from '@mastra/server/handlers/mcp';
import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';
import {
  MastraServer as MastraServerBase,
  normalizeQueryParams,
  redactStreamChunk,
} from '@mastra/server/server-adapter';
import type Koa from 'koa';
import type { Context, Middleware, Next } from 'koa';
import { ZodError } from 'zod';

import { authenticationMiddleware, authorizationMiddleware } from './auth-middleware';

// Extend Koa types to include Mastra context
declare module 'koa' {
  interface DefaultState {
    mastra: Mastra;
    requestContext: RequestContext;
    tools: ToolsInput;
    abortSignal: AbortSignal;
    taskStore: InMemoryTaskStore;
    customRouteAuthConfig?: Map<string, boolean>;
  }
  interface Request {
    body?: unknown;
  }
}

export class MastraServer extends MastraServerBase<Koa, Context, Context> {
  async init() {
    this.registerErrorMiddleware();
    await super.init();
  }

  /**
   * Register a global error-handling middleware at the top of the middleware chain.
   * This acts as a safety net for errors that propagate past route handlers
   * (e.g., from auth middleware, context middleware, or when route handlers re-throw).
   *
   * When `server.onError` is configured, calls it and uses the response.
   * Otherwise provides a default JSON error response.
   *
   * Errors are emitted on the app for logging (Koa convention) but NOT re-thrown,
   * so this middleware is the final error boundary. Users who need custom error handling
   * should use `server.onError` or register their own middleware between this and the routes.
   */
  private registerErrorMiddleware(): void {
    this.app.use(async (ctx: Context, next: Next) => {
      try {
        await next();
      } catch (err) {
        // Try onError first (may have already been called in registerRoute,
        // but this catches errors from other middleware too)
        if (await this.handleOnError(err, ctx)) {
          return;
        }

        // Default error handling
        const error = err instanceof Error ? err : new Error(String(err));
        let status = 500;
        if (err && typeof err === 'object') {
          if ('status' in err) {
            status = (err as any).status;
          } else if (
            'details' in err &&
            (err as any).details &&
            typeof (err as any).details === 'object' &&
            'status' in (err as any).details
          ) {
            status = (err as any).details.status;
          }
        }
        ctx.status = status;
        ctx.body = { error: error.message || 'Unknown error' };

        // Emit the error for logging (standard Koa pattern) but don't re-throw
        // since this middleware is the final error boundary.
        ctx.app.emit('error', err, ctx);
      }
    });
  }

  /**
   * Try to handle an error using the `server.onError` hook.
   * Creates a minimal context shim compatible with the Hono-style onError signature.
   *
   * @returns true if the error was handled and the response was set on ctx
   */
  private async handleOnError(err: unknown, ctx: Context): Promise<boolean> {
    // Guard against double invocation (route catch → re-throw → error middleware)
    if ((ctx as any)._mastraOnErrorAttempted) return false;
    (ctx as any)._mastraOnErrorAttempted = true;

    const onError = this.mastra.getServer()?.onError;
    if (!onError) return false;

    const error = err instanceof Error ? err : new Error(String(err));

    // Create a minimal context shim compatible with the onError signature
    const shimContext = {
      json: (data: unknown, status: number = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      req: {
        path: ctx.path,
        method: ctx.method,
        header: (name: string) => {
          const value = ctx.headers[name.toLowerCase()];
          if (Array.isArray(value)) return value.join(', ');
          return value;
        },
        url: ctx.url,
      },
    };

    try {
      const response = await onError(error, shimContext as any);
      // Apply the Response from onError to the Koa context
      ctx.status = response.status;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        ctx.body = await response.json();
      } else {
        ctx.body = await response.text();
      }
      return true;
    } catch (onErrorErr) {
      this.mastra.getLogger()?.error('Error in custom onError handler', {
        error: onErrorErr instanceof Error ? { message: onErrorErr.message, stack: onErrorErr.stack } : onErrorErr,
      });
      return false;
    }
  }

  createContextMiddleware(): Middleware {
    return async (ctx: Context, next: Next) => {
      // Parse request context from request body and add to context
      let bodyRequestContext: Record<string, any> | undefined;
      let paramsRequestContext: Record<string, any> | undefined;

      // Parse request context from request body (POST/PUT)
      if (ctx.method === 'POST' || ctx.method === 'PUT') {
        const contentType = ctx.headers['content-type'];
        if (contentType?.includes('application/json') && ctx.request.body) {
          const body = ctx.request.body as { requestContext?: Record<string, any> };
          if (body.requestContext) {
            bodyRequestContext = body.requestContext;
          }
        }
      }

      // Parse request context from query params (GET)
      if (ctx.method === 'GET') {
        try {
          const query = ctx.query;
          const encodedRequestContext = query.requestContext;
          if (typeof encodedRequestContext === 'string') {
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

      // Set context in state object
      ctx.state.requestContext = requestContext;
      ctx.state.mastra = this.mastra;
      ctx.state.tools = this.tools || {};
      if (this.taskStore) {
        ctx.state.taskStore = this.taskStore;
      }
      ctx.state.customRouteAuthConfig = this.customRouteAuthConfig;

      // Create abort controller for request cancellation
      const controller = new AbortController();
      ctx.req.on('close', () => {
        // Only abort if the response wasn't successfully completed
        if (!ctx.res.writableEnded) {
          controller.abort();
        }
      });
      ctx.state.abortSignal = controller.signal;

      await next();
    };
  }

  async stream(route: ServerRoute, ctx: Context, result: { fullStream: ReadableStream }): Promise<void> {
    // Tell Koa we're handling the response ourselves
    ctx.respond = false;

    const streamFormat = route.streamFormat || 'stream';

    // Set status and headers via ctx.res directly since we're bypassing Koa's response
    const sseHeaders =
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

    ctx.res.writeHead(200, {
      ...sseHeaders,
      'Transfer-Encoding': 'chunked',
    });

    const readableStream = result instanceof ReadableStream ? result : result.fullStream;
    const reader = readableStream.getReader();

    ctx.res.on('close', () => {
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
            ctx.res.write(`data: ${JSON.stringify(outputValue)}\n\n`);
          } else {
            ctx.res.write(JSON.stringify(outputValue) + '\x1E');
          }
        }
      }
    } catch (error) {
      this.mastra.getLogger()?.error('Error in stream processing', {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });
    } finally {
      ctx.res.end();
    }
  }

  async getParams(route: ServerRoute, ctx: Context): Promise<ParsedRequestParams> {
    const urlParams = (ctx.params || {}) as Record<string, string>;
    // Koa's ctx.query is ParsedUrlQuery which is Record<string, string | string[]>
    const queryParams = normalizeQueryParams((ctx.query || {}) as Record<string, unknown>);
    let body: unknown;
    let bodyParseError: { message: string } | undefined;

    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH' || route.method === 'DELETE') {
      const contentType = ctx.headers['content-type'] || '';

      if (contentType.includes('multipart/form-data')) {
        try {
          const maxFileSize = route.maxBodySize ?? this.bodyLimitOptions?.maxSize;
          body = await this.parseMultipartFormData(ctx, maxFileSize);
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
      } else {
        body = ctx.request.body;
      }
    }

    return { urlParams, queryParams, body, bodyParseError };
  }

  /**
   * Parse multipart/form-data using @fastify/busboy.
   * Converts file uploads to Buffers and parses JSON field values.
   *
   * @param ctx - The Koa context object
   * @param maxFileSize - Optional maximum file size in bytes
   */
  private parseMultipartFormData(ctx: Context, maxFileSize?: number): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const result: Record<string, unknown> = {};

      const busboy = new Busboy({
        headers: {
          'content-type': ctx.headers['content-type'] as string,
        },
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
          if (!limitExceeded) {
            result[fieldname] = Buffer.concat(chunks);
          }
        });
      });

      busboy.on('field', (fieldname: string, value: string) => {
        // Try to parse JSON strings (like 'options')
        try {
          result[fieldname] = JSON.parse(value);
        } catch {
          result[fieldname] = value;
        }
      });

      busboy.on('finish', () => {
        resolve(result);
      });

      busboy.on('error', (error: Error) => {
        reject(error);
      });

      // Pipe the raw request to busboy
      ctx.req.pipe(busboy);
    });
  }

  async sendResponse(route: ServerRoute, ctx: Context, result: unknown, prefix?: string): Promise<void> {
    const resolvedPrefix = prefix ?? this.prefix ?? '';

    if (route.responseType === 'json') {
      ctx.body = result;
    } else if (route.responseType === 'stream') {
      await this.stream(route, ctx, result as { fullStream: ReadableStream });
    } else if (route.responseType === 'datastream-response') {
      // Handle AI SDK Response objects - pipe Response.body to Koa response
      // Tell Koa we're handling the response ourselves
      ctx.respond = false;

      const fetchResponse = result as globalThis.Response;
      const headers: Record<string, string> = {};
      fetchResponse.headers.forEach((value, key) => {
        headers[key] = value;
      });
      ctx.res.writeHead(fetchResponse.status, headers);

      if (fetchResponse.body) {
        const reader = fetchResponse.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            ctx.res.write(value);
          }
        } finally {
          ctx.res.end();
        }
      } else {
        ctx.res.end();
      }
    } else if (route.responseType === 'mcp-http') {
      // MCP Streamable HTTP transport
      // Tell Koa we're handling the response ourselves
      ctx.respond = false;

      const { server, httpPath, mcpOptions: routeMcpOptions } = result as MCPHttpTransportResult;

      try {
        // Attach parsed body to raw request so MCP server's readJsonBody can use it
        const rawReq = ctx.req as typeof ctx.req & { body?: unknown };
        if (ctx.request.body !== undefined) {
          rawReq.body = ctx.request.body;
        }

        // Merge class-level mcpOptions with route-specific options (route takes precedence)
        const options = { ...this.mcpOptions, ...routeMcpOptions };

        await server.startHTTP({
          url: new URL(ctx.url, `http://${ctx.headers.host}`),
          httpPath: `${resolvedPrefix}${httpPath}`,
          req: rawReq,
          res: ctx.res,
          options: Object.keys(options).length > 0 ? options : undefined,
        });
        // Response handled by startHTTP
      } catch {
        if (!ctx.res.headersSent) {
          ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
          ctx.res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal server error' },
              id: null,
            }),
          );
        }
      }
    } else if (route.responseType === 'mcp-sse') {
      // MCP SSE transport
      // Tell Koa we're handling the response ourselves
      ctx.respond = false;

      const { server, ssePath, messagePath } = result as MCPSseTransportResult;

      try {
        // Attach parsed body to raw request so MCP server's readJsonBody can use it
        const rawReq = ctx.req as typeof ctx.req & { body?: unknown };
        if (ctx.request.body !== undefined) {
          rawReq.body = ctx.request.body;
        }

        await server.startSSE({
          url: new URL(ctx.url, `http://${ctx.headers.host}`),
          ssePath: `${resolvedPrefix}${ssePath}`,
          messagePath: `${resolvedPrefix}${messagePath}`,
          req: rawReq,
          res: ctx.res,
        });
        // Response handled by startSSE
      } catch {
        if (!ctx.res.headersSent) {
          ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
          ctx.res.end(JSON.stringify({ error: 'Error handling MCP SSE request' }));
        }
      }
    } else {
      ctx.status = 500;
    }
  }

  async registerRoute(app: Koa, route: ServerRoute, { prefix: prefixParam }: { prefix?: string } = {}): Promise<void> {
    // Default prefix to this.prefix if not provided, or empty string
    const prefix = prefixParam ?? this.prefix ?? '';

    const fullPath = `${prefix}${route.path}`;

    // Convert Express-style :param to Koa-style :param (they're the same)
    const koaPath = fullPath;

    // Define the route handler
    const handler = async (ctx: Context, next: Next) => {
      // Check if this route matches the request
      const pathRegex = this.pathToRegex(koaPath);
      const match = pathRegex.exec(ctx.path);

      if (!match) {
        await next();
        return;
      }

      // Check HTTP method
      if (route.method.toUpperCase() !== 'ALL' && ctx.method.toUpperCase() !== route.method.toUpperCase()) {
        await next();
        return;
      }

      // Extract URL params from regex match
      const paramNames = this.extractParamNames(koaPath);
      ctx.params = {};
      paramNames.forEach((name, index) => {
        ctx.params[name] = match[index + 1];
      });

      // Check route-level authentication/authorization
      const authError = await this.checkRouteAuth(route, {
        path: String(ctx.path || '/'),
        method: String(ctx.method || 'GET'),
        getHeader: name => ctx.headers[name.toLowerCase()] as string | undefined,
        getQuery: name => (ctx.query as Record<string, string>)[name],
        requestContext: ctx.state.requestContext,
      });

      if (authError) {
        ctx.status = authError.status;
        ctx.body = { error: authError.error };
        return;
      }

      const params = await this.getParams(route, ctx);

      // Return 400 Bad Request if body parsing failed (e.g., malformed multipart data)
      if (params.bodyParseError) {
        ctx.status = 400;
        ctx.body = {
          error: 'Invalid request body',
          issues: [{ field: 'body', message: params.bodyParseError.message }],
        };
        return;
      }

      if (params.queryParams) {
        try {
          params.queryParams = await this.parseQueryParams(route, params.queryParams);
        } catch (error) {
          this.mastra.getLogger()?.error('Error parsing query params', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
          // Zod validation errors should return 400 Bad Request with structured issues
          if (error instanceof ZodError) {
            ctx.status = 400;
            ctx.body = formatZodError(error, 'query parameters');
            return;
          }
          ctx.status = 400;
          ctx.body = {
            error: 'Invalid query parameters',
            issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
          };
          return;
        }
      }

      if (params.body) {
        try {
          params.body = await this.parseBody(route, params.body);
        } catch (error) {
          this.mastra.getLogger()?.error('Error parsing body', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
          // Zod validation errors should return 400 Bad Request with structured issues
          if (error instanceof ZodError) {
            ctx.status = 400;
            ctx.body = formatZodError(error, 'request body');
            return;
          }
          ctx.status = 400;
          ctx.body = {
            error: 'Invalid request body',
            issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
          };
          return;
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
            ctx.status = 400;
            ctx.body = formatZodError(error, 'path parameters');
            return;
          }
          ctx.status = 400;
          ctx.body = {
            error: 'Invalid path parameters',
            issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
          };
          return;
        }
      }

      const handlerParams = {
        ...params.urlParams,
        ...params.queryParams,
        ...(typeof params.body === 'object' ? params.body : {}),
        requestContext: ctx.state.requestContext,
        mastra: this.mastra,
        tools: ctx.state.tools,
        taskStore: ctx.state.taskStore,
        abortSignal: ctx.state.abortSignal,
        routePrefix: prefix,
      };

      try {
        const result = await route.handler(handlerParams);
        await this.sendResponse(route, ctx, result, prefix);
      } catch (error) {
        this.mastra.getLogger()?.error('Error calling handler', {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          path: route.path,
          method: route.method,
        });
        // Attach status code to the error for upstream middleware
        if (error && typeof error === 'object') {
          if (!('status' in error)) {
            // Check for MastraError with status in details
            if ('details' in error && error.details && typeof error.details === 'object' && 'status' in error.details) {
              (error as any).status = (error.details as any).status;
            }
          }
        }

        // Try to call server.onError if configured
        if (await this.handleOnError(error, ctx)) {
          return;
        }

        // Re-throw so the error propagates up Koa's middleware chain
        throw error;
      }
    };

    // Register the middleware
    app.use(handler);
  }

  /**
   * Convert Express-style path to regex for matching
   */
  private pathToRegex(path: string): RegExp {
    // First replace :param with a placeholder that won't be affected by escaping
    const PARAM_PLACEHOLDER = '\x00PARAM\x00';
    const pathWithPlaceholders = path.replace(/:[^/]+/g, PARAM_PLACEHOLDER);

    // Escape all regex meta-characters so the path is treated literally
    const escapedPath = pathWithPlaceholders.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace placeholders with capture groups and escape forward slashes
    const regexPath = escapedPath.replace(new RegExp(PARAM_PLACEHOLDER, 'g'), '([^/]+)').replace(/\//g, '\\/');

    return new RegExp(`^${regexPath}$`);
  }

  /**
   * Extract parameter names from path
   */
  private extractParamNames(path: string): string[] {
    const matches = path.match(/:[^/]+/g) || [];
    return matches.map(m => m.slice(1)); // Remove the leading ':'
  }

  async registerCustomApiRoutes(): Promise<void> {
    if (!(await this.buildCustomRouteHandler())) return;

    this.app.use(async (ctx: Context, next: Next) => {
      const response = await this.handleCustomRouteRequest(
        `${ctx.protocol}://${ctx.host}${ctx.originalUrl || ctx.url}`,
        ctx.method,
        ctx.headers as Record<string, string | string[] | undefined>,
        ctx.request.body,
        ctx.state.requestContext,
      );
      if (!response) return next();
      ctx.respond = false;
      await this.writeCustomRouteResponse(response, ctx.res);
    });
  }

  registerContextMiddleware(): void {
    this.app.use(this.createContextMiddleware());
  }

  registerAuthMiddleware(): void {
    const authConfig = this.mastra.getServer()?.auth;
    if (!authConfig) {
      // No auth config, skip registration
      return;
    }

    this.app.use(authenticationMiddleware);
    this.app.use(authorizationMiddleware);
  }
}
