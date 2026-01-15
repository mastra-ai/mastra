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
}

export class MastraServer extends MastraServerBase<Koa, Context, Context> {
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

    // Set status and headers via ctx.res directly since we're bypassing Koa's response
    ctx.res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
    });

    const streamFormat = route.streamFormat || 'stream';

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
      console.error(error);
    } finally {
      ctx.res.end();
    }
  }

  async getParams(route: ServerRoute, ctx: Context): Promise<ParsedRequestParams> {
    const urlParams = (ctx.params || {}) as Record<string, string>;
    // Koa's ctx.query is ParsedUrlQuery which is Record<string, string | string[]>
    const queryParams = normalizeQueryParams((ctx.query || {}) as Record<string, unknown>);
    let body: unknown;

    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
      const contentType = ctx.headers['content-type'] || '';

      if (contentType.includes('multipart/form-data')) {
        try {
          const maxFileSize = route.maxBodySize ?? this.bodyLimitOptions?.maxSize;
          body = await this.parseMultipartFormData(ctx, maxFileSize);
        } catch (error) {
          console.error('Failed to parse multipart form data:', error);
          // Re-throw size limit errors, let others fall through to validation
          if (error instanceof Error && error.message.toLowerCase().includes('size')) {
            throw error;
          }
        }
      } else {
        body = ctx.request.body;
      }
    }

    return { urlParams, queryParams, body };
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

  async sendResponse(route: ServerRoute, ctx: Context, result: unknown): Promise<void> {
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

      const { server, httpPath } = result as MCPHttpTransportResult;

      try {
        // Attach parsed body to raw request so MCP server's readJsonBody can use it
        const rawReq = ctx.req as typeof ctx.req & { body?: unknown };
        if (ctx.request.body !== undefined) {
          rawReq.body = ctx.request.body;
        }

        await server.startHTTP({
          url: new URL(ctx.url, `http://${ctx.headers.host}`),
          httpPath,
          req: rawReq,
          res: ctx.res,
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
          ssePath,
          messagePath,
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

  async registerRoute(app: Koa, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
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

      const params = await this.getParams(route, ctx);

      if (params.queryParams) {
        try {
          params.queryParams = await this.parseQueryParams(route, params.queryParams);
        } catch (error) {
          console.error('Error parsing query params', error);
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
          console.error('Error parsing body:', error instanceof Error ? error.message : String(error));
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

      // Handle property precedence between body and context:
      // - Body `tools` (for stored-agents API) should override context `tools`
      // - Other context properties (requestContext, mastra, etc.) must NEVER be overwritten
      // Solution: Spread body first, then explicitly set protected context properties.
      // `tools` is set from context first, then body spread can override it.
      const handlerParams = {
        ...params.urlParams,
        ...params.queryParams,
        tools: ctx.state.tools, // Context tools (can be overridden by body)
        ...(typeof params.body === 'object' ? params.body : {}),
        // Protected context properties - MUST come after body spread
        requestContext: ctx.state.requestContext,
        mastra: this.mastra,
        taskStore: ctx.state.taskStore,
        abortSignal: ctx.state.abortSignal,
      };

      try {
        const result = await route.handler(handlerParams);
        await this.sendResponse(route, ctx, result);
      } catch (error) {
        console.error('Error calling handler', error);
        // Check if it's an HTTPException or MastraError with a status code
        let status = 500;
        if (error && typeof error === 'object') {
          // Check for direct status property (HTTPException)
          if ('status' in error) {
            status = (error as any).status;
          }
          // Check for MastraError with status in details
          else if (
            'details' in error &&
            error.details &&
            typeof error.details === 'object' &&
            'status' in error.details
          ) {
            status = (error.details as any).status;
          }
        }
        ctx.status = status;
        ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
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
