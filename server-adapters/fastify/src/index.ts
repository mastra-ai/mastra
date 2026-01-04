import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { formatZodError } from '@mastra/server/handlers/error';
import type { MCPHttpTransportResult, MCPSseTransportResult } from '@mastra/server/handlers/mcp';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { MastraServer as MastraServerBase, redactStreamChunk } from '@mastra/server/server-adapter';
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler, RouteHandlerMethod } from 'fastify';
import { ZodError } from 'zod';

import { authenticationMiddleware, authorizationMiddleware } from './auth-middleware';

// Extend Fastify types to include Mastra context
declare module 'fastify' {
  interface FastifyRequest {
    mastra: Mastra;
    requestContext: RequestContext;
    tools: ToolsInput;
    abortSignal: AbortSignal;
    taskStore: InMemoryTaskStore;
    customRouteAuthConfig?: Map<string, boolean>;
  }
}

export class MastraServer extends MastraServerBase<FastifyInstance, FastifyRequest, FastifyReply> {
  createContextMiddleware(): preHandlerHookHandler {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      // Parse request context from request body and add to context
      let bodyRequestContext: Record<string, any> | undefined;
      let paramsRequestContext: Record<string, any> | undefined;

      // Parse request context from request body (POST/PUT)
      if (request.method === 'POST' || request.method === 'PUT') {
        const contentType = request.headers['content-type'];
        if (contentType?.includes('application/json') && request.body) {
          const body = request.body as { requestContext?: Record<string, any> };
          if (body.requestContext) {
            bodyRequestContext = body.requestContext;
          }
        }
      }

      // Parse request context from query params (GET)
      if (request.method === 'GET') {
        try {
          const query = request.query as Record<string, string>;
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

      // Set context in request object
      request.requestContext = requestContext;
      request.mastra = this.mastra;
      request.tools = this.tools || {};
      if (this.taskStore) {
        request.taskStore = this.taskStore;
      }
      request.customRouteAuthConfig = this.customRouteAuthConfig;

      // Create abort controller for request cancellation
      const controller = new AbortController();
      request.raw.on('close', () => {
        // Only abort if the response wasn't successfully completed
        if (!request.raw.complete) {
          controller.abort();
        }
      });
      request.abortSignal = controller.signal;
    };
  }

  async stream(route: ServerRoute, reply: FastifyReply, result: { fullStream: ReadableStream }): Promise<void> {
    reply.header('Content-Type', 'text/plain');
    reply.header('Transfer-Encoding', 'chunked');

    const streamFormat = route.streamFormat || 'stream';

    const readableStream = result instanceof ReadableStream ? result : result.fullStream;
    const reader = readableStream.getReader();

    reply.raw.on('close', () => {
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
            reply.raw.write(`data: ${JSON.stringify(outputValue)}\n\n`);
          } else {
            reply.raw.write(JSON.stringify(outputValue) + '\x1E');
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      reply.raw.end();
    }
  }

  async getParams(
    route: ServerRoute,
    request: FastifyRequest,
  ): Promise<{ urlParams: Record<string, string>; queryParams: Record<string, string>; body: unknown }> {
    const urlParams = (request.params || {}) as Record<string, string>;
    const queryParams = (request.query || {}) as Record<string, string>;
    let body: unknown;

    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
      const contentType = request.headers['content-type'] || '';

      if (contentType.includes('multipart/form-data')) {
        try {
          body = await this.parseMultipartFormData(request);
        } catch (error) {
          console.error('Failed to parse multipart form data:', error);
          // Re-throw size limit errors, let others fall through to validation
          if (error instanceof Error && error.message.toLowerCase().includes('size')) {
            throw error;
          }
        }
      } else {
        body = request.body;
      }
    }

    return { urlParams, queryParams, body };
  }

  /**
   * Parse multipart/form-data using @fastify/multipart.
   * Converts file uploads to Buffers and parses JSON field values.
   *
   * @param request - The Fastify request object
   */
  private async parseMultipartFormData(request: FastifyRequest): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    // Use fastify multipart - assumes @fastify/multipart is registered
    const parts = (request as any).parts?.();

    if (!parts) {
      // If @fastify/multipart is not registered, try to read body directly
      return request.body as Record<string, unknown>;
    }

    for await (const part of parts) {
      if (part.type === 'file') {
        // Convert file stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        result[part.fieldname] = Buffer.concat(chunks);
      } else {
        // Field value - try to parse as JSON
        try {
          result[part.fieldname] = JSON.parse(part.value);
        } catch {
          result[part.fieldname] = part.value;
        }
      }
    }

    return result;
  }

