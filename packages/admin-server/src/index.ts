// Main exports
export { AdminServer } from './server';
export type {
  AdminServerConfig,
  AdminServerContext,
  AdminServerVariables,
  ServerStatus,
  CorsOptions,
  RateLimitOptions,
  ErrorContext,
  RateLimitContext,
  AdminServerRoute,
  AdminRouteHandler,
  AdminRouteResponseType,
  ErrorResponse,
  LogEntry,
} from './types';

// Route exports
export { ADMIN_SERVER_ROUTES } from './routes';

// Middleware exports
export { createAuthMiddleware } from './middleware/auth';
export type { AuthMiddlewareConfig } from './middleware/auth';

export { createRBACMiddleware } from './middleware/rbac';
export type { RBACMiddlewareConfig, RBACVariables } from './middleware/rbac';

export { createTeamContextMiddleware } from './middleware/team-context';
export type { TeamContextMiddlewareConfig, TeamContextVariables } from './middleware/team-context';

export { errorHandler } from './middleware/error-handler';

export { createRequestLoggerMiddleware } from './middleware/request-logger';
export type { RequestLoggerConfig } from './middleware/request-logger';
