# LANE 1: @mastra/admin Core Package Implementation Plan

**Plan File**: `2025-01-23-admin-core.md`
**Priority**: P0 (Must be completed first)
**Dependencies**: None (foundation)
**Master Plan Reference**: `2025-01-23-mastra-admin-master-plan.md`

---

## Overview

This plan covers the implementation of `@mastra/admin`, the foundational core package for the MastraAdmin platform.

**Architecture Pattern**: This package follows the same pattern as `@mastra/core`:
- `@mastra/core` → `Mastra` class = Central orchestrator with business logic methods
- `@mastra/admin` → `MastraAdmin` class = Central orchestrator with business logic methods

The `MastraAdmin` class is **NOT just a configuration container** - it contains all the business logic methods like `createTeam()`, `createProject()`, `deploy()`, etc. The companion package `@mastra/admin-server` (LANE 1.5) is just an HTTP wrapper that injects `MastraAdmin` into handlers, exactly like how `@mastra/server` wraps `Mastra`.

This package provides:

1. **MastraAdmin class** - Central orchestrator with business logic methods:
   - Team management: `createTeam()`, `getTeam()`, `listTeams()`, `inviteMember()`, etc.
   - Project management: `createProject()`, `getProject()`, `setEnvVar()`, etc.
   - Deployment management: `createDeployment()`, `deploy()`, `stop()`, `rollback()`, etc.
   - Build management: `triggerBuild()`, `getBuild()`, `getBuildLogs()`, etc.
2. **BuildOrchestrator** - Internal class that manages build queue and deploy flow
3. **Abstract provider interfaces** - Contracts for all pluggable components
4. **Core entity types** - User, Team, Project, Deployment, Build, etc.
5. **License validation** - Feature gating and tier management
6. **RBAC system** - Role-based access control (types and permission checking)
7. **Error handling** - Structured error classes
8. **Built-in simple providers** - NoBilling, ConsoleEmail, NodeCrypto

---

## Directory Structure

