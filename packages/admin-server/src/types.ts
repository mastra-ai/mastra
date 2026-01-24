import type { MastraAdmin, AdminLogger, User, Team, TeamMember, Permission, TeamRole } from '@mastra/admin';
import type { z } from 'zod';

/**
 * CORS configuration options.
 */
export interface CorsOptions {
  /**
   * Allowed origins. Can be a string, array of strings, or function.
   */
  origin?: string | string[] | ((origin: string) => boolean);
  /**
   * Allowed HTTP methods.
   */
  allowMethods?: string[];
  /**
   * Allowed headers.
   */
  allowHeaders?: string[];
  /**
   * Headers to expose to the client.
   */
  exposeHeaders?: string[];
  /**
   * Max age in seconds for preflight cache.
   */
  maxAge?: number;
  /**
   * Allow credentials (cookies, authorization headers).
   */
  credentials?: boolean;
}

/**
 * Rate limiting configuration options.
 */
export interface RateLimitOptions {
  /**
   * Window size in milliseconds.
   */
  windowMs?: number;
  /**
   * Maximum requests per window.
   */
  max?: number;
  /**
   * Custom key generator for rate limiting.
   */
  keyGenerator?: (context: RateLimitContext) => string;
}

/**
 * Context for rate limit key generation.
 */
export interface RateLimitContext {
  path: string;
  method: string;
  ip: string;
  userId?: string;
}

/**
 * Context for error handling.
 */
export interface ErrorContext {
  path: string;
  method: string;
  userId?: string;
  teamId?: string;
}

/**
 * AdminServer configuration options.
 */
export interface AdminServerConfig {
  /**
   * MastraAdmin instance - contains all business logic.
   * Routes delegate to this instance for all operations.
   */
  admin: MastraAdmin;

  /**
   * Server port (default: 3000).
   */
  port?: number;

  /**
   * Server host (default: 'localhost').
   */
  host?: string;

  /**
   * Base path for all API routes (default: '/api').
   */
  basePath?: string;

  /**
   * CORS configuration.
   */
  cors?: CorsOptions;

  /**
   * Rate limiting options.
   */
  rateLimit?: RateLimitOptions;

  /**
   * Request timeout in ms (default: 30000).
   */
  timeout?: number;

  /**
   * Maximum request body size in bytes (default: 10MB).
   */
  maxBodySize?: number;

  /**
   * Enable build worker (processes build queue).
   * Default: true
   */
  enableBuildWorker?: boolean;

  /**
   * Build worker polling interval in ms (default: 5000).
   */
  buildWorkerIntervalMs?: number;

  /**
   * Enable health check worker.
   * Default: true
   */
  enableHealthWorker?: boolean;

  /**
   * Health check interval in ms (default: 30000).
   */
  healthCheckIntervalMs?: number;

  /**
   * Enable WebSocket support for real-time logs.
   * Default: true
   */
  enableWebSocket?: boolean;

  /**
   * Enable request logging.
   * Default: true in development
   */
  enableRequestLogging?: boolean;

  /**
   * Custom error handler.
   */
  onError?: (error: Error, context: ErrorContext) => Response | void;
}

/**
 * Server status information.
 */
export interface ServerStatus {
  running: boolean;
  uptime: number;
  buildWorkerActive: boolean;
  healthWorkerActive: boolean;
  wsConnectionCount: number;
  port: number;
  host: string;
}

/**
 * Resolved AdminServer configuration with all defaults applied.
 */
export interface ResolvedAdminServerConfig {
  admin: MastraAdmin;
  port: number;
  host: string;
  basePath: string;
  cors: CorsOptions;
  rateLimit?: RateLimitOptions;
  timeout: number;
  maxBodySize: number;
  enableBuildWorker: boolean;
  buildWorkerIntervalMs: number;
  enableHealthWorker: boolean;
  healthCheckIntervalMs: number;
  enableWebSocket: boolean;
  enableRequestLogging: boolean;
  onError?: (error: Error, context: ErrorContext) => Response | void;
}

