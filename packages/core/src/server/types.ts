import type { IncomingMessage } from 'node:http';
import type { MastraAuthConfig as InternalMastraAuthConfig } from '@internal/auth/types';
import type { Handler, MiddlewareHandler, Context } from 'hono';
import type { cors } from 'hono/cors';
import type { DescribeRouteOptions } from 'hono-openapi';
import type { ZodError } from 'zod/v4';
import type { FGARouteConfig, IFGAProvider } from '../auth/ee/interfaces/fga';
import type { MastraFGAPermissionInput } from '../auth/ee/interfaces/permissions.generated';
import type { IRBACProvider } from '../auth/ee/interfaces/rbac';
import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';
import type { IMastraAuthProvider } from './auth';

/** Fine-grained resource authorization requirements for a custom route. */
type RouteFGAConfig = FGARouteConfig;

/** HTTP methods accepted by custom routes, including ALL to match every method. */
export type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';

/**
 * Custom route handler that receives the request context and returns an HTTP response.
 * @param c - Request context passed to the custom handler.
 */
export type ApiRouteHandler = (c: any) => Response | Promise<Response>;

/** Path, method and authorization settings shared by custom route formats. */
type ApiRouteBase = {
  /** URL path or path pattern registered for the route. */
  path: string;
  /** HTTP method matched by the route. */
  method: Methods;
  /** Whether the route requires authentication when server authentication is configured. */
  requiresAuth?: boolean;
  /** Required permission, or alternative permissions accepted by the authorization middleware. */
  requiresPermission?: MastraFGAPermissionInput | MastraFGAPermissionInput[];
  /** Resource-level fine-grained authorization requirements. */
  fga?: RouteFGAConfig;
  /** Framework-generated route. Bypasses the apiPrefix collision check. Mastra-internal — do not use. */
  _mastraInternal?: true;
};

/** Hono custom route with a direct handler or an asynchronous Mastra-aware handler factory. */
type HonoApiRoute = ApiRouteBase & {
  /** Middleware applied to this route. */
  middleware?: MiddlewareHandler | MiddlewareHandler[];
  /** OpenAPI metadata describing this route. */
  openapi?: DescribeRouteOptions;
  /** Cross-origin request settings for this route. */
  cors?: CorsOptions;
} & (
    | {
        /** Hono handler invoked for matching requests. */
        handler: Handler;
      }
    | {
        /**
         * Creates the route handler with access to the Mastra instance.
         */
        // Preserve the source-derived identity of the destructured binding.
        // oxfmt-ignore
        createHandler: (
          /** Factory context containing the hosting Mastra instance. */
          { mastra }: {
            /** Mastra instance hosting the route. */
            mastra: Mastra;
          },
        ) => Promise<ApiRouteHandler>;
      }
  );

/**
 * Structural mirror of the generated OpenAPI metadata attached to a
 * `ServerRoute` by `createRoute()` in `@mastra/server/server-adapter`.
 * Core cannot import from `@mastra/server`, so keep this in sync with
 * `generateRouteOpenAPI()` in `packages/server/src/server/server-adapter/routes/route-builder.ts`.
 */
type SchemaApiRouteOpenAPI = {
  /** Whether to omit the route from the OpenAPI document. */
  hide?: boolean;
  /** Short summary of the operation. */
  summary?: string;
  /** Detailed description of the operation. */
  description?: string;
  /** Tags used to group the operation in API documentation. */
  tags?: string[];
  /** Whether the operation is deprecated. */
  deprecated?: boolean;
  /** Schemas describing URL parameters. */
  requestParams?: {
    /** Schema for path parameters. */
    path?: unknown;
    /** Schema for query parameters. */
    query?: unknown;
  };
  /** Generated request-body documentation. */
  requestBody?: {
    /** Request-body schemas keyed by media type. */
    content: {
      /** JSON request-body definition. */
      'application/json': {
        /** Schema describing the JSON request body. */
        schema: unknown;
      };
    };
  };
  /** Response definitions keyed by HTTP status code. */
  responses: Record<
    string,
    {
      /** Description of the response. */
      description: string;
      /** Response-body schemas keyed by media type. */
      content?: {
        /** JSON response-body definition. */
        'application/json': {
          /** Schema describing the JSON response body. */
          schema: unknown;
        };
      };
    }
  >;
};