```
packages/admin/
├── src/
│   ├── index.ts                           # Main exports
│   ├── mastra-admin.ts                    # MastraAdmin class (central orchestrator)
│   ├── types.ts                           # Core entity types
│   ├── errors.ts                          # Error classes
│   ├── constants.ts                       # Registered components, status enums
│   │
│   ├── orchestrator/
│   │   ├── index.ts                       # Orchestrator exports
│   │   ├── build-orchestrator.ts          # BuildOrchestrator class
│   │   └── types.ts                       # Build queue types
│   │
│   ├── license/
│   │   ├── index.ts                       # License exports
│   │   ├── validator.ts                   # LicenseValidator class
│   │   ├── types.ts                       # License types and features
│   │   └── features.ts                    # Feature gating logic
│   │
│   ├── providers/
│   │   ├── index.ts                       # Provider exports
│   │   │
│   │   ├── storage/
│   │   │   ├── index.ts
│   │   │   └── base.ts                    # AdminStorage interface
│   │   │
│   │   ├── file-storage/
│   │   │   ├── index.ts
│   │   │   └── base.ts                    # FileStorageProvider interface
│   │   │
│   │   ├── observability/
│   │   │   ├── index.ts
│   │   │   ├── writer.ts                  # ObservabilityWriter interface
│   │   │   ├── query-provider.ts          # ObservabilityQueryProvider interface
│   │   │   └── types.ts                   # Trace, Span, Log, Metric, Score
│   │   │
│   │   ├── runner/
│   │   │   ├── index.ts
│   │   │   └── base.ts                    # ProjectRunner interface
│   │   │
│   │   ├── router/
│   │   │   ├── index.ts
│   │   │   └── base.ts                    # EdgeRouterProvider interface
│   │   │
│   │   ├── source/
│   │   │   ├── index.ts
│   │   │   └── base.ts                    # ProjectSourceProvider interface
│   │   │
│   │   ├── billing/
│   │   │   ├── index.ts
│   │   │   ├── base.ts                    # BillingProvider interface
│   │   │   └── no-billing.ts              # NoBillingProvider implementation
│   │   │
│   │   ├── email/
│   │   │   ├── index.ts
│   │   │   ├── base.ts                    # EmailProvider interface
│   │   │   └── console.ts                 # ConsoleEmailProvider implementation
│   │   │
│   │   └── encryption/
│   │       ├── index.ts
│   │       ├── base.ts                    # EncryptionProvider interface
│   │       └── node-crypto.ts             # NodeCryptoEncryptionProvider
│   │
│   └── rbac/
│       ├── index.ts                       # RBAC exports
│       ├── manager.ts                     # RBACManager class
│       ├── roles.ts                       # Default role definitions
│       └── types.ts                       # RBAC types
│
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## Phase 1: Package Setup

### 1.1 package.json

```json
{
  "name": "@mastra/admin",
  "version": "0.1.0",
  "description": "MastraAdmin core - enterprise platform for running many Mastra servers",
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./license": {
      "import": {
        "types": "./dist/license/index.d.ts",
        "default": "./dist/license/index.js"
      },
      "require": {
        "types": "./dist/license/index.d.ts",
        "default": "./dist/license/index.cjs"
      }
    },
    "./providers": {
      "import": {
        "types": "./dist/providers/index.d.ts",
        "default": "./dist/providers/index.js"
      },
      "require": {
        "types": "./dist/providers/index.d.ts",
        "default": "./dist/providers/index.cjs"
      }
    },
    "./rbac": {
      "import": {
        "types": "./dist/rbac/index.d.ts",
        "default": "./dist/rbac/index.js"
      },
      "require": {
        "types": "./dist/rbac/index.d.ts",
        "default": "./dist/rbac/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "files": [
    "dist",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build:lib": "tsup --silent --config tsup.config.ts",
    "build": "pnpm build:lib",
    "build:watch": "pnpm build:lib --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest watch"
  },
  "dependencies": {},
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@internal/types-builder": "workspace:*",
    "@mastra/core": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "tsup": "catalog:"
  },
  "peerDependencies": {
    "@mastra/core": ">=1.0.0-0 <2.0.0-0"
  },
  "engines": {
    "node": ">=22.13.0"
  }
}
```

### 1.2 tsconfig.json

```json
{
  "extends": "../../tsconfig.node.json",
  "include": ["src/**/*", "tsup.config.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "**/*.test.ts"],
  "compilerOptions": {
    "lib": ["ES2023"]
  }
}
```

### 1.3 tsup.config.ts

```typescript
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'license/index': 'src/license/index.ts',
    'providers/index': 'src/providers/index.ts',
    'rbac/index': 'src/rbac/index.ts',
  },
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
```

### 1.4 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

---

## Phase 2: Constants and Base Types

### 2.1 src/constants.ts

```typescript
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
```

### 2.2 src/types.ts

```typescript
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
```

---

## Phase 3: Error Handling

### 3.1 src/errors.ts

```typescript
import { MastraBaseError } from '@mastra/core/error';

/**
 * Error domains for MastraAdmin.
 */
export const AdminErrorDomain = {
  ADMIN: 'ADMIN',
  LICENSE: 'LICENSE',
  RBAC: 'RBAC',
  STORAGE: 'ADMIN_STORAGE',
  RUNNER: 'RUNNER',
  ROUTER: 'ROUTER',
  SOURCE: 'SOURCE',
  BILLING: 'BILLING',
  BUILD: 'BUILD',
  DEPLOYMENT: 'DEPLOYMENT',
  PROJECT: 'PROJECT',
  TEAM: 'TEAM',
} as const;

export type AdminErrorDomain = (typeof AdminErrorDomain)[keyof typeof AdminErrorDomain];

/**
 * Error categories for MastraAdmin.
 */
export const AdminErrorCategory = {
  /** User-caused errors (invalid input, permissions, etc.) */
  USER: 'USER',
  /** System/infrastructure errors */
  SYSTEM: 'SYSTEM',
  /** Third-party service errors */
  THIRD_PARTY: 'THIRD_PARTY',
  /** Configuration errors */
  CONFIG: 'CONFIG',
  /** License-related errors */
  LICENSE: 'LICENSE',
} as const;

export type AdminErrorCategory = (typeof AdminErrorCategory)[keyof typeof AdminErrorCategory];

/**
 * Base error class for all MastraAdmin errors.
 */
export class MastraAdminError extends MastraBaseError<AdminErrorDomain, AdminErrorCategory> {
  constructor(
    definition: {
      id: Uppercase<string>;
      text?: string;
      domain: AdminErrorDomain;
      category: AdminErrorCategory;
      details?: Record<string, unknown>;
    },
    originalError?: unknown,
  ) {
    super(definition, originalError);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // ============================================================================
  // Static Factory Methods - License
  // ============================================================================

  static invalidLicense(message?: string): MastraAdminError {
    return new MastraAdminError({
      id: 'INVALID_LICENSE',
      text: message ?? 'Invalid or expired license key',
      domain: AdminErrorDomain.LICENSE,
      category: AdminErrorCategory.LICENSE,
    });
  }

  static licenseExpired(expiresAt: Date): MastraAdminError {
    return new MastraAdminError({
      id: 'LICENSE_EXPIRED',
      text: `License expired on ${expiresAt.toISOString()}`,
      domain: AdminErrorDomain.LICENSE,
      category: AdminErrorCategory.LICENSE,
      details: { expiresAt: expiresAt.toISOString() },
    });
  }

  static featureNotLicensed(feature: string): MastraAdminError {
    return new MastraAdminError({
      id: 'FEATURE_NOT_LICENSED',
      text: `Feature '${feature}' is not available in your license tier`,
      domain: AdminErrorDomain.LICENSE,
      category: AdminErrorCategory.LICENSE,
      details: { feature },
    });
  }

  static licenseLimitExceeded(limit: string, current: number, max: number): MastraAdminError {
    return new MastraAdminError({
      id: 'LICENSE_LIMIT_EXCEEDED',
      text: `${limit} limit exceeded: ${current}/${max}`,
      domain: AdminErrorDomain.LICENSE,
      category: AdminErrorCategory.LICENSE,
      details: { limit, current, max },
    });
  }

  // ============================================================================
  // Static Factory Methods - RBAC
  // ============================================================================

  static accessDenied(resource: string, action: string): MastraAdminError {
    return new MastraAdminError({
      id: 'ACCESS_DENIED',
      text: `Access denied: cannot ${action} on ${resource}`,
      domain: AdminErrorDomain.RBAC,
      category: AdminErrorCategory.USER,
      details: { resource, action },
    });
  }

  static roleNotFound(roleId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'ROLE_NOT_FOUND',
      text: `Role not found: ${roleId}`,
      domain: AdminErrorDomain.RBAC,
      category: AdminErrorCategory.USER,
      details: { roleId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Team
  // ============================================================================

  static teamNotFound(teamId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'TEAM_NOT_FOUND',
      text: `Team not found: ${teamId}`,
      domain: AdminErrorDomain.TEAM,
      category: AdminErrorCategory.USER,
      details: { teamId },
    });
  }

  static teamSlugExists(slug: string): MastraAdminError {
    return new MastraAdminError({
      id: 'TEAM_SLUG_EXISTS',
      text: `Team with slug '${slug}' already exists`,
      domain: AdminErrorDomain.TEAM,
      category: AdminErrorCategory.USER,
      details: { slug },
    });
  }

  static userNotTeamMember(userId: string, teamId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'USER_NOT_TEAM_MEMBER',
      text: `User is not a member of this team`,
      domain: AdminErrorDomain.TEAM,
      category: AdminErrorCategory.USER,
      details: { userId, teamId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Project
  // ============================================================================

  static projectNotFound(projectId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'PROJECT_NOT_FOUND',
      text: `Project not found: ${projectId}`,
      domain: AdminErrorDomain.PROJECT,
      category: AdminErrorCategory.USER,
      details: { projectId },
    });
  }

  static projectSlugExists(slug: string, teamId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'PROJECT_SLUG_EXISTS',
      text: `Project with slug '${slug}' already exists in this team`,
      domain: AdminErrorDomain.PROJECT,
      category: AdminErrorCategory.USER,
      details: { slug, teamId },
    });
  }

  static invalidProjectSource(message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'INVALID_PROJECT_SOURCE',
      text: message,
      domain: AdminErrorDomain.SOURCE,
      category: AdminErrorCategory.USER,
    });
  }

  // ============================================================================
  // Static Factory Methods - Deployment
  // ============================================================================

  static deploymentNotFound(deploymentId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'DEPLOYMENT_NOT_FOUND',
      text: `Deployment not found: ${deploymentId}`,
      domain: AdminErrorDomain.DEPLOYMENT,
      category: AdminErrorCategory.USER,
      details: { deploymentId },
    });
  }

  static deploymentAlreadyExists(type: string, branch: string): MastraAdminError {
    return new MastraAdminError({
      id: 'DEPLOYMENT_ALREADY_EXISTS',
      text: `${type} deployment for branch '${branch}' already exists`,
      domain: AdminErrorDomain.DEPLOYMENT,
      category: AdminErrorCategory.USER,
      details: { type, branch },
    });
  }

  // ============================================================================
  // Static Factory Methods - Build
  // ============================================================================

  static buildNotFound(buildId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'BUILD_NOT_FOUND',
      text: `Build not found: ${buildId}`,
      domain: AdminErrorDomain.BUILD,
      category: AdminErrorCategory.USER,
      details: { buildId },
    });
  }

  static buildFailed(buildId: string, message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'BUILD_FAILED',
      text: message,
      domain: AdminErrorDomain.BUILD,
      category: AdminErrorCategory.SYSTEM,
      details: { buildId },
    });
  }

  static buildCancelled(buildId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'BUILD_CANCELLED',
      text: `Build was cancelled: ${buildId}`,
      domain: AdminErrorDomain.BUILD,
      category: AdminErrorCategory.USER,
      details: { buildId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Runner
  // ============================================================================

  static runnerError(message: string, details?: Record<string, unknown>): MastraAdminError {
    return new MastraAdminError({
      id: 'RUNNER_ERROR',
      text: message,
      domain: AdminErrorDomain.RUNNER,
      category: AdminErrorCategory.SYSTEM,
      details,
    });
  }

  static serverStartFailed(deploymentId: string, message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'SERVER_START_FAILED',
      text: message,
      domain: AdminErrorDomain.RUNNER,
      category: AdminErrorCategory.SYSTEM,
      details: { deploymentId },
    });
  }

  static healthCheckFailed(serverId: string, message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'HEALTH_CHECK_FAILED',
      text: message,
      domain: AdminErrorDomain.RUNNER,
      category: AdminErrorCategory.SYSTEM,
      details: { serverId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Router
  // ============================================================================

  static routerError(message: string, details?: Record<string, unknown>): MastraAdminError {
    return new MastraAdminError({
      id: 'ROUTER_ERROR',
      text: message,
      domain: AdminErrorDomain.ROUTER,
      category: AdminErrorCategory.SYSTEM,
      details,
    });
  }

  static routeNotFound(routeId: string): MastraAdminError {
    return new MastraAdminError({
      id: 'ROUTE_NOT_FOUND',
      text: `Route not found: ${routeId}`,
      domain: AdminErrorDomain.ROUTER,
      category: AdminErrorCategory.USER,
      details: { routeId },
    });
  }

  // ============================================================================
  // Static Factory Methods - Configuration
  // ============================================================================

  static configurationError(message: string): MastraAdminError {
    return new MastraAdminError({
      id: 'CONFIGURATION_ERROR',
      text: message,
      domain: AdminErrorDomain.ADMIN,
      category: AdminErrorCategory.CONFIG,
    });
  }

  static providerNotConfigured(provider: string): MastraAdminError {
    return new MastraAdminError({
      id: 'PROVIDER_NOT_CONFIGURED',
      text: `Provider '${provider}' is not configured`,
      domain: AdminErrorDomain.ADMIN,
      category: AdminErrorCategory.CONFIG,
      details: { provider },
    });
  }

  static storageError(message: string, originalError?: unknown): MastraAdminError {
    return new MastraAdminError(
      {
        id: 'STORAGE_ERROR',
        text: message,
        domain: AdminErrorDomain.STORAGE,
        category: AdminErrorCategory.SYSTEM,
      },
      originalError,
    );
  }
}
```

---

## Phase 4: Provider Interfaces

### 4.1 src/providers/storage/base.ts - AdminStorage Interface

```typescript
import type {
  Build,
  Deployment,
  EncryptedEnvVar,
  Project,
  ProjectApiToken,
  RunningServer,
  Team,
  TeamInvite,
  TeamMember,
  User,
} from '../../types';
import type { BuildStatus, DeploymentStatus, TeamRole } from '../../constants';

/**
 * Pagination parameters for list operations.
 */
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

/**
 * Paginated result container.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

/**
 * Abstract interface for admin storage operations.
 * Implementations: PostgresAdminStorage (stores/admin-pg/)
 */
export interface AdminStorage {
  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Initialize the storage (create tables, run migrations).
   */
  init(): Promise<void>;

  /**
   * Close the storage connection.
   */
  close(): Promise<void>;

  // ============================================================================
  // User Operations
  // ============================================================================

  getUser(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>;

  // ============================================================================
  // Team Operations
  // ============================================================================

  getTeam(teamId: string): Promise<Team | null>;
  getTeamBySlug(slug: string): Promise<Team | null>;
  listTeamsForUser(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<Team>>;
  createTeam(team: Omit<Team, 'createdAt' | 'updatedAt'>): Promise<Team>;
  updateTeam(teamId: string, updates: Partial<Omit<Team, 'id' | 'createdAt'>>): Promise<Team>;
  deleteTeam(teamId: string): Promise<void>;

  // ============================================================================
  // Team Member Operations
  // ============================================================================

  getTeamMember(teamId: string, userId: string): Promise<TeamMember | null>;
  listTeamMembers(teamId: string, pagination?: PaginationParams): Promise<PaginatedResult<TeamMember & { user: User }>>;
  addTeamMember(member: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<TeamMember>;
  updateTeamMemberRole(teamId: string, userId: string, role: TeamRole): Promise<TeamMember>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;

  // ============================================================================
  // Team Invite Operations
  // ============================================================================

  getTeamInvite(inviteId: string): Promise<TeamInvite | null>;
  getTeamInviteByEmail(teamId: string, email: string): Promise<TeamInvite | null>;
  listTeamInvites(teamId: string): Promise<TeamInvite[]>;
  createTeamInvite(invite: Omit<TeamInvite, 'id' | 'createdAt'>): Promise<TeamInvite>;
  deleteTeamInvite(inviteId: string): Promise<void>;

  // ============================================================================
  // Project Operations
  // ============================================================================

  getProject(projectId: string): Promise<Project | null>;
  getProjectBySlug(teamId: string, slug: string): Promise<Project | null>;
  listProjectsForTeam(teamId: string, pagination?: PaginationParams): Promise<PaginatedResult<Project>>;
  createProject(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project>;
  updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'teamId' | 'createdAt'>>): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;

  // ============================================================================
  // Project Environment Variables
  // ============================================================================

  getProjectEnvVars(projectId: string): Promise<EncryptedEnvVar[]>;
  setProjectEnvVar(projectId: string, envVar: Omit<EncryptedEnvVar, 'createdAt' | 'updatedAt'>): Promise<EncryptedEnvVar>;
  deleteProjectEnvVar(projectId: string, key: string): Promise<void>;

  // ============================================================================
  // Project API Tokens
  // ============================================================================

  getProjectApiToken(tokenId: string): Promise<ProjectApiToken | null>;
  getProjectApiTokenByHash(tokenHash: string): Promise<ProjectApiToken | null>;
  listProjectApiTokens(projectId: string): Promise<ProjectApiToken[]>;
  createProjectApiToken(token: Omit<ProjectApiToken, 'createdAt' | 'lastUsedAt'>): Promise<ProjectApiToken>;
  updateProjectApiTokenLastUsed(tokenId: string): Promise<void>;
  deleteProjectApiToken(tokenId: string): Promise<void>;

  // ============================================================================
  // Deployment Operations
  // ============================================================================

  getDeployment(deploymentId: string): Promise<Deployment | null>;
  getDeploymentBySlug(projectId: string, slug: string): Promise<Deployment | null>;
  listDeploymentsForProject(projectId: string, pagination?: PaginationParams): Promise<PaginatedResult<Deployment>>;
  createDeployment(deployment: Omit<Deployment, 'createdAt' | 'updatedAt'>): Promise<Deployment>;
  updateDeployment(deploymentId: string, updates: Partial<Omit<Deployment, 'id' | 'projectId' | 'createdAt'>>): Promise<Deployment>;
  updateDeploymentStatus(deploymentId: string, status: DeploymentStatus): Promise<Deployment>;
  deleteDeployment(deploymentId: string): Promise<void>;

  // ============================================================================
  // Build Operations
  // ============================================================================

  getBuild(buildId: string): Promise<Build | null>;
  listBuildsForDeployment(deploymentId: string, pagination?: PaginationParams): Promise<PaginatedResult<Build>>;
  createBuild(build: Omit<Build, 'startedAt' | 'completedAt'>): Promise<Build>;
  updateBuild(buildId: string, updates: Partial<Omit<Build, 'id' | 'deploymentId' | 'queuedAt'>>): Promise<Build>;
  updateBuildStatus(buildId: string, status: BuildStatus, errorMessage?: string): Promise<Build>;
  appendBuildLogs(buildId: string, logs: string): Promise<void>;

  /** Get the next queued build for processing */
  dequeueNextBuild(): Promise<Build | null>;

  // ============================================================================
  // Running Server Operations
  // ============================================================================

  getRunningServer(serverId: string): Promise<RunningServer | null>;
  getRunningServerForDeployment(deploymentId: string): Promise<RunningServer | null>;
  listRunningServers(): Promise<RunningServer[]>;
  createRunningServer(server: Omit<RunningServer, 'stoppedAt'>): Promise<RunningServer>;
  updateRunningServer(serverId: string, updates: Partial<Omit<RunningServer, 'id' | 'deploymentId' | 'buildId' | 'startedAt'>>): Promise<RunningServer>;
  stopRunningServer(serverId: string): Promise<void>;

  // ============================================================================
  // RBAC Operations
  // ============================================================================

  /** Get all permissions for a user in a team */
  getUserPermissionsForTeam(userId: string, teamId: string): Promise<string[]>;

  /** Check if a user has a specific permission in a team */
  userHasPermission(userId: string, teamId: string, permission: string): Promise<boolean>;
}
```

### 4.2 src/providers/file-storage/base.ts - FileStorageProvider Interface

```typescript
import type { FileInfo } from '../../types';

/**
 * Abstract interface for file storage operations.
 * Used for observability data persistence.
 *
 * Implementations:
 * - LocalFileStorage (observability/file-local/)
 * - S3FileStorage (observability/file-s3/)
 * - GCSFileStorage (observability/file-gcs/)
 */
export interface FileStorageProvider {
  /** Storage type identifier */
  readonly type: 'local' | 's3' | 'gcs' | string;

  /**
   * Write content to a file.
   * Creates parent directories if they don't exist.
   */
  write(path: string, content: Buffer | string): Promise<void>;

  /**
   * Read a file's content.
   * @throws Error if file doesn't exist
   */
  read(path: string): Promise<Buffer>;

  /**
   * List files matching a prefix.
   * Results are sorted by lastModified ascending (oldest first).
   */
  list(prefix: string): Promise<FileInfo[]>;

  /**
   * Delete a file.
   * No-op if file doesn't exist.
   */
  delete(path: string): Promise<void>;

  /**
   * Move/rename a file.
   * Used for marking files as processed.
   */
  move(from: string, to: string): Promise<void>;

  /**
   * Check if a file exists.
   */
  exists(path: string): Promise<boolean>;
}
```

### 4.3 src/providers/observability/types.ts - Observability Event Types

```typescript
/**
 * Trace represents a distributed trace spanning multiple services.
 */
export interface Trace {
  traceId: string;
  projectId: string;
  deploymentId: string;
  name: string;
  status: 'ok' | 'error' | 'unset';
  startTime: Date;
  endTime: Date | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
}

/**
 * Span represents a single operation within a trace.
 */
export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  projectId: string;
  deploymentId: string;
  name: string;
  kind: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  status: 'ok' | 'error' | 'unset';
  startTime: Date;
  endTime: Date | null;
  durationMs: number | null;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

/**
 * Event within a span.
 */
export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes: Record<string, unknown>;
}

/**
 * Log entry from a running server.
 */
export interface Log {
  id: string;
  projectId: string;
  deploymentId: string;
  traceId: string | null;
  spanId: string | null;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  attributes: Record<string, unknown>;
}

/**
 * Metric data point.
 */
export interface Metric {
  id: string;
  projectId: string;
  deploymentId: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  unit: string | null;
  timestamp: Date;
  labels: Record<string, string>;
}

/**
 * Score for evaluation tracking.
 */
export interface Score {
  id: string;
  projectId: string;
  deploymentId: string;
  traceId: string | null;
  name: string;
  value: number;
  normalizedValue: number | null; // 0-1 range
  comment: string | null;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * Union type for all observability events.
 */
export type ObservabilityEvent =
  | { type: 'trace'; data: Trace }
  | { type: 'span'; data: Span }
  | { type: 'log'; data: Log }
  | { type: 'metric'; data: Metric }
  | { type: 'score'; data: Score };
```

### 4.4 src/providers/observability/writer.ts - ObservabilityWriter Interface

```typescript
import type { FileStorageProvider } from '../file-storage/base';
import type { Log, Metric, ObservabilityEvent, Score, Span, Trace } from './types';

/**
 * Configuration for the ObservabilityWriter.
 */
export interface ObservabilityWriterConfig {
  /** File storage backend for writing JSONL files */
  fileStorage: FileStorageProvider;
  /** Number of events to batch before flushing (default: 1000) */
  batchSize?: number;
  /** Interval in ms to flush events (default: 5000) */
  flushIntervalMs?: number;
  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxFileSize?: number;
}

/**
 * Abstract interface for writing observability events.
 * Events are batched and written to file storage as JSONL files.
 *
 * Implementation: ObservabilityWriter (observability/writer/)
 */
export interface ObservabilityWriterInterface {
  /**
   * Record a trace event.
   * Non-blocking - events are buffered internally.
   */
  recordTrace(trace: Trace): void;

  /**
   * Record a span event.
   * Non-blocking - events are buffered internally.
   */
  recordSpan(span: Span): void;

  /**
   * Record a log event.
   * Non-blocking - events are buffered internally.
   */
  recordLog(log: Log): void;

  /**
   * Record a metric event.
   * Non-blocking - events are buffered internally.
   */
  recordMetric(metric: Metric): void;

  /**
   * Record a score event.
   * Non-blocking - events are buffered internally.
   */
  recordScore(score: Score): void;

  /**
   * Record multiple events at once.
   * Non-blocking - events are buffered internally.
   */
  recordEvents(events: ObservabilityEvent[]): void;

  /**
   * Force flush all pending events to file storage.
   */
  flush(): Promise<void>;

  /**
   * Gracefully shutdown the writer.
   * Flushes all pending events before returning.
   */
  shutdown(): Promise<void>;
}
```

### 4.5 src/providers/observability/query-provider.ts - ObservabilityQueryProvider Interface

```typescript
import type { Log, Metric, Score, Span, Trace } from './types';

/**
 * Time range filter for queries.
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Pagination for query results.
 */
export interface QueryPagination {
  limit?: number;
  offset?: number;
}

/**
 * Trace query filters.
 */
export interface TraceQueryFilter {
  projectId?: string;
  deploymentId?: string;
  status?: 'ok' | 'error' | 'unset';
  timeRange?: TimeRange;
  minDurationMs?: number;
  maxDurationMs?: number;
}

/**
 * Span query filters.
 */
export interface SpanQueryFilter {
  projectId?: string;
  deploymentId?: string;
  traceId?: string;
  parentSpanId?: string | null;
  kind?: Span['kind'];
  status?: 'ok' | 'error' | 'unset';
  timeRange?: TimeRange;
}

/**
 * Log query filters.
 */
export interface LogQueryFilter {
  projectId?: string;
  deploymentId?: string;
  traceId?: string;
  level?: Log['level'] | Log['level'][];
  messageContains?: string;
  timeRange?: TimeRange;
}

/**
 * Metric query filters.
 */
export interface MetricQueryFilter {
  projectId?: string;
  deploymentId?: string;
  name?: string;
  type?: Metric['type'];
  labels?: Record<string, string>;
  timeRange?: TimeRange;
}

/**
 * Score query filters.
 */
export interface ScoreQueryFilter {
  projectId?: string;
  deploymentId?: string;
  traceId?: string;
  name?: string;
  minValue?: number;
  maxValue?: number;
  timeRange?: TimeRange;
}

/**
 * Aggregation result for metrics.
 */
export interface MetricAggregation {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p99: number;
}

/**
 * Abstract interface for querying observability data.
 * Implementation: ClickHouseQueryProvider (observability/clickhouse/)
 */
export interface ObservabilityQueryProvider {
  // ============================================================================
  // Trace Queries
  // ============================================================================

  getTrace(traceId: string): Promise<Trace | null>;
  listTraces(filter: TraceQueryFilter, pagination?: QueryPagination): Promise<{ traces: Trace[]; total: number }>;
  getTraceSpans(traceId: string): Promise<Span[]>;

  // ============================================================================
  // Span Queries
  // ============================================================================

  getSpan(spanId: string): Promise<Span | null>;
  listSpans(filter: SpanQueryFilter, pagination?: QueryPagination): Promise<{ spans: Span[]; total: number }>;

  // ============================================================================
  // Log Queries
  // ============================================================================

  listLogs(filter: LogQueryFilter, pagination?: QueryPagination): Promise<{ logs: Log[]; total: number }>;
  searchLogs(query: string, filter: LogQueryFilter, pagination?: QueryPagination): Promise<{ logs: Log[]; total: number }>;

  // ============================================================================
  // Metric Queries
  // ============================================================================

  listMetrics(filter: MetricQueryFilter, pagination?: QueryPagination): Promise<{ metrics: Metric[]; total: number }>;
  aggregateMetrics(filter: MetricQueryFilter, groupBy?: string[]): Promise<MetricAggregation[]>;
  getMetricTimeSeries(name: string, filter: MetricQueryFilter, intervalMs: number): Promise<{ timestamp: Date; value: number }[]>;

  // ============================================================================
  // Score Queries
  // ============================================================================

  listScores(filter: ScoreQueryFilter, pagination?: QueryPagination): Promise<{ scores: Score[]; total: number }>;
  aggregateScores(filter: ScoreQueryFilter, groupBy?: string[]): Promise<{ name: string; avg: number; count: number }[]>;
}
```

### 4.6 src/providers/runner/base.ts - ProjectRunner Interface

```typescript
import type { Build, Deployment, Project, RunningServer } from '../../types';

/**
 * Build options for the runner.
 */
export interface BuildOptions {
  /** Environment variables to inject during build */
  envVars?: Record<string, string>;
  /** Build timeout in milliseconds (default: 10 minutes) */
  timeoutMs?: number;
  /** Whether to skip dependency installation */
  skipInstall?: boolean;
}

/**
 * Run options for starting a server.
 */
export interface RunOptions {
  /** Environment variables for the running server */
  envVars?: Record<string, string>;
  /** Port to run on (auto-allocated if not specified) */
  port?: number;
  /** Health check timeout in milliseconds (default: 30 seconds) */
  healthCheckTimeoutMs?: number;
}

/**
 * Log stream callback.
 */
export type LogStreamCallback = (log: string) => void;

/**
 * Abstract interface for running Mastra projects.
 *
 * Implementations:
 * - LocalProcessRunner (runners/local/)
 * - KubernetesRunner (runners/k8s/) - future
 */
export interface ProjectRunner {
  /** Runner type identifier */
  readonly type: 'local' | 'k8s' | string;

  /**
   * Build a project from source.
   *
   * @param project - The project to build
   * @param build - Build record for logging
   * @param options - Build options
   * @param onLog - Callback for streaming build logs
   * @returns Updated build record
   */
  build(
    project: Project,
    build: Build,
    options?: BuildOptions,
    onLog?: LogStreamCallback,
  ): Promise<Build>;

  /**
   * Deploy and start a server for a deployment.
   *
   * @param project - The project
   * @param deployment - The deployment configuration
   * @param build - The build to deploy
   * @param options - Run options
   * @returns Running server info
   */
  deploy(
    project: Project,
    deployment: Deployment,
    build: Build,
    options?: RunOptions,
  ): Promise<RunningServer>;

  /**
   * Stop a running server.
   *
   * @param server - The server to stop
   */
  stop(server: RunningServer): Promise<void>;

  /**
   * Check health of a running server.
   *
   * @param server - The server to check
   * @returns Health status
   */
  healthCheck(server: RunningServer): Promise<{ healthy: boolean; message?: string }>;

  /**
   * Get logs from a running server.
   *
   * @param server - The server
   * @param options - Log options
   * @returns Log content
   */
  getLogs(
    server: RunningServer,
    options?: { tail?: number; since?: Date },
  ): Promise<string>;

  /**
   * Stream logs from a running server.
   *
   * @param server - The server
   * @param callback - Callback for each log line
   * @returns Cleanup function to stop streaming
   */
  streamLogs(server: RunningServer, callback: LogStreamCallback): () => void;

  /**
   * Get resource usage for a running server.
   *
   * @param server - The server
   * @returns Resource metrics
   */
  getResourceUsage(server: RunningServer): Promise<{
    memoryUsageMb: number | null;
    cpuPercent: number | null;
  }>;
}
```

### 4.7 src/providers/router/base.ts - EdgeRouterProvider Interface

```typescript
import type { RouteConfig, RouteHealthStatus, RouteInfo } from '../../types';

/**
 * Abstract interface for edge routing.
 * Exposes Mastra servers to the network via reverse proxy or tunnel.
 *
 * Implementations:
 * - LocalEdgeRouter (routers/local/)
 * - CloudflareEdgeRouter (routers/cloudflare/) - future
 */
export interface EdgeRouterProvider {
  /** Router type identifier */
  readonly type: 'local' | 'cloudflare' | string;

  /**
   * Register a route for a deployment.
   *
   * @param config - Route configuration
   * @returns Route info with public URL
   */
  registerRoute(config: RouteConfig): Promise<RouteInfo>;

  /**
   * Update an existing route.
   *
   * @param routeId - ID of the route to update
   * @param config - Partial configuration to update
   * @returns Updated route info
   */
  updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo>;

  /**
   * Remove a route.
   *
   * @param routeId - ID of the route to remove
   */
  removeRoute(routeId: string): Promise<void>;

  /**
   * Get route info for a deployment.
   *
   * @param deploymentId - ID of the deployment
   * @returns Route info or null if not found
   */
  getRoute(deploymentId: string): Promise<RouteInfo | null>;

  /**
   * List all routes for a project.
   *
   * @param projectId - ID of the project
   * @returns List of route infos
   */
  listRoutes(projectId: string): Promise<RouteInfo[]>;

  /**
   * Check health of a route.
   *
   * @param routeId - ID of the route
   * @returns Health status
   */
  checkRouteHealth(routeId: string): Promise<RouteHealthStatus>;
}
```

### 4.8 src/providers/source/base.ts - ProjectSourceProvider Interface

```typescript
import type { ChangeEvent, ProjectSource } from '../../types';

/**
 * Abstract interface for project source operations.
 *
 * Implementations:
 * - LocalProjectSource (sources/local/)
 * - GitHubProjectSource (sources/github/) - future
 */
export interface ProjectSourceProvider {
  /** Source type identifier */
  readonly type: 'local' | 'github' | string;

  /**
   * List available projects/repos.
   *
   * @param teamId - Team ID for filtering (used by GitHub for installations)
   * @returns List of project sources
   */
  listProjects(teamId: string): Promise<ProjectSource[]>;

  /**
   * Get project source details.
   *
   * @param projectId - Project source ID
   * @returns Project source details
   */
  getProject(projectId: string): Promise<ProjectSource>;

  /**
   * Validate that a project source is accessible.
   *
   * @param source - Project source to validate
   * @returns True if accessible
   */
  validateAccess(source: ProjectSource): Promise<boolean>;

  /**
   * Get the local path to the project.
   * For local sources, returns the path directly.
   * For GitHub, clones to targetDir.
   *
   * @param source - Project source
   * @param targetDir - Target directory for cloning (used by GitHub)
   * @returns Local filesystem path
   */
  getProjectPath(source: ProjectSource, targetDir: string): Promise<string>;

  /**
   * Watch for file changes in a project.
   * Optional - primarily for local development.
   *
   * @param source - Project source to watch
   * @param callback - Callback for change events
   * @returns Cleanup function to stop watching
   */
  watchChanges?(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void;
}
```

### 4.9 src/providers/billing/base.ts and no-billing.ts

```typescript
// base.ts
/**
 * Subscription tier information.
 */
export interface SubscriptionInfo {
  tier: 'free' | 'team' | 'enterprise' | string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

/**
 * Usage metrics for billing.
 */
export interface UsageMetrics {
  buildMinutes: number;
  activeDeployments: number;
  storageGb: number;
  dataTransferGb: number;
}

/**
 * Abstract interface for billing operations.
 */
export interface BillingProvider {
  /**
   * Get subscription info for a team.
   */
  getSubscription(teamId: string): Promise<SubscriptionInfo | null>;

  /**
   * Get usage metrics for a team.
   */
  getUsage(teamId: string, periodStart: Date, periodEnd: Date): Promise<UsageMetrics>;

  /**
   * Check if a team can perform an action based on billing.
   */
  canPerformAction(teamId: string, action: string): Promise<boolean>;

  /**
   * Record usage for billing.
   */
  recordUsage(teamId: string, metric: keyof UsageMetrics, amount: number): Promise<void>;
}
```

```typescript
// no-billing.ts
import type { BillingProvider, SubscriptionInfo, UsageMetrics } from './base';

/**
 * No-op billing provider for self-hosted deployments.
 * Returns enterprise subscription for all teams.
 */
export class NoBillingProvider implements BillingProvider {
  async getSubscription(_teamId: string): Promise<SubscriptionInfo> {
    return {
      tier: 'enterprise',
      status: 'active',
      currentPeriodStart: new Date(0),
      currentPeriodEnd: new Date('2099-12-31'),
      cancelAtPeriodEnd: false,
    };
  }

  async getUsage(_teamId: string, _periodStart: Date, _periodEnd: Date): Promise<UsageMetrics> {
    return {
      buildMinutes: 0,
      activeDeployments: 0,
      storageGb: 0,
      dataTransferGb: 0,
    };
  }

  async canPerformAction(_teamId: string, _action: string): Promise<boolean> {
    return true;
  }

  async recordUsage(_teamId: string, _metric: keyof UsageMetrics, _amount: number): Promise<void> {
    // No-op for self-hosted
  }
}
```

### 4.10 src/providers/email/base.ts and console.ts

```typescript
// base.ts
/**
 * Email template types.
 */
export type EmailTemplate =
  | 'team_invite'
  | 'build_failed'
  | 'deployment_ready'
  | 'license_expiring';

/**
 * Email options.
 */
export interface EmailOptions {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

/**
 * Abstract interface for email operations.
 */
export interface EmailProvider {
  /**
   * Send an email.
   */
  send(options: EmailOptions): Promise<void>;

  /**
   * Send a batch of emails.
   */
  sendBatch(emails: EmailOptions[]): Promise<void>;
}
```

```typescript
// console.ts
import type { EmailOptions, EmailProvider } from './base';

/**
 * Console email provider for development.
 * Logs emails to console instead of sending.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<void> {
    console.log('[Email]', {
      to: options.to,
      subject: options.subject,
      template: options.template,
      data: options.data,
    });
  }

  async sendBatch(emails: EmailOptions[]): Promise<void> {
    for (const email of emails) {
      await this.send(email);
    }
  }
}
```

### 4.11 src/providers/encryption/base.ts and node-crypto.ts

```typescript
// base.ts
/**
 * Abstract interface for encryption operations.
 */
export interface EncryptionProvider {
  /**
   * Encrypt a plaintext value.
   *
   * @param plaintext - Value to encrypt
   * @returns Base64-encoded encrypted value
   */
  encrypt(plaintext: string): Promise<string>;

  /**
   * Decrypt an encrypted value.
   *
   * @param ciphertext - Base64-encoded encrypted value
   * @returns Decrypted plaintext
   */
  decrypt(ciphertext: string): Promise<string>;

  /**
   * Hash a value (one-way).
   * Used for API tokens.
   *
   * @param value - Value to hash
   * @returns Hashed value
   */
  hash(value: string): Promise<string>;

  /**
   * Verify a value against a hash.
   *
   * @param value - Plain value
   * @param hash - Hash to verify against
   * @returns True if matches
   */
  verifyHash(value: string, hash: string): Promise<boolean>;
}
```

```typescript
// node-crypto.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { EncryptionProvider } from './base';

const scryptAsync = promisify(scrypt);

/**
 * AES-256-GCM encryption provider using Node.js crypto.
 */
export class NodeCryptoEncryptionProvider implements EncryptionProvider {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private key: Buffer | null = null;

  constructor(private readonly secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('Encryption secret must be at least 32 characters');
    }
  }

  private async getKey(): Promise<Buffer> {
    if (!this.key) {
      this.key = (await scryptAsync(this.secret, 'salt', this.keyLength)) as Buffer;
    }
    return this.key;
  }

  async encrypt(plaintext: string): Promise<string> {
    const key = await this.getKey();
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv, { authTagLength: this.authTagLength });

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  async decrypt(ciphertext: string): Promise<string> {
    const key = await this.getKey();
    const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':');

    if (!ivB64 || !authTagB64 || !encryptedB64) {
      throw new Error('Invalid ciphertext format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const decipher = createDecipheriv(this.algorithm, key, iv, { authTagLength: this.authTagLength });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  async hash(value: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(`${salt}:${value}`).digest('hex');
    return `${salt}:${hash}`;
  }

  async verifyHash(value: string, hashWithSalt: string): Promise<boolean> {
    const [salt, storedHash] = hashWithSalt.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    const computedHash = createHash('sha256').update(`${salt}:${value}`).digest('hex');
    return timingSafeEqual(Buffer.from(storedHash), Buffer.from(computedHash));
  }
}
```

---

## Phase 5: License Validation

### 5.1 src/license/types.ts

```typescript
/**
 * License tiers.
 */
export const LicenseTier = {
  COMMUNITY: 'community',
  TEAM: 'team',
  ENTERPRISE: 'enterprise',
} as const;

export type LicenseTier = (typeof LicenseTier)[keyof typeof LicenseTier];

/**
 * License features that can be gated.
 */
export const LicenseFeature = {
  LOCAL_RUNNER: 'local-runner',
  K8S_RUNNER: 'k8s-runner',
  CLOUDFLARE_ROUTER: 'cloudflare-router',
  GITHUB_SOURCE: 'github-source',
  SSO: 'sso',
  AUDIT_LOGS: 'audit-logs',
  ADVANCED_RBAC: 'advanced-rbac',
  UNLIMITED_USERS: 'unlimited-users',
  PRIORITY_SUPPORT: 'priority-support',
} as const;

export type LicenseFeature = (typeof LicenseFeature)[keyof typeof LicenseFeature];

/**
 * Decoded license information.
 */
export interface LicenseInfo {
  /** Whether the license is valid */
  valid: boolean;
  /** License tier */
  tier: LicenseTier;
  /** Enabled features */
  features: LicenseFeature[];
  /** Expiration date (null = perpetual) */
  expiresAt: Date | null;
  /** Maximum teams allowed (null = unlimited) */
  maxTeams: number | null;
  /** Maximum users per team (null = unlimited) */
  maxUsersPerTeam: number | null;
  /** Maximum projects (null = unlimited) */
  maxProjects: number | null;
  /** Organization name from license */
  organizationName?: string;
  /** License key ID for tracking */
  licenseKeyId?: string;
}

/**
 * License key payload structure (JWT claims).
 */
export interface LicensePayload {
  /** License key ID */
  kid: string;
  /** Organization name */
  org: string;
  /** Tier */
  tier: LicenseTier;
  /** Features array */
  features: LicenseFeature[];
  /** Expiration timestamp */
  exp?: number;
  /** Issued at timestamp */
  iat: number;
  /** Limits */
  limits?: {
    teams?: number;
    usersPerTeam?: number;
    projects?: number;
  };
}
```

### 5.2 src/license/features.ts

```typescript
import { LicenseFeature, LicenseTier, type LicenseInfo } from './types';

/**
 * Features available for each tier.
 */
export const TIER_FEATURES: Record<LicenseTier, LicenseFeature[]> = {
  [LicenseTier.COMMUNITY]: [
    LicenseFeature.LOCAL_RUNNER,
  ],
  [LicenseTier.TEAM]: [
    LicenseFeature.LOCAL_RUNNER,
    LicenseFeature.GITHUB_SOURCE,
    LicenseFeature.AUDIT_LOGS,
  ],
  [LicenseTier.ENTERPRISE]: [
    LicenseFeature.LOCAL_RUNNER,
    LicenseFeature.K8S_RUNNER,
    LicenseFeature.CLOUDFLARE_ROUTER,
    LicenseFeature.GITHUB_SOURCE,
    LicenseFeature.SSO,
    LicenseFeature.AUDIT_LOGS,
    LicenseFeature.ADVANCED_RBAC,
    LicenseFeature.UNLIMITED_USERS,
    LicenseFeature.PRIORITY_SUPPORT,
  ],
};

/**
 * Default limits for each tier.
 */
export const TIER_LIMITS: Record<LicenseTier, { teams: number | null; usersPerTeam: number | null; projects: number | null }> = {
  [LicenseTier.COMMUNITY]: {
    teams: 1,
    usersPerTeam: 3,
    projects: 3,
  },
  [LicenseTier.TEAM]: {
    teams: 5,
    usersPerTeam: 10,
    projects: 20,
  },
  [LicenseTier.ENTERPRISE]: {
    teams: null, // Unlimited
    usersPerTeam: null,
    projects: null,
  },
};

/**
 * Check if a feature is enabled based on license info.
 */
export function isFeatureEnabled(license: LicenseInfo, feature: LicenseFeature): boolean {
  if (!license.valid) {
    return false;
  }

  // Check explicit features first
  if (license.features.includes(feature)) {
    return true;
  }

  // Fall back to tier defaults
  return TIER_FEATURES[license.tier]?.includes(feature) ?? false;
}

/**
 * Get merged features for a license (explicit + tier defaults).
 */
export function getMergedFeatures(license: LicenseInfo): LicenseFeature[] {
  const tierFeatures = TIER_FEATURES[license.tier] ?? [];
  const explicitFeatures = license.features;

  // Merge and deduplicate
  return [...new Set([...tierFeatures, ...explicitFeatures])];
}
```

### 5.3 src/license/validator.ts

```typescript
import { createVerify } from 'node:crypto';

import { MastraAdminError } from '../errors';

import { getMergedFeatures, isFeatureEnabled, TIER_LIMITS } from './features';
import type { LicenseFeature, LicenseInfo, LicensePayload } from './types';
import { LicenseTier } from './types';

/**
 * Public key for verifying license signatures.
 * In production, this would be fetched from a secure source.
 */
const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`;

/**
 * License validator for verifying and decoding license keys.
 */
export class LicenseValidator {
  private licenseInfo: LicenseInfo | null = null;
  private validated = false;

  constructor(
    private readonly licenseKey: string,
    private readonly publicKey: string = LICENSE_PUBLIC_KEY,
  ) {}

  /**
   * Validate and decode the license key.
   * Caches the result after first validation.
   */
  async validate(): Promise<LicenseInfo> {
    if (this.validated && this.licenseInfo) {
      return this.licenseInfo;
    }

    try {
      // For development, allow special dev license
      if (this.licenseKey === 'dev' || this.licenseKey === 'development') {
        this.licenseInfo = this.createDevLicense();
        this.validated = true;
        return this.licenseInfo;
      }

      // Decode and verify the license (JWT-like format)
      const payload = await this.verifyAndDecode(this.licenseKey);
      this.licenseInfo = this.payloadToLicenseInfo(payload);
      this.validated = true;

      // Check expiration
      if (this.licenseInfo.expiresAt && this.licenseInfo.expiresAt < new Date()) {
        this.licenseInfo.valid = false;
        throw MastraAdminError.licenseExpired(this.licenseInfo.expiresAt);
      }

      return this.licenseInfo;
    } catch (error) {
      if (error instanceof MastraAdminError) {
        throw error;
      }
      throw MastraAdminError.invalidLicense(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Check if a specific feature is enabled.
   */
  hasFeature(feature: LicenseFeature): boolean {
    if (!this.licenseInfo) {
      return false;
    }
    return isFeatureEnabled(this.licenseInfo, feature);
  }

  /**
   * Check if a team can be created based on limits.
   */
  canCreateTeam(currentCount: number): boolean {
    if (!this.licenseInfo?.valid) {
      return false;
    }
    if (this.licenseInfo.maxTeams === null) {
      return true;
    }
    return currentCount < this.licenseInfo.maxTeams;
  }

  /**
   * Check if a team member can be added.
   */
  canAddTeamMember(_teamId: string, currentCount: number): boolean {
    if (!this.licenseInfo?.valid) {
      return false;
    }
    if (this.licenseInfo.maxUsersPerTeam === null) {
      return true;
    }
    return currentCount < this.licenseInfo.maxUsersPerTeam;
  }

  /**
   * Check if a project can be created.
   */
  canCreateProject(_teamId: string, currentCount: number): boolean {
    if (!this.licenseInfo?.valid) {
      return false;
    }
    if (this.licenseInfo.maxProjects === null) {
      return true;
    }
    return currentCount < this.licenseInfo.maxProjects;
  }

  /**
   * Get the cached license info.
   */
  getLicenseInfo(): LicenseInfo {
    if (!this.licenseInfo) {
      throw new Error('License not validated. Call validate() first.');
    }
    return this.licenseInfo;
  }

  /**
   * Get all enabled features.
   */
  getEnabledFeatures(): LicenseFeature[] {
    if (!this.licenseInfo) {
      return [];
    }
    return getMergedFeatures(this.licenseInfo);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async verifyAndDecode(licenseKey: string): Promise<LicensePayload> {
    // License format: base64(header).base64(payload).base64(signature)
    const parts = licenseKey.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid license format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const signedData = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64!, 'base64');

    // Verify signature
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signedData);
    const isValid = verifier.verify(this.publicKey, signature);

    if (!isValid) {
      throw new Error('Invalid license signature');
    }

    // Decode payload
    const payloadJson = Buffer.from(payloadB64!, 'base64').toString('utf8');
    return JSON.parse(payloadJson) as LicensePayload;
  }

  private payloadToLicenseInfo(payload: LicensePayload): LicenseInfo {
    const tier = payload.tier as LicenseTier;
    const limits = payload.limits ?? TIER_LIMITS[tier];

    return {
      valid: true,
      tier,
      features: payload.features ?? [],
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      maxTeams: limits?.teams ?? null,
      maxUsersPerTeam: limits?.usersPerTeam ?? null,
      maxProjects: limits?.projects ?? null,
      organizationName: payload.org,
      licenseKeyId: payload.kid,
    };
  }

  private createDevLicense(): LicenseInfo {
    return {
      valid: true,
      tier: LicenseTier.ENTERPRISE,
      features: Object.values(LicenseFeature) as LicenseFeature[],
      expiresAt: null,
      maxTeams: null,
      maxUsersPerTeam: null,
      maxProjects: null,
      organizationName: 'Development',
      licenseKeyId: 'dev',
    };
  }
}
```

---

## Phase 6: RBAC System

### 6.1 src/rbac/types.ts

```typescript
/**
 * RBAC resource types.
 */
export const RBACResource = {
  TEAM: 'team',
  PROJECT: 'project',
  DEPLOYMENT: 'deployment',
  BUILD: 'build',
  ENV_VAR: 'env_var',
  MEMBER: 'member',
  INVITE: 'invite',
  API_TOKEN: 'api_token',
} as const;

export type RBACResource = (typeof RBACResource)[keyof typeof RBACResource];

/**
 * RBAC action types.
 */
export const RBACAction = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  DEPLOY: 'deploy',
  MANAGE: 'manage',
} as const;

export type RBACAction = (typeof RBACAction)[keyof typeof RBACAction];

/**
 * Permission string format: "resource:action"
 */
export type Permission = `${RBACResource}:${RBACAction}`;

/**
 * Role definition with permissions.
 */
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}

/**
 * Context for permission checks.
 */
export interface PermissionContext {
  userId: string;
  teamId: string;
  projectId?: string;
  deploymentId?: string;
}
```

### 6.2 src/rbac/roles.ts

```typescript
import { RBACAction, RBACResource, type Permission, type Role } from './types';

/**
 * Helper to create permission strings.
 */
function p(resource: RBACResource, action: RBACAction): Permission {
  return `${resource}:${action}`;
}

/**
 * All possible permissions.
 */
export const ALL_PERMISSIONS: Permission[] = Object.values(RBACResource).flatMap((resource) =>
  Object.values(RBACAction).map((action) => p(resource, action)),
);

/**
 * System-defined roles.
 */
export const SYSTEM_ROLES: Record<string, Role> = {
  owner: {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all team resources',
    permissions: ALL_PERMISSIONS,
    isSystem: true,
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    description: 'Manage team settings, projects, and members',
    permissions: [
      // Team management (except delete)
      p(RBACResource.TEAM, RBACAction.READ),
      p(RBACResource.TEAM, RBACAction.UPDATE),
      // Member management
      p(RBACResource.MEMBER, RBACAction.CREATE),
      p(RBACResource.MEMBER, RBACAction.READ),
      p(RBACResource.MEMBER, RBACAction.UPDATE),
      p(RBACResource.MEMBER, RBACAction.DELETE),
      // Invite management
      p(RBACResource.INVITE, RBACAction.CREATE),
      p(RBACResource.INVITE, RBACAction.READ),
      p(RBACResource.INVITE, RBACAction.DELETE),
      // Full project management
      p(RBACResource.PROJECT, RBACAction.CREATE),
      p(RBACResource.PROJECT, RBACAction.READ),
      p(RBACResource.PROJECT, RBACAction.UPDATE),
      p(RBACResource.PROJECT, RBACAction.DELETE),
      // Full deployment management
      p(RBACResource.DEPLOYMENT, RBACAction.CREATE),
      p(RBACResource.DEPLOYMENT, RBACAction.READ),
      p(RBACResource.DEPLOYMENT, RBACAction.UPDATE),
      p(RBACResource.DEPLOYMENT, RBACAction.DELETE),
      p(RBACResource.DEPLOYMENT, RBACAction.DEPLOY),
      // Build management
      p(RBACResource.BUILD, RBACAction.CREATE),
      p(RBACResource.BUILD, RBACAction.READ),
      p(RBACResource.BUILD, RBACAction.DELETE),
      // Env var management
      p(RBACResource.ENV_VAR, RBACAction.CREATE),
      p(RBACResource.ENV_VAR, RBACAction.READ),
      p(RBACResource.ENV_VAR, RBACAction.UPDATE),
      p(RBACResource.ENV_VAR, RBACAction.DELETE),
      // API token management
      p(RBACResource.API_TOKEN, RBACAction.CREATE),
      p(RBACResource.API_TOKEN, RBACAction.READ),
      p(RBACResource.API_TOKEN, RBACAction.DELETE),
    ],
    isSystem: true,
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    description: 'Deploy and manage projects',
    permissions: [
      // Read team
      p(RBACResource.TEAM, RBACAction.READ),
      p(RBACResource.MEMBER, RBACAction.READ),
      // Project management (no delete)
      p(RBACResource.PROJECT, RBACAction.CREATE),
      p(RBACResource.PROJECT, RBACAction.READ),
      p(RBACResource.PROJECT, RBACAction.UPDATE),
      // Deployment management
      p(RBACResource.DEPLOYMENT, RBACAction.CREATE),
      p(RBACResource.DEPLOYMENT, RBACAction.READ),
      p(RBACResource.DEPLOYMENT, RBACAction.UPDATE),
      p(RBACResource.DEPLOYMENT, RBACAction.DEPLOY),
      // Build management
      p(RBACResource.BUILD, RBACAction.CREATE),
      p(RBACResource.BUILD, RBACAction.READ),
      // Env var management
      p(RBACResource.ENV_VAR, RBACAction.CREATE),
      p(RBACResource.ENV_VAR, RBACAction.READ),
      p(RBACResource.ENV_VAR, RBACAction.UPDATE),
      // Own API tokens
      p(RBACResource.API_TOKEN, RBACAction.CREATE),
      p(RBACResource.API_TOKEN, RBACAction.READ),
    ],
    isSystem: true,
  },
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to projects',
    permissions: [
      p(RBACResource.TEAM, RBACAction.READ),
      p(RBACResource.MEMBER, RBACAction.READ),
      p(RBACResource.PROJECT, RBACAction.READ),
      p(RBACResource.DEPLOYMENT, RBACAction.READ),
      p(RBACResource.BUILD, RBACAction.READ),
      // Note: No env var read (secrets)
    ],
    isSystem: true,
  },
};

/**
 * Get role by ID.
 */
export function getSystemRole(roleId: string): Role | undefined {
  return SYSTEM_ROLES[roleId];
}

/**
 * Check if a role has a permission.
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return role.permissions.includes(permission);
}
```

### 6.3 src/rbac/manager.ts

```typescript
import { MastraAdminError } from '../errors';
import type { AdminStorage } from '../providers/storage/base';

import { getSystemRole, roleHasPermission, SYSTEM_ROLES } from './roles';
import type { Permission, PermissionContext, Role } from './types';
import { RBACAction, RBACResource } from './types';

/**
 * RBAC manager for permission checks.
 */
export class RBACManager {
  constructor(private readonly storage: AdminStorage) {}

  /**
   * Check if a user has a specific permission in a context.
   */
  async hasPermission(context: PermissionContext, permission: Permission): Promise<boolean> {
    const { userId, teamId } = context;

    // Get user's role in the team
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member) {
      return false;
    }

    // Get role definition
    const role = getSystemRole(member.role);
    if (!role) {
      return false;
    }

    return roleHasPermission(role, permission);
  }

  /**
   * Assert that a user has a permission. Throws if not.
   */
  async assertPermission(context: PermissionContext, permission: Permission): Promise<void> {
    const hasPermission = await this.hasPermission(context, permission);
    if (!hasPermission) {
      const [resource, action] = permission.split(':') as [RBACResource, RBACAction];
      throw MastraAdminError.accessDenied(resource, action);
    }
  }

  /**
   * Get all permissions for a user in a team.
   */
  async getUserPermissions(userId: string, teamId: string): Promise<Permission[]> {
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member) {
      return [];
    }

    const role = getSystemRole(member.role);
    if (!role) {
      return [];
    }

    return role.permissions;
  }

  /**
   * Get role for a user in a team.
   */
  async getUserRole(userId: string, teamId: string): Promise<Role | null> {
    const member = await this.storage.getTeamMember(teamId, userId);
    if (!member) {
      return null;
    }

    return getSystemRole(member.role) ?? null;
  }

  /**
   * List all system roles.
   */
  listRoles(): Role[] {
    return Object.values(SYSTEM_ROLES);
  }

  /**
   * Get a role by ID.
   */
  getRole(roleId: string): Role | undefined {
    return getSystemRole(roleId);
  }

  /**
   * Create a permission check helper for a context.
   */
  forContext(context: PermissionContext): ContextualRBAC {
    return new ContextualRBAC(this, context);
  }
}

/**
 * Contextual RBAC helper for checking permissions in a fixed context.
 */
export class ContextualRBAC {
  constructor(
    private readonly manager: RBACManager,
    private readonly context: PermissionContext,
  ) {}

  async can(resource: RBACResource, action: RBACAction): Promise<boolean> {
    return this.manager.hasPermission(this.context, `${resource}:${action}`);
  }

  async assert(resource: RBACResource, action: RBACAction): Promise<void> {
    return this.manager.assertPermission(this.context, `${resource}:${action}`);
  }

  async canCreate(resource: RBACResource): Promise<boolean> {
    return this.can(resource, RBACAction.CREATE);
  }

  async canRead(resource: RBACResource): Promise<boolean> {
    return this.can(resource, RBACAction.READ);
  }

  async canUpdate(resource: RBACResource): Promise<boolean> {
    return this.can(resource, RBACAction.UPDATE);
  }

  async canDelete(resource: RBACResource): Promise<boolean> {
    return this.can(resource, RBACAction.DELETE);
  }
}
```

---

## Phase 7: MastraAdmin Class

**Architecture Pattern**: MastraAdmin follows the same pattern as the `Mastra` class in `@mastra/core`:
- Central orchestrator with business logic methods
- Accepts providers via constructor (dependency injection)
- Can be used directly OR wrapped with an HTTP server

Just like you can use `Mastra` directly or wrap it with `@mastra/server`, you can use `MastraAdmin` directly or wrap it with `@mastra/admin-server`.

### 7.1 src/mastra-admin.ts

```typescript
import { MastraBase } from '@mastra/core/base';
import type { IMastraLogger } from '@mastra/core/logger';
import type { MastraAuthProvider } from '@mastra/core/server';

import { RegisteredAdminComponent, TeamRole } from './constants';
import { MastraAdminError } from './errors';
import { LicenseValidator } from './license/validator';
import type { LicenseInfo } from './license/types';
import type { BillingProvider, EmailProvider, EncryptionProvider } from './providers';
import { ConsoleEmailProvider, NoBillingProvider, NodeCryptoEncryptionProvider } from './providers';
import type { AdminStorage, PaginationParams, PaginatedResult } from './providers/storage/base';
import type { FileStorageProvider } from './providers/file-storage/base';
import type { ObservabilityWriterInterface, ObservabilityQueryProvider } from './providers/observability';
import type { ProjectRunner } from './providers/runner/base';
import type { EdgeRouterProvider } from './providers/router/base';
import type { ProjectSourceProvider } from './providers/source/base';
import { RBACManager } from './rbac/manager';
import { BuildOrchestrator } from './orchestrator/build-orchestrator';
import type {
  Team,
  TeamMember,
  TeamInvite,
  Project,
  Deployment,
  Build,
  EncryptedEnvVar,
  RunningServer,
} from './types';

/**
 * Observability configuration.
 */
export interface ObservabilityConfig {
  /** File storage for JSONL event files */
  fileStorage: FileStorageProvider;
  /** Optional query provider (e.g., ClickHouse) */
  queryProvider?: ObservabilityQueryProvider;
  /** Optional pre-configured writer instance */
  writer?: ObservabilityWriterInterface;
}

/**
 * MastraAdmin configuration options.
 */
export interface MastraAdminConfig<
  TStorage extends AdminStorage = AdminStorage,
  TFileStorage extends FileStorageProvider = FileStorageProvider,
  TRunner extends ProjectRunner = ProjectRunner,
  TRouter extends EdgeRouterProvider = EdgeRouterProvider,
  TSource extends ProjectSourceProvider = ProjectSourceProvider,
> {
  /** License key for enterprise features. Use 'dev' or 'development' for development mode. */
  licenseKey: string;
  /** Auth provider from @mastra/auth-* packages. */
  auth: MastraAuthProvider<unknown>;
  /** Admin storage provider (e.g., PostgresAdminStorage). */
  storage: TStorage;
  /** Observability configuration. */
  observability?: ObservabilityConfig;
  /** Project runner for building and deploying. */
  runner?: TRunner;
  /** Edge router for exposing services. */
  router?: TRouter;
  /** Project source provider. */
  source?: TSource;
  /** Billing provider. Defaults to NoBillingProvider. */
  billing?: BillingProvider;
  /** Email provider. Defaults to ConsoleEmailProvider. */
  email?: EmailProvider;
  /** Encryption provider. Defaults to NodeCryptoEncryptionProvider. */
  encryption?: EncryptionProvider;
  /** Logger instance. Set to false to disable logging. */
  logger?: IMastraLogger | false;
}

// ============================================================================
// Input Types for Business Logic Methods
// ============================================================================

export interface CreateTeamInput {
  name: string;
  slug: string;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  description?: string;
  sourceType: 'local' | 'github';
  sourceConfig: Record<string, unknown>;
}

export interface CreateDeploymentInput {
  type: 'production' | 'staging' | 'preview';
  subdomain?: string;
  envOverrides?: Record<string, string>;
}

export interface TriggerBuildInput {
  trigger: 'manual' | 'webhook' | 'schedule' | 'rollback';
  commitSha?: string;
}

/**
 * MastraAdmin - Central orchestrator for the admin platform.
 *
 * This class follows the same pattern as `Mastra` in @mastra/core:
 * - Contains all business logic methods (createTeam, deploy, etc.)
 * - Accepts providers via constructor (dependency injection)
 * - Can be used directly OR wrapped with @mastra/admin-server for HTTP access
 *
 * @example
 * ```typescript
 * // Create and initialize MastraAdmin
 * const admin = new MastraAdmin({
 *   licenseKey: 'dev',
 *   auth: new MastraAuthSupabase(),
 *   storage: new PostgresAdminStorage({ ... }),
 *   runner: new LocalProcessRunner(),
 *   router: new LocalEdgeRouter(),
 *   source: new LocalProjectSource({ basePaths: ['/projects'] }),
 * });
 * await admin.init();
 *
 * // Use directly (like using Mastra directly)
 * const team = await admin.createTeam('user-123', { name: 'Search', slug: 'search' });
 * const project = await admin.createProject('user-123', team.id, { ... });
 * await admin.deploy('user-123', deployment.id);
 *
 * // OR wrap with AdminServer for HTTP access (like @mastra/server)
 * const server = new AdminServer({ admin, port: 3000 });
 * await server.start();
 * // POST /api/teams → calls admin.createTeam()
 * // POST /api/deployments/:id/deploy → calls admin.deploy()
 * ```
 */
export class MastraAdmin<
  TStorage extends AdminStorage = AdminStorage,
  TFileStorage extends FileStorageProvider = FileStorageProvider,
  TRunner extends ProjectRunner = ProjectRunner,
  TRouter extends EdgeRouterProvider = EdgeRouterProvider,
  TSource extends ProjectSourceProvider = ProjectSourceProvider,
> extends MastraBase {
  readonly #config: MastraAdminConfig<TStorage, TFileStorage, TRunner, TRouter, TSource>;
  readonly #license: LicenseValidator;
  readonly #rbac: RBACManager;
  readonly #orchestrator: BuildOrchestrator;
  #initialized = false;

  // Providers (also accessible via getters)
  readonly #auth: MastraAuthProvider<unknown>;
  readonly #storage: TStorage;
  readonly #billing: BillingProvider;
  readonly #email: EmailProvider;
  readonly #encryption: EncryptionProvider;
  readonly #observability?: ObservabilityConfig;
  readonly #runner?: TRunner;
  readonly #router?: TRouter;
  readonly #source?: TSource;

  constructor(config: MastraAdminConfig<TStorage, TFileStorage, TRunner, TRouter, TSource>) {
    super({
      component: RegisteredAdminComponent.ADMIN,
      name: 'MastraAdmin',
    });

    // Validate required config
    if (!config.licenseKey) {
      throw MastraAdminError.configurationError('licenseKey is required');
    }
    if (!config.auth) {
      throw MastraAdminError.configurationError('auth provider is required');
    }
    if (!config.storage) {
      throw MastraAdminError.configurationError('storage provider is required');
    }

    this.#config = config;

    // Initialize components
    this.#license = new LicenseValidator(config.licenseKey);
    this.#auth = config.auth;
    this.#storage = config.storage;
    this.#observability = config.observability;
    this.#runner = config.runner;
    this.#router = config.router;
    this.#source = config.source;

    // Initialize optional providers with defaults
    this.#billing = config.billing ?? new NoBillingProvider();
    this.#email = config.email ?? new ConsoleEmailProvider();
    this.#encryption =
      config.encryption ??
      new NodeCryptoEncryptionProvider(
        process.env.ADMIN_ENCRYPTION_SECRET ?? this.#generateFallbackSecret(),
      );

    // Initialize RBAC manager
    this.#rbac = new RBACManager(this.#storage);

    // Initialize build orchestrator (requires runner, router, source)
    this.#orchestrator = new BuildOrchestrator(
      this.#storage,
      this.#runner,
      this.#router,
      this.#source,
    );

    // Set logger if provided
    if (config.logger !== false && config.logger) {
      this.__setLogger(config.logger);
    }
  }

  // ============================================================================
  // Initialization & Lifecycle
  // ============================================================================

  /**
   * Initialize MastraAdmin. Validates license and initializes storage.
   * Must be called before using any business logic methods.
   */
  async init(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    this.logger.info('Initializing MastraAdmin...');

    // Validate license
    try {
      await this.#license.validate();
      this.logger.info(`License valid: ${this.#license.getLicenseInfo().tier}`);
    } catch (error) {
      this.logger.error('License validation failed', error);
      throw error;
    }

    // Initialize storage
    try {
      await this.#storage.init();
      this.logger.info('Storage initialized');
    } catch (error) {
      this.logger.error('Storage initialization failed', error);
      throw MastraAdminError.storageError('Failed to initialize storage', error);
    }

    this.#initialized = true;
    this.logger.info('MastraAdmin initialized successfully');
  }

  /**
   * Gracefully shutdown MastraAdmin.
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MastraAdmin...');

    // Stop build orchestrator
    await this.#orchestrator.shutdown();

    // Flush observability writer if present
    if (this.#observability?.writer) {
      await this.#observability.writer.shutdown();
    }

    // Close storage
    await this.#storage.close();

    this.logger.info('MastraAdmin shutdown complete');
  }

  // ============================================================================
  // Accessors (for admin-server to use)
  // ============================================================================

  getAuth(): MastraAuthProvider<unknown> {
    return this.#auth;
  }

  getStorage(): TStorage {
    return this.#storage;
  }

  getLicense(): LicenseValidator {
    return this.#license;
  }

  getLicenseInfo(): LicenseInfo {
    return this.#license.getLicenseInfo();
  }

  getRBAC(): RBACManager {
    return this.#rbac;
  }

  getOrchestrator(): BuildOrchestrator {
    return this.#orchestrator;
  }

  hasFeature(feature: string): boolean {
    return this.#license.hasFeature(feature as any);
  }

  // ============================================================================
  // Team Management
  // ============================================================================

  /**
   * Create a new team.
   */
  async createTeam(userId: string, input: CreateTeamInput): Promise<Team> {
    this.#assertInitialized();
    await this.#rbac.assertCanCreateTeam(userId);
    await this.#license.assertCanCreateTeam(await this.#storage.countTeams());

    const team = await this.#storage.createTeam({
      id: crypto.randomUUID(),
      name: input.name,
      slug: input.slug,
      createdBy: userId,
    });

    // Add creator as owner
    await this.#storage.addTeamMember({
      teamId: team.id,
      userId,
      role: TeamRole.OWNER,
    });

    this.logger.info(`Team created: ${team.slug}`, { teamId: team.id, userId });
    return team;
  }

  /**
   * Get a team by ID.
   */
  async getTeam(userId: string, teamId: string): Promise<Team> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, 'team:read');
    return this.#storage.getTeam(teamId);
  }

  /**
   * List teams the user has access to.
   */
  async listTeams(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<Team>> {
    this.#assertInitialized();
    return this.#storage.listTeamsForUser(userId, pagination);
  }

  /**
   * Invite a user to a team.
   */
  async inviteMember(
    userId: string,
    teamId: string,
    email: string,
    role: typeof TeamRole[keyof typeof TeamRole],
  ): Promise<TeamInvite> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, 'member:create');

    const invite = await this.#storage.createTeamInvite({
      id: crypto.randomUUID(),
      teamId,
      email,
      role,
      invitedBy: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Send invite email
    await this.#email.send({
      to: email,
      template: 'team_invite',
      data: { invite, teamId },
    });

    this.logger.info(`Team invite sent`, { teamId, email, invitedBy: userId });
    return invite;
  }

  /**
   * Get team members.
   */
  async getTeamMembers(userId: string, teamId: string): Promise<TeamMember[]> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, 'member:read');
    return this.#storage.getTeamMembers(teamId);
  }

  /**
   * Remove a team member.
   */
  async removeMember(userId: string, teamId: string, memberId: string): Promise<void> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, 'member:delete');
    await this.#storage.removeTeamMember(teamId, memberId);
    this.logger.info(`Team member removed`, { teamId, memberId, removedBy: userId });
  }

  // ============================================================================
  // Project Management
  // ============================================================================

  /**
   * Create a new project.
   */
  async createProject(userId: string, teamId: string, input: CreateProjectInput): Promise<Project> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, 'project:create');
    await this.#license.assertCanCreateProject(await this.#storage.countProjects(teamId));

    const project = await this.#storage.createProject({
      id: crypto.randomUUID(),
      teamId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      sourceType: input.sourceType,
      sourceConfig: input.sourceConfig,
      createdBy: userId,
    });

    this.logger.info(`Project created: ${project.slug}`, { projectId: project.id, teamId, userId });
    return project;
  }

  /**
   * Get a project by ID.
   */
  async getProject(userId: string, projectId: string): Promise<Project> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'project:read');
    return project;
  }

  /**
   * List projects in a team.
   */
  async listProjects(
    userId: string,
    teamId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Project>> {
    this.#assertInitialized();
    await this.#rbac.assertPermission({ userId, teamId }, 'project:read');
    return this.#storage.listProjects(teamId, pagination);
  }

  /**
   * Set an environment variable for a project.
   */
  async setEnvVar(
    userId: string,
    projectId: string,
    key: string,
    value: string,
    isSecret: boolean,
  ): Promise<void> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'project:update');

    const encryptedValue = isSecret
      ? await this.#encryption.encrypt(value)
      : value;

    await this.#storage.setEnvVar(projectId, {
      key,
      value: encryptedValue,
      isSecret,
    });

    this.logger.info(`Env var set: ${key}`, { projectId, isSecret, userId });
  }

  /**
   * Get environment variables for a project.
   */
  async getEnvVars(userId: string, projectId: string): Promise<EncryptedEnvVar[]> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'project:read');
    return this.#storage.getEnvVars(projectId);
  }

  /**
   * Delete a project.
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'project:delete');

    // Stop all deployments first
    const deployments = await this.#storage.listDeployments(projectId);
    for (const deployment of deployments.items) {
      if (deployment.status === 'running') {
        await this.stop(userId, deployment.id);
      }
    }

    await this.#storage.deleteProject(projectId);
    this.logger.info(`Project deleted`, { projectId, userId });
  }

  // ============================================================================
  // Deployment Management
  // ============================================================================

  /**
   * Create a new deployment for a project.
   */
  async createDeployment(
    userId: string,
    projectId: string,
    input: CreateDeploymentInput,
  ): Promise<Deployment> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:create');

    const deployment = await this.#storage.createDeployment({
      id: crypto.randomUUID(),
      projectId,
      type: input.type,
      subdomain: input.subdomain,
      envOverrides: input.envOverrides,
      status: 'pending',
      createdBy: userId,
    });

    this.logger.info(`Deployment created`, { deploymentId: deployment.id, projectId, userId });
    return deployment;
  }

  /**
   * Get a deployment by ID.
   */
  async getDeployment(userId: string, deploymentId: string): Promise<Deployment> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:read');
    return deployment;
  }

  /**
   * List deployments for a project.
   */
  async listDeployments(
    userId: string,
    projectId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Deployment>> {
    this.#assertInitialized();
    const project = await this.#storage.getProject(projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:read');
    return this.#storage.listDeployments(projectId, pagination);
  }

  /**
   * Deploy a deployment (trigger a build and deploy).
   * This is the main entry point for deploying a project.
   */
  async deploy(userId: string, deploymentId: string): Promise<Build> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:deploy');

    // Create a build and queue it
    const build = await this.#storage.createBuild({
      id: crypto.randomUUID(),
      deploymentId,
      status: 'queued',
      trigger: 'manual',
      triggeredBy: userId,
    });

    // Queue the build for processing by the orchestrator
    await this.#orchestrator.queueBuild(build.id);

    this.logger.info(`Deploy triggered`, { deploymentId, buildId: build.id, userId });
    return build;
  }

  /**
   * Stop a running deployment.
   */
  async stop(userId: string, deploymentId: string): Promise<void> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:stop');

    await this.#orchestrator.stopDeployment(deploymentId);
    await this.#storage.updateDeployment(deploymentId, { status: 'stopped' });

    this.logger.info(`Deployment stopped`, { deploymentId, userId });
  }

  /**
   * Rollback to a previous build.
   */
  async rollback(userId: string, deploymentId: string, buildId: string): Promise<Build> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:deploy');

    // Create a rollback build
    const build = await this.#storage.createBuild({
      id: crypto.randomUUID(),
      deploymentId,
      status: 'queued',
      trigger: 'rollback',
      triggeredBy: userId,
      rollbackFromBuildId: buildId,
    });

    await this.#orchestrator.queueBuild(build.id);

    this.logger.info(`Rollback triggered`, { deploymentId, buildId: build.id, rollbackFrom: buildId, userId });
    return build;
  }

  // ============================================================================
  // Build Management
  // ============================================================================

  /**
   * Trigger a build manually.
   */
  async triggerBuild(
    userId: string,
    deploymentId: string,
    input: TriggerBuildInput,
  ): Promise<Build> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'build:create');

    const build = await this.#storage.createBuild({
      id: crypto.randomUUID(),
      deploymentId,
      status: 'queued',
      trigger: input.trigger,
      commitSha: input.commitSha,
      triggeredBy: userId,
    });

    await this.#orchestrator.queueBuild(build.id);

    this.logger.info(`Build triggered`, { deploymentId, buildId: build.id, trigger: input.trigger, userId });
    return build;
  }

  /**
   * Get a build by ID.
   */
  async getBuild(userId: string, buildId: string): Promise<Build> {
    this.#assertInitialized();
    const build = await this.#storage.getBuild(buildId);
    const deployment = await this.#storage.getDeployment(build.deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'build:read');
    return build;
  }

  /**
   * List builds for a deployment.
   */
  async listBuilds(
    userId: string,
    deploymentId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Build>> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'build:read');
    return this.#storage.listBuilds(deploymentId, pagination);
  }

  /**
   * Get build logs.
   */
  async getBuildLogs(userId: string, buildId: string): Promise<string> {
    this.#assertInitialized();
    const build = await this.#storage.getBuild(buildId);
    const deployment = await this.#storage.getDeployment(build.deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'build:read');
    return this.#storage.getBuildLogs(buildId);
  }

  /**
   * Cancel a queued or running build.
   */
  async cancelBuild(userId: string, buildId: string): Promise<void> {
    this.#assertInitialized();
    const build = await this.#storage.getBuild(buildId);
    const deployment = await this.#storage.getDeployment(build.deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'build:cancel');

    await this.#orchestrator.cancelBuild(buildId);
    await this.#storage.updateBuild(buildId, { status: 'cancelled' });

    this.logger.info(`Build cancelled`, { buildId, userId });
  }

  // ============================================================================
  // Running Server Management
  // ============================================================================

  /**
   * Get the running server for a deployment.
   */
  async getRunningServer(userId: string, deploymentId: string): Promise<RunningServer | null> {
    this.#assertInitialized();
    const deployment = await this.#storage.getDeployment(deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:read');
    return this.#storage.getRunningServer(deploymentId);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  #assertInitialized(): void {
    if (!this.#initialized) {
      throw MastraAdminError.configurationError('MastraAdmin not initialized. Call init() first.');
    }
  }

  #generateFallbackSecret(): string {
    this.logger.warn(
      'ADMIN_ENCRYPTION_SECRET not set. Using generated secret. ' +
        'This is insecure for production - set ADMIN_ENCRYPTION_SECRET environment variable.',
    );
    return 'dev-fallback-secret-not-for-production-use!!';
  }
}
```

---

## Phase 8: BuildOrchestrator

The BuildOrchestrator manages the build queue and deployment flow. It's used internally by MastraAdmin's `deploy()`, `triggerBuild()`, and related methods.

### 8.1 src/orchestrator/types.ts

```typescript
import type { Build, Deployment, Project } from '../types';

