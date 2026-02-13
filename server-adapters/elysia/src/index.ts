import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { formatZodError } from '@mastra/server/handlers/error';
import type { MCPHttpTransportResult } from '@mastra/server/handlers/mcp';
import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';
import {
  MastraServer as MastraServerBase,
  normalizeQueryParams,
  redactStreamChunk,
} from '@mastra/server/server-adapter';
import type { AnyElysia, MaybePromise } from 'elysia';
import type Elysia from 'elysia';
import { sse } from 'elysia';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import { ZodError } from 'zod';
import { authPlugin } from './auth-middleware';

// Export helper functions for OpenAPI integration
export { getMastraOpenAPIDoc, clearMastraOpenAPICache } from './helper';

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
  onError(handler: (context: any) => any): ElysiaApp;
}

export class MastraServer extends MastraServerBase<Elysia, Request, Response> {
  createContextMiddleware() {
    return async (ctx: any) => {
      // Parse request context from request body and query params
      let bodyRequestContext: Record<string, any> | undefined;
      let paramsRequestContext: Record<string, any> | undefined;

      // Parse request context from request body (POST/PUT)
      if (ctx.request.method === 'POST' || ctx.request.method === 'PUT') {
        const contentType = ctx.request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          try {
            const body = (await ctx.request.clone().json()) as { requestContext?: Record<string, any> };
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

  async stream(route: ServerRoute, res: Response, result: { fullStream: ReadableStream }): Promise<any> {
    const streamFormat = route.streamFormat || 'stream';

    if (streamFormat === 'sse') {
      // Return generator function for SSE format
      return async function* (this: MastraServer) {
        const readableStream = result instanceof ReadableStream ? result : result.fullStream;
        const reader = readableStream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
              // Optionally redact sensitive data
              const shouldRedact = this.streamOptions?.redact ?? true;
              const outputValue = shouldRedact ? redactStreamChunk(value) : value;
              yield sse({ data: JSON.stringify(outputValue) });
            }
          }

          yield sse({ data: '[DONE]' });
        } catch (error) {
          this.mastra.getLogger()?.error('Error in stream processing', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          });
        } finally {
          await reader.cancel();
        }
      }.bind(this)();
    } else {
      // Return Response with ReadableStream for regular stream format
      const stream = new ReadableStream({
        start: async controller => {
          const readableStream = result instanceof ReadableStream ? result : result.fullStream;
          const reader = readableStream.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              if (value) {
                const shouldRedact = this.streamOptions?.redact ?? true;
                const outputValue = shouldRedact ? redactStreamChunk(value) : value;
                const encoded = new TextEncoder().encode(JSON.stringify(outputValue) + '\x1E');
                controller.enqueue(encoded);
              }
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

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked',
        },
      });
    }
  }

  async getParams(route: ServerRoute, request: Request): Promise<ParsedRequestParams> {
    // For Elysia, we need to extract from the context that was passed
    // We'll use a different approach - get context from the request
    // Note: Elysia pre-parses params, query, and body, but we're getting Request here
    // We'll need to work with what we have

    // This is a bit tricky - in Elysia, the params are available on the context, not the Request
    // We'll need to adjust the approach. Let's extract what we can from the Request directly
    const url = new URL(request.url);

    // URL params - we'll need to parse from the pathname if needed
    const urlParams: Record<string, string> = {};

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

  async sendResponse(route: ServerRoute, response: Response, result: unknown, prefix?: string): Promise<any> {
    const resolvedPrefix = prefix ?? this.prefix ?? '';

    if (route.responseType === 'json') {
      return result;
    } else if (route.responseType === 'stream') {
      return this.stream(route, response, result as { fullStream: ReadableStream });
    } else if (route.responseType === 'datastream-response') {
      const fetchResponse = result as globalThis.Response;
      return fetchResponse;
    } else if (route.responseType === 'mcp-http') {
      // MCP Streamable HTTP transport
      const { server, httpPath, mcpOptions: routeMcpOptions } = result as MCPHttpTransportResult;

      // We need to get the Request object - it's passed as the response parameter in Elysia context
      // Actually, we need to work with the context differently
      // Let's create a proper Request object from what we have
      const request = response as any; // This will be the context in reality

      const { req, res } = toReqRes(request.request);

      try {
        const options = { ...this.mcpOptions, ...routeMcpOptions };

        await server.startHTTP({
          url: new URL(request.request.url),
          httpPath: `${resolvedPrefix}${httpPath}`,
          req,
          res,
          options: Object.keys(options).length > 0 ? options : undefined,
        });
        return await toFetchResponse(res);
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
          return await toFetchResponse(res);
        }
        return await toFetchResponse(res);
      }
    } else if (route.responseType === 'mcp-sse') {
      // MCP SSE transport - not supported yet for Elysia
      // We would need to implement startElysiaSSE on the MCP server
      this.mastra.getLogger()?.error('MCP SSE transport not yet implemented for Elysia');
      return new Response(JSON.stringify({ error: 'MCP SSE transport not yet implemented for Elysia' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
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

    const handler = async (ctx: any) => {
      // Check route-level authentication/authorization
      const authError = await this.checkRouteAuth(route, {
        path: ctx.request.url ? new URL(ctx.request.url).pathname : ctx.path,
        method: ctx.request.method,
        getHeader: (name: string) => ctx.request.headers.get(name) || undefined,
        getQuery: (name: string) => ctx.query?.[name],
        requestContext: ctx.requestContext,
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.error }), {
          status: authError.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Extract params - with Elysia, params are pre-parsed
      const urlParams = ctx.params || {};
      const queryParams = normalizeQueryParams(ctx.query || {});
      let body: unknown;
      let bodyParseError: { message: string } | undefined;

      if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH' || route.method === 'DELETE') {
        const contentType = ctx.request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
          try {
            // Elysia pre-parses multipart form data
            body = ctx.body ? await this.parseFormData(ctx.body as FormData) : undefined;
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
          if (error instanceof ZodError) {
            return new Response(JSON.stringify(formatZodError(error, 'query parameters')), {
              status: 400,
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
          if (error instanceof ZodError) {
            return new Response(JSON.stringify(formatZodError(error, 'request body')), {
              status: 400,
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
    app[method](fullPath, handler);
  }

  async registerCustomApiRoutes(): Promise<void> {
    // Build custom route handler
    if (!(await this.buildCustomRouteHandler())) return;

    // Register catch-all route to forward to custom route handler
    this.app.all('*', async (ctx: any) => {
      // Convert Headers object to plain object
      const headers: Record<string, string | string[] | undefined> = {};
      ctx.request.headers.forEach((value: string, key: string) => {
        headers[key] = value;
      });

      const response = await this.handleCustomRouteRequest(
        ctx.request.url,
        ctx.request.method,
        headers,
        ctx.request.body,
        ctx.requestContext,
      );

      // If response is null, this is not a custom route - continue
      if (!response) return;

      return response;
    });
  }

  registerContextMiddleware(): void {
    this.app.derive(this.createContextMiddleware());
  }

  registerAuthMiddleware(): void {
    const authConfig = this.mastra.getServer()?.auth;
    if (!authConfig) {
      // No auth config, skip registration
      return;
    }

    // Register auth plugin using Elysia's use() method
    this.app.use(authPlugin);
  }
}
