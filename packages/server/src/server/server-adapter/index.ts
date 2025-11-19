import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { Tool } from '@mastra/core/tools';
import { generateOpenAPIDocument } from './openapi-utils';
import { SERVER_ROUTES } from './routes';
import type { ServerRoute } from './routes';

export * from './routes';

export { WorkflowRegistry } from '../utils';

export interface OpenAPIConfig {
  title?: string;
  version?: string;
  description?: string;
  path?: string;
}

export interface BodyLimitOptions {
  maxSize: number;
  onError: (error: unknown) => unknown;
}

export abstract class MastraServerAdapter<TApp, TRequest, TResponse> {
  protected mastra: Mastra;
  protected bodyLimitOptions?: BodyLimitOptions;
  protected tools?: Record<string, Tool>;

  constructor({
    mastra,
    bodyLimitOptions,
    tools,
  }: {
    mastra: Mastra;
    bodyLimitOptions?: BodyLimitOptions;
    tools?: Record<string, Tool>;
  }) {
    this.mastra = mastra;
    this.bodyLimitOptions = bodyLimitOptions;
    this.tools = tools;
  }

  protected mergeRequestContext({
    paramsRequestContext,
    bodyRequestContext,
  }: {
    paramsRequestContext: Record<string, any>;
    bodyRequestContext: Record<string, any>;
  }): RequestContext {
    return new RequestContext([
      ...Array.from(Object.entries(bodyRequestContext)),
      ...Array.from(Object.entries(paramsRequestContext)),
    ]);
  }

  abstract stream(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract getParams(
    route: ServerRoute,
    request: TRequest,
  ): Promise<{ urlParams: Record<string, string>; queryParams: Record<string, string>; body: unknown }>;
  abstract sendResponse(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract registerRoute(app: TApp, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void>;
  abstract registerContextMiddleware(app: TApp): void;

  async registerOpenAPIRoute(app: TApp, config: OpenAPIConfig = {}, { prefix }: { prefix?: string }): Promise<void> {
    const {
      title = 'Mastra API',
      version = '1.0.0',
      description = 'Mastra Server API',
      path = '/openapi.json',
    } = config;

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

    await this.registerRoute(app, openApiRoute, { prefix });
  }

  async registerRoutes(
    app: TApp,
    {
      prefix = '',
      openapiPath = '',
    }: {
      prefix?: string;
      openapiPath?: string;
    } = {},
  ): Promise<void> {
    await Promise.all(SERVER_ROUTES.map(route => this.registerRoute(app, route, { prefix })));

    if (openapiPath) {
      await this.registerOpenAPIRoute(
        app,
        {
          title: 'Mastra API',
          version: '1.0.0',
          description: 'Mastra Server API',
          path: `${prefix}${openapiPath}`,
        },
        { prefix },
      );
    }
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