/**
 * Build job in the queue.
 */
export interface BuildJob {
  buildId: string;
  queuedAt: Date;
  priority: number;
}

/**
 * Build context passed to the runner.
 */
export interface BuildContext {
  build: Build;
  deployment: Deployment;
  project: Project;
  envVars: Record<string, string>;
  sourceDir: string;
}

/**
 * Build result from the runner.
 */
export interface BuildResult {
  success: boolean;
  artifactPath?: string;
  logs: string;
  durationMs: number;
  error?: string;
}
```

### 8.2 src/orchestrator/build-orchestrator.ts

```typescript
import type { AdminStorage } from '../providers/storage/base';
import type { ProjectRunner } from '../providers/runner/base';
import type { EdgeRouterProvider } from '../providers/router/base';
import type { ProjectSourceProvider } from '../providers/source/base';
import type { BuildJob, BuildContext, BuildResult } from './types';

/**
 * BuildOrchestrator manages the build queue and deployment flow.
 *
 * This is used internally by MastraAdmin. The admin-server's build worker
 * calls `processNextBuild()` to process queued builds.
 */
export class BuildOrchestrator {
  readonly #storage: AdminStorage;
  readonly #runner?: ProjectRunner;
  readonly #router?: EdgeRouterProvider;
  readonly #source?: ProjectSourceProvider;
  readonly #queue: BuildJob[] = [];
  #processing = false;
  #shutdown = false;

