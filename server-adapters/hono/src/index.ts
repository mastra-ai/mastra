import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { Tool } from '@mastra/core/tools';
import { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { MastraServerAdapter } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { Context, Env, Hono, HonoRequest, MiddlewareHandler } from 'hono';
import { stream } from 'hono/streaming';

// Export type definitions for Hono app configuration
export type HonoVariables = {
  mastra: Mastra;
  requestContext: RequestContext;
  tools: Record<string, Tool>;
  taskStore: InMemoryTaskStore;
  customRouteAuthConfig?: Map<string, boolean>;
  playground?: boolean;
  isDev?: boolean;
};

export type HonoBindings = {};

export class HonoServerAdapter extends MastraServerAdapter<Hono<any, any, any>, HonoRequest, Context> {
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

  createContextMiddleware(): MiddlewareHandler {
    return async (c, next) => {
      // Parse request context from request body and add to context
      let requestContext = new RequestContext();

      // Parse request context from request body (POST/PUT)
      if (c.req.method === 'POST' || c.req.method === 'PUT') {
        const contentType = c.req.header('content-type');
        if (contentType?.includes('application/json')) {
          try {
            const clonedReq = c.req.raw.clone();
            const body = (await clonedReq.json()) as { requestContext?: Record<string, any> };
            if (body.requestContext) {
              requestContext = new RequestContext(Object.entries(body.requestContext));
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

      // Add relevant contexts to hono context
      c.set('requestContext', requestContext);
      c.set('mastra', this.mastra);
      c.set('tools', this.tools || {});
      c.set('taskStore', this.taskStore);
      c.set('playground', this.playground === true);
      c.set('isDev', this.isDev === true);
      c.set('customRouteAuthConfig', this.customRouteAuthConfig);

      return next();
    };
  }
  async stream(route: ServerRoute, res: Context, result: { fullStream: ReadableStream }): Promise<any> {
    res.header('Content-Type', 'text/plain');
    res.header('Transfer-Encoding', 'chunked');

    const streamMode: 'data' | 'plain' = result instanceof ReadableStream ? 'plain' : 'data';

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
              if (streamMode === 'data') {
                await stream.write(`data: ${JSON.stringify(value)}\n\n`);
              } else {
                await stream.write(JSON.stringify(value) + '\x1E');
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

  async getParams(
    route: ServerRoute,
    request: HonoRequest,
  ): Promise<{ urlParams: Record<string, string>; queryParams: Record<string, string>; body: unknown }> {
    const urlParams = request.param();
    const queryParams = request.query();
    let body: unknown;
    if (route.method === 'POST' || route.method === 'PUT') {
      try {
        body = await request.json();
      } catch {}
    }
    return { urlParams, queryParams: queryParams as Record<string, string>, body };
  }

  async sendResponse(route: ServerRoute, response: Context, result: unknown): Promise<any> {
    if (route.responseType === 'json') {
      return response.json(result as any, 200);
    } else if (route.responseType === 'stream') {
      return this.stream(route, response, result as { fullStream: ReadableStream });
    } else {
      return response.status(500);
    }
  }

  async registerRoute<E extends Env = any>(
    app: Hono<E, any, any>,
    route: ServerRoute,
    { prefix }: { prefix?: string },
  ): Promise<void> {
    app[route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'all'](
      `${prefix}${route.path}`,
      async (c: Context) => {
        const params = await this.getParams(route, c.req);

        if (params.queryParams) {
          try {
            params.queryParams = await this.parseQueryParams(route, params.queryParams as Record<string, string>);
          } catch (error) {
            console.error('Error parsing query params', error);
            return c.status(500);
          }
        }

        if (params.body) {
          try {
            params.body = await this.parseBody(route, params.body);
          } catch (error) {
            console.error('Error parsing body', error);
            return c.status(500);
          }
        }

        const handlerParams = {
          ...params.urlParams,
          ...params.queryParams,
          body: params.body,
          ...(typeof params.body === 'object' ? params.body : {}),
          requestContext: c.get('requestContext'),
          mastra: this.mastra,
          tools: c.get('tools'),
          taskStore: c.get('taskStore'),
        };

        try {
          const result = await route.handler(handlerParams);
          return this.sendResponse(route, c, result);
        } catch (error) {
          console.error('Error calling handler', error);
          return c.status(500);
        }
      },
    );
  }

  async registerRoutes<E extends Env = any>(
    app: Hono<E, any, any>,
    { prefix, openapiPath }: { prefix?: string; openapiPath?: string },
  ): Promise<void> {
    // Cast to base type for super call - safe because registerRoute is generic
    await super.registerRoutes(app as any, { prefix, openapiPath });
  }
}
