import { RequestContext } from '@mastra/core/request-context';
import { MastraServerAdapter } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { Context, Hono, HonoRequest, Next } from 'hono';
import { stream } from 'hono/streaming';

export class HonoServerAdapter extends MastraServerAdapter<Hono, HonoRequest, Context> {
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
      body = await request.json();
    }
    return { urlParams, queryParams: queryParams as Record<string, string>, body };
  }

  async sendResponse(route: ServerRoute, response: Context, result: unknown): Promise<any> {
    if (route.responseType === 'json') {
      return response.json(result as any);
    } else if (route.responseType === 'stream') {
      return this.stream(route, response, result as { fullStream: ReadableStream });
    } else {
      return response.status(500);
    }
  }

  async registerRoute(app: Hono, route: ServerRoute): Promise<void> {
    console.log('registering route', route);
    app[route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'all'](
      route.path,
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
        };

        console.dir({ params }, { depth: null });
        const result = await route.handler(handlerParams);
        console.dir({ result }, { depth: null });
        return this.sendResponse(route, c, result);
      },
    );
  }

  async registerRoutes(app: Hono): Promise<void> {
    app.use('*', async (c: Context, next: Next) => {
      c.set('requestContext', new RequestContext());
      return next();
    });

    await super.registerRoutes(app);
  }
}
