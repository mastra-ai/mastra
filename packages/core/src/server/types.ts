import type { Handler, MiddlewareHandler, HonoRequest, Context } from 'hono';
import type { cors } from 'hono/cors';
import type { DescribeRouteOptions } from 'hono-openapi';
import type { Mastra } from '../mastra';
import type { RuntimeContext } from '../runtime-context';
import type { MastraAuthProvider } from './auth';

export type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';

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

export type Middleware = MiddlewareHandler | { path: string; handler: MiddlewareHandler };

export type ContextWithMastra = Context<{
  Variables: {
    mastra: Mastra;
    runtimeContext: RuntimeContext;
  };
}>;

export type MastraAuthConfig<TUser = unknown> = {
  /**
   * Protected paths for the server
   */
  protected?: (RegExp | string | [string, Methods | Methods[]])[];

  /**
   * Public paths for the server
   */
  public?: (RegExp | string | [string, Methods | Methods[]])[];

  /**
   * Public paths for the server
   */
  authenticateToken?: (token: string, request: HonoRequest) => Promise<TUser>;

  /**
   * Authorization function for the server
   */
  authorize?: (path: string, method: string, user: TUser, context: ContextWithMastra) => Promise<boolean>;

  /**
   * Rules for the server
   */
  rules?: {
    /**
     * Path for the rule
     */
    path?: RegExp | string | string[];
    /**
     * Method for the rule
     */
    methods?: Methods | Methods[];
    /**
     * Condition for the rule
     */
    condition?: (user: TUser) => Promise<boolean> | boolean;
    /**
     * Allow the rule
     */
    allow?: boolean;
  }[];
};

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
   * @default { origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-client-type'], exposeHeaders: ['Content-Length', 'X-Requested-With'], credentials: false }
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

  /**
   * Authentication configuration for the server
   */
  experimental_auth?: MastraAuthConfig<any> | MastraAuthProvider<any>;
};
