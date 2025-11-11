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

export interface BodyLimitOptions {
  maxSize: number;
  onError: (error: unknown) => unknown;
}

export abstract class MastraServerAdapter<TApp, TRequest, TResponse> {
  protected mastra: Mastra;
  protected bodyLimitOptions?: BodyLimitOptions;

  constructor({ mastra, bodyLimitOptions }: { mastra: Mastra; bodyLimitOptions?: BodyLimitOptions }) {
    this.mastra = mastra;
    this.bodyLimitOptions = bodyLimitOptions;
  }

  abstract stream(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract getParams(
    route: ServerRoute,
    request: TRequest,
  ): Promise<{ urlParams: Record<string, string>; queryParams: Record<string, string>; body: unknown }>;
  abstract sendResponse(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract registerRoute(app: TApp, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void>;

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

    const normalized = this.normalizeQueryParams(params);
    return queryParamSchema.parseAsync(normalized);
  }

  async parseBody(route: ServerRoute, body: unknown): Promise<unknown> {
    const bodySchema = route.bodySchema;
    if (!bodySchema) {
      return body;
    }

    return bodySchema.parseAsync(body);
  }

  private normalizeQueryParams(params: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = {};

    const assignNested = (target: Record<string, any>, keys: string[], value: string) => {
      const [currentKey, ...rest] = keys;
      if (!currentKey) {
        return;
      }

      if (rest.length === 0) {
        target[currentKey] = this.coerceQueryValue(value);
        return;
      }

      if (typeof target[currentKey] !== 'object' || target[currentKey] === null) {
        target[currentKey] = {};
      }

      assignNested(target[currentKey], rest, value);
    };

    for (const [key, value] of Object.entries(params)) {
      const parts = key
        .replace(/\]/g, '')
        .split(/[.[\[]+/)
        .filter(Boolean);

      if (parts.length === 0) {
        continue;
      }

      assignNested(result, parts, value);
    }

    return result;
  }

  private coerceQueryValue(value: string): unknown {
    const trimmed = value.trim();
    if (trimmed === '') {
      return '';
    }

    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isNaN(numeric) ? value : numeric;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' || Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // ignore parse errors
    }

    return value;
  }
}