  constructor(
    storage: AdminStorage,
    runner?: ProjectRunner,
    router?: EdgeRouterProvider,
    source?: ProjectSourceProvider,
  ) {
    this.#storage = storage;
    this.#runner = runner;
    this.#router = router;
    this.#source = source;
  }

  /**
   * Queue a build for processing.
   */
  async queueBuild(buildId: string, priority = 0): Promise<void> {
    this.#queue.push({
      buildId,
      queuedAt: new Date(),
      priority,
    });

    // Sort by priority (higher first), then by queue time (older first)
    this.#queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });
  }

  /**
   * Process the next build in the queue.
   * Called by admin-server's build worker.
   * Returns true if a build was processed, false if queue is empty.
   */
  async processNextBuild(): Promise<boolean> {
    if (this.#shutdown || this.#processing) {
      return false;
    }

    const job = this.#queue.shift();
    if (!job) {
      return false;
    }

    this.#processing = true;

    try {
      await this.#processBuild(job.buildId);
    } finally {
      this.#processing = false;
    }

    return true;
  }

  /**
   * Process a specific build.
   */
  async #processBuild(buildId: string): Promise<void> {
    const build = await this.#storage.getBuild(buildId);
    const deployment = await this.#storage.getDeployment(build.deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);

    // Update build status
    await this.#storage.updateBuild(buildId, { status: 'building', startedAt: new Date() });

    try {
      // 1. Get project source
      if (!this.#source) {
        throw new Error('No source provider configured');
      }
      const sourceDir = await this.#source.getSource(project);

      // 2. Get decrypted env vars
      const envVars = await this.#getDecryptedEnvVars(project.id);

      // 3. Run the build
      if (!this.#runner) {
        throw new Error('No runner configured');
      }

      const context: BuildContext = {
        build,
        deployment,
        project,
        envVars,
        sourceDir,
      };

      const result = await this.#runner.build(context);

      if (!result.success) {
        throw new Error(result.error || 'Build failed');
      }

      // 4. Deploy the artifact
      await this.#storage.updateBuild(buildId, { status: 'deploying' });
      const server = await this.#runner.deploy(context, result.artifactPath!);

      // 5. Configure routing
      if (this.#router && deployment.subdomain) {
        await this.#router.addRoute({
          subdomain: deployment.subdomain,
          target: `http://localhost:${server.port}`,
          deploymentId: deployment.id,
        });
      }

      // 6. Save running server info
      await this.#storage.saveRunningServer(deployment.id, server);

      // 7. Update build and deployment status
      await this.#storage.updateBuild(buildId, {
        status: 'succeeded',
        finishedAt: new Date(),
        logs: result.logs,
        durationMs: result.durationMs,
      });

      await this.#storage.updateDeployment(deployment.id, {
        status: 'running',
        currentBuildId: buildId,
      });

      // 8. Cleanup old artifacts (keep last 5 builds)
      await this.#cleanupOldBuilds(deployment.id);

    } catch (error) {
      await this.#storage.updateBuild(buildId, {
        status: 'failed',
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      });

      await this.#storage.updateDeployment(deployment.id, {
        status: 'failed',
      });
    }
  }

  /**
   * Stop a running deployment.
   */
  async stopDeployment(deploymentId: string): Promise<void> {
    const server = await this.#storage.getRunningServer(deploymentId);
    if (server && this.#runner) {
      await this.#runner.stop(server);
    }

    if (this.#router) {
      await this.#router.removeRoute(deploymentId);
    }

    await this.#storage.deleteRunningServer(deploymentId);
  }

  /**
   * Cancel a build.
   */
  async cancelBuild(buildId: string): Promise<void> {
    // Remove from queue if queued
    const index = this.#queue.findIndex(j => j.buildId === buildId);
    if (index !== -1) {
      this.#queue.splice(index, 1);
    }

    // If currently building, stop it
    // (In a real implementation, this would signal the runner to abort)
  }

  /**
   * Get queue status.
   */
  getQueueStatus(): { length: number; processing: boolean } {
    return {
      length: this.#queue.length,
      processing: this.#processing,
    };
  }

  /**
   * Shutdown the orchestrator.
   */
  async shutdown(): Promise<void> {
    this.#shutdown = true;
    // Wait for current build to finish
    while (this.#processing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async #getDecryptedEnvVars(projectId: string): Promise<Record<string, string>> {
    const envVars = await this.#storage.getEnvVars(projectId);
    const result: Record<string, string> = {};
    for (const env of envVars) {
      // In real implementation, decrypt secret values
      result[env.key] = env.value;
    }
    return result;
  }

  async #cleanupOldBuilds(deploymentId: string): Promise<void> {
    const builds = await this.#storage.listBuilds(deploymentId, { limit: 100 });
    const succeededBuilds = builds.items
      .filter(b => b.status === 'succeeded')
      .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime());

    // Keep last 5 builds, cleanup older ones
    for (const build of succeededBuilds.slice(5)) {
      if (this.#runner && build.artifactPath) {
        await this.#runner.cleanup(build.artifactPath);
      }
    }
  }
}
```

### 8.3 src/orchestrator/index.ts

```typescript
export { BuildOrchestrator } from './build-orchestrator';
export type { BuildJob, BuildContext, BuildResult } from './types';
```

---

## Phase 9: Exports

### 9.1 src/index.ts

```typescript
// Main class
export { MastraAdmin } from './mastra-admin';
export type {
  MastraAdminConfig,
  ObservabilityConfig,
  CreateTeamInput,
  CreateProjectInput,
  CreateDeploymentInput,
  TriggerBuildInput,
} from './mastra-admin';

