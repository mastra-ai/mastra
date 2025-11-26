import type { Context, Handler, MiddlewareHandler } from 'hono';
import type { DescribeRouteOptions } from 'hono-openapi';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { Mastra } from '../mastra';
import type { ApiRoute, MastraAuthConfig, Methods } from './types';

export type { MastraAuthConfig, ContextWithMastra, ApiRoute } from './types';
export { MastraAuthProvider } from './auth';
export type { MastraAuthProviderOptions } from './auth';
export { CompositeAuth } from './composite-auth';

// Helper type for inferring parameters from a path
// Thank you Claude!
type ParamsFromPath<P extends string> = {
  [K in P extends `${string}:${infer Param}/${string}` | `${string}:${infer Param}` ? Param : never]: string;
};

type RegisterApiRoutePathError = `Param 'path' must not start with '/api', it is reserved for internal API routes.`;
type ValidatePath<P extends string, T> = P extends `/api/${string}` ? RegisterApiRoutePathError : T;

type RegisterApiRouteOptions<P extends string> = {
  method: Methods;
  openapi?: DescribeRouteOptions;
  handler?: Handler<
    {
      Variables: {
        mastra: Mastra;
      };
    },
    P,
    ParamsFromPath<P>
  >;
  createHandler?: (c: Context) => Promise<
    Handler<
      {
        Variables: {
          mastra: Mastra;
        };
      },
      P,
      ParamsFromPath<P>
    >
  >;
  middleware?: MiddlewareHandler | MiddlewareHandler[];
  /**
   * When false, skips Mastra auth for this route (defaults to true)
   */
  requiresAuth?: boolean;
};

function validateOptions<P extends string>(
  path: P,
  options: RegisterApiRoutePathError | RegisterApiRouteOptions<P>,
): asserts options is RegisterApiRouteOptions<P> {
  const opts = options as RegisterApiRouteOptions<P>;

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

export function registerApiRoute<P extends string>(
  path: P,
  options: ValidatePath<P, RegisterApiRouteOptions<P>>,
): ValidatePath<P, ApiRoute> {
  if (path.startsWith('/api/')) {
    throw new MastraError({
      id: 'MASTRA_SERVER_API_PATH_RESERVED',
      text: 'Path must not start with "/api", it\'s reserved for internal API routes',
      domain: ErrorDomain.MASTRA_SERVER,
      category: ErrorCategory.USER,
    });
  }

  validateOptions(path, options);

  return {
    path,
    method: options.method,
    handler: options.handler,
    createHandler: options.createHandler,
    openapi: options.openapi,
    middleware: options.middleware,
    requiresAuth: options.requiresAuth,
  } as unknown as ValidatePath<P, ApiRoute>;
}

export function defineAuth<TUser>(config: MastraAuthConfig<TUser>): MastraAuthConfig<TUser> {
  return config;
}
