import { RequestContext } from '@mastra/core/request-context';
import { MastraServerAdapter } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { Application, NextFunction, Request, Response } from 'express';

export class ExpressServerAdapter extends MastraServerAdapter<Application, Request, Response> {
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

  async registerRoute(app: Application, route: ServerRoute): Promise<void> {
    app[route.method.toLowerCase() as keyof Application](route.path, async (req: Request, res: Response) => {
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
      };

      console.dir({ params }, { depth: null });
      const result = await route.handler(handlerParams);
      console.dir({ result }, { depth: null });
      await this.sendResponse(route, res, result);
    });
  }

  async registerRoutes(app: Application): Promise<void> {
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      res.locals.requestContext = new RequestContext();
      next();
    });
    await super.registerRoutes(app);
  }
}