/**
 * A schema-aware route created by `createRoute()` from a server adapter.
 * The adapter registers these through its native route pipeline so parsing,
 * validation, response handling, and generated OpenAPI metadata are preserved.
 *
 * Structural mirror of `ServerRoute` in
 * `packages/server/src/server/server-adapter/routes/index.ts` (core cannot
 * import from `@mastra/server`). Keep the two in sync. Unlike Hono-style
 * routes, schema routes do not support `middleware` or `cors`.
 */
type SchemaApiRoute = ApiRouteBase & {
  /** Runtime discriminator attached by `createRoute()`. */
  readonly _mastraSchemaRoute: true;
  /** Response handling mode used by the server adapter. */
  responseType: 'stream' | 'json' | 'datastream-response' | 'mcp-http' | 'mcp-sse';
  /**
   * Handles validated route parameters and server context, returning the route result.
   * @param params - Validated request parameters combined with the adapter's server context.
   */
  handler(params: any): Promise<unknown>;
  /** Encoding for a streaming response: server-sent events or the default stream format. */
  streamFormat?: 'sse' | 'stream';
  /** Sends an initial connection comment when the response uses server-sent events. */
  sseFlushOnConnect?: boolean;
  /** Schema used to validate URL path parameters. */
  pathParamSchema?: unknown;
  /** Schema used to validate URL query parameters. */
  queryParamSchema?: unknown;
  /** Schema used to validate the request body. */
  bodySchema?: unknown;
  /** Schema describing the response body. */
  responseSchema?: unknown;
  /** Generated OpenAPI metadata for the route. */
  openapi?: SchemaApiRouteOpenAPI;
  /** Route-specific maximum request-body size in bytes. */
  maxBodySize?: number;
  /** Whether this route is deprecated. */
  deprecated?: boolean;
  /** Customizes the response to invalid path, query or body input. */
  onValidationError?: ValidationErrorHook;
};

/** Custom API route registered as a Hono handler or a schema-aware server-adapter route. */
export type ApiRoute = HonoApiRoute | SchemaApiRoute;

/** Server middleware applied globally or restricted to a path pattern. */
export type Middleware =
  | MiddlewareHandler
  | {
      /** Path pattern matched by this middleware. */
      path: string;
      /** Middleware invoked for matching requests. */
      handler: MiddlewareHandler;
    };

/** Options accepted by Hono's cross-origin resource sharing middleware. */
export type CorsOptions = Parameters<typeof cors>[0];

/** Hono request context containing Mastra and request-scoped server variables. */
export type ContextWithMastra = Context<{
  /** Variables available through the Hono context. */
  Variables: {
    /** Mastra instance serving the request. */
    mastra: Mastra;
    /** Request-scoped context passed to Mastra operations. */
    requestContext: RequestContext;
    /** Custom-route authentication requirements indexed by route key. */
    customRouteAuthConfig?: Map<string, boolean>;
  };
}>;

/** Authentication configuration parameterized by the user type and Mastra's Hono context. */
export type MastraAuthConfig<TUser = unknown> = InternalMastraAuthConfig<TUser, ContextWithMastra>;

/** Controls HTTP request logging and which request details are included. */
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

/** Request section whose schema validation failed. */
export type ValidationErrorContext = 'query' | 'body' | 'path';

/** Custom HTTP response returned by a request-validation error hook. */
export type ValidationErrorResponse = {
  /** HTTP status code for the validation error response. */
  status: number;
  /** Response body describing the validation failure. */
  body: unknown;
};

/** Signing key and JSON Web Signature headers for a served A2A Agent Card. */
export type A2AAgentCardSigningConfig = {
  /**
   * Private signing key used to sign the Agent Card.
   * Supports PKCS#8 PEM strings or JsonWebKey.
   */
  privateKey: string | JsonWebKey;
  /**
   * Protected JWS header values. `alg` is required.
   * Optional fields like `kid` and `jku` can be supplied here.
   */
  protectedHeader: {
    /** Signing algorithm identified in the protected JSON Web Signature header. */
    alg: string;
    /**
     * Additional protected JSON Web Signature headers.
     * @param key - Name of an additional protected header.
     */
    [key: string]: unknown;
  };
  /**
   * Optional unprotected JWS header values.
   */
  header?: Record<string, unknown>;
};

