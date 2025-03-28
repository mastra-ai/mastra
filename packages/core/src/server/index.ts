import type { Handler, MiddlewareHandler } from 'hono';
import type { DescribeRouteOptions } from 'hono-openapi';
import type { Mastra } from '../mastra';
import type { ApiRoute, Methods } from './types';

// Helper type for inferring parameters from a path
// Thank you Claude!
type ParamsFromPath<P extends string> = {
  [K in P extends `${string}:${infer Param}/${string}` | `${string}:${infer Param}` ? Param : never]: string;
};

export function registerApiRoute<P extends string>(
  path: P,
  options: {
    method: Methods;
    openapi?: DescribeRouteOptions;
    handler: Handler<
      {
        Variables: {
          mastra: Mastra;
        };
      },
      P,
      ParamsFromPath<P>
    >;
    middleware?: MiddlewareHandler | MiddlewareHandler[];
  },
): ApiRoute {
  return {
    path,
    method: options.method,
    handler: options.handler,
    openapi: options.openapi,
    middleware: options.middleware,
  };
}
