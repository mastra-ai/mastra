import type { Handler, MiddlewareHandler } from 'hono';
import type { cors } from 'hono/cors';
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
  port?: number;
  timeout?: number;
  apiRoutes?: ApiRoute[];
  middleware?: Middleware | Middleware[];
  /**
   * CORS configuration for the server
   * @default { origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-client-type'], exposeHeaders: ['Content-Length', 'X-Requested-With'], credentials: false }
   */
  cors?: Parameters<typeof cors>[0] | false;
};