/** Server settings for Agent-to-Agent protocol integration. */
export type A2AConfig = {
  /**
   * Optional Agent Card signing configuration.
   * When provided, Mastra signs the served Agent Card and includes `signatures`.
   */
  agentCardSigning?: A2AAgentCardSigningConfig;
};

/**
 * Returns a custom validation error response, or no value to use default error handling.
 * @param error - Schema validation error for the request.
 * @param context - Request section that failed validation.
 */
export type ValidationErrorHook = (
  error: ZodError,
  context: ValidationErrorContext,
) => ValidationErrorResponse | undefined | void;

/** Enables stored-resource scoping or configures how each request's scope is resolved. */
export type StoredResourceScopeConfig =
  | boolean
  | {
      /**
       * Metadata key used to persist the resolved stored-resource scope.
       *
       * @default 'mastra.resourceId'
       */
      metadataKey?: string;
      /**
       * Resolve the stored-resource scope for the current request. When omitted,
       * Mastra uses MASTRA_RESOURCE_ID_KEY from the request context.
       * @param context - Request context and authenticated user used to resolve the resource scope.
       */
      resolve?: (context: {
        /** Context values associated with the current request. */
        requestContext?: RequestContext;
        /** Authenticated user associated with the current request, when available. */
        user?: unknown;
      }) => string | undefined | null | Promise<string | undefined | null>;
      /**
       * When true, scoped stored-resource routes fail if no scope can be resolved.
       *
       * @default true
       */
      requireScope?: boolean;
    };

/** Server behavior for persisted resources such as stored agents and tools. */
export type StoredResourcesConfig = {
  /**
   * Opt-in tenant/resource scoping for stored resources. When enabled, stored
   * resource handlers persist and filter a scope value in record metadata.
   */
  scope?: StoredResourceScopeConfig;
};

