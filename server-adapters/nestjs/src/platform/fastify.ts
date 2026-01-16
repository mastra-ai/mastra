import { Busboy } from '@fastify/busboy';
import { formatZodError } from '@mastra/server/handlers/error';
import type { MCPHttpTransportResult, MCPSseTransportResult } from '@mastra/server/handlers/mcp';
import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';
import { normalizeQueryParams, redactStreamChunk } from '@mastra/server/server-adapter';
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { ZodError } from 'zod';

import type { MastraServerOptions, PlatformAdapter, PlatformType } from '../types';

import { fastifyAuthenticationMiddleware, fastifyAuthorizationMiddleware } from './fastify-auth';

// Type for accessing protected members of MastraServer
interface MastraServerInternal {
  mastra: any;
  streamOptions?: { redact?: boolean };
  mergeRequestContext(params: {
    paramsRequestContext?: Record<string, any>;
    bodyRequestContext?: Record<string, any>;
  }): any;
  parseQueryParams(route: ServerRoute, params: Record<string, any>): Promise<Record<string, any>>;
  parseBody(route: ServerRoute, body: unknown): Promise<unknown>;
}

/**
 * Fastify platform adapter for NestJS.
 * Handles all Fastify-specific request/response handling.
 */
export class FastifyPlatformAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'fastify';
  private server: MastraServerInternal;
  private options: MastraServerOptions;
  private instance: FastifyInstance;

  constructor(server: unknown, options: MastraServerOptions) {
    this.server = server as MastraServerInternal;
    this.options = options;
    this.instance = options.app.getHttpAdapter().getInstance() as FastifyInstance;
  }

  getInstance(): FastifyInstance {
    return this.instance;
  }

  createContextMiddleware(): preHandlerHookHandler {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      let bodyRequestContext: Record<string, any> | undefined;
      let paramsRequestContext: Record<string, any> | undefined;

      // Parse request context from POST/PUT body
      if (request.method === 'POST' || request.method === 'PUT') {
        const contentType = request.headers['content-type'];
        if (contentType?.includes('application/json') && request.body) {
          const body = request.body as { requestContext?: Record<string, any> };
          if (body.requestContext) {
            bodyRequestContext = body.requestContext;
          }
        }
      }

      // Parse request context from GET query params
      if (request.method === 'GET') {
        try {
          const query = request.query as Record<string, string>;
          const encodedRequestContext = query.requestContext;
          if (typeof encodedRequestContext === 'string') {
            try {
              paramsRequestContext = JSON.parse(encodedRequestContext);
            } catch {
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

      const requestContext = this.server.mergeRequestContext({
        paramsRequestContext,
        bodyRequestContext,
      });

      // Store context directly on request (Fastify pattern)
      (request as any).mastra = this.server.mastra;
      (request as any).requestContext = requestContext;
      (request as any).tools = this.options.tools || {};
      if (this.options.taskStore) {
        (request as any).taskStore = this.options.taskStore;
      }
      (request as any).customRouteAuthConfig = this.options.customRouteAuthConfig;

      // Create abort controller
      const controller = new AbortController();
      request.raw.on('close', () => {
        if (!request.raw.complete) {
          controller.abort();
        }
      });
      (request as any).abortSignal = controller.signal;
    };
  }

  async stream(route: ServerRoute, reply: FastifyReply, result: unknown): Promise<void> {
    // CRITICAL: Must hijack reply for streaming in Fastify
    reply.hijack();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
    });

    const streamFormat = route.streamFormat || 'stream';
    const readableStream = result instanceof ReadableStream ? result : (result as any).fullStream;
    const reader = readableStream.getReader();

    reply.raw.on('close', () => {
      void reader.cancel('request aborted');
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          const shouldRedact = this.server.streamOptions?.redact ?? true;
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

  async getParams(route: ServerRoute, request: FastifyRequest): Promise<ParsedRequestParams> {
    const urlParams = (request.params || {}) as Record<string, string>;
    const queryParams = normalizeQueryParams((request.query || {}) as Record<string, unknown>);
    let body: unknown;

    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      const contentType = request.headers['content-type'] || '';

      if (contentType.includes('multipart/form-data')) {
        try {
          const maxFileSize = route.maxBodySize ?? this.options.bodyLimitOptions?.maxSize;
          body = await this.parseMultipartFormData(request, maxFileSize);
        } catch (error) {
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

  private parseMultipartFormData(request: FastifyRequest, maxFileSize?: number): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const result: Record<string, unknown> = {};

      const busboy = new Busboy({
        headers: { 'content-type': request.headers['content-type'] as string },
        limits: maxFileSize ? { fileSize: maxFileSize } : undefined,
      });

      busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream) => {
        const chunks: Buffer[] = [];
        let limitExceeded = false;

        file.on('data', (chunk: Buffer) => chunks.push(chunk));
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
        try {
          result[fieldname] = JSON.parse(value);
        } catch {
          result[fieldname] = value;
        }
      });

      busboy.on('finish', () => resolve(result));
      busboy.on('error', (error: Error) => reject(error));

      // CRITICAL: Pipe raw request, not Fastify request
      request.raw.pipe(busboy);
    });
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
      await this.stream(route, reply, result);
    } else if (route.responseType === 'datastream-response') {
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
      if (!request) {
        await reply.status(500).send({ error: 'Request object required for MCP transport' });
        return;
      }

      const { server, httpPath } = result as MCPHttpTransportResult;

      try {
        // CRITICAL: Must hijack for MCP transport
        reply.hijack();

        // Attach parsed body for MCP server
        const rawReq = request.raw as typeof request.raw & { body?: unknown };
        if (request.body !== undefined) {
          rawReq.body = request.body;
        }

        await server.startHTTP({
          url: new URL(request.url, `http://${request.headers.host}`),
          httpPath,
          req: rawReq,
          res: reply.raw,
        });
      } catch {
        if (!reply.raw.headersSent) {
          reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
          reply.raw.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal server error' },
              id: null,
            }),
          );
        }
      }
    } else if (route.responseType === 'mcp-sse') {
      if (!request) {
        await reply.status(500).send({ error: 'Request object required for MCP transport' });
        return;
      }

      const { server, ssePath, messagePath } = result as MCPSseTransportResult;

      try {
        reply.hijack();

        const rawReq = request.raw as typeof request.raw & { body?: unknown };
        if (request.body !== undefined) {
          rawReq.body = request.body;
        }

        await server.startSSE({
          url: new URL(request.url, `http://${request.headers.host}`),
          ssePath,
          messagePath,
          req: rawReq,
          res: reply.raw,
        });
      } catch {
        if (!reply.raw.headersSent) {
          reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
          reply.raw.end(JSON.stringify({ error: 'Error handling MCP SSE request' }));
        }
      }
    } else {
      reply.status(500);
    }
  }

  async registerRoute(route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
    const fullPath = `${prefix}${route.path}`;
    const bodyLimitOptions = this.options.bodyLimitOptions;
    const shouldApplyBodyLimit = bodyLimitOptions && ['POST', 'PUT', 'PATCH'].includes(route.method.toUpperCase());
    const maxSize = route.maxBodySize ?? bodyLimitOptions?.maxSize;

    const config = shouldApplyBodyLimit && maxSize ? { bodyLimit: maxSize } : undefined;

    const handler = async (request: FastifyRequest, reply: FastifyReply) => {
      const params = await this.getParams(route, request);

      // Parse and validate query params
      if (params.queryParams) {
        try {
          params.queryParams = await this.server.parseQueryParams(route, params.queryParams);
        } catch (error) {
          if (error instanceof ZodError) {
            return reply.status(400).send(formatZodError(error, 'query parameters'));
          }
          return reply.status(400).send({
            error: 'Invalid query parameters',
            issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
          });
        }
      }

      // Parse and validate body
      if (params.body) {
        try {
          params.body = await this.server.parseBody(route, params.body);
        } catch (error) {
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
        requestContext: (request as any).requestContext,
        mastra: this.server.mastra,
        tools: (request as any).tools,
        taskStore: (request as any).taskStore,
        abortSignal: (request as any).abortSignal,
      };

      try {
        const result = await route.handler(handlerParams);
        await this.sendResponse(route, reply, result, request);
      } catch (error) {
        let status = 500;
        if (error && typeof error === 'object') {
          if ('status' in error) {
            status = (error as any).status;
          } else if (
            'details' in error &&
            (error as any).details &&
            typeof (error as any).details === 'object' &&
            'status' in (error as any).details
          ) {
            status = (error as any).details.status;
          }
        }
        await reply.status(status).send({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    };

    // CRITICAL: Fastify doesn't support 'ALL' method natively
    if (route.method.toUpperCase() === 'ALL') {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
      for (const method of methods) {
        try {
          this.instance.route({
            method,
            url: fullPath,
            handler,
            config,
          });
        } catch (err) {
          if (err instanceof Error && err.message.includes('already declared')) {
            continue;
          }
          throw err;
        }
      }
    } else {
      this.instance.route({
        method: route.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: fullPath,
        handler,
        config,
      });
    }
  }

  registerContextMiddleware(): void {
    // NOTE: For NestJS with Fastify, we don't override the JSON parser
    // because NestJS's FastifyAdapter registers its own parser during listen().
    // NestJS handles JSON parsing by default, and we work with what it provides.

    // Register multipart parser (we handle it manually with busboy)
    // Use try/catch since NestJS may already have registered some parsers
    try {
      this.instance.addContentTypeParser('multipart/form-data', (_request, _payload, done) => {
        done(null, undefined);
      });
    } catch {
      // Parser may already be registered, ignore
    }

    this.instance.addHook('preHandler', this.createContextMiddleware());
  }

  registerAuthMiddleware(): void {
    const authConfig = this.server.mastra.getServer()?.auth;
    if (!authConfig) {
      return;
    }

    this.instance.addHook('preHandler', fastifyAuthenticationMiddleware);
    this.instance.addHook('preHandler', fastifyAuthorizationMiddleware);
  }
}
