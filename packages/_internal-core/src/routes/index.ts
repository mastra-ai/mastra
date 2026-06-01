import type * as z from 'zod/v4';
import type { RequestContext } from '../request-context';
import type { ToolsInput } from '../types';

export interface OpenAPIRoute {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  requestParams?: {
    path?: z.ZodSchema;
    query?: z.ZodSchema;
  };
  requestBody?: {
    content: {
      'application/json': {
        schema: z.ZodSchema;
      };
    };
  };
  responses: {
    [statusCode: string]: {
      description: string;
      content?: {
        'application/json': {
          schema: z.ZodSchema;
        };
      };
    };
  };
}

interface RouteOpenAPIConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  pathParamSchema?: z.ZodSchema;
  queryParamSchema?: z.ZodSchema;
  bodySchema?: z.ZodSchema;
  responseSchema?: z.ZodSchema;
  deprecated?: boolean;
}

export function generateRouteOpenAPI({
  method,
  path,
  summary,
  description,
  tags = [],
  pathParamSchema,
  queryParamSchema,
  bodySchema,
  responseSchema,
  deprecated,
}: RouteOpenAPIConfig): OpenAPIRoute {
  const route: OpenAPIRoute = {
    summary: summary || `${method} ${path}`,
    description,
    tags,
    deprecated,
    responses: {
      200: {
        description: 'Successful response',
      },
    },
  };

  if (pathParamSchema || queryParamSchema) {
    route.requestParams = {};

    if (pathParamSchema) {
      route.requestParams.path = pathParamSchema;
    }

    if (queryParamSchema) {
      route.requestParams.query = queryParamSchema;
    }
  }

  if (bodySchema) {
    route.requestBody = {
      content: {
        'application/json': {
          schema: bodySchema,
        },
      },
    };
  }

  if (responseSchema) {
    route.responses[200] = {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: responseSchema,
        },
      },
    };
  }

  return route;
}

export type ResponseType = 'stream' | 'json' | 'datastream-response' | 'mcp-http' | 'mcp-sse';

export type InferParams<
  TPathSchema extends z.ZodTypeAny | undefined,
  TQuerySchema extends z.ZodTypeAny | undefined,
  TBodySchema extends z.ZodTypeAny | undefined,
> = (TPathSchema extends z.ZodTypeAny ? z.infer<TPathSchema> : {}) &
  (TQuerySchema extends z.ZodTypeAny ? z.infer<TQuerySchema> : {}) &
  (TBodySchema extends z.ZodTypeAny ? z.infer<TBodySchema> : {});

export interface RouteSchemas<
  TPathSchema = unknown,
  TQuerySchema = unknown,
  TBodySchema = unknown,
  TResponseSchema = unknown,
> {
  readonly pathParams: TPathSchema;
  readonly queryParams: TQuerySchema;
  readonly body: TBodySchema;
  readonly response: TResponseSchema;
}

export type ServerContext = {
  mastra: any;
  requestContext: RequestContext;
  registeredTools?: ToolsInput;
  taskStore?: unknown;
  abortSignal: AbortSignal;
  routePrefix?: string;
};

export type ServerRouteHandler<
  TParams = Record<string, unknown>,
  TResponse = unknown,
  TResponseType extends ResponseType = 'json',
> = (
  params: TParams & ServerContext,
) => Promise<
  TResponseType extends 'stream' ? ReadableStream : TResponseType extends 'datastream-response' ? Response : TResponse
>;

export type ValidationErrorHook = (error: z.ZodError) => { status?: number; body?: unknown } | void;

export type ServerRoute<
  TParams = Record<string, unknown>,
  TResponse = unknown,
  TResponseType extends ResponseType = ResponseType,
  TSchemas extends RouteSchemas = RouteSchemas,
  TMethod extends string = string,
  TPath extends string = string,
