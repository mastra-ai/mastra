import type { Mastra } from '@mastra/core/mastra';
import { SERVER_ROUTES } from './routes';
import type { ServerRoute } from './routes';

export * from './routes';

export abstract class MastraServerAdapter<TApp, TRequest, TResponse> {
  protected mastra: Mastra;

  constructor({ mastra }: { mastra: Mastra }) {
    this.mastra = mastra;
  }

  abstract stream(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract getParams(
    route: ServerRoute,
    request: TRequest,
  ): Promise<{ urlParams: Record<string, string>; queryParams: Record<string, string>; body: unknown }>;
  abstract sendResponse(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract registerRoute(app: TApp, route: ServerRoute): Promise<void>;

  async registerRoutes(app: TApp): Promise<void> {
    await Promise.all(SERVER_ROUTES.map(route => this.registerRoute(app, route)));
  }

  async parseQueryParams(route: ServerRoute, params: Record<string, string>): Promise<Record<string, any>> {
    const queryParamSchema = route.queryParamSchema;
    if (!queryParamSchema) {
      return params;
    }

    return queryParamSchema.parseAsync(params);
  }

  async parseBody(route: ServerRoute, body: unknown): Promise<unknown> {
    const bodySchema = route.bodySchema;
    if (!bodySchema) {
      return body;
    }

    return bodySchema.parseAsync(body);
  }
}
