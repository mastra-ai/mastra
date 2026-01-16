import { Busboy } from '@fastify/busboy';
import { formatZodError } from '@mastra/server/handlers/error';
import type { MCPHttpTransportResult, MCPSseTransportResult } from '@mastra/server/handlers/mcp';
import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';
import { normalizeQueryParams, redactStreamChunk } from '@mastra/server/server-adapter';
import type { Application, NextFunction, Request, Response } from 'express';
import express from 'express';
import { ZodError } from 'zod';

import type { MastraServerOptions, PlatformAdapter, PlatformType } from '../types';

import { expressAuthenticationMiddleware, expressAuthorizationMiddleware } from './express-auth';

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
 * Express platform adapter for NestJS.
 * Handles all Express-specific request/response handling.
 */
export class ExpressPlatformAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'express';
  private server: MastraServerInternal;
  private options: MastraServerOptions;
  private instance: Application;

  constructor(server: unknown, options: MastraServerOptions) {
    this.server = server as MastraServerInternal;
    this.options = options;
    this.instance = options.app.getHttpAdapter().getInstance() as Application;
  }

  getInstance(): Application {
    return this.instance;
  }

  createContextMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      let bodyRequestContext: Record<string, any> | undefined;
      let paramsRequestContext: Record<string, any> | undefined;

      // Parse request context from POST/PUT body
      if (req.method === 'POST' || req.method === 'PUT') {
        const contentType = req.headers['content-type'];
        if (contentType?.includes('application/json') && req.body?.requestContext) {
          bodyRequestContext = req.body.requestContext;
        }
      }

      // Parse request context from GET query params
      if (req.method === 'GET') {
        try {
          const encodedRequestContext = req.query.requestContext;
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

      // Store context in res.locals (Express pattern)
      res.locals.mastra = this.server.mastra;
      res.locals.requestContext = requestContext;
      res.locals.tools = this.options.tools || {};
      if (this.options.taskStore) {
        res.locals.taskStore = this.options.taskStore;
      }
      res.locals.customRouteAuthConfig = this.options.customRouteAuthConfig;

      // Create abort controller
      const controller = new AbortController();
      res.on('close', () => {
        if (!res.writableFinished) {
          controller.abort();
        }
      });
      res.locals.abortSignal = controller.signal;

      next();
    };
  }

  async stream(route: ServerRoute, res: Response, result: unknown): Promise<void> {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    const streamFormat = route.streamFormat || 'stream';
    const readableStream = result instanceof ReadableStream ? result : (result as any).fullStream;
    const reader = readableStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          const shouldRedact = this.server.streamOptions?.redact ?? true;
          const outputValue = shouldRedact ? redactStreamChunk(value) : value;
          if (streamFormat === 'sse') {
            res.write(`data: ${JSON.stringify(outputValue)}\n\n`);
          } else {
            res.write(JSON.stringify(outputValue) + '\x1E');
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      res.end();
    }
  }

  async getParams(route: ServerRoute, request: Request): Promise<ParsedRequestParams> {
    const urlParams = request.params;
    const queryParams = normalizeQueryParams(request.query as Record<string, unknown>);
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

  private parseMultipartFormData(request: Request, maxFileSize?: number): Promise<Record<string, unknown>> {
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

      request.pipe(busboy);
    });
  }

  async sendResponse(route: ServerRoute, response: Response, result: unknown, request?: Request): Promise<void> {
    if (route.responseType === 'json') {
      response.json(result);
    } else if (route.responseType === 'stream') {
      await this.stream(route, response, result);
    } else if (route.responseType === 'datastream-response') {
      const fetchResponse = result as globalThis.Response;
      fetchResponse.headers.forEach((value, key) => response.setHeader(key, value));
      response.status(fetchResponse.status);
      if (fetchResponse.body) {
        const reader = fetchResponse.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            response.write(value);
          }
        } finally {
          response.end();
        }
      } else {
        response.end();
      }
    } else if (route.responseType === 'mcp-http') {
      if (!request) {
        response.status(500).json({ error: 'Request object required for MCP transport' });
        return;
      }

      const { server, httpPath } = result as MCPHttpTransportResult;

      try {
        await server.startHTTP({
          url: new URL(request.url, `http://${request.headers.host}`),
          httpPath,
          req: request,
          res: response,
        });
      } catch {
        if (!response.headersSent) {
          response.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    } else if (route.responseType === 'mcp-sse') {
      if (!request) {
        response.status(500).json({ error: 'Request object required for MCP transport' });
        return;
      }

      const { server, ssePath, messagePath } = result as MCPSseTransportResult;

      try {
        await server.startSSE({
          url: new URL(request.url, `http://${request.headers.host}`),
          ssePath,
          messagePath,
          req: request,
          res: response,
        });
      } catch {
        if (!response.headersSent) {
          response.status(500).json({ error: 'Error handling MCP SSE request' });
        }
      }
    } else {
      response.sendStatus(500);
    }
  }

  async registerRoute(route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
    const bodyLimitOptions = this.options.bodyLimitOptions;
    const shouldApplyBodyLimit = bodyLimitOptions && ['POST', 'PUT', 'PATCH'].includes(route.method.toUpperCase());
    const maxSize = route.maxBodySize ?? bodyLimitOptions?.maxSize;

    const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

    // Add body limit middleware if needed
    if (shouldApplyBodyLimit && maxSize && bodyLimitOptions) {
      middlewares.push((req: Request, res: Response, next: NextFunction) => {
        const contentLength = req.headers['content-length'];
        if (contentLength && parseInt(contentLength, 10) > maxSize) {
          try {
            const errorResponse = bodyLimitOptions.onError({ error: 'Request body too large' });
            return res.status(413).json(errorResponse);
          } catch {
            return res.status(413).json({ error: 'Request body too large' });
          }
        }
        next();
      });
    }

    const handler = async (req: Request, res: Response) => {
      const params = await this.getParams(route, req);

      // Parse and validate query params
      if (params.queryParams) {
        try {
          params.queryParams = await this.server.parseQueryParams(route, params.queryParams);
        } catch (error) {
          if (error instanceof ZodError) {
            return res.status(400).json(formatZodError(error, 'query parameters'));
          }
          return res.status(400).json({
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
            return res.status(400).json(formatZodError(error, 'request body'));
          }
          return res.status(400).json({
            error: 'Invalid request body',
            issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
          });
        }
      }

      const handlerParams = {
        ...params.urlParams,
        ...params.queryParams,
        ...(typeof params.body === 'object' ? params.body : {}),
        requestContext: res.locals.requestContext,
        mastra: this.server.mastra,
        tools: res.locals.tools,
        taskStore: res.locals.taskStore,
        abortSignal: res.locals.abortSignal,
      };

      try {
        const result = await route.handler(handlerParams);
        await this.sendResponse(route, res, result, req);
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
        res.status(status).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    };

    const path = `${prefix}${route.path}`;
    const method = route.method.toLowerCase();

    // Register route with Express
    if (middlewares.length > 0) {
      (this.instance as any)[method](path, ...middlewares, handler);
    } else {
      (this.instance as any)[method](path, handler);
    }
  }

  registerContextMiddleware(): void {
    // Add JSON body parser before context middleware
    // NestJS may not have body parsing configured when using raw HTTP adapter
    this.instance.use(express.json());
    this.instance.use(this.createContextMiddleware() as any);
  }

  registerAuthMiddleware(): void {
    const authConfig = this.server.mastra.getServer()?.auth;
    if (!authConfig) {
      return;
    }

    this.instance.use(expressAuthenticationMiddleware as any);
    this.instance.use(expressAuthorizationMiddleware as any);
  }
}