// Orchestrator
export { BuildOrchestrator } from './orchestrator';
export type { BuildJob, BuildContext, BuildResult } from './orchestrator';

// Types
export type {
  User,
  Team,
  TeamSettings,
  TeamMember,
  TeamInvite,
  Project,
  LocalSourceConfig,
  GitHubSourceConfig,
  EncryptedEnvVar,
  Deployment,
  Build,
  RunningServer,
  RouteConfig,
  RouteInfo,
  RouteHealthStatus,
  ProjectSource,
  ChangeEvent,
  FileInfo,
  ProjectApiToken,
} from './types';

// Constants
export {
  RegisteredAdminComponent,
  DeploymentStatus,
  DeploymentType,
  BuildStatus,
  BuildTrigger,
  HealthStatus,
  SourceType,
  TeamRole,
  RouteStatus,
} from './constants';

// Errors
export { MastraAdminError, AdminErrorDomain, AdminErrorCategory } from './errors';

// Re-export from submodules
export * from './license';
export * from './providers';
export * from './rbac';
```

### 9.2 src/license/index.ts

```typescript
export { LicenseValidator } from './validator';
export { LicenseTier, LicenseFeature } from './types';
export type { LicenseInfo, LicensePayload } from './types';
export { TIER_FEATURES, TIER_LIMITS, isFeatureEnabled, getMergedFeatures } from './features';
```

### 9.3 src/providers/index.ts

```typescript
// Storage
export type { AdminStorage, PaginationParams, PaginatedResult } from './storage/base';

