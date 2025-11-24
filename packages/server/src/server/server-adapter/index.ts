import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { Tool } from '@mastra/core/tools';
import type { InMemoryTaskStore } from '../a2a/store';
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

export abstract class MastraServerBase<TApp, TRequest, TResponse> {
  protected mastra: Mastra;
  protected bodyLimitOptions?: BodyLimitOptions;
  protected tools?: Record<string, Tool>;
  protected app: TApp;
  protected prefix?: string;
  protected openapiPath?: string;
  protected taskStore?: InMemoryTaskStore;
  protected playground?: boolean;
  protected isDev?: boolean;
  protected customRouteAuthConfig?: Map<string, boolean>;

  constructor({
    app,
    mastra,
    bodyLimitOptions,
    tools,
    prefix = '',
    openapiPath = '',
    taskStore,
    playground = false,
    isDev = false,
    customRouteAuthConfig,
  }: {
    app: TApp;
    mastra: Mastra;
    bodyLimitOptions?: BodyLimitOptions;
    tools?: Record<string, Tool>;
    prefix?: string;
    openapiPath?: string;
    taskStore?: InMemoryTaskStore;
    playground?: boolean;
    isDev?: boolean;
    customRouteAuthConfig?: Map<string, boolean>;
  }) {
    this.mastra = mastra;
    this.bodyLimitOptions = bodyLimitOptions;
    this.tools = tools;
    this.app = app;
    this.prefix = prefix;
    this.openapiPath = openapiPath;
    this.taskStore = taskStore;
    this.playground = playground;
    this.isDev = isDev;
    this.customRouteAuthConfig = customRouteAuthConfig;
  }

  protected mergeRequestContext({
    paramsRequestContext,
    bodyRequestContext,
  }: {
    paramsRequestContext?: Record<string, any>;
    bodyRequestContext?: Record<string, any>;
  }): RequestContext {
    const requestContext = new RequestContext();
    if (bodyRequestContext) {
      for (const [key, value] of Object.entries(bodyRequestContext)) {
        requestContext.set(key, value);
      }
    }
    if (paramsRequestContext) {
      for (const [key, value] of Object.entries(paramsRequestContext)) {
        requestContext.set(key, value);
      }
    }
    return requestContext;
  }

  abstract stream(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract getParams(
    route: ServerRoute,
    request: TRequest,
  ): Promise<{ urlParams: Record<string, string>; queryParams: Record<string, string>; body: unknown }>;
  abstract sendResponse(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract registerRoute(app: TApp, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void>;
  abstract registerContextMiddleware(): void;
  abstract registerAuthMiddleware(): void;

  async init() {
    this.registerContextMiddleware();
    this.registerAuthMiddleware();
    await this.registerRoutes();
  }

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

  async registerRoutes(): Promise<void> {
    await Promise.all(SERVER_ROUTES.map(route => this.registerRoute(this.app, route, { prefix: this.prefix })));

    if (this.openapiPath) {
      await this.registerOpenAPIRoute(
        this.app,
        {
          title: 'Mastra API',
          version: '1.0.0',
          description: 'Mastra Server API',
          path: `${this.prefix}${this.openapiPath}`,
        },
        { prefix: this.prefix },
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
