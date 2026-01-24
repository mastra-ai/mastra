import type {
  BuildStatus,
  BuildTrigger,
  DeploymentStatus,
  DeploymentType,
  HealthStatus,
  RouteStatus,
  SourceType,
  TeamRole,
} from './constants';

// ============================================================================
// User & Authentication
// ============================================================================

/**
 * User entity representing an authenticated user.
 * Note: Auth is handled by @mastra/auth-* packages.
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Team & Membership
// ============================================================================

/**
 * Team settings configuration.
 */
export interface TeamSettings {
  /** Maximum number of projects allowed */
  maxProjects?: number;
  /** Maximum number of concurrent deployments */
  maxConcurrentDeployments?: number;
  /** Default environment variables for all projects */
  defaultEnvVars?: Record<string, string>;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Team entity representing an organizational unit.
 */
export interface Team {
  id: string;
  name: string;
  slug: string;
  settings: TeamSettings;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team member representing a user's membership in a team.
 */
export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team invitation for pending members.
 */
export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
}

// ============================================================================
// Project Configuration
// ============================================================================

/**
 * Local filesystem source configuration.
 */
export interface LocalSourceConfig {
  /** Absolute path to the project directory */
  path: string;
}

/**
 * GitHub source configuration.
 */
export interface GitHubSourceConfig {
  /** GitHub repository full name (e.g., "owner/repo") */
  repoFullName: string;
  /** GitHub installation ID */
  installationId: string;
  /** Whether the repository is private */
  isPrivate: boolean;
}

/**
 * Encrypted environment variable.
 */
export interface EncryptedEnvVar {
  key: string;
  /** Encrypted value (base64 encoded) */
  encryptedValue: string;
  /** Whether this is a secret (hidden in UI) */
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project entity representing a Mastra codebase.
 */
export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;

  /** Source type: 'local' or 'github' */
  sourceType: SourceType;
  /** Source-specific configuration */
  sourceConfig: LocalSourceConfig | GitHubSourceConfig;

  /** Default branch for production deployments */
  defaultBranch: string;
  /** Base environment variables inherited by all deployments */
  envVars: EncryptedEnvVar[];

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Deployment & Build
// ============================================================================

/**
 * Deployment entity representing a running instance of a project.
 */
export interface Deployment {
  id: string;
  projectId: string;

  /** Deployment type: production, staging, or preview */
  type: DeploymentType;
  /** Branch name (e.g., "main", "staging", "feature-x") */
  branch: string;
  /** URL-safe identifier for routing */
  slug: string;

  /** Current deployment status */
  status: DeploymentStatus;
  /** ID of the currently deployed build */
  currentBuildId: string | null;

  /** Public URL (e.g., "https://feature-x--job-agent.company.com") */
  publicUrl: string | null;
  /** Internal host (e.g., "localhost:3001") */
  internalHost: string | null;

  /** Environment variable overrides for this deployment */
  envVarOverrides: EncryptedEnvVar[];

  /** Whether to auto-shutdown after inactivity (for previews) */
  autoShutdown: boolean;
  /** Auto-delete date for preview deployments */
  expiresAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Build entity representing a single build attempt.
 */
export interface Build {
  id: string;
  deploymentId: string;

  /** What triggered this build */
  trigger: BuildTrigger;
  /** User ID or 'system' */
  triggeredBy: string;

  /** Git commit SHA */
  commitSha: string;
  /** Git commit message */
  commitMessage: string | null;

  /** Build status */
  status: BuildStatus;

  /** Build logs (streamed/appended) */
  logs: string;

  /** When the build was queued */
  queuedAt: Date;
  /** When the build started */
  startedAt: Date | null;
  /** When the build completed */
  completedAt: Date | null;

  /** Error message if failed */
  errorMessage: string | null;
}

/**
 * Running server entity representing runtime state.
 */
export interface RunningServer {
  id: string;
  deploymentId: string;
  buildId: string;

  /** Process ID (for local runner) */
  processId: number | null;
  /** Container ID (for K8s runner) */
  containerId: string | null;

  /** Host address */
  host: string;
  /** Port number */
  port: number;

  /** Health status */
  healthStatus: HealthStatus;
  /** Last health check timestamp */
  lastHealthCheck: Date | null;

  /** Memory usage in MB */
  memoryUsageMb: number | null;
  /** CPU usage percentage */
  cpuPercent: number | null;

  startedAt: Date;
  stoppedAt: Date | null;
}

// ============================================================================
// Routing
// ============================================================================

/**
 * Route configuration for edge routing.
 */
export interface RouteConfig {
  deploymentId: string;
  projectId: string;
  /** Subdomain (e.g., "job-matching-agent" or "pr-456--job-matching-agent") */
  subdomain: string;
  /** Target host (e.g., "localhost") */
  targetHost: string;
  /** Target port (e.g., 3001) */
  targetPort: number;
  /** Enable TLS (default: true for production routers) */
  tls?: boolean;
}

/**
 * Route information returned after registration.
 */
export interface RouteInfo {
  routeId: string;
  deploymentId: string;
  /** Full public URL */
  publicUrl: string;
  /** Route status */
  status: RouteStatus;
  createdAt: Date;
  lastHealthCheck?: Date;
}

/**
 * Route health check result.
 */
export interface RouteHealthStatus {
  healthy: boolean;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
}

// ============================================================================
// Project Source
// ============================================================================

/**
 * Project source information from a source provider.
 */
export interface ProjectSource {
  id: string;
  name: string;
  type: SourceType;
  /** Local path or GitHub repo full name */
  path: string;
  defaultBranch?: string;
  metadata?: Record<string, unknown>;
}

/**
 * File change event from source watchers.
 */
export interface ChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: Date;
}

// ============================================================================
// File Storage
// ============================================================================

/**
 * File information from file storage.
 */
export interface FileInfo {
  path: string;
  size: number;
  lastModified: Date;
}

// ============================================================================
// API Tokens
// ============================================================================

/**
 * Project API token for programmatic access.
 */
export interface ProjectApiToken {
  id: string;
  projectId: string;
  name: string;
  /** Token prefix for identification (e.g., "mst_") */
  tokenPrefix: string;
  /** Hashed token value */
  tokenHash: string;
  /** Scopes/permissions */
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}
