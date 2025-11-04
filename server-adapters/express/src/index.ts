import { RequestContext } from '@mastra/core/request-context';
import { MastraServerAdapter } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { Application, NextFunction, Request, Response } from 'express';

export class ExpressServerAdapter extends MastraServerAdapter<Application, Request, Response> {
  async stream(route: ServerRoute, res: Response, result: { fullStream: ReadableStream }): Promise<void> {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    const readableStream = result.fullStream;
    const reader = readableStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          console.log('WRITING', JSON.stringify(value));
          res.write(`data: ${JSON.stringify(value)}\n\n`);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      res.end();
    }
  }

  async getParams(route: ServerRoute, request: Request): Promise<Record<string, unknown>> {
    const urlParams = request.params;
    const body = await request.body;
    return { ...urlParams, body };
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
    console.log('registering route', route);
    app[route.method.toLowerCase() as keyof Application](route.path, async (req: Request, res: Response) => {
      const params = await this.getParams(route, req);
      console.dir({ params }, { depth: null });
      const result = await route.handler({ ...params, requestContext: res.locals.requestContext, mastra: this.mastra });
      console.dir({ result }, { depth: null });
      await this.sendResponse(route, res, result);
    });
  }

  async registerRoutes(app: Application): Promise<void> {
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      res.locals.requestContext = new RequestContext();
      next();
    });
    super.registerRoutes(app);
  }
}
