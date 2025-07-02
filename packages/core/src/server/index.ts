import type { Context, Handler, MiddlewareHandler } from 'hono';
import type { DescribeRouteOptions } from 'hono-openapi';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { Mastra } from '../mastra';
import type { ApiRoute, MastraAuthConfig, Methods } from './types';

export type { MastraAuthConfig, ContextWithMastra } from './types';
export { MastraAuthProvider } from './auth';
export type { MastraAuthProviderOptions } from './auth';

// Helper type for inferring parameters from a path
// Thank you Claude!
type ParamsFromPath<P extends string> = {
  [K in P extends `${string}:${infer Param}/${string}` | `${string}:${infer Param}` ? Param : never]: string;
};

export function registerApiRoute<P extends string>(
  path: P,
  options: P extends `/api/${string}`
    ? never
    : {
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
      },
): P extends `/api/${string}` ? never : ApiRoute {
  if (path.startsWith('/api/')) {
    throw new MastraError({
      id: 'MASTRA_SERVER_API_PATH_RESERVED',
      text: 'Path must not start with "/api", it\'s reserved for internal API routes',
      domain: ErrorDomain.MASTRA_SERVER,
      category: ErrorCategory.USER,
    });
  }

  // @ts-expect-error
  return {
    path,
    method: options.method,
    handler: options.handler,
    createHandler: options.createHandler,
    openapi: options.openapi,
    middleware: options.middleware,
  } as ApiRoute;
}

export function defineAuth<TUser>(config: MastraAuthConfig<TUser>): MastraAuthConfig<TUser> {
  return config;
}
