// ============================================================================
// Enums / Constants
// ============================================================================

export const DeploymentStatus = {
  PENDING: 'pending',
  BUILDING: 'building',
  RUNNING: 'running',
  STOPPED: 'stopped',
  FAILED: 'failed',
} as const;

export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const DeploymentType = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  PREVIEW: 'preview',
} as const;

export type DeploymentType = (typeof DeploymentType)[keyof typeof DeploymentType];

export const BuildStatus = {
  QUEUED: 'queued',
  BUILDING: 'building',
  DEPLOYING: 'deploying',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type BuildStatus = (typeof BuildStatus)[keyof typeof BuildStatus];

export const BuildTrigger = {
  MANUAL: 'manual',
  WEBHOOK: 'webhook',
  SCHEDULE: 'schedule',
  ROLLBACK: 'rollback',
} as const;

export type BuildTrigger = (typeof BuildTrigger)[keyof typeof BuildTrigger];

export const HealthStatus = {
  STARTING: 'starting',
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  STOPPING: 'stopping',
} as const;

export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

export const SourceType = {
  LOCAL: 'local',
  GITHUB: 'github',
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const TeamRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
} as const;

export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];

// ============================================================================
// User & Authentication
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Team & Membership
// ============================================================================

export interface TeamSettings {
  maxProjects?: number;
  maxConcurrentDeployments?: number;
  defaultEnvVars?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  settings: TeamSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  createdAt: string;
  updatedAt: string;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

// ============================================================================
// Project Configuration
// ============================================================================

export interface LocalSourceConfig {
  path: string;
}

export interface GitHubSourceConfig {
  repoFullName: string;
  installationId: string;
  isPrivate: boolean;
}

export interface EncryptedEnvVar {
  key: string;
  encryptedValue: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  sourceType: SourceType;
  sourceConfig: LocalSourceConfig | GitHubSourceConfig;
  defaultBranch: string;
  envVars: EncryptedEnvVar[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  slug?: string;
  sourceType: SourceType;
  sourceConfig: LocalSourceConfig | GitHubSourceConfig;
  defaultBranch?: string;
}

// ============================================================================
// Deployment & Build
// ============================================================================

export interface Deployment {
  id: string;
  projectId: string;
  type: DeploymentType;
  branch: string;
  slug: string;
  status: DeploymentStatus;
  currentBuildId: string | null;
  publicUrl: string | null;
  internalHost: string | null;
  envVarOverrides: EncryptedEnvVar[];
  autoShutdown: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeploymentInput {
  type: DeploymentType;
  branch: string;
  slug?: string;
  autoShutdown?: boolean;
  envVarOverrides?: Array<{ key: string; value: string; isSecret: boolean }>;
}

export interface Build {
  id: string;
  deploymentId: string;
  trigger: BuildTrigger;
  triggeredBy: string;
  commitSha: string;
  commitMessage: string | null;
  status: BuildStatus;
  logs: string;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface RunningServer {
  id: string;
  deploymentId: string;
  buildId: string;
  processId: number | null;
  containerId: string | null;
  host: string;
  port: number;
  healthStatus: HealthStatus;
  lastHealthCheck: string | null;
  memoryUsageMb: number | null;
  cpuPercent: number | null;
  startedAt: string;
  stoppedAt: string | null;
}

// ============================================================================
// Project Source
// ============================================================================

export interface ProjectSource {
  id: string;
  name: string;
  type: SourceType;
  path: string;
  defaultBranch?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// API Tokens
// ============================================================================

export interface ProjectApiToken {
  id: string;
  projectId: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// ============================================================================
// Server Health & Metrics
// ============================================================================

export interface ServerHealthDetails {
  memoryUsageMb?: number;
  cpuPercent?: number;
  uptime?: number;
  lastError?: string;
}

export interface ServerMetrics {
  memoryUsageMb: number;
  memoryLimitMb: number;
  cpuPercent: number;
  requestCount: number;
  requestLatencyP50Ms: number;
  requestLatencyP99Ms: number;
  errorRate: number;
  uptime: number;
}

// ============================================================================
// Observability
// ============================================================================

export interface Trace {
  traceId: string;
  projectId: string;
  deploymentId: string;
  name: string;
  status: 'ok' | 'error' | 'unset';
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
}

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  projectId: string;
  deploymentId: string;
  name: string;
  kind: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  status: 'ok' | 'error' | 'unset';
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes: Record<string, unknown>;
}

export interface Log {
  id: string;
  projectId: string;
  deploymentId: string;
  traceId: string | null;
  spanId: string | null;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  attributes: Record<string, unknown>;
}

export interface Metric {
  id: string;
  projectId: string;
  deploymentId: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  unit: string | null;
  timestamp: string;
  labels: Record<string, string>;
}

export interface Score {
  id: string;
  projectId: string;
  deploymentId: string;
  traceId: string | null;
  name: string;
  value: number;
  normalizedValue: number | null;
  comment: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface AggregatedMetrics {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorCount: number;
  timeRange: {
    start: string;
    end: string;
  };
  timeSeries?: MetricDataPoint[];
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface TraceQueryParams {
  page?: number;
  perPage?: number;
  status?: 'ok' | 'error' | 'unset';
  name?: string;
  startTime?: string;
  endTime?: string;
  deploymentId?: string;
}

export interface LogQueryParams {
  page?: number;
  perPage?: number;
  level?: 'debug' | 'info' | 'warn' | 'error';
  search?: string;
  startTime?: string;
  endTime?: string;
  deploymentId?: string;
  traceId?: string;
}

export interface MetricQueryParams {
  name?: string;
  startTime?: string;
  endTime?: string;
  deploymentId?: string;
  interval?: string;
}

export interface ScoreQueryParams {
  page?: number;
  perPage?: number;
  name?: string;
  startTime?: string;
  endTime?: string;
  deploymentId?: string;
  traceId?: string;
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}
