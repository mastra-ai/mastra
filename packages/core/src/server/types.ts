import type { Handler, MiddlewareHandler, HonoRequest, Context } from 'hono';
import type { cors } from 'hono/cors';
import type { DescribeRouteOptions } from 'hono-openapi';
import type { ZodError } from 'zod/v4';
import type { IRBACProvider } from '../auth/ee/interfaces/rbac';
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
      /** Framework-generated route. Bypasses the apiPrefix collision check. Mastra-internal — do not use. */
      _mastraInternal?: true;
    }
  | {
      path: string;
      method: Methods;
      createHandler: ({ mastra }: { mastra: Mastra }) => Promise<Handler>;
      middleware?: MiddlewareHandler | MiddlewareHandler[];
      openapi?: DescribeRouteOptions;
      requiresAuth?: boolean;
      /** Framework-generated route. Bypasses the apiPrefix collision check. Mastra-internal — do not use. */
      _mastraInternal?: true;
    };

export type Middleware = MiddlewareHandler | { path: string; handler: MiddlewareHandler };

export type ContextWithMastra = Context<{
  Variables: {
    mastra: Mastra;
    requestContext: RequestContext;
    customRouteAuthConfig?: Map<string, boolean>;
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
   * Maps the authenticated user to a resource ID for memory/thread scoping.
   * When provided, the returned value is set as `MASTRA_RESOURCE_ID_KEY` on the request context
   * after successful authentication, enabling per-user memory isolation.
   */
  mapUserToResourceId?(user: TUser): string | undefined | null;

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

export type HttpLoggingConfig = {
  /**
   * Enable HTTP request logging
   */
  enabled: boolean;
  /**
   * Log level for HTTP requests
   * @default 'info'
   */
  level?: 'debug' | 'info' | 'warn';
  /**
   * Paths to exclude from logging (e.g., health checks)
   * @example ['/health', '/ready', '/metrics']
   */
  excludePaths?: string[];
  /**
   * Include request headers in logs
   * @default false
   */
  includeHeaders?: boolean;
  /**
   * Include query parameters in logs
   * @default false
   */
  includeQueryParams?: boolean;
  /**
   * Headers to redact from logs (if includeHeaders is true)
   * @default ['authorization', 'cookie']
   */
  redactHeaders?: string[];
};

export type ValidationErrorContext = 'query' | 'body' | 'path';

export type ValidationErrorResponse = {
  status: number;
  body: unknown;
};

export type ValidationErrorHook = (
  error: ZodError,
  context: ValidationErrorContext,
) => ValidationErrorResponse | undefined | void;

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
   * Host for Studio API URL. Use this when the server bind address
   * differs from the public domain (e.g., binding to '0.0.0.0' but accessible at 'my-app.run.app').
   * When not set, falls back to `host`.
   */
  studioHost?: string;
  /**
   * Protocol for Studio API URL ('http' or 'https').
   * Use this when the public protocol differs from the server's local protocol
   * (e.g., behind a TLS-terminating reverse proxy).
   * When not set, falls back to auto-detected protocol based on HTTPS config.
   */
  studioProtocol?: 'http' | 'https';
  /**
   * Port for Studio API URL. Use this when the external port differs
   * from the server's local port (e.g., server listens on 8080 but is exposed on 443).
   * When not set, falls back to `port`.
   */
  studioPort?: number;
  /**
   * Base path for Mastra Studio UI
   * @default '/'
   * @example '/my-mastra-studio'
   */
  studioBase?: string;
  /**
   * Prefix for API routes
   * @default '/api'
   * @example '/mastra'
   */
  apiPrefix?: string;
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
     * - Set to `true` for default logging (info level, redacts auth headers)
     * - Set to an object for custom configuration
     * @default false
     * @example
     * // Simple enable
     * apiReqLogs: true
     *
     * // Advanced configuration
     * apiReqLogs: {
     *   enabled: true,
     *   level: 'debug',
     *   excludePaths: ['/health', '/ready'],
     *   includeQueryParams: true,
     * }
     */
    apiReqLogs?: boolean | HttpLoggingConfig;
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
   * MCP transport options applied to all MCP HTTP and SSE routes.
   * Use this to enable stateless mode for serverless environments
   * (Cloudflare Workers, Vercel Edge, AWS Lambda, etc.).
   */
  mcpOptions?: {
    /**
     * Run MCP in stateless mode without session management
     * @default false
     */
    serverless?: boolean;
    /**
     * Custom session ID generator function
     */
    sessionIdGenerator?: () => string;
  };

  /**
   * Authentication configuration for the server.
   *
   * Handles WHO the user is (authentication only).
   * For authorization (WHAT the user can do), use the `rbac` option.
   */
  auth?: MastraAuthConfig<any> | MastraAuthProvider<any>;

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
   * import { StaticRBACProvider, DEFAULT_ROLES } from '@mastra/core/auth/ee';
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

  /**
   * Custom validation error handler for the server. Called when a request fails
   * Zod schema validation (query parameters, request body, or path parameters).
   *
   * Return a `{ status, body }` object to override the default 400 response,
   * or return `undefined` to fall back to the default behavior.
   *
   * @param error - The ZodError from schema validation
   * @param context - Which part of the request failed: 'query', 'body', or 'path'
   *
   * @example
   * ```ts
   * const mastra = new Mastra({
   *   server: {
   *     onValidationError: (error, context) => ({
   *       status: 422,
   *       body: {
   *         ok: false,
   *         errors: error.issues.map(i => ({
   *           path: i.path.join('.'),
   *           message: i.message,
   *         })),
   *         source: context,
   *       },
   *     }),
   *   },
   * });
   * ```
   */
  onValidationError?: ValidationErrorHook;
};