/** Server binding, routing, authentication and request-handling configuration. */
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
   * Request timeout in milliseconds for the generated server.
   * @default 180000
   */
  timeout?: number;
  /**
   * Max time (ms) to drain in-flight requests after SIGINT/SIGTERM. Must be a
   * finite number from 0 through 2_147_483_647. When the window passes,
   * remaining HTTP connections are force-closed. Mastra shutdown then runs
   * either way (bounded separately) before the process exits. Set 0 to skip
   * the drain entirely.
   * @default 5000
   */
  drainTimeout?: number;
  /**
   * Whether the generated server installs its own SIGINT/SIGTERM handlers
   * (drain in-flight requests + `mastra.shutdown()` + `process.exit`). Set
   * false to manage signals yourself (e.g. a handler registered in your
   * Mastra config module that calls `mastra.shutdown()`). Note: user code
   * has no access to the HTTP server handle in the generated entry, so HTTP
   * drain is unavailable with false — prefer `drainTimeout`, or a server
   * adapter for full custom lifecycle. With false and no user handler,
   * Node's default signal behavior applies (immediate termination, no drain).
   * @default true
   */
  handleShutdownSignals?: boolean;
  /**
   * Custom API routes for the server
   */
  apiRoutes?: ApiRoute[];
  /**
   * Middleware for the server. Handlers use Hono's `(c, next)` signature and
   * run on Hono-based serving paths: `mastra dev` / `mastra build`,
   * `@mastra/hono`, and adapters built on it such as `@mastra/next` and
   * `@mastra/tanstack-start`. Handlers are skipped for routes declared public
   * with `requiresAuth: false` (see `skipIfFrameworkPublic` in `@mastra/hono`),
   * so they cannot block endpoints such as the Studio sign-in routes.
   * Non-Hono adapters (Express, Fastify, Koa) cannot run Hono handlers and log
   * a warning when this is set. Register middleware through the framework's
   * own API there instead.
   */
  middleware?: Middleware | Middleware[];
  /**
   * CORS configuration for the server. Set to `false` to disable CORS.
   * `origin` selects allowed origins, `allowMethods` selects HTTP methods, and
   * `allowHeaders` selects request headers. `exposeHeaders` selects headers readable
   * by browsers, `credentials` permits credentials, and `maxAge` sets the preflight
   * cache duration in seconds. The generated server merges custom allowed/exposed
   * headers with its built-in headers. With authentication enabled, its global
   * policy defaults to credentials enabled and reflecting the requesting origin;
   * explicit origin and credentials settings override those defaults.
   * @default Without authentication: { origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization', 'A2A-Version', 'x-mastra-client-type', 'x-mastra-dev-playground'], exposeHeaders: ['Content-Length', 'X-Requested-With'], credentials: false, maxAge: 3600 }
   */
  cors?: CorsOptions | false;
  /**
   * Build configuration for the server
   */
  build?: {
    /**
     * Enable Swagger UI at `/swagger-ui` for interactive API exploration.
     * Also enable `openAPIDocs` so the UI can load the API specification.
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
     * Enable the OpenAPI specification at `/api/openapi.json` with the default API prefix.
     * Built-in routes use the API prefix as their server URL; custom routes use
     * a per-path server URL of `/`.
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
    /**
     * Sets `req.auth` on the request handed to the MCP transport, which is what
     * surfaces as `extra.authInfo` inside tool and agent execution.
     *
     * When omitted, the principal resolved by `server.auth` is bridged
     * automatically. Provide this hook when your own middleware performs the
     * verification and you want full control over the resulting `AuthInfo`.
     * @param req - Incoming request whose auth field is passed to the MCP transport.
     * @param requestContext - Context associated with the current Mastra request.
     */
    setRequestAuth?: (req: IncomingMessage, requestContext: RequestContext) => void | Promise<void>;
  };

  /**
   * A2A-specific server configuration.
   */
  a2a?: A2AConfig;

  /**
   * Authentication configuration for the server.
   *
   * Handles WHO the user is (authentication only).
   * For authorization (WHAT the user can do), use the `rbac` option.
   */
  auth?: MastraAuthConfig<any> | IMastraAuthProvider<any>;

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
   * FGA provider for fine-grained authorization (EE feature).
   *
   * While `rbac` handles role-based access (WHAT the user can do),
   * `fga` handles relationship-based access (can this user do this action
   * on THIS specific resource).
   */
  fga?: IFGAProvider<any>;

  /**
   * Stored-resource route and handler behavior.
   */
  storedResources?: StoredResourcesConfig;

  /**
   * If you want to run `mastra dev` with HTTPS, you can run it with the `--https` flag and provide the key and cert files here.
   */
  https?: {
    /** Private key bytes used by the local HTTPS server. */
    key: Buffer;
    /** Certificate bytes used by the local HTTPS server. */
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

/**
 * Configuration for Mastra Studio authentication and authorization.
 *
 * Studio authentication is independent from server (API) authentication,
 * allowing you to use different providers for internal team members (Studio)
 * vs external customers (API).
 *
 * @example Using separate providers for Studio and API
 * ```typescript
 * const mastra = new Mastra({
 *   server: {
 *     // API authentication for external customers
 *     auth: new MastraAuthWorkos({ ... }),
 *     rbac: new MastraRBACWorkos({ ... }),
 *   },
 *   studio: {
 *     // Studio authentication for internal team
 *     auth: new MastraAuthOkta({ ... }),
 *     rbac: new StaticRBACProvider({
 *       roles: DEFAULT_ROLES,
 *       getUserRoles: (user) => [user.role],
 *     }),
 *   },
 * });
 * ```
 */
export type StudioConfig = {
  /**
   * Authentication provider for Studio UI.
   *
   * Handles WHO can access Studio (authentication only).
   * For authorization (WHAT users can do in Studio), use the `rbac` option.
   *
   * When not configured, Studio operates without authentication (development mode).
   */
  auth?: MastraAuthConfig<any> | IMastraAuthProvider<any>;

  /**
   * Role-based access control (RBAC) provider for Studio.
   *
   * Handles WHAT authenticated Studio users can do.
   * Controls access to Studio features like team management, user listing, etc.
   *
   * @example
   * ```typescript
   * rbac: new StaticRBACProvider({
   *   roles: DEFAULT_ROLES,
   *   getUserRoles: (user) => [user.role],
   * }),
   * ```
   */
  rbac?: IRBACProvider<any>;

  /**
   * FGA provider for fine-grained authorization in Studio.
   *
   * Enables relationship-based access control for Studio resources.
   */
  fga?: IFGAProvider<any>;
};
