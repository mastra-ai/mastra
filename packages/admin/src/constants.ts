/**
 * Registered component types for logging and identification.
 */
export const RegisteredAdminComponent = {
  ADMIN: 'ADMIN',
  LICENSE: 'LICENSE',
  RBAC: 'RBAC',
  STORAGE: 'ADMIN_STORAGE',
  RUNNER: 'RUNNER',
  ROUTER: 'ROUTER',
  SOURCE: 'SOURCE',
  BILLING: 'BILLING',
  EMAIL: 'EMAIL',
  ENCRYPTION: 'ENCRYPTION',
  OBSERVABILITY: 'OBSERVABILITY',
  FILE_STORAGE: 'FILE_STORAGE',
} as const;

export type RegisteredAdminComponent = (typeof RegisteredAdminComponent)[keyof typeof RegisteredAdminComponent];

/**
 * Deployment status values.
 */
export const DeploymentStatus = {
  PENDING: 'pending',
  BUILDING: 'building',
  RUNNING: 'running',
  STOPPED: 'stopped',
  FAILED: 'failed',
} as const;

export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

/**
 * Deployment type values.
 */
export const DeploymentType = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  PREVIEW: 'preview',
} as const;

export type DeploymentType = (typeof DeploymentType)[keyof typeof DeploymentType];

/**
 * Build status values.
 */
export const BuildStatus = {
  QUEUED: 'queued',
  BUILDING: 'building',
  DEPLOYING: 'deploying',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type BuildStatus = (typeof BuildStatus)[keyof typeof BuildStatus];

/**
 * Build trigger types.
 */
export const BuildTrigger = {
  MANUAL: 'manual',
  WEBHOOK: 'webhook',
  SCHEDULE: 'schedule',
  ROLLBACK: 'rollback',
} as const;

export type BuildTrigger = (typeof BuildTrigger)[keyof typeof BuildTrigger];

/**
 * Server health status values.
 */
export const HealthStatus = {
  STARTING: 'starting',
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  STOPPING: 'stopping',
} as const;

export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

/**
 * Project source types.
 */
export const SourceType = {
  LOCAL: 'local',
  GITHUB: 'github',
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

/**
 * Team member roles.
 */
export const TeamRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
} as const;

export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];

/**
 * Route status values.
 */
export const RouteStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  UNHEALTHY: 'unhealthy',
  ERROR: 'error',
} as const;

export type RouteStatus = (typeof RouteStatus)[keyof typeof RouteStatus];