// File Storage
export type { FileStorageProvider } from './file-storage/base';

// Observability
export type {
  Trace,
  Span,
  SpanEvent,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
} from './observability/types';
export type {
  ObservabilityWriterConfig,
  ObservabilityWriterInterface,
} from './observability/writer';
export type {
  TimeRange,
  QueryPagination,
  TraceQueryFilter,
  SpanQueryFilter,
  LogQueryFilter,
  MetricQueryFilter,
  ScoreQueryFilter,
  MetricAggregation,
  ObservabilityQueryProvider,
} from './observability/query-provider';

// Runner
export type { ProjectRunner, BuildOptions, RunOptions, LogStreamCallback } from './runner/base';

// Router
export type { EdgeRouterProvider } from './router/base';

// Source
export type { ProjectSourceProvider } from './source/base';

// Billing
export type { BillingProvider, SubscriptionInfo, UsageMetrics } from './billing/base';
export { NoBillingProvider } from './billing/no-billing';

// Email
export type { EmailProvider, EmailOptions, EmailTemplate } from './email/base';
export { ConsoleEmailProvider } from './email/console';

// Encryption
export type { EncryptionProvider } from './encryption/base';
export { NodeCryptoEncryptionProvider } from './encryption/node-crypto';
```

### 9.4 src/rbac/index.ts

```typescript
export { RBACManager, ContextualRBAC } from './manager';
export { SYSTEM_ROLES, ALL_PERMISSIONS, getSystemRole, roleHasPermission } from './roles';
export { RBACResource, RBACAction } from './types';
export type { Permission, Role, PermissionContext } from './types';
```

---

## Phase 10: Testing

### 10.1 Test Structure

```
packages/admin/src/
├── __tests__/
│   ├── mastra-admin.test.ts
│   ├── license/
│   │   ├── validator.test.ts
│   │   └── features.test.ts
│   ├── providers/
│   │   ├── encryption/
│   │   │   └── node-crypto.test.ts
│   │   ├── email/
│   │   │   └── console.test.ts
│   │   └── billing/
│   │       └── no-billing.test.ts
│   └── rbac/
│       ├── manager.test.ts
│       └── roles.test.ts
```

### 10.2 Example Test: License Validator

```typescript
// src/__tests__/license/validator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { LicenseValidator } from '../../license/validator';
import { LicenseTier, LicenseFeature } from '../../license/types';

