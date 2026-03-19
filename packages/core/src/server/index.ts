import type { Context, Handler, MiddlewareHandler } from 'hono';
import type { DescribeRouteOptions } from 'hono-openapi';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';
import type { ApiRoute, MastraAuthConfig, Methods } from './types';

export type {
  MastraAuthConfig,
  ContextWithMastra,
  ApiRoute,
  HttpLoggingConfig,
  ValidationErrorContext,
  ValidationErrorResponse,
  ValidationErrorHook,
} from './types';
export { MastraAuthProvider } from './auth';
export type { MastraAuthProviderOptions } from './auth';
export { CompositeAuth } from './composite-auth';
export { MastraServerBase } from './base';
export { SimpleAuth } from './simple-auth';
export type { SimpleAuthOptions } from './simple-auth';

// Helper type for inferring parameters from a path
type ParamsFromPath<P extends string> = {
  [K in P extends `${string}:${infer Param}/${string}` | `${string}:${infer Param}` ? Param : never]: string;
};

/**
 * Variables available in the Hono context for custom API route handlers.
 * These are set by the server middleware and available via c.get().
 */
type CustomRouteVariables = {
  mastra: Mastra;
  requestContext: RequestContext;
};

type RegisterApiRouteOptions = {
  method: Methods;
  openapi?: DescribeRouteOptions;
  handler?: Handler<
    {
      Variables: CustomRouteVariables;
    },
    string,
    ParamsFromPath<string>
  >;
  createHandler?: (c: Context) => Promise<
    Handler<
      {
        Variables: CustomRouteVariables;
      },
      string,
      ParamsFromPath<string>
    >
  >;
  middleware?: MiddlewareHandler | MiddlewareHandler[];
  /**
   * When false, skips Mastra auth for this route (defaults to true)
   */
  requiresAuth?: boolean;
};

function validateOptions(path: string, options: RegisterApiRouteOptions): asserts options is RegisterApiRouteOptions {
  const opts = options as RegisterApiRouteOptions;

  if (opts.method === undefined) {
    throw new MastraError({
      id: 'MASTRA_SERVER_API_INVALID_ROUTE_OPTIONS',
      text: `Invalid options for route "${path}", missing "method" property`,
      domain: ErrorDomain.MASTRA_SERVER,
      category: ErrorCategory.USER,
    });
  }

  if (opts.handler === undefined && opts.createHandler === undefined) {
    throw new MastraError({
      id: 'MASTRA_SERVER_API_INVALID_ROUTE_OPTIONS',
      text: `Invalid options for route "${path}", you must define a "handler" or "createHandler" property`,
      domain: ErrorDomain.MASTRA_SERVER,
      category: ErrorCategory.USER,
    });
  }

  if (opts.handler !== undefined && opts.createHandler !== undefined) {
    throw new MastraError({
      id: 'MASTRA_SERVER_API_INVALID_ROUTE_OPTIONS',
      text: `Invalid options for route "${path}", you can only define one of the following properties: "handler" or "createHandler"`,
      domain: ErrorDomain.MASTRA_SERVER,
      category: ErrorCategory.USER,
    });
  }
}

export function registerApiRoute(path: string, options: RegisterApiRouteOptions): ApiRoute {
  validateOptions(path, options);

  return {
    path,
    method: options.method,
    handler: options.handler,
    createHandler: options.createHandler,
    openapi: options.openapi,
    middleware: options.middleware,
    requiresAuth: options.requiresAuth,
  } as unknown as ApiRoute;
}

export function defineAuth<TUser>(config: MastraAuthConfig<TUser>): MastraAuthConfig<TUser> {
  return config;
}