/**
 * Context available to all route handlers.
 */
export interface AdminServerContext {
  /**
   * MastraAdmin instance for business logic.
   */
  admin: MastraAdmin;

  /**
   * Authenticated user (null if not authenticated).
   */
  user?: User;

  /**
   * Authenticated user ID.
   */
  userId: string;

  /**
   * Current team (if applicable).
   */
  team?: Team;

  /**
   * Current team ID (if applicable).
   */
  teamId?: string;

  /**
   * User's permissions for the current team.
   */
  permissions: Permission[];

  /**
   * Request abort signal.
   */
  abortSignal: AbortSignal;

  /**
   * Logger instance.
   */
  logger: AdminLogger;
}

/**
 * Route handler function type.
 */
export type AdminRouteHandler<TParams = unknown, TResult = unknown> = (
  params: TParams & AdminServerContext,
) => Promise<TResult>;

/**
 * Response type for routes.
 */
export type AdminRouteResponseType = 'json' | 'stream';

/**
 * Admin server route definition.
 */
export interface AdminServerRoute<TPathParams = unknown, TQueryParams = unknown, TBody = unknown, TResponse = unknown> {
  /**
   * HTTP method.
   */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /**
   * Route path (e.g., '/teams/:teamId').
   */
  path: string;

  /**
   * Response type.
   */
  responseType: AdminRouteResponseType;

  /**
   * Route handler function.
   */
  handler: AdminRouteHandler<TPathParams & TQueryParams & TBody, TResponse>;

  /**
   * Path parameter validation schema.
   */
  pathParamSchema?: z.ZodSchema<TPathParams>;

  /**
   * Query parameter validation schema.
   */
  queryParamSchema?: z.ZodSchema<TQueryParams>;

  /**
   * Request body validation schema.
   */
  bodySchema?: z.ZodSchema<TBody>;

  /**
   * Response validation schema.
   */
  responseSchema?: z.ZodSchema<TResponse>;

  /**
   * Whether the route requires authentication.
   * Default: true
   */
  requiresAuth?: boolean;

  /**
   * Route summary for documentation.
   */
  summary?: string;

  /**
   * Route description for documentation.
   */
  description?: string;

  /**
   * Tags for documentation grouping.
   */
  tags?: string[];

  /**
   * Whether the route is deprecated.
   */
  deprecated?: boolean;

  /**
   * Max body size for this specific route (overrides server default).
   */
  maxBodySize?: number;
}

/**
 * Error response format.
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Hono context variables for AdminServer.
 * These are set by middleware and available to route handlers.
 */
export interface AdminServerVariables {
  /**
   * MastraAdmin instance for business logic.
   */
  admin: MastraAdmin;

  /**
   * Base path for the API (e.g., '/api').
   */
  basePath: string;

  /**
   * Unique request ID for tracing.
   */
  requestId: string;

  /**
   * Request abort signal.
   */
  abortSignal: AbortSignal;

  /**
   * Authenticated user object (set by auth middleware).
   */
  user?: User;

  /**
   * Authenticated user ID (set by auth middleware).
   */
  userId?: string;

  /**
   * Current team object (set by RBAC/team context middleware).
   */
  team?: Team;

  /**
   * Current team ID (set by RBAC/team context middleware).
   */
  teamId?: string;

  /**
   * Current team member record (set by RBAC/team context middleware).
   */
  teamMember?: TeamMember;

  /**
   * Current team role (set by team context middleware).
   */
  teamRole?: TeamRole;

  /**
   * User's permissions for the current team (set by RBAC middleware).
   */
  permissions?: Permission[];
}

/**
 * Log entry for request logging.
 */
export interface LogEntry {
  method: string;
  path: string;
  status: number;
  duration: number;
  userId?: string;
  teamId?: string;
  requestId: string;
  userAgent?: string;
  ip?: string;
}
