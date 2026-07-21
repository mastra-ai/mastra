import type { Handler, MiddlewareHandler } from 'hono';
import type { DescribeRouteOptions } from 'hono-openapi';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';
import type { ApiRoute, ApiRouteHandler, MastraAuthConfig, Methods } from './types';

export type {
  MastraAuthConfig,
  A2AAgentCardSigningConfig,
  A2AConfig,
  ContextWithMastra,
  CorsOptions,
  ApiRoute,
  ApiRouteHandler,
  HttpLoggingConfig,
  ValidationErrorContext,
  ValidationErrorResponse,
  ValidationErrorHook,
  StudioConfig,
  Middleware,
} from './types';
export {
  MastraAuthProvider,
  isSSOProvider,
  isSessionProvider,
  isUserProvider,
  isCredentialsProvider,
  isOrganizationsProvider,
  isAuthHttpHandler,
  hasAuthInit,
} from './auth';
export type {
  IMastraAuthProvider,
  MastraAuthProviderOptions,
  AuthInitContext,
  IAuthHttpHandler,
  IAuthInit,
  ICredentialsProvider,
  IOrganizationsProvider,
  ISessionProvider,
  ISSOProvider,
  IUserProvider,
} from './auth';
export type { HonoRequestLike, MastraAuthRequest } from './request-types';
export { getRequestHeader, getWebRequest } from './request-types';
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

type RegisterApiRouteOptions<P extends string> = {
  method: Methods;
  openapi?: DescribeRouteOptions;
  handler?: Handler<
    {
      Variables: CustomRouteVariables;
    },
    P,
    ParamsFromPath<P>
  >;
  createHandler?: (opts: { mastra: Mastra }) => Promise<ApiRouteHandler>;
  middleware?: MiddlewareHandler | MiddlewareHandler[];
  /**
   * Route-specific CORS configuration.
   */
  cors?: ApiRoute['cors'];
  /**
   * When false, skips Mastra auth for this route (defaults to true)
   */
  requiresAuth?: boolean;
  /**
   * Explicit RBAC permission for the route.
   */
  requiresPermission?: ApiRoute['requiresPermission'];
  /**
   * Optional FGA configuration for resource-level authorization.
   */
  fga?: ApiRoute['fga'];
};

function validateOptions<P extends string>(path: P, options: RegisterApiRouteOptions<P>): void {
  if (options.method === undefined) {
    throw new MastraError({
      id: 'MASTRA_SERVER_API_INVALID_ROUTE_OPTIONS',
      text: `Invalid options for route "${path}", missing "method" property`,
      domain: ErrorDomain.MASTRA_SERVER,
      category: ErrorCategory.USER,
    });
  }

  if (options.handler === undefined && options.createHandler === undefined) {
    throw new MastraError({
      id: 'MASTRA_SERVER_API_INVALID_ROUTE_OPTIONS',
      text: `Invalid options for route "${path}", you must define a "handler" or "createHandler" property`,
      domain: ErrorDomain.MASTRA_SERVER,
      category: ErrorCategory.USER,
    });
  }

  if (options.handler !== undefined && options.createHandler !== undefined) {
    throw new MastraError({
      id: 'MASTRA_SERVER_API_INVALID_ROUTE_OPTIONS',
      text: `Invalid options for route "${path}", you can only define one of the following properties: "handler" or "createHandler"`,
      domain: ErrorDomain.MASTRA_SERVER,
      category: ErrorCategory.USER,
    });
  }
}

export function registerApiRoute<P extends string>(path: P, options: RegisterApiRouteOptions<P>): ApiRoute {
  validateOptions(path, options);

  return {
    path,
    method: options.method,
    handler: options.handler,
    createHandler: options.createHandler,
    openapi: options.openapi,
    middleware: options.middleware,
    cors: options.cors,
    requiresAuth: options.requiresAuth,
    requiresPermission: options.requiresPermission,
    fga: options.fga,
  } as ApiRoute;
}

export function defineAuth<TUser>(config: MastraAuthConfig<TUser>): MastraAuthConfig<TUser> {
  return config;
}