  async sendResponse(
    route: ServerRoute,
    reply: FastifyReply,
    result: unknown,
    request?: FastifyRequest,
  ): Promise<void> {
    if (route.responseType === 'json') {
      await reply.send(result);
    } else if (route.responseType === 'stream') {
      await this.stream(route, reply, result as { fullStream: ReadableStream });
    } else if (route.responseType === 'datastream-response') {
      // Handle AI SDK Response objects - pipe Response.body to Fastify response
      const fetchResponse = result as globalThis.Response;
      fetchResponse.headers.forEach((value, key) => reply.header(key, value));
      reply.status(fetchResponse.status);
      if (fetchResponse.body) {
        const reader = fetchResponse.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(value);
          }
        } finally {
          reply.raw.end();
        }
      } else {
        reply.raw.end();
      }
    } else if (route.responseType === 'mcp-http') {
      // MCP Streamable HTTP transport - request is required
      if (!request) {
        await reply.status(500).send({ error: 'Request object required for MCP transport' });
        return;
      }

      const { server, httpPath } = result as MCPHttpTransportResult;

      try {
        await server.startHTTP({
          url: new URL(request.url, `http://${request.headers.host}`),
          httpPath,
          req: request.raw,
          res: reply.raw,
        });
        // Response handled by startHTTP
      } catch {
        if (!reply.sent) {
          await reply.status(500).send({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    } else if (route.responseType === 'mcp-sse') {
      // MCP SSE transport - request is required
      if (!request) {
        await reply.status(500).send({ error: 'Request object required for MCP transport' });
        return;
      }

      const { server, ssePath, messagePath } = result as MCPSseTransportResult;

      try {
        await server.startSSE({
          url: new URL(request.url, `http://${request.headers.host}`),
          ssePath,
          messagePath,
          req: request.raw,
          res: reply.raw,
        });
        // Response handled by startSSE
      } catch {
        if (!reply.sent) {
          await reply.status(500).send({ error: 'Error handling MCP SSE request' });
        }
      }
    } else {
      reply.status(500);
    }
  }

  async registerRoute(app: FastifyInstance, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
    const fullPath = `${prefix}${route.path}`;

    // Convert Express-style :param to Fastify-style :param (they're the same, but ensure consistency)
    const fastifyPath = fullPath;

    // Define the route handler
    const handler: RouteHandlerMethod = async (request: FastifyRequest, reply: FastifyReply) => {
      const params = await this.getParams(route, request);

      if (params.queryParams) {
        try {
          params.queryParams = await this.parseQueryParams(route, params.queryParams as Record<string, string>);
        } catch (error) {
          console.error('Error parsing query params', error);
          // Zod validation errors should return 400 Bad Request with structured issues
          if (error instanceof ZodError) {
            return reply.status(400).send(formatZodError(error, 'query parameters'));
          }
          return reply.status(400).send({
            error: 'Invalid query parameters',
            issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
          });
        }
      }

      if (params.body) {
        try {
          params.body = await this.parseBody(route, params.body);
        } catch (error) {
          console.error('Error parsing body:', error instanceof Error ? error.message : String(error));
          // Zod validation errors should return 400 Bad Request with structured issues
          if (error instanceof ZodError) {
            return reply.status(400).send(formatZodError(error, 'request body'));
          }
          return reply.status(400).send({
            error: 'Invalid request body',
            issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
          });
        }
      }

      const handlerParams = {
        ...params.urlParams,
        ...params.queryParams,
        ...(typeof params.body === 'object' ? params.body : {}),
        requestContext: request.requestContext,
        mastra: this.mastra,
        tools: request.tools,
        taskStore: request.taskStore,
        abortSignal: request.abortSignal,
      };

      try {
        const result = await route.handler(handlerParams);
        await this.sendResponse(route, reply, result, request);
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
        await reply.status(status).send({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    };

    // Add body limit if configured
    const shouldApplyBodyLimit = this.bodyLimitOptions && ['POST', 'PUT', 'PATCH'].includes(route.method.toUpperCase());
    const maxSize = route.maxBodySize ?? this.bodyLimitOptions?.maxSize;

    const config = shouldApplyBodyLimit && maxSize ? { bodyLimit: maxSize } : undefined;

    // Handle ALL method by registering for each HTTP method
    // Fastify doesn't support 'ALL' method natively like Express
    if (route.method.toUpperCase() === 'ALL') {
      // Only register the main HTTP methods that MCP actually uses
      // Skip HEAD/OPTIONS to avoid potential conflicts with Fastify's auto-generated routes
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
      for (const method of methods) {
        try {
          app.route({
            method,
            url: fastifyPath,
            handler,
            config,
          });
        } catch (err) {
          // Skip duplicate route errors - can happen if route is registered multiple times
          if (err instanceof Error && err.message.includes('already declared')) {
            continue;
          }
          throw err;
        }
      }
    } else {
      app.route({
        method: route.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: fastifyPath,
        handler,
        config,
      });
    }
  }

  registerContextMiddleware(): void {
    this.app.addHook('preHandler', this.createContextMiddleware());
  }

  registerAuthMiddleware(): void {
    const authConfig = this.mastra.getServer()?.auth;
    if (!authConfig) {
      // No auth config, skip registration
      return;
    }

    this.app.addHook('preHandler', authenticationMiddleware);
    this.app.addHook('preHandler', authorizationMiddleware);
  }
}
