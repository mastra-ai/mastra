import type { Handler, MiddlewareHandler, HonoRequest, Context } from 'hono';
import type { cors } from 'hono/cors';
import type { DescribeRouteOptions } from 'hono-openapi';
import type { IRBACProvider } from '../ee/interfaces/rbac';
import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';
import type { MastraAuthProvider } from './auth';

export type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';

export type ApiRoute =
  | {
      path: string;
      method: Methods;
      handler: Handler;
      middleware?: MiddlewareHandler | MiddlewareHandler[];
      openapi?: DescribeRouteOptions;
      requiresAuth?: boolean;
    }
  | {
      path: string;
      method: Methods;
      createHandler: ({ mastra }: { mastra: Mastra }) => Promise<Handler>;
      middleware?: MiddlewareHandler | MiddlewareHandler[];
      openapi?: DescribeRouteOptions;
      requiresAuth?: boolean;
    };

export type Middleware = MiddlewareHandler | { path: string; handler: MiddlewareHandler };

export type ContextWithMastra = Context<{
  Variables: {
    mastra: Mastra;
    requestContext: RequestContext;
    customRouteAuthConfig?: Map<string, boolean>;
  };
}>;

/**
 * Configuration for audit event logging.
 */
export type AuditConfig = {
  /**
   * Which event types to log.
   * If not specified, all events are logged.
   */
  events?: {
    /** Log authentication events (login, logout, sign-up) */
    auth?: boolean;
    /** Log agent execution events */
    agents?: boolean;
    /** Log workflow execution events */
    workflows?: boolean;
    /** Log tool execution events */
    tools?: boolean;
    /** Log permission denial events */
    permissions?: boolean;
  };
  /**
   * Retention policy for audit events.
   */
  retention?: {
    /** Number of days to keep audit events. Events older than this are auto-deleted. */
    days?: number;
  };
};

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
   * Base path for Mastra Studio
   * @default '/'
   * @example '/my-mastra-studio'
   */
  studioBase?: string;
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
   * @default 4_718_592 bytes (4.5 MB)
   */
  bodySizeLimit?: number;

  /**
   * Authentication configuration for the server.
   *
   * Handles WHO the user is (authentication only).
   * For authorization (WHAT the user can do), use the `rbac` option.
   */
  auth?: MastraAuthConfig<any> | MastraAuthProvider<any>;

  /**
   * Audit logging configuration for EE (Enterprise Edition).
   *
   * Enables activity tracking for compliance, security monitoring,
   * and debugging. Audit events are stored in Mastra's storage layer.
   *
   * Set to `true` to enable with defaults (logs all events).
   * Pass a config object to customize what gets logged.
   *
   * @example Enable with defaults
   * ```typescript
   * const mastra = new Mastra({
   *   server: {
   *     audit: true,
   *   },
   * });
   * ```
   *
   * @example Custom configuration
   * ```typescript
   * const mastra = new Mastra({
   *   server: {
   *     audit: {
   *       events: {
   *         auth: true,      // Login, logout, sign-up
   *         agents: true,    // Agent executions
   *         workflows: true, // Workflow runs
   *         tools: false,    // Tool executions (disabled)
   *       },
   *       retention: {
   *         days: 90,        // Auto-delete after 90 days
   *       },
   *     },
   *   },
   * });
   * ```
   */
  audit?: true | AuditConfig;

  /**
   * Role-based access control (RBAC) provider for EE (Enterprise Edition).
   *
   * Handles WHAT the user can do (authorization).
   * Use this to enable permission-based access control in Studio.
   *
   * RBAC is separate from authentication:
   * - `auth` handles WHO the user is (authentication)
   * - `rbac` handles WHAT the user can do (authorization)
   *
   * You can mix providers - e.g., use Better Auth for authentication
   * and StaticRBACProvider for authorization.
   *
   * @example Using StaticRBACProvider with role definitions
   * ```typescript
   * import { StaticRBACProvider, DEFAULT_ROLES } from '@mastra/core/ee';
   *
   * const mastra = new Mastra({
   *   server: {
   *     auth: myAuthProvider,
   *     rbac: new StaticRBACProvider({
   *       roles: DEFAULT_ROLES,
   *       getUserRoles: (user) => [user.role],
   *     }),
   *   },
   * });
   * ```
   *
   * @example Using MastraRBACClerk with role mapping
   * ```typescript
   * import { MastraAuthClerk, MastraRBACClerk } from '@mastra/auth-clerk';
   *
   * const mastra = new Mastra({
   *   server: {
   *     auth: new MastraAuthClerk({ clerk }),
   *     rbac: new MastraRBACClerk({
   *       clerk,
   *       roleMapping: {
   *         "org:admin": ["*"],
   *         "org:member": ["agents:read", "workflows:read"],
   *       },
   *     }),
   *   },
   * });
   * ```
   */
  rbac?: IRBACProvider<any>;

  /**
   * If you want to run `mastra dev` with HTTPS, you can run it with the `--https` flag and provide the key and cert files here.
   */
  https?: {
    key: Buffer;
    cert: Buffer;
  };

  /**
   * Custom error handler for the server. This hook is called when an unhandled error occurs.
   * Use this to customize error responses, log errors to external services (e.g., Sentry),
   * or implement custom error formatting.
   *
   * @param err - The error that was thrown
   * @param c - The Hono context object, providing access to request details and response methods
   * @returns A Response object or a Promise that resolves to a Response
   *
   * @example
   * ```ts
   * const mastra = new Mastra({
   *   server: {
   *     onError: (err, c) => {
   *       // Log to Sentry
   *       Sentry.captureException(err);
   *
   *       // Return custom formatted response
   *       return c.json({
   *         error: err.message,
   *         timestamp: new Date().toISOString(),
   *       }, 500);
   *     },
   *   },
   * });
   * ```
   */
  onError?: (err: Error, c: Context) => Response | Promise<Response>;
};
