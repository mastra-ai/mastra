import type { Mastra } from '@mastra/core/mastra';
import { SERVER_ROUTES } from './routes';
import type { ServerRoute } from './routes';
import { generateOpenAPIDocument } from './openapi-utils';

export * from './routes';

export interface OpenAPIConfig {
  title?: string;
  version?: string;
  description?: string;
  path?: string;
}

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

  async registerOpenAPIRoute(app: TApp, config: OpenAPIConfig = {}): Promise<void> {
    const { title = 'Mastra API', version = '1.0.0', description = 'Mastra Server API', path = '/openapi.json' } =
      config;

    const openApiSpec = generateOpenAPIDocument(SERVER_ROUTES, {
      title,
      version,
      description,
    });

    const openApiRoute: ServerRoute = {
      method: 'GET',
      path,
      responseType: 'json',
      handler: async () => openApiSpec,
    };

    await this.registerRoute(app, openApiRoute);
  }

  async registerRoutes(app: TApp): Promise<void> {
    await Promise.all(SERVER_ROUTES.map(route => this.registerRoute(app, route)));
    await this.registerOpenAPIRoute(app, {
      title: 'Mastra API',
      version: '1.0.0',
      description: 'Mastra Server API',
      path: '/openapi.json',
    });
  }

  async parsePathParams(route: ServerRoute, params: Record<string, string>): Promise<Record<string, any>> {
    const pathParamSchema = route.pathParamSchema;
    if (!pathParamSchema) {
      return params;
    }

    return pathParamSchema.parseAsync(params);
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
