import type { Handler, MiddlewareHandler } from 'hono';
import type { cors } from 'hono/cors';
import type { DescribeRouteOptions } from 'hono-openapi';
import type { Mastra } from '..';
export type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'ALL';

export type ApiRoute =
  | {
      path: string;
      method: Methods;
      handler: Handler;
      middleware?: MiddlewareHandler | MiddlewareHandler[];
      openapi?: DescribeRouteOptions;
    }
  | {
      path: string;
      method: Methods;
      createHandler: ({ mastra }: { mastra: Mastra }) => Promise<Handler>;
      middleware?: MiddlewareHandler | MiddlewareHandler[];
      openapi?: DescribeRouteOptions;
    };

type Middleware = MiddlewareHandler | { path: string; handler: MiddlewareHandler };

export type ServerConfig = {
  /**
   * Port for the server
   * @default 4111
   */
  port?: number;
  /**
   * Host for the server
   * @default 'localhost'
   */
  host?: string;
  /**
   * Timeout for the server
   */
  timeout?: number;
  /**
   * Custom API routes for the server
   */
  apiRoutes?: ApiRoute[];
  /**
   * Middleware for the server
   */
  middleware?: Middleware | Middleware[];
  /**
   * CORS configuration for the server
   * @default { origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-client-type'], exposeHeaders: ['Content-Length', 'X-Requested-With'], credentials: false }
   */
  cors?: Parameters<typeof cors>[0] | false;
  /**
   * Build configuration for the server
   */
  build?: {
    /**
     * Enable Swagger UI
     * @default false
     */
    swaggerUI?: boolean;
    /**
     * Enable API request logging
     * @default false
     */
    apiReqLogs?: boolean;
    /**
     * Enable OpenAPI documentation
     * @default false
     */
    openAPIDocs?: boolean;
  };
  /**
   * Body size limit for the server
   * @default 4.5mb
   */
  bodySizeLimit?: number;
};
