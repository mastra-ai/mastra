import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { Tool } from '@mastra/core/tools';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { MastraServerAdapter } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { Application, NextFunction, Request, Response } from 'express';

// Extend Express types to include Mastra context
declare global {
  namespace Express {
    interface Locals {
      mastra: Mastra;
      requestContext: RequestContext;
      tools: Record<string, Tool>;
      taskStore: InMemoryTaskStore;
      customRouteAuthConfig?: Map<string, boolean>;
      playground?: boolean;
      isDev?: boolean;
    }
  }
}

export class ExpressServerAdapter extends MastraServerAdapter<Application, Request, Response> {
  private tools?: Record<string, Tool>;
  private taskStore: InMemoryTaskStore;
  private customRouteAuthConfig?: Map<string, boolean>;
  private playground?: boolean;
  private isDev?: boolean;

  constructor({
    mastra,
    tools,
    taskStore,
    customRouteAuthConfig,
    playground,
    isDev,
  }: {
    mastra: Mastra;
    tools?: Record<string, Tool>;
    taskStore?: InMemoryTaskStore;
    customRouteAuthConfig?: Map<string, boolean>;
    playground?: boolean;
    isDev?: boolean;
  }) {
    super({ mastra });
    this.tools = tools;
    this.taskStore = taskStore || new InMemoryTaskStore();
    this.customRouteAuthConfig = customRouteAuthConfig;
    this.playground = playground;
    this.isDev = isDev;
  }

  createContextMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Parse request context from request body and add to context
      let requestContext = new RequestContext();

      // Parse request context from request body (POST/PUT)
      if (req.method === 'POST' || req.method === 'PUT') {
        const contentType = req.headers['content-type'];
        if (contentType?.includes('application/json') && req.body) {
          if (req.body.requestContext) {
            requestContext = new RequestContext(Object.entries(req.body.requestContext));
          }
        }
      }

      // Parse request context from query params (GET)
      if (req.method === 'GET') {
        try {
          const encodedRequestContext = req.query.requestContext;
          if (typeof encodedRequestContext === 'string') {
            let parsedRequestContext: Record<string, any> | undefined;
            // Try JSON first
            try {
              parsedRequestContext = JSON.parse(encodedRequestContext);
            } catch {
              // Fallback to base64(JSON)
              try {
                const json = Buffer.from(encodedRequestContext, 'base64').toString('utf-8');
                parsedRequestContext = JSON.parse(json);
              } catch {
                // ignore if still invalid
              }
            }

            if (parsedRequestContext && typeof parsedRequestContext === 'object') {
              requestContext = new RequestContext([
                ...requestContext.entries(),
                ...Object.entries(parsedRequestContext),
              ]);
            }
          }
        } catch {
          // ignore query parsing errors
        }
      }

      // Set context in res.locals
      res.locals.requestContext = requestContext;
      res.locals.mastra = this.mastra;
      res.locals.tools = this.tools || {};
      res.locals.taskStore = this.taskStore;
      res.locals.playground = this.playground === true;
      res.locals.isDev = this.isDev === true;
      res.locals.customRouteAuthConfig = this.customRouteAuthConfig;

      next();
    };
  }
  async stream(route: ServerRoute, res: Response, result: { fullStream: ReadableStream }): Promise<void> {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    const streamMode: 'data' | 'plain' = result instanceof ReadableStream ? 'plain' : 'data';

    const readableStream = result instanceof ReadableStream ? result : result.fullStream;
    const reader = readableStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          if (streamMode === 'data') {
            res.write(`data: ${JSON.stringify(value)}\n\n`);
          } else {
            res.write(JSON.stringify(value) + '\x1E');
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      res.end();
    }
  }

  async getParams(
    route: ServerRoute,
    request: Request,
  ): Promise<{ urlParams: Record<string, string>; queryParams: Record<string, string>; body: unknown }> {
    const urlParams = request.params;
    const queryParams = request.query;
    const body = await request.body;
    return { urlParams, queryParams: queryParams as Record<string, string>, body };
  }

  async sendResponse(route: ServerRoute, response: Response, result: unknown): Promise<void> {
    if (route.responseType === 'json') {
      response.json(result);
    } else if (route.responseType === 'stream') {
      await this.stream(route, response, result as { fullStream: ReadableStream });
    } else {
      response.sendStatus(500);
    }
  }

  async registerRoute(app: Application, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
    app[route.method.toLowerCase() as keyof Application](
      `${prefix}${route.path}`,
      async (req: Request, res: Response) => {
        console.log('got request', req.method, req.url);
        const params = await this.getParams(route, req);

        if (params.queryParams) {
          try {
            params.queryParams = await this.parseQueryParams(route, params.queryParams as Record<string, string>);
          } catch (error) {
            console.error('Error parsing query params', error);
            return res.status(500).json({ error: 'Internal server error' });
          }
        }

        if (params.body) {
          try {
            params.body = await this.parseBody(route, params.body);
          } catch (error) {
            console.error('Error parsing body', error);
            return res.status(500).json({ error: 'Internal server error' });
          }
        }

        const handlerParams = {
          ...params.urlParams,
          ...params.queryParams,
          body: params.body,
          ...(typeof params.body === 'object' ? params.body : {}),
          requestContext: res.locals.requestContext,
          mastra: this.mastra,
          tools: res.locals.tools,
          taskStore: res.locals.taskStore,
        };

        console.dir({ params }, { depth: null });
        const result = await route.handler(handlerParams);
        console.dir({ result }, { depth: null });
        await this.sendResponse(route, res, result);
      },
    );
  }

  async registerRoutes(
    app: Application,
    { prefix, openapiPath }: { prefix?: string; openapiPath?: string },
  ): Promise<void> {
    await super.registerRoutes(app, { prefix, openapiPath });
  }
}
