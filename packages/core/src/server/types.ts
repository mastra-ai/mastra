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

type Middleware = MiddlewareHandler | { path: string; handler: MiddlewareHandler };

export type ServerConfig = {
  // TOOD add support for port
  // port?: number;
  apiRoutes?: ApiRoute[];
  middleware?: Middleware | Middleware[];
};
