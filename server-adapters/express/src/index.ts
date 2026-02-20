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
import type { Application, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { authenticationMiddleware, authorizationMiddleware } from './auth-middleware';

// Extend Express types to include Mastra context
declare global {
  namespace Express {
    interface Locals {
      mastra: Mastra;
      requestContext: RequestContext;
      abortSignal: AbortSignal;
      registeredTools: ToolsInput;
      taskStore: InMemoryTaskStore;
      customRouteAuthConfig?: Map<string, boolean>;
    }
  }
}

export class MastraServer extends MastraServerBase<Application, Request, Response> {
  createContextMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Parse request context from request body and add to context
      let bodyRequestContext: Record<string, any> | undefined;
      let paramsRequestContext: Record<string, any> | undefined;

      // Parse request context from request body (POST/PUT)
      if (req.method === 'POST' || req.method === 'PUT') {
        const contentType = req.headers['content-type'];
        if (contentType?.includes('application/json') && req.body) {
          if (req.body.requestContext) {
            bodyRequestContext = req.body.requestContext;
          }
        }
      }

      // Parse request context from query params (GET)
      if (req.method === 'GET') {
        try {
          const encodedRequestContext = req.query.requestContext;
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

      // Set context in res.locals
      res.locals.requestContext = requestContext;
      res.locals.mastra = this.mastra;
      res.locals.registeredTools = this.tools || {};
      if (this.taskStore) {
        res.locals.taskStore = this.taskStore;
      }
      res.locals.customRouteAuthConfig = this.customRouteAuthConfig;
      const controller = new AbortController();
      // Use res.on('close') instead of req.on('close') because the request's 'close' event
      // fires when the request body is fully consumed (e.g., after express.json() parses it),
      // NOT when the client disconnects. The response's 'close' event fires when the underlying
      // connection is actually closed, which is the correct signal for client disconnection.
      res.on('close', () => {
        // Only abort if the response wasn't successfully completed
        if (!res.writableFinished) {
          controller.abort();
        }
      });
      res.locals.abortSignal = controller.signal;
      next();
    };
  }
  async stream(route: ServerRoute, res: Response, result: { fullStream: ReadableStream }): Promise<void> {
    const streamFormat = route.streamFormat || 'stream';

    if (streamFormat === 'sse') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders();

    const readableStream = result instanceof ReadableStream ? result : result.fullStream;
    const reader = readableStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          // Optionally redact sensitive data (system prompts, tool definitions, API keys) before sending to the client
          const shouldRedact = this.streamOptions?.redact ?? true;
          const outputValue = shouldRedact ? redactStreamChunk(value) : value;
          if (streamFormat === 'sse') {
            res.write(`data: ${JSON.stringify(outputValue)}\n\n`);
          } else {
            res.write(JSON.stringify(outputValue) + '\x1E');
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

  async getParams(route: ServerRoute, request: Request): Promise<ParsedRequestParams> {
    const urlParams = request.params;
    // Express's req.query can contain string | string[] | ParsedQs | ParsedQs[]
    const queryParams = normalizeQueryParams(request.query as Record<string, unknown>);
    let body: unknown;
    let bodyParseError: { message: string } | undefined;

    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH' || route.method === 'DELETE') {
      const contentType = request.headers['content-type'] || '';

      if (contentType.includes('multipart/form-data')) {
        try {
          const maxFileSize = route.maxBodySize ?? this.bodyLimitOptions?.maxSize;
          body = await this.parseMultipartFormData(request, maxFileSize);
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
        body = request.body;
      }
    }

    return { urlParams, queryParams, body, bodyParseError };
  }

  /**
   * Parse multipart/form-data using @fastify/busboy.
   * Converts file uploads to Buffers and parses JSON field values.
   *
   * @param request - The Express request object
   * @param maxFileSize - Optional maximum file size in bytes
   */
  private parseMultipartFormData(request: Request, maxFileSize?: number): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const result: Record<string, unknown> = {};

      const busboy = new Busboy({
        headers: {
          'content-type': request.headers['content-type'] as string,
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

      request.pipe(busboy);
    });
  }

  async sendResponse(
    route: ServerRoute,
    response: Response,
    result: unknown,
    request?: Request,
    prefix?: string,
  ): Promise<void> {
    const resolvedPrefix = prefix ?? this.prefix ?? '';

    if (route.responseType === 'json') {
      response.json(result);
    } else if (route.responseType === 'stream') {
      await this.stream(route, response, result as { fullStream: ReadableStream });
    } else if (route.responseType === 'datastream-response') {
      // Handle AI SDK Response objects - pipe Response.body to Express response
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
      // MCP Streamable HTTP transport - request is required
      if (!request) {
        response.status(500).json({ error: 'Request object required for MCP transport' });
        return;
      }

      const { server, httpPath, mcpOptions: routeMcpOptions } = result as MCPHttpTransportResult;

      try {
        // Merge class-level mcpOptions with route-specific options (route takes precedence)
        const options = { ...this.mcpOptions, ...routeMcpOptions };

        await server.startHTTP({
          url: new URL(request.url, `http://${request.headers.host}`),
          httpPath: `${resolvedPrefix}${httpPath}`,
          req: request,
          res: response,
          options: Object.keys(options).length > 0 ? options : undefined,
        });
        // Response handled by startHTTP
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
      // MCP SSE transport - request is required
      if (!request) {
        response.status(500).json({ error: 'Request object required for MCP transport' });
        return;
      }

      const { server, ssePath, messagePath } = result as MCPSseTransportResult;

      try {
        await server.startSSE({
          url: new URL(request.url, `http://${request.headers.host}`),
          ssePath: `${resolvedPrefix}${ssePath}`,
          messagePath: `${resolvedPrefix}${messagePath}`,
          req: request,
          res: response,
        });
        // Response handled by startSSE
      } catch {
        if (!response.headersSent) {
          response.status(500).json({ error: 'Error handling MCP SSE request' });
        }
      }
    } else {
      response.sendStatus(500);
    }
  }

  async registerRoute(
    app: Application,
    route: ServerRoute,
    { prefix: prefixParam }: { prefix?: string } = {},
  ): Promise<void> {
    // Default prefix to this.prefix if not provided, or empty string
    const prefix = prefixParam ?? this.prefix ?? '';

    // Determine if body limits should be applied
    const shouldApplyBodyLimit = this.bodyLimitOptions && ['POST', 'PUT', 'PATCH'].includes(route.method.toUpperCase());

    // Get the body size limit for this route (route-specific or default)
    const maxSize = route.maxBodySize ?? this.bodyLimitOptions?.maxSize;

    // Create middleware array
    const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

    // Add body limit middleware if needed
    if (shouldApplyBodyLimit && maxSize && this.bodyLimitOptions) {
      const bodyLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
        const contentLength = req.headers['content-length'];
        if (contentLength && parseInt(contentLength, 10) > maxSize) {
          try {
            const errorResponse = this.bodyLimitOptions!.onError({ error: 'Request body too large' });
            return res.status(413).json(errorResponse);
          } catch {
            return res.status(413).json({ error: 'Request body too large' });
          }
        }
        next();
      };
      middlewares.push(bodyLimitMiddleware);
    }

    app[route.method.toLowerCase() as keyof Application](
      `${prefix}${route.path}`,
      ...middlewares,
      async (req: Request, res: Response) => {
        // Check route-level authentication/authorization
        const authError = await this.checkRouteAuth(route, {
          path: String(req.path || '/'),
          method: String(req.method || 'GET'),
          getHeader: name => req.headers[name.toLowerCase()] as string | undefined,
          getQuery: name => req.query[name] as string | undefined,
          requestContext: res.locals.requestContext,
        });

        if (authError) {
          return res.status(authError.status).json({ error: authError.error });
        }

        const params = await this.getParams(route, req);

        // Return 400 Bad Request if body parsing failed (e.g., malformed multipart data)
        if (params.bodyParseError) {
          return res.status(400).json({
            error: 'Invalid request body',
            issues: [{ field: 'body', message: params.bodyParseError.message }],
          });
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
              return res.status(400).json(formatZodError(error, 'query parameters'));
            }
            return res.status(400).json({
              error: 'Invalid query parameters',
              issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
            });
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
              return res.status(400).json(formatZodError(error, 'request body'));
            }
            return res.status(400).json({
              error: 'Invalid request body',
              issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
            });
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
              return res.status(400).json(formatZodError(error, 'path parameters'));
            }
            return res.status(400).json({
              error: 'Invalid path parameters',
              issues: [{ field: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' }],
            });
          }
        }

        const handlerParams = {
          ...params.urlParams,
          ...params.queryParams,
          ...(typeof params.body === 'object' ? params.body : {}),
          requestContext: res.locals.requestContext,
          mastra: this.mastra,
          registeredTools: res.locals.registeredTools,
          taskStore: res.locals.taskStore,
          abortSignal: res.locals.abortSignal,
          routePrefix: prefix,
        };

        try {
          const result = await route.handler(handlerParams);
          await this.sendResponse(route, res, result, req, prefix);
        } catch (error) {
          this.mastra.getLogger()?.error('Error calling handler', {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            path: route.path,
            method: route.method,
          });
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
          res.status(status).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
      },
    );
  }

  async registerCustomApiRoutes(): Promise<void> {
    if (!(await this.buildCustomRouteHandler())) return;

    this.app.use(async (req: Request, res: Response, next: NextFunction) => {
      const response = await this.handleCustomRouteRequest(
        `${req.protocol}://${req.get('host') || 'localhost'}${req.originalUrl}`,
        req.method,
        req.headers as Record<string, string | string[] | undefined>,
        req.body,
        res.locals.requestContext,
      );
      if (!response) return next();
      await this.writeCustomRouteResponse(response, res);
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
