import type { Handler, MiddlewareHandler } from 'hono';
import type { DescribeRouteOptions } from 'hono-openapi';
export type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type ApiRoute = {
  path: string;
  method: Methods;
  handler: Handler;
  middleware?: MiddlewareHandler | MiddlewareHandler[];
  openapi?: DescribeRouteOptions;
};

export type ServerConfig = {
  port?: number;
  apiRoutes?: ApiRoute[];
  middleware?: MiddlewareHandler | Array<MiddlewareHandler>;
};