describe('LicenseValidator', () => {
  describe('development license', () => {
    it('should accept "dev" license key', async () => {
      const validator = new LicenseValidator('dev');
      const info = await validator.validate();

      expect(info.valid).toBe(true);
      expect(info.tier).toBe(LicenseTier.ENTERPRISE);
      expect(info.organizationName).toBe('Development');
    });

    it('should accept "development" license key', async () => {
      const validator = new LicenseValidator('development');
      const info = await validator.validate();

      expect(info.valid).toBe(true);
      expect(info.tier).toBe(LicenseTier.ENTERPRISE);
    });

    it('should have all features enabled for dev license', async () => {
      const validator = new LicenseValidator('dev');
      await validator.validate();

      expect(validator.hasFeature(LicenseFeature.LOCAL_RUNNER)).toBe(true);
      expect(validator.hasFeature(LicenseFeature.K8S_RUNNER)).toBe(true);
      expect(validator.hasFeature(LicenseFeature.SSO)).toBe(true);
    });

    it('should have no limits for dev license', async () => {
      const validator = new LicenseValidator('dev');
      await validator.validate();

      expect(validator.canCreateTeam(100)).toBe(true);
      expect(validator.canAddTeamMember('team1', 1000)).toBe(true);
      expect(validator.canCreateProject('team1', 1000)).toBe(true);
    });
  });

  describe('invalid license', () => {
    it('should throw for invalid format', async () => {
      const validator = new LicenseValidator('invalid-key');
      await expect(validator.validate()).rejects.toThrow();
    });

    it('should throw for empty key', async () => {
      const validator = new LicenseValidator('');
      await expect(validator.validate()).rejects.toThrow();
    });
  });

  describe('getLicenseInfo', () => {
    it('should throw if not validated', () => {
      const validator = new LicenseValidator('dev');
      expect(() => validator.getLicenseInfo()).toThrow('License not validated');
    });

    it('should return cached info after validation', async () => {
      const validator = new LicenseValidator('dev');
      await validator.validate();

      const info1 = validator.getLicenseInfo();
      const info2 = validator.getLicenseInfo();

      expect(info1).toBe(info2);
    });
  });
});
```

### 10.3 Example Test: NodeCryptoEncryptionProvider

```typescript
// src/__tests__/providers/encryption/node-crypto.test.ts
import { describe, it, expect } from 'vitest';
import { NodeCryptoEncryptionProvider } from '../../../providers/encryption/node-crypto';

