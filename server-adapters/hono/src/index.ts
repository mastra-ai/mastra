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
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context, HonoRequest, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { stream } from 'hono/streaming';
import { ZodError } from 'zod';

import { authenticationMiddleware, authorizationMiddleware } from './auth-middleware';

// Export type definitions for Hono app configuration
export type HonoVariables = {
  mastra: Mastra;
  requestContext: RequestContext;
  tools: ToolsInput;
  abortSignal: AbortSignal;
  taskStore: InMemoryTaskStore;
  customRouteAuthConfig?: Map<string, boolean>;
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
      // Parse request context from request body and add to context

      let bodyRequestContext: Record<string, any> | undefined;
      let paramsRequestContext: Record<string, any> | undefined;

      // Parse request context from request body (POST/PUT)
      if (c.req.method === 'POST' || c.req.method === 'PUT') {
        const contentType = c.req.header('content-type');
        if (contentType?.includes('application/json')) {
          try {
            const clonedReq = c.req.raw.clone();
            const body = (await clonedReq.json()) as { requestContext?: Record<string, any> };
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
      c.set('tools', this.tools || {});
      c.set('taskStore', this.taskStore);
      c.set('abortSignal', c.req.raw.signal);
      c.set('customRouteAuthConfig', this.customRouteAuthConfig);

      return next();
    };
  }
  async stream(route: ServerRoute, res: Context, result: { fullStream: ReadableStream }): Promise<any> {
    res.header('Content-Type', 'text/plain');
    res.header('Transfer-Encoding', 'chunked');

    const streamFormat = route.streamFormat || 'stream';

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

          await stream.write('data: [DONE]\n\n');
        } catch (error) {
          console.error(error);
        } finally {
          await stream.close();
        }
      },
      async err => {
        console.error(err);
      },
    );
  }

  async getParams(route: ServerRoute, request: HonoRequest): Promise<ParsedRequestParams> {
    const urlParams = request.param();
    // Use queries() to get all values for repeated params (e.g., ?tags=a&tags=b -> { tags: ['a', 'b'] })
    const queryParams = normalizeQueryParams(request.queries());
    let body: unknown;
    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
      const contentType = request.header('content-type') || '';

      if (contentType.includes('multipart/form-data')) {
        try {
          const formData = await request.formData();
          body = await this.parseFormData(formData);
        } catch (error) {
          console.error('Failed to parse multipart form data:', error);
          // Re-throw size limit errors, let others fall through to validation
          if (error instanceof Error && error.message.toLowerCase().includes('size')) {
            throw error;
          }
        }
      } else {
        try {
          body = await request.json();
        } catch (error) {
          console.error('Failed to parse JSON body:', error);
        }
      }
    }
    return { urlParams, queryParams, body };
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

  async sendResponse(route: ServerRoute, response: Context, result: unknown): Promise<any> {
    if (route.responseType === 'json') {
      return response.json(result as any, 200);
    } else if (route.responseType === 'stream') {
      return this.stream(route, response, result as { fullStream: ReadableStream });
    } else if (route.responseType === 'datastream-response') {
      const fetchResponse = result as globalThis.Response;
      return fetchResponse;
    } else if (route.responseType === 'mcp-http') {
      // MCP Streamable HTTP transport
      const { server, httpPath } = result as MCPHttpTransportResult;
      const { req, res } = toReqRes(response.req.raw);

      try {
        await server.startHTTP({
          url: new URL(response.req.url),
          httpPath,
          req,
          res,
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
      // MCP SSE transport
      const { server, ssePath, messagePath } = result as MCPSseTransportResult;

      try {
        return await server.startHonoSSE({
          url: new URL(response.req.url),
          ssePath,
          messagePath,
          context: response,
        });
      } catch {
        return response.json({ error: 'Error handling MCP SSE request' }, 500);
      }
    } else {
      return response.status(500);
    }
  }

  async registerRoute(app: HonoApp, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
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
        const params = await this.getParams(route, c.req);

        if (params.queryParams) {
          try {
            params.queryParams = await this.parseQueryParams(route, params.queryParams);
          } catch (error) {
            console.error('Error parsing query params', error);
            // Zod validation errors should return 400 Bad Request with structured issues
            if (error instanceof ZodError) {
              return c.json(formatZodError(error, 'query parameters'), 400);
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
            console.error('Error parsing body:', error instanceof Error ? error.message : String(error));
            // Zod validation errors should return 400 Bad Request with structured issues
            if (error instanceof ZodError) {
              return c.json(formatZodError(error, 'request body'), 400);
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

        const handlerParams = {
          ...params.urlParams,
          ...params.queryParams,
          ...(typeof params.body === 'object' ? params.body : {}),
          requestContext: c.get('requestContext'),
          mastra: this.mastra,
          tools: c.get('tools'),
          taskStore: c.get('taskStore'),
          abortSignal: c.get('abortSignal'),
          rawRequest: c.req.raw,
        };

        try {
          const result = await route.handler(handlerParams);
          return this.sendResponse(route, c, result);
        } catch (error) {
          console.error('Error calling handler', error);
          // Check if it's an HTTPException or MastraError with a status code
          if (error && typeof error === 'object') {
            // Check for direct status property (HTTPException)
            if ('status' in error) {
              const status = (error as any).status;
              return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, status);
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

  registerContextMiddleware(): void {
    this.app.use('*', this.createContextMiddleware());
  }

  registerAuthMiddleware(): void {
    const authConfig = this.mastra.getServer()?.auth;
    if (!authConfig) {
      // No auth config, skip registration
      return;
    }

    this.app.use('*', authenticationMiddleware);
    this.app.use('*', authorizationMiddleware);
  }
}