> = {
  method: TMethod;
  path: TPath;
  responseType: TResponseType;
  streamFormat?: 'sse' | 'stream';
  sseFlushOnConnect?: boolean;
  handler(params: TParams & ServerContext): ReturnType<ServerRouteHandler<TParams, TResponse, TResponseType>>;
  pathParamSchema?: z.ZodSchema;
  queryParamSchema?: z.ZodSchema;
  bodySchema?: z.ZodSchema;
  responseSchema?: z.ZodSchema;
  openapi?: OpenAPIRoute;
  maxBodySize?: number;
  deprecated?: boolean;
  requiresAuth?: boolean;
  requiresPermission?: any;
  fga?: any;
  onValidationError?: ValidationErrorHook;
  readonly __schemas?: TSchemas;
};

interface RouteConfig<
  TPathSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TResponseSchema extends z.ZodTypeAny | undefined = undefined,
  TResponseType extends ResponseType = 'json',
  TMethod extends string = string,
  TPath extends string = string,
> {
  method: TMethod;
  path: TPath;
  responseType: TResponseType;
  streamFormat?: 'sse' | 'stream';
  sseFlushOnConnect?: boolean;
  handler: ServerRouteHandler<
    InferParams<TPathSchema, TQuerySchema, TBodySchema>,
    TResponseSchema extends z.ZodTypeAny ? z.infer<TResponseSchema> : unknown,
    TResponseType
  >;
  pathParamSchema?: TPathSchema;
  queryParamSchema?: TQuerySchema;
  bodySchema?: TBodySchema;
  responseSchema?: TResponseSchema;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  maxBodySize?: number;
  requiresAuth?: boolean;
  requiresPermission?: any;
  fga?: any;
  onValidationError?: ValidationErrorHook;
}

export function createRoute<
  TPathSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TResponseSchema extends z.ZodTypeAny | undefined = undefined,
  TResponseType extends ResponseType = 'json',
  TMethod extends string = string,
  TPath extends string = string,
>(
  config: RouteConfig<TPathSchema, TQuerySchema, TBodySchema, TResponseSchema, TResponseType, TMethod, TPath>,
): ServerRoute<
  InferParams<TPathSchema, TQuerySchema, TBodySchema>,
  TResponseSchema extends z.ZodTypeAny ? z.infer<TResponseSchema> : unknown,
  TResponseType,
  RouteSchemas<TPathSchema, TQuerySchema, TBodySchema, TResponseSchema>,
  TMethod,
  TPath
> {
  const { summary, description, tags, deprecated, requiresAuth, requiresPermission, onValidationError, ...baseRoute } =
    config;

  const openapi =
    config.method !== 'ALL'
      ? generateRouteOpenAPI({
          method: config.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          path: config.path,
          summary,
          description,
          tags,
          pathParamSchema: config.pathParamSchema,
          queryParamSchema: config.queryParamSchema,
          bodySchema: config.bodySchema,
          responseSchema: config.responseSchema,
          deprecated,
        })
      : undefined;

  return {
    ...baseRoute,
    openapi,
    deprecated,
    requiresAuth,
    requiresPermission,
    onValidationError,
  };
}

export function createPublicRoute<
  TPathSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TResponseSchema extends z.ZodTypeAny | undefined = undefined,
  TResponseType extends ResponseType = 'json',
  TMethod extends string = string,
  TPath extends string = string,
>(
  config: Omit<
    RouteConfig<TPathSchema, TQuerySchema, TBodySchema, TResponseSchema, TResponseType, TMethod, TPath>,
    'requiresAuth'
  >,
): ServerRoute<
  InferParams<TPathSchema, TQuerySchema, TBodySchema>,
  TResponseSchema extends z.ZodTypeAny ? z.infer<TResponseSchema> : unknown,
  TResponseType,
  RouteSchemas<TPathSchema, TQuerySchema, TBodySchema, TResponseSchema>,
  TMethod,
  TPath
> {
  return createRoute({
    ...config,
    requiresAuth: false,
  });
}