describe('NodeCryptoEncryptionProvider', () => {
  const secret = 'test-secret-key-that-is-at-least-32-chars-long';
  let provider: NodeCryptoEncryptionProvider;

  beforeEach(() => {
    provider = new NodeCryptoEncryptionProvider(secret);
  });

  describe('constructor', () => {
    it('should throw for short secret', () => {
      expect(() => new NodeCryptoEncryptionProvider('short')).toThrow('at least 32 characters');
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly', async () => {
      const plaintext = 'Hello, World!';
      const encrypted = await provider.encrypt(plaintext);
      const decrypted = await provider.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext each time', async () => {
      const plaintext = 'Hello, World!';
      const encrypted1 = await provider.encrypt(plaintext);
      const encrypted2 = await provider.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', async () => {
      const encrypted = await provider.encrypt('');
      const decrypted = await provider.decrypt(encrypted);

      expect(decrypted).toBe('');
    });

    it('should handle unicode', async () => {
      const plaintext = '你好世界 🌍';
      const encrypted = await provider.encrypt(plaintext);
      const decrypted = await provider.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with wrong key', async () => {
      const encrypted = await provider.encrypt('secret');
      const wrongProvider = new NodeCryptoEncryptionProvider('different-secret-key-at-least-32-chars');

      await expect(wrongProvider.decrypt(encrypted)).rejects.toThrow();
    });
  });

  describe('hash/verifyHash', () => {
    it('should hash and verify correctly', async () => {
      const value = 'my-api-token';
      const hash = await provider.hash(value);
      const isValid = await provider.verifyHash(value, hash);

      expect(isValid).toBe(true);
    });

    it('should fail verification for wrong value', async () => {
      const hash = await provider.hash('correct-value');
      const isValid = await provider.verifyHash('wrong-value', hash);

      expect(isValid).toBe(false);
    });

    it('should produce different hashes with different salts', async () => {
      const value = 'same-value';
      const hash1 = await provider.hash(value);
      const hash2 = await provider.hash(value);

      expect(hash1).not.toBe(hash2);
      // But both should verify
      expect(await provider.verifyHash(value, hash1)).toBe(true);
      expect(await provider.verifyHash(value, hash2)).toBe(true);
    });
  });
});
```

---

## Success Criteria

### Automated Verification

- [ ] Package builds successfully: `pnpm build` in `packages/admin/`
- [ ] TypeScript types compile: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] All unit tests pass: `pnpm test`
- [ ] Package exports are correct (can import from `@mastra/admin`, `@mastra/admin/license`, etc.)

### Manual Verification

- [ ] Can instantiate `MastraAdmin` with required config
- [ ] License validation works with `'dev'` key
- [ ] License feature gating returns correct values
- [ ] RBAC system roles have correct permissions
- [ ] `NodeCryptoEncryptionProvider` encrypts/decrypts correctly
- [ ] `ConsoleEmailProvider` logs to console
- [ ] `NoBillingProvider` returns enterprise subscription
- [ ] Error classes provide structured error information

### Type Safety

- [ ] All provider interfaces are exported
- [ ] Generic types work correctly in `MastraAdmin<...>`
- [ ] Provider implementations can be type-checked against interfaces
- [ ] No `any` types in public APIs (except where intentional)

---

## Dependencies on Other Lanes

This package is the **foundation** that all other lanes depend on:

- **LANE 1.5 (admin-server)**: **Primary consumer** - uses MastraAdmin and all providers to implement actual operations
- **LANE 2 (admin-pg)**: Will implement `AdminStorage` interface
- **LANE 3 (observability)**: Will implement `FileStorageProvider`, `ObservabilityWriterInterface`, `ObservabilityQueryProvider`
- **LANE 4 (source-local)**: Will implement `ProjectSourceProvider`
- **LANE 5 (runner-local)**: Will implement `ProjectRunner`
- **LANE 12 (router-local)**: Will implement `EdgeRouterProvider`

This package defines the contracts (interfaces) that all other lanes implement. LANE 1.5 (admin-server) is where those providers are actually *used* to do work.

---

## Implementation Order

1. **Phase 1**: Package setup (package.json, tsconfig, tsup.config)
2. **Phase 2**: Constants and base types
3. **Phase 3**: Error handling classes
4. **Phase 4**: Provider interfaces (in parallel)
   - Storage interface
   - File storage interface
   - Observability interfaces
   - Runner interface
   - Router interface
   - Source interface
   - Billing (interface + implementation)
   - Email (interface + implementation)
   - Encryption (interface + implementation)
5. **Phase 5**: License validation system
6. **Phase 6**: RBAC system
7. **Phase 7**: MastraAdmin class (with business logic methods)
8. **Phase 8**: BuildOrchestrator
9. **Phase 9**: Exports and index files
10. **Phase 10**: Tests

---

## Notes

- **This package follows the `@mastra/core` pattern** - MastraAdmin is a central orchestrator with business logic
- The `MastraAdmin` class has methods like `createTeam()`, `createProject()`, `deploy()`, etc.
- Provider interfaces define contracts for pluggable components (storage, runner, router, etc.)
- Built-in providers (NoBilling, ConsoleEmail, NodeCrypto) are simple enough to include in core
- License validation supports a `'dev'` key for development without a real license
- RBAC uses a simple role-based model with four system roles: owner, admin, developer, viewer
- Auth is delegated to existing `@mastra/auth-*` packages - no new auth abstraction needed

## Relationship to admin-server

This mirrors the relationship between `@mastra/core` and `@mastra/server`:

```
@mastra/admin (this package)           @mastra/admin-server (LANE 1.5)
┌────────────────────────────────┐    ┌──────────────────────────────┐
│ MastraAdmin class              │    │ AdminServer class            │
│ • Business logic methods:      │    │ • HTTP wrapper               │
│   - createTeam()               │◄───│ • Routes call MastraAdmin:   │
│   - createProject()            │    │   POST /teams → createTeam() │
│   - deploy()                   │    │   POST /deploy → deploy()    │
│   - triggerBuild()             │    │ • Auth middleware            │
│ • BuildOrchestrator            │    │ • Build worker process       │
│ • Provider interfaces          │    │                              │
│ • Types, Errors, RBAC          │    │                              │
└────────────────────────────────┘    └──────────────────────────────┘
   Central orchestrator + logic          HTTP wrapper (thin layer)
```

**Usage:**
```typescript
// Direct usage (like using Mastra directly)
const admin = new MastraAdmin({ storage, runner, router, ... });
await admin.init();
const team = await admin.createTeam('user-123', { name: 'Search', slug: 'search' });
await admin.deploy('user-123', deploymentId);

// Via HTTP server (like using @mastra/server)
const server = new AdminServer({ admin, port: 3000 });
await server.start();
// POST /api/teams → calls admin.createTeam()
// POST /api/deployments/:id/deploy → calls admin.deploy()
```
