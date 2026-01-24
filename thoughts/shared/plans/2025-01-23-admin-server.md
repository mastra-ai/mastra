# @mastra/admin-server Implementation Plan

## Overview

`@mastra/admin-server` is the HTTP API layer that exposes `MastraAdmin` functionality via REST endpoints. It follows the same pattern as `@mastra/server` wrapping `Mastra` - it's a thin HTTP wrapper that delegates all business logic to the `MastraAdmin` class.

**Package Location**: `packages/admin-server/`
**npm Package**: `@mastra/admin-server`

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `@mastra/admin` | peer | Core `MastraAdmin` class with all business logic |
| `hono` | runtime | HTTP server framework (same as @mastra/server) |
| `@hono/node-server` | runtime | Node.js adapter for Hono |
| `zod` | peer | Request validation schemas |

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         @mastra/admin-server                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                        AdminServer Class                              │  │
│   │                                                                       │  │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │  │
│   │  │   HTTP Routes   │  │   Middleware    │  │   Build Worker      │   │  │
│   │  │                 │  │                 │  │                     │   │  │
│   │  │ POST /api/teams │  │ Auth Middleware │  │ Polls build queue   │   │  │
│   │  │ GET  /api/...   │  │ RBAC Middleware │  │ Processes builds    │   │  │
│   │  │ WebSocket /ws   │  │ Error Handler   │  │ Runs in background  │   │  │
│   │  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘   │  │
│   │           │                    │                      │              │  │
│   │           └────────────────────┼──────────────────────┘              │  │
│   │                                │                                      │  │
│   │                                ▼                                      │  │
│   │                    ┌──────────────────────┐                          │  │
│   │                    │    MastraAdmin       │                          │  │
│   │                    │    (injected)        │                          │  │
│   │                    │                      │                          │  │
│   │                    │ .createTeam()        │                          │  │
│   │                    │ .createProject()     │                          │  │
│   │                    │ .deploy()            │                          │  │
│   │                    │ .getOrchestrator()   │                          │  │
│   │                    └──────────────────────┘                          │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Thin HTTP Layer**: All business logic lives in `MastraAdmin` - this package only handles HTTP concerns
2. **Route → Handler → Admin Method**: Each route extracts params, validates, then calls the appropriate `MastraAdmin` method
3. **Consistent with @mastra/server patterns**: Uses same route definition style, middleware patterns, and response handling
4. **WebSocket Support**: Real-time streaming for build logs and server logs

## Directory Structure

```
packages/admin-server/
├── src/
│   ├── index.ts                          # Main exports
│   ├── server.ts                         # AdminServer class
│   ├── types.ts                          # Server-specific types
│   │
│   ├── routes/
│   │   ├── index.ts                      # Route aggregation (ADMIN_SERVER_ROUTES)
│   │   ├── auth.ts                       # Auth routes
│   │   ├── teams.ts                      # Team routes
│   │   ├── projects.ts                   # Project routes
│   │   ├── sources.ts                    # Source routes
│   │   ├── deployments.ts                # Deployment routes
│   │   ├── builds.ts                     # Build routes
│   │   ├── servers.ts                    # Running server routes
│   │   ├── observability.ts              # Observability routes
│   │   └── admin.ts                      # Platform admin routes
│   │
│   ├── handlers/
│   │   ├── auth.ts                       # Auth handler implementations
│   │   ├── teams.ts                      # Team handler implementations
│   │   ├── projects.ts                   # Project handler implementations
│   │   ├── sources.ts                    # Source handler implementations
│   │   ├── deployments.ts                # Deployment handler implementations
│   │   ├── builds.ts                     # Build handler implementations
│   │   ├── servers.ts                    # Server handler implementations
│   │   ├── observability.ts              # Observability handler implementations
│   │   ├── admin.ts                      # Admin handler implementations
│   │   └── error.ts                      # Error handling utilities
│   │
│   ├── schemas/
│   │   ├── auth.ts                       # Auth request/response schemas
│   │   ├── teams.ts                      # Team schemas
│   │   ├── projects.ts                   # Project schemas
│   │   ├── sources.ts                    # Source schemas
│   │   ├── deployments.ts                # Deployment schemas
│   │   ├── builds.ts                     # Build schemas
│   │   ├── servers.ts                    # Server schemas
│   │   ├── observability.ts              # Observability schemas
│   │   ├── admin.ts                      # Admin schemas
│   │   └── common.ts                     # Shared schemas (pagination, etc.)
│   │
│   ├── middleware/
│   │   ├── auth.ts                       # Authentication middleware
│   │   ├── rbac.ts                       # RBAC permission checking
│   │   ├── team-context.ts               # Team context extraction
│   │   ├── error-handler.ts              # Global error handling
│   │   └── request-logger.ts             # Request logging
│   │
│   ├── websocket/
│   │   ├── index.ts                      # WebSocket server setup
│   │   ├── types.ts                      # WebSocket message types
│   │   ├── build-logs.ts                 # Real-time build log streaming
│   │   └── server-logs.ts                # Real-time server log streaming
│   │
│   └── worker/
│       ├── build-worker.ts               # Build queue processor
│       └── health-checker.ts             # Server health check worker
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Core Interfaces

### AdminServerConfig

```typescript
import type { MastraAdmin } from '@mastra/admin';

export interface AdminServerConfig {
  /**
   * MastraAdmin instance - contains all business logic
   * Routes delegate to this instance for all operations
   */
  admin: MastraAdmin;

  /**
   * Server port (default: 3000)
   */
  port?: number;

  /**
   * Server host (default: 'localhost')
   */
  host?: string;

  /**
   * Base path for all API routes (default: '/api')
   */
  basePath?: string;

  /**
   * CORS configuration
   */
  cors?: CorsOptions;

  /**
   * Rate limiting options
   */
  rateLimit?: RateLimitOptions;

  /**
   * Request timeout in ms (default: 30000)
   */
  timeout?: number;

  /**
   * Maximum request body size (default: 10MB)
   */
  maxBodySize?: number;

  /**
   * Enable build worker (processes build queue)
   * Default: true
   */
  enableBuildWorker?: boolean;

  /**
   * Build worker polling interval in ms (default: 5000)
   */
  buildWorkerIntervalMs?: number;

  /**
   * Enable health check worker
   * Default: true
   */
  enableHealthWorker?: boolean;

  /**
   * Health check interval in ms (default: 30000)
   */
  healthCheckIntervalMs?: number;

  /**
   * Enable WebSocket support for real-time logs
   * Default: true
   */
  enableWebSocket?: boolean;

  /**
   * Enable request logging
   * Default: true in development
   */
  enableRequestLogging?: boolean;

  /**
   * Custom error handler
   */
  onError?: (error: Error, context: ErrorContext) => Response | void;
}

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (context: RateLimitContext) => string;
}

export interface ErrorContext {
  path: string;
  method: string;
  userId?: string;
  teamId?: string;
}

export interface RateLimitContext {
  path: string;
  method: string;
  ip: string;
  userId?: string;
}
```

### AdminServer Class

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { MastraAdmin } from '@mastra/admin';
import type { Server } from 'node:http';

export class AdminServer {
  private readonly app: Hono;
  private readonly config: AdminServerConfig;
  private readonly admin: MastraAdmin;
  private server?: Server;
  private buildWorker?: BuildWorker;
  private healthWorker?: HealthCheckWorker;
  private wsServer?: WebSocketServer;

  constructor(config: AdminServerConfig) {
    this.config = {
      port: 3000,
      host: 'localhost',
      basePath: '/api',
      enableBuildWorker: true,
      buildWorkerIntervalMs: 5000,
      enableHealthWorker: true,
      healthCheckIntervalMs: 30000,
      enableWebSocket: true,
      timeout: 30000,
      maxBodySize: 10 * 1024 * 1024, // 10MB
      ...config,
    };
    this.admin = config.admin;
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Start the HTTP server and background workers
   */
  async start(): Promise<void>;

  /**
   * Stop the server and workers gracefully
   */
  async stop(): Promise<void>;

  /**
   * Get the underlying Hono app for customization
   */
  getApp(): Hono;

  /**
   * Get the MastraAdmin instance
   */
  getAdmin(): MastraAdmin;

  /**
   * Check if server is healthy
   */
  isHealthy(): boolean;

  /**
   * Get server status
   */
  getStatus(): ServerStatus;
}

export interface ServerStatus {
  running: boolean;
  uptime: number;
  buildWorkerActive: boolean;
  healthWorkerActive: boolean;
  wsConnectionCount: number;
  port: number;
  host: string;
}
```

### AdminServerContext

```typescript
/**
 * Context available to all route handlers
 */
export interface AdminServerContext {
  /**
   * MastraAdmin instance for business logic
   */
  admin: MastraAdmin;

  /**
   * Authenticated user (null if not authenticated)
   */
  user: User | null;

  /**
   * User ID (convenience accessor)
   */
  userId: string;

  /**
   * Current team context (if applicable)
   */
  team?: Team;

  /**
   * Team ID from route params or context
   */
  teamId?: string;

  /**
   * User's permissions for current team
   */
  permissions: Permission[];

  /**
   * Request abort signal
   */
  abortSignal: AbortSignal;

  /**
   * Logger instance
   */
  logger: Logger;
}
```

## Route Definitions

### Route Pattern (Following @mastra/server conventions)

```typescript
import { z } from 'zod';
import { createRoute } from '../utils/route-builder';

// Define schemas
const teamIdPathParams = z.object({
  teamId: z.string().uuid(),
});

const createTeamBodySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(50),
  settings: teamSettingsSchema.optional(),
});

const teamResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string().datetime(),
  settings: teamSettingsSchema,
});

// Define route
export const CREATE_TEAM_ROUTE = createRoute({
  method: 'POST',
  path: '/teams',
  responseType: 'json',
  bodySchema: createTeamBodySchema,
  responseSchema: teamResponseSchema,
  summary: 'Create a new team',
  description: 'Creates a new team for the authenticated user',
  tags: ['Teams'],
  handler: async ({ admin, userId, name, slug, settings }) => {
    const team = await admin.createTeam(userId, { name, slug, settings });
    return team;
  },
});
```

### Complete Route List

#### Auth Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/auth/login` | `loginHandler` | Login via auth provider |
| `POST` | `/auth/logout` | `logoutHandler` | Logout current session |
| `GET` | `/auth/me` | `getMeHandler` | Get current user info |
| `POST` | `/auth/refresh` | `refreshTokenHandler` | Refresh access token |

```typescript
// Auth routes
export const AUTH_ROUTES: AdminServerRoute[] = [
  LOGIN_ROUTE,
  LOGOUT_ROUTE,
  GET_ME_ROUTE,
  REFRESH_TOKEN_ROUTE,
];
```

#### Team Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/teams` | `listTeamsHandler` | List user's teams |
| `POST` | `/teams` | `createTeamHandler` | Create new team |
| `GET` | `/teams/:teamId` | `getTeamHandler` | Get team details |
| `PATCH` | `/teams/:teamId` | `updateTeamHandler` | Update team |
| `DELETE` | `/teams/:teamId` | `deleteTeamHandler` | Delete team |
| `GET` | `/teams/:teamId/members` | `listMembersHandler` | List team members |
| `POST` | `/teams/:teamId/members` | `inviteMemberHandler` | Invite member |
| `DELETE` | `/teams/:teamId/members/:userId` | `removeMemberHandler` | Remove member |
| `PATCH` | `/teams/:teamId/members/:userId` | `updateMemberRoleHandler` | Update member role |
| `GET` | `/teams/:teamId/invites` | `listInvitesHandler` | List pending invites |
| `DELETE` | `/teams/:teamId/invites/:inviteId` | `cancelInviteHandler` | Cancel invite |
| `POST` | `/invites/:inviteId/accept` | `acceptInviteHandler` | Accept team invite |

```typescript
// Team routes
export const TEAM_ROUTES: AdminServerRoute[] = [
  LIST_TEAMS_ROUTE,
  CREATE_TEAM_ROUTE,
  GET_TEAM_ROUTE,
  UPDATE_TEAM_ROUTE,
  DELETE_TEAM_ROUTE,
  LIST_MEMBERS_ROUTE,
  INVITE_MEMBER_ROUTE,
  REMOVE_MEMBER_ROUTE,
  UPDATE_MEMBER_ROLE_ROUTE,
  LIST_INVITES_ROUTE,
  CANCEL_INVITE_ROUTE,
  ACCEPT_INVITE_ROUTE,
];
```

#### Project Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/teams/:teamId/projects` | `listProjectsHandler` | List team's projects |
| `POST` | `/teams/:teamId/projects` | `createProjectHandler` | Create project |
| `GET` | `/projects/:projectId` | `getProjectHandler` | Get project details |
| `PATCH` | `/projects/:projectId` | `updateProjectHandler` | Update project |
| `DELETE` | `/projects/:projectId` | `deleteProjectHandler` | Delete project |
| `GET` | `/projects/:projectId/env-vars` | `listEnvVarsHandler` | List env vars |
| `POST` | `/projects/:projectId/env-vars` | `setEnvVarHandler` | Set env var |
| `DELETE` | `/projects/:projectId/env-vars/:key` | `deleteEnvVarHandler` | Delete env var |
| `GET` | `/projects/:projectId/api-tokens` | `listApiTokensHandler` | List API tokens |
| `POST` | `/projects/:projectId/api-tokens` | `createApiTokenHandler` | Create API token |
| `DELETE` | `/projects/:projectId/api-tokens/:tokenId` | `revokeApiTokenHandler` | Revoke API token |

```typescript
// Project routes
export const PROJECT_ROUTES: AdminServerRoute[] = [
  LIST_PROJECTS_ROUTE,
  CREATE_PROJECT_ROUTE,
  GET_PROJECT_ROUTE,
  UPDATE_PROJECT_ROUTE,
  DELETE_PROJECT_ROUTE,
  LIST_ENV_VARS_ROUTE,
  SET_ENV_VAR_ROUTE,
  DELETE_ENV_VAR_ROUTE,
  LIST_API_TOKENS_ROUTE,
  CREATE_API_TOKEN_ROUTE,
  REVOKE_API_TOKEN_ROUTE,
];
```

#### Source Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/teams/:teamId/sources` | `listSourcesHandler` | List available project sources |
| `GET` | `/sources/:sourceId` | `getSourceHandler` | Get source details |
| `POST` | `/sources/:sourceId/validate` | `validateSourceHandler` | Validate source access |

```typescript
// Source routes
export const SOURCE_ROUTES: AdminServerRoute[] = [
  LIST_SOURCES_ROUTE,
  GET_SOURCE_ROUTE,
  VALIDATE_SOURCE_ROUTE,
];
```

#### Deployment Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/projects/:projectId/deployments` | `listDeploymentsHandler` | List deployments |
| `POST` | `/projects/:projectId/deployments` | `createDeploymentHandler` | Create deployment |
| `GET` | `/deployments/:deploymentId` | `getDeploymentHandler` | Get deployment details |
| `PATCH` | `/deployments/:deploymentId` | `updateDeploymentHandler` | Update deployment config |
| `DELETE` | `/deployments/:deploymentId` | `deleteDeploymentHandler` | Delete deployment |
| `POST` | `/deployments/:deploymentId/deploy` | `triggerDeployHandler` | Trigger deploy |
| `POST` | `/deployments/:deploymentId/stop` | `stopDeploymentHandler` | Stop deployment |
| `POST` | `/deployments/:deploymentId/restart` | `restartDeploymentHandler` | Restart deployment |
| `POST` | `/deployments/:deploymentId/rollback` | `rollbackDeploymentHandler` | Rollback to previous build |

```typescript
// Deployment routes
export const DEPLOYMENT_ROUTES: AdminServerRoute[] = [
  LIST_DEPLOYMENTS_ROUTE,
  CREATE_DEPLOYMENT_ROUTE,
  GET_DEPLOYMENT_ROUTE,
  UPDATE_DEPLOYMENT_ROUTE,
  DELETE_DEPLOYMENT_ROUTE,
  TRIGGER_DEPLOY_ROUTE,
  STOP_DEPLOYMENT_ROUTE,
  RESTART_DEPLOYMENT_ROUTE,
  ROLLBACK_DEPLOYMENT_ROUTE,
];
```

#### Build Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/deployments/:deploymentId/builds` | `listBuildsHandler` | List builds |
| `GET` | `/builds/:buildId` | `getBuildHandler` | Get build details |
| `GET` | `/builds/:buildId/logs` | `getBuildLogsHandler` | Get build logs (supports streaming) |
| `POST` | `/builds/:buildId/cancel` | `cancelBuildHandler` | Cancel build |

```typescript
// Build routes
export const BUILD_ROUTES: AdminServerRoute[] = [
  LIST_BUILDS_ROUTE,
  GET_BUILD_ROUTE,
  GET_BUILD_LOGS_ROUTE,
  CANCEL_BUILD_ROUTE,
];
```

#### Server Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/deployments/:deploymentId/server` | `getServerHandler` | Get running server info |
| `GET` | `/servers/:serverId/logs` | `getServerLogsHandler` | Get server logs (supports streaming) |
| `GET` | `/servers/:serverId/health` | `getServerHealthHandler` | Get server health |
| `GET` | `/servers/:serverId/metrics` | `getServerMetricsHandler` | Get server resource metrics |

```typescript
// Server routes
export const SERVER_ROUTES: AdminServerRoute[] = [
  GET_SERVER_ROUTE,
  GET_SERVER_LOGS_ROUTE,
  GET_SERVER_HEALTH_ROUTE,
  GET_SERVER_METRICS_ROUTE,
];
```

#### Observability Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/projects/:projectId/traces` | `queryTracesHandler` | Query traces |
| `GET` | `/projects/:projectId/logs` | `queryLogsHandler` | Query logs |
| `GET` | `/projects/:projectId/metrics` | `queryMetricsHandler` | Query metrics |
| `GET` | `/traces/:traceId` | `getTraceHandler` | Get trace details with spans |
| `GET` | `/projects/:projectId/scores` | `queryScoresHandler` | Query scores |

```typescript
// Observability routes
export const OBSERVABILITY_ROUTES: AdminServerRoute[] = [
  QUERY_TRACES_ROUTE,
  QUERY_LOGS_ROUTE,
  QUERY_METRICS_ROUTE,
  GET_TRACE_ROUTE,
  QUERY_SCORES_ROUTE,
];
```

#### Admin Endpoints (Platform Admin Only)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/admin/users` | `listAllUsersHandler` | List all users |
| `GET` | `/admin/teams` | `listAllTeamsHandler` | List all teams |
| `GET` | `/admin/license` | `getLicenseHandler` | Get license info |
| `POST` | `/admin/license` | `updateLicenseHandler` | Update license |
| `GET` | `/admin/stats` | `getSystemStatsHandler` | Get system statistics |

```typescript
// Admin routes
export const ADMIN_ROUTES: AdminServerRoute[] = [
  LIST_ALL_USERS_ROUTE,
  LIST_ALL_TEAMS_ROUTE,
  GET_LICENSE_ROUTE,
  UPDATE_LICENSE_ROUTE,
  GET_SYSTEM_STATS_ROUTE,
];
```

#### System Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/health` | `healthHandler` | Health check |
| `GET` | `/ready` | `readyHandler` | Readiness check |

```typescript
// System routes
export const SYSTEM_ROUTES: AdminServerRoute[] = [
  HEALTH_ROUTE,
  READY_ROUTE,
];
```

### Route Aggregation

```typescript
// routes/index.ts
import type { AdminServerRoute } from '../types';
import { AUTH_ROUTES } from './auth';
import { TEAM_ROUTES } from './teams';
import { PROJECT_ROUTES } from './projects';
import { SOURCE_ROUTES } from './sources';
import { DEPLOYMENT_ROUTES } from './deployments';
import { BUILD_ROUTES } from './builds';
import { SERVER_ROUTES } from './servers';
import { OBSERVABILITY_ROUTES } from './observability';
import { ADMIN_ROUTES } from './admin';
import { SYSTEM_ROUTES } from './system';

export const ADMIN_SERVER_ROUTES: AdminServerRoute[] = [
  ...AUTH_ROUTES,
  ...TEAM_ROUTES,
  ...PROJECT_ROUTES,
  ...SOURCE_ROUTES,
  ...DEPLOYMENT_ROUTES,
  ...BUILD_ROUTES,
  ...SERVER_ROUTES,
  ...OBSERVABILITY_ROUTES,
  ...ADMIN_ROUTES,
  ...SYSTEM_ROUTES,
];
```

## Middleware Implementation

### Authentication Middleware

```typescript
// middleware/auth.ts
import type { Context, Next } from 'hono';
import type { MastraAdmin } from '@mastra/admin';

export interface AuthMiddlewareConfig {
  /**
   * Paths that don't require authentication
   */
  publicPaths?: string[];

  /**
   * Custom token extraction
   */
  extractToken?: (c: Context) => string | null;
}

const DEFAULT_PUBLIC_PATHS = [
  '/health',
  '/ready',
  '/auth/login',
  '/auth/refresh',
  '/invites/:inviteId/accept',
];

export function createAuthMiddleware(admin: MastraAdmin, config?: AuthMiddlewareConfig) {
  const publicPaths = config?.publicPaths ?? DEFAULT_PUBLIC_PATHS;

  return async (c: Context, next: Next) => {
    const path = c.req.path;
    const basePath = c.get('basePath') || '/api';
    const relativePath = path.replace(basePath, '');

    // Check if path is public
    if (isPublicPath(relativePath, publicPaths)) {
      return next();
    }

    // Extract token
    const token = config?.extractToken?.(c) ?? extractDefaultToken(c);

    if (!token) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    try {
      // Verify token through admin's auth provider
      const auth = admin.getAuth();
      const user = await auth.authenticateToken(token, c.req.raw);

      if (!user) {
        return c.json({ error: 'Invalid or expired token' }, 401);
      }

      // Set user in context
      c.set('user', user);
      c.set('userId', (user as any).id);

      return next();
    } catch (error) {
      console.error('Authentication error:', error);
      return c.json({ error: 'Authentication failed' }, 401);
    }
  };
}

function extractDefaultToken(c: Context): string | null {
  // Check Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query param (for WebSocket connections)
  const queryToken = c.req.query('token');
  if (queryToken) {
    return queryToken;
  }

  // Check cookie
  const cookieToken = c.req.header('Cookie')?.match(/auth_token=([^;]+)/)?.[1];
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

function isPublicPath(path: string, publicPaths: string[]): boolean {
  return publicPaths.some(pattern => {
    // Convert pattern to regex (handles :param placeholders)
    const regexPattern = pattern.replace(/:[\w]+/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  });
}
```

### RBAC Middleware

```typescript
// middleware/rbac.ts
import type { Context, Next } from 'hono';
import type { MastraAdmin, Permission } from '@mastra/admin';

export interface RBACMiddlewareConfig {
  /**
   * Map route patterns to required permissions
   */
  permissions?: Map<string, Permission>;
}

/**
 * RBAC middleware that checks permissions via MastraAdmin
 *
 * Note: Most permission checks are done within handlers (calling admin methods)
 * This middleware handles cross-cutting concerns like team context extraction
 */
export function createRBACMiddleware(admin: MastraAdmin) {
  return async (c: Context, next: Next) => {
    const userId = c.get('userId');

    if (!userId) {
      // No user context, skip RBAC (auth middleware will handle)
      return next();
    }

    // Extract teamId from path params if present
    const teamId = c.req.param('teamId');
    const projectId = c.req.param('projectId');
    const deploymentId = c.req.param('deploymentId');
    const buildId = c.req.param('buildId');
    const serverId = c.req.param('serverId');

    // Resolve team context from various ID types
    let resolvedTeamId = teamId;

    if (!resolvedTeamId && projectId) {
      try {
        const project = await admin.getStorage().getProject(projectId);
        resolvedTeamId = project?.teamId;
      } catch {
        // Project not found, will be handled in handler
      }
    }

    if (!resolvedTeamId && deploymentId) {
      try {
        const deployment = await admin.getStorage().getDeployment(deploymentId);
        if (deployment) {
          const project = await admin.getStorage().getProject(deployment.projectId);
          resolvedTeamId = project?.teamId;
        }
      } catch {
        // Deployment not found, will be handled in handler
      }
    }

    // Similar for buildId and serverId...

    if (resolvedTeamId) {
      try {
        // Load team context
        const team = await admin.getStorage().getTeam(resolvedTeamId);
        const member = await admin.getStorage().getTeamMember(resolvedTeamId, userId);
        const permissions = await admin.getRBAC().getUserPermissions(userId, resolvedTeamId);

        c.set('team', team);
        c.set('teamId', resolvedTeamId);
        c.set('teamMember', member);
        c.set('permissions', permissions);
      } catch {
        // Team context resolution failed, will be handled in handler
      }
    }

    return next();
  };
}
```

### Team Context Middleware

```typescript
// middleware/team-context.ts
import type { Context, Next } from 'hono';
import type { MastraAdmin } from '@mastra/admin';

/**
 * Middleware that extracts and validates team context from requests
 */
export function createTeamContextMiddleware(admin: MastraAdmin) {
  return async (c: Context, next: Next) => {
    // Team context can come from:
    // 1. Route params (/teams/:teamId/...)
    // 2. Header (X-Team-Id)
    // 3. Query param (?teamId=...)

    let teamId = c.req.param('teamId');

    if (!teamId) {
      teamId = c.req.header('X-Team-Id') || c.req.query('teamId') || undefined;
    }

    if (teamId) {
      const userId = c.get('userId');

      // Verify user has access to team
      try {
        const membership = await admin.getStorage().getTeamMember(teamId, userId);
        if (!membership) {
          return c.json({ error: 'Not a member of this team' }, 403);
        }

        const team = await admin.getStorage().getTeam(teamId);
        c.set('team', team);
        c.set('teamId', teamId);
        c.set('teamRole', membership.role);
      } catch (error) {
        return c.json({ error: 'Team not found' }, 404);
      }
    }

    return next();
  };
}
```

### Error Handler Middleware

```typescript
// middleware/error-handler.ts
import type { Context } from 'hono';
import { MastraAdminError, ErrorCode } from '@mastra/admin';

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.LICENSE_INVALID]: 402,
  [ErrorCode.LICENSE_EXPIRED]: 402,
  [ErrorCode.FEATURE_DISABLED]: 402,
  [ErrorCode.QUOTA_EXCEEDED]: 402,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.BUILD_FAILED]: 500,
  [ErrorCode.DEPLOYMENT_FAILED]: 500,
};

export function errorHandler(err: Error, c: Context): Response {
  const requestId = c.get('requestId');

  // Handle MastraAdminError
  if (err instanceof MastraAdminError) {
    const status = ERROR_STATUS_MAP[err.code] || 500;
    const response: ErrorResponse = {
      error: err.message,
      code: err.code,
      details: err.details,
      requestId,
    };
    return c.json(response, status as any);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const zodError = err as any;
    return c.json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: {
        issues: zodError.issues.map((issue: any) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      requestId,
    }, 400);
  }

  // Handle generic errors
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
  }, 500);
}
```

### Request Logger Middleware

```typescript
// middleware/request-logger.ts
import type { Context, Next } from 'hono';

export interface RequestLoggerConfig {
  /**
   * Log level (default: 'info')
   */
  level?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Paths to skip logging
   */
  skipPaths?: string[];

  /**
   * Custom log formatter
   */
  formatter?: (entry: LogEntry) => string;
}

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

export function createRequestLoggerMiddleware(config?: RequestLoggerConfig) {
  const skipPaths = config?.skipPaths ?? ['/health', '/ready'];

  return async (c: Context, next: Next) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();

    // Set request ID for tracing
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);

    // Skip logging for certain paths
    if (skipPaths.includes(c.req.path)) {
      return next();
    }

    await next();

    const duration = Date.now() - start;
    const entry: LogEntry = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
      userId: c.get('userId'),
      teamId: c.get('teamId'),
      requestId,
      userAgent: c.req.header('User-Agent'),
      ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    };

    const message = config?.formatter?.(entry) ?? formatLogEntry(entry);
    console.log(message);
  };
}

function formatLogEntry(entry: LogEntry): string {
  const { method, path, status, duration, userId, requestId } = entry;
  const user = userId ? ` user=${userId}` : '';
  return `[${requestId}] ${method} ${path} ${status} ${duration}ms${user}`;
}
```

## WebSocket Implementation

### WebSocket Server Setup

```typescript
// websocket/index.ts
import type { Server as HTTPServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { MastraAdmin } from '@mastra/admin';
import { verifyToken } from '../utils/auth';

export interface WSServerConfig {
  admin: MastraAdmin;
  server: HTTPServer;
  path?: string;
}

export interface WSClient {
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>;
}

export interface WSMessage {
  type: string;
  payload: unknown;
}

export class AdminWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient> = new Map();
  private admin: MastraAdmin;

  constructor(config: WSServerConfig) {
    this.admin = config.admin;
    this.wss = new WebSocketServer({
      server: config.server,
      path: config.path ?? '/ws',
    });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private async handleConnection(ws: WebSocket, request: any) {
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const auth = this.admin.getAuth();
      const user = await auth.authenticateToken(token, request);

      if (!user) {
        ws.close(4001, 'Invalid token');
        return;
      }

      const clientId = crypto.randomUUID();
      const client: WSClient = {
        ws,
        userId: (user as any).id,
        subscriptions: new Set(),
      };

      this.clients.set(clientId, client);

      ws.on('message', (data) => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleClose(clientId));
      ws.on('error', (error) => this.handleError(clientId, error));

      // Send connected confirmation
      this.send(clientId, {
        type: 'connected',
        payload: { clientId },
      });
    } catch (error) {
      ws.close(4001, 'Authentication failed');
    }
  }

  private handleMessage(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message: WSMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.payload as SubscribePayload);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.payload as UnsubscribePayload);
          break;
        case 'ping':
          this.send(clientId, { type: 'pong', payload: {} });
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }

  private handleSubscribe(clientId: string, payload: SubscribePayload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = payload;

    // Validate subscription permissions
    // e.g., build:${buildId}, server:${serverId}, deployment:${deploymentId}
    // TODO: Check RBAC permissions

    client.subscriptions.add(channel);
    this.send(clientId, {
      type: 'subscribed',
      payload: { channel },
    });
  }

  private handleUnsubscribe(clientId: string, payload: UnsubscribePayload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = payload;
    client.subscriptions.delete(channel);
    this.send(clientId, {
      type: 'unsubscribed',
      payload: { channel },
    });
  }

  private handleClose(clientId: string) {
    this.clients.delete(clientId);
  }

  private handleError(clientId: string, error: Error) {
    console.error(`WebSocket error for client ${clientId}:`, error);
    this.clients.delete(clientId);
  }

  private send(clientId: string, message: WSMessage) {
    const client = this.clients.get(clientId);
    if (client?.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast to all clients subscribed to a channel
   */
  broadcast(channel: string, message: WSMessage) {
    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        this.send(clientId, message);
      }
    }
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Close all connections
   */
  close() {
    for (const [_, client] of this.clients) {
      client.ws.close(1001, 'Server shutting down');
    }
    this.wss.close();
  }
}

interface SubscribePayload {
  channel: string;
}

interface UnsubscribePayload {
  channel: string;
}
```

### WebSocket Event Types

```typescript
// websocket/types.ts

/**
 * WebSocket event types for real-time updates
 */
export type WSEventType =
  | 'build:log'
  | 'build:status'
  | 'server:log'
  | 'server:health'
  | 'deployment:status';

export interface BuildLogEvent {
  type: 'build:log';
  payload: {
    buildId: string;
    line: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error';
  };
}

export interface BuildStatusEvent {
  type: 'build:status';
  payload: {
    buildId: string;
    status: 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed' | 'cancelled';
    message?: string;
  };
}

export interface ServerLogEvent {
  type: 'server:log';
  payload: {
    serverId: string;
    line: string;
    timestamp: string;
    stream: 'stdout' | 'stderr';
  };
}

export interface ServerHealthEvent {
  type: 'server:health';
  payload: {
    serverId: string;
    status: 'starting' | 'healthy' | 'unhealthy' | 'stopping';
    lastCheck: string;
    details?: {
      memoryUsageMb?: number;
      cpuPercent?: number;
      uptime?: number;
    };
  };
}

export interface DeploymentStatusEvent {
  type: 'deployment:status';
  payload: {
    deploymentId: string;
    status: 'pending' | 'building' | 'running' | 'stopped' | 'failed';
    publicUrl?: string;
  };
}

export type WSEvent =
  | BuildLogEvent
  | BuildStatusEvent
  | ServerLogEvent
  | ServerHealthEvent
  | DeploymentStatusEvent;
```

### Build Log Streaming

```typescript
// websocket/build-logs.ts
import type { AdminWebSocketServer } from './index';
import type { MastraAdmin, Build } from '@mastra/admin';

/**
 * Handles real-time build log streaming via WebSocket
 */
export class BuildLogStreamer {
  private activeStreams: Map<string, AbortController> = new Map();

  constructor(
    private admin: MastraAdmin,
    private wsServer: AdminWebSocketServer,
  ) {}

  /**
   * Start streaming logs for a build
   */
  async startStreaming(buildId: string): Promise<void> {
    if (this.activeStreams.has(buildId)) {
      return; // Already streaming
    }

    const controller = new AbortController();
    this.activeStreams.set(buildId, controller);

    const channel = `build:${buildId}`;

    try {
      // Get log stream from runner
      const runner = this.admin.getRunner();
      if (!runner) {
        throw new Error('No runner configured');
      }

      const build = await this.admin.getStorage().getBuild(buildId);
      if (!build) {
        throw new Error('Build not found');
      }

      // Stream logs
      const logStream = await runner.streamBuildLogs(build, controller.signal);

      for await (const line of logStream) {
        if (controller.signal.aborted) break;

        this.wsServer.broadcast(channel, {
          type: 'build:log',
          payload: {
            buildId,
            line: line.content,
            timestamp: line.timestamp.toISOString(),
            level: line.level,
          },
        });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(`Build log streaming error for ${buildId}:`, error);
        this.wsServer.broadcast(channel, {
          type: 'build:log',
          payload: {
            buildId,
            line: `Error streaming logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date().toISOString(),
            level: 'error',
          },
        });
      }
    } finally {
      this.activeStreams.delete(buildId);
    }
  }

  /**
   * Stop streaming logs for a build
   */
  stopStreaming(buildId: string): void {
    const controller = this.activeStreams.get(buildId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(buildId);
    }
  }

  /**
   * Stop all active streams
   */
  stopAll(): void {
    for (const [buildId, controller] of this.activeStreams) {
      controller.abort();
    }
    this.activeStreams.clear();
  }
}
```

## Build Worker Implementation

```typescript
// worker/build-worker.ts
import type { MastraAdmin, BuildOrchestrator } from '@mastra/admin';
import type { AdminWebSocketServer } from '../websocket';

export interface BuildWorkerConfig {
  admin: MastraAdmin;
  wsServer?: AdminWebSocketServer;
  intervalMs?: number;
  maxConcurrent?: number;
}

/**
 * Background worker that processes the build queue
 */
export class BuildWorker {
  private running = false;
  private orchestrator: BuildOrchestrator;
  private intervalMs: number;
  private maxConcurrent: number;
  private activeBuilds: Set<string> = new Set();
  private wsServer?: AdminWebSocketServer;

  constructor(config: BuildWorkerConfig) {
    this.orchestrator = config.admin.getOrchestrator();
    this.wsServer = config.wsServer;
    this.intervalMs = config.intervalMs ?? 5000;
    this.maxConcurrent = config.maxConcurrent ?? 3;
  }

  /**
   * Start the build worker
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('[BuildWorker] Already running');
      return;
    }

    this.running = true;
    console.log('[BuildWorker] Started');

    while (this.running) {
      try {
        await this.processQueue();
      } catch (error) {
        console.error('[BuildWorker] Error processing queue:', error);
      }

      // Wait before checking queue again
      await this.sleep(this.intervalMs);
    }

    console.log('[BuildWorker] Stopped');
  }

  /**
   * Stop the build worker gracefully
   */
  async stop(): Promise<void> {
    this.running = false;

    // Wait for active builds to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (this.activeBuilds.size > 0 && Date.now() - start < timeout) {
      console.log(`[BuildWorker] Waiting for ${this.activeBuilds.size} active build(s) to complete...`);
      await this.sleep(1000);
    }

    if (this.activeBuilds.size > 0) {
      console.warn(`[BuildWorker] Force stopping with ${this.activeBuilds.size} active build(s)`);
    }
  }

  /**
   * Process the next item(s) in the build queue
   */
  private async processQueue(): Promise<void> {
    // Check if we can process more builds
    if (this.activeBuilds.size >= this.maxConcurrent) {
      return;
    }

    const slotsAvailable = this.maxConcurrent - this.activeBuilds.size;

    // Process up to `slotsAvailable` builds
    for (let i = 0; i < slotsAvailable; i++) {
      const build = await this.orchestrator.dequeueNextBuild();
      if (!build) break; // No more builds in queue

      // Process build asynchronously
      this.processBuild(build.id).catch((error) => {
        console.error(`[BuildWorker] Error processing build ${build.id}:`, error);
      });
    }
  }

  /**
   * Process a single build
   */
  private async processBuild(buildId: string): Promise<void> {
    this.activeBuilds.add(buildId);

    try {
      // Broadcast build started
      this.broadcastStatus(buildId, 'building');

      // Process the build through the orchestrator
      const result = await this.orchestrator.processBuild(buildId, {
        onLog: (line, level) => {
          this.broadcastLog(buildId, line, level);
        },
        onStatusChange: (status) => {
          this.broadcastStatus(buildId, status);
        },
      });

      // Broadcast final status
      this.broadcastStatus(buildId, result.success ? 'succeeded' : 'failed', result.message);
    } finally {
      this.activeBuilds.delete(buildId);
    }
  }

  /**
   * Broadcast build log via WebSocket
   */
  private broadcastLog(buildId: string, line: string, level: 'info' | 'warn' | 'error' = 'info') {
    if (!this.wsServer) return;

    this.wsServer.broadcast(`build:${buildId}`, {
      type: 'build:log',
      payload: {
        buildId,
        line,
        timestamp: new Date().toISOString(),
        level,
      },
    });
  }

  /**
   * Broadcast build status change via WebSocket
   */
  private broadcastStatus(buildId: string, status: string, message?: string) {
    if (!this.wsServer) return;

    this.wsServer.broadcast(`build:${buildId}`, {
      type: 'build:status',
      payload: {
        buildId,
        status,
        message,
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

## Health Check Worker Implementation

```typescript
// worker/health-checker.ts
import type { MastraAdmin } from '@mastra/admin';
import type { AdminWebSocketServer } from '../websocket';

export interface HealthCheckWorkerConfig {
  admin: MastraAdmin;
  wsServer?: AdminWebSocketServer;
  intervalMs?: number;
}

/**
 * Background worker that checks health of running servers
 */
export class HealthCheckWorker {
  private running = false;
  private admin: MastraAdmin;
  private wsServer?: AdminWebSocketServer;
  private intervalMs: number;

  constructor(config: HealthCheckWorkerConfig) {
    this.admin = config.admin;
    this.wsServer = config.wsServer;
    this.intervalMs = config.intervalMs ?? 30000;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    console.log('[HealthCheckWorker] Started');

    while (this.running) {
      try {
        await this.checkAllServers();
      } catch (error) {
        console.error('[HealthCheckWorker] Error:', error);
      }

      await this.sleep(this.intervalMs);
    }

    console.log('[HealthCheckWorker] Stopped');
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async checkAllServers(): Promise<void> {
    const storage = this.admin.getStorage();
    const runner = this.admin.getRunner();

    if (!runner) return;

    // Get all running servers
    const servers = await storage.listRunningServers();

    for (const server of servers) {
      try {
        const health = await runner.checkHealth(server);

        // Update health status in storage
        await storage.updateServerHealth(server.id, {
          healthStatus: health.status,
          lastHealthCheck: new Date(),
          memoryUsageMb: health.memoryUsageMb,
          cpuPercent: health.cpuPercent,
        });

        // Broadcast health status
        this.broadcastHealth(server.id, health);
      } catch (error) {
        console.error(`[HealthCheckWorker] Error checking server ${server.id}:`, error);

        // Mark as unhealthy
        await storage.updateServerHealth(server.id, {
          healthStatus: 'unhealthy',
          lastHealthCheck: new Date(),
        });

        this.broadcastHealth(server.id, { status: 'unhealthy' });
      }
    }
  }

  private broadcastHealth(serverId: string, health: any) {
    if (!this.wsServer) return;

    this.wsServer.broadcast(`server:${serverId}`, {
      type: 'server:health',
      payload: {
        serverId,
        status: health.status,
        lastCheck: new Date().toISOString(),
        details: {
          memoryUsageMb: health.memoryUsageMb,
          cpuPercent: health.cpuPercent,
          uptime: health.uptime,
        },
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

## AdminServer Implementation

```typescript
// server.ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { timeout } from 'hono/timeout';
import { logger } from 'hono/logger';
import type { Server } from 'node:http';
import type { MastraAdmin } from '@mastra/admin';

import type { AdminServerConfig, AdminServerContext, ServerStatus } from './types';
import { ADMIN_SERVER_ROUTES } from './routes';
import { createAuthMiddleware } from './middleware/auth';
import { createRBACMiddleware } from './middleware/rbac';
import { createTeamContextMiddleware } from './middleware/team-context';
import { createRequestLoggerMiddleware } from './middleware/request-logger';
import { errorHandler } from './middleware/error-handler';
import { AdminWebSocketServer } from './websocket';
import { BuildWorker } from './worker/build-worker';
import { HealthCheckWorker } from './worker/health-checker';

export class AdminServer {
  private readonly app: Hono;
  private readonly config: Required<AdminServerConfig>;
  private readonly admin: MastraAdmin;
  private server?: Server;
  private wsServer?: AdminWebSocketServer;
  private buildWorker?: BuildWorker;
  private healthWorker?: HealthCheckWorker;
  private startTime?: Date;

  constructor(config: AdminServerConfig) {
    this.config = {
      port: 3000,
      host: 'localhost',
      basePath: '/api',
      cors: {
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Team-Id'],
        credentials: true,
      },
      rateLimit: undefined,
      timeout: 30000,
      maxBodySize: 10 * 1024 * 1024,
      enableBuildWorker: true,
      buildWorkerIntervalMs: 5000,
      enableHealthWorker: true,
      healthCheckIntervalMs: 30000,
      enableWebSocket: true,
      enableRequestLogging: process.env.NODE_ENV !== 'production',
      onError: undefined,
      ...config,
    } as Required<AdminServerConfig>;

    this.admin = config.admin;
    this.app = new Hono();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    const basePath = this.config.basePath;

    // CORS
    if (this.config.cors) {
      this.app.use('*', cors(this.config.cors));
    }

    // Timeout
    this.app.use('*', timeout(this.config.timeout));

    // Request logging
    if (this.config.enableRequestLogging) {
      this.app.use('*', createRequestLoggerMiddleware());
    }

    // Error handler
    this.app.onError((err, c) => {
      if (this.config.onError) {
        const result = this.config.onError(err, {
          path: c.req.path,
          method: c.req.method,
          userId: c.get('userId'),
          teamId: c.get('teamId'),
        });
        if (result) return result;
      }
      return errorHandler(err, c);
    });

    // Context middleware - sets basePath and admin
    this.app.use('*', async (c, next) => {
      c.set('basePath', basePath);
      c.set('admin', this.admin);
      return next();
    });

    // Auth middleware (skip for health/ready)
    this.app.use(`${basePath}/*`, createAuthMiddleware(this.admin));

    // RBAC middleware
    this.app.use(`${basePath}/*`, createRBACMiddleware(this.admin));

    // Team context middleware
    this.app.use(`${basePath}/*`, createTeamContextMiddleware(this.admin));
  }

  private setupRoutes(): void {
    const basePath = this.config.basePath;

    // Health check (no auth required)
    this.app.get('/health', (c) => c.json({ status: 'ok' }));
    this.app.get('/ready', async (c) => {
      const isReady = await this.checkReadiness();
      return c.json({ ready: isReady }, isReady ? 200 : 503);
    });

    // Register all API routes
    for (const route of ADMIN_SERVER_ROUTES) {
      const path = `${basePath}${route.path}`;
      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';

      this.app[method](path, async (c) => {
        try {
          // Build context
          const context: AdminServerContext = {
            admin: this.admin,
            user: c.get('user'),
            userId: c.get('userId'),
            team: c.get('team'),
            teamId: c.get('teamId'),
            permissions: c.get('permissions') ?? [],
            abortSignal: c.req.raw.signal,
            logger: this.admin.getLogger(),
          };

          // Parse and validate params
          const urlParams = c.req.param();
          const queryParams = c.req.query();
          let body: unknown;

          if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
            body = await c.req.json().catch(() => ({}));
          }

          // Validate with Zod schemas if defined
          let validatedPath = urlParams;
          let validatedQuery = queryParams;
          let validatedBody = body;

          if (route.pathParamSchema) {
            validatedPath = route.pathParamSchema.parse(urlParams);
          }
          if (route.queryParamSchema) {
            validatedQuery = route.queryParamSchema.parse(queryParams);
          }
          if (route.bodySchema && body) {
            validatedBody = route.bodySchema.parse(body);
          }

          // Call handler
          const result = await route.handler({
            ...context,
            ...validatedPath,
            ...validatedQuery,
            ...(typeof validatedBody === 'object' ? validatedBody : {}),
          });

          // Handle response types
          if (route.responseType === 'stream') {
            return this.handleStreamResponse(c, result);
          }

          return c.json(result, 200);
        } catch (error) {
          return errorHandler(error as Error, c);
        }
      });
    }
  }

  private handleStreamResponse(c: any, result: any): Response {
    // Implement SSE streaming for logs
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  private async checkReadiness(): Promise<boolean> {
    try {
      // Check storage connection
      await this.admin.getStorage().healthCheck();

      // Check license validity
      const license = this.admin.getLicense();
      if (!license.isValid()) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  async start(): Promise<void> {
    const { port, host } = this.config;

    // Start HTTP server
    this.server = serve({
      fetch: this.app.fetch,
      port,
      hostname: host,
    }, () => {
      console.log(`AdminServer listening on http://${host}:${port}`);
      console.log(`API available at http://${host}:${port}${this.config.basePath}`);
    });

    this.startTime = new Date();

    // Setup WebSocket server
    if (this.config.enableWebSocket && this.server) {
      this.wsServer = new AdminWebSocketServer({
        admin: this.admin,
        server: this.server,
        path: '/ws',
      });
      console.log(`WebSocket server listening on ws://${host}:${port}/ws`);
    }

    // Start build worker
    if (this.config.enableBuildWorker) {
      this.buildWorker = new BuildWorker({
        admin: this.admin,
        wsServer: this.wsServer,
        intervalMs: this.config.buildWorkerIntervalMs,
      });
      // Don't await - runs in background
      this.buildWorker.start().catch(console.error);
    }

    // Start health check worker
    if (this.config.enableHealthWorker) {
      this.healthWorker = new HealthCheckWorker({
        admin: this.admin,
        wsServer: this.wsServer,
        intervalMs: this.config.healthCheckIntervalMs,
      });
      // Don't await - runs in background
      this.healthWorker.start().catch(console.error);
    }
  }

  async stop(): Promise<void> {
    console.log('AdminServer shutting down...');

    // Stop workers first
    if (this.buildWorker) {
      await this.buildWorker.stop();
    }
    if (this.healthWorker) {
      await this.healthWorker.stop();
    }

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }

    // Close HTTP server
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log('AdminServer stopped');
  }

  getApp(): Hono {
    return this.app;
  }

  getAdmin(): MastraAdmin {
    return this.admin;
  }

  isHealthy(): boolean {
    return this.server !== undefined && this.server.listening;
  }

  getStatus(): ServerStatus {
    const uptime = this.startTime
      ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
      : 0;

    return {
      running: this.isHealthy(),
      uptime,
      buildWorkerActive: this.buildWorker !== undefined,
      healthWorkerActive: this.healthWorker !== undefined,
      wsConnectionCount: this.wsServer?.getConnectionCount() ?? 0,
      port: this.config.port,
      host: this.config.host,
    };
  }
}
```

## Package Configuration

### package.json

```json
{
  "name": "@mastra/admin-server",
  "version": "0.1.0",
  "description": "HTTP API server for MastraAdmin",
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
    "./routes": {
      "import": {
        "types": "./dist/routes/index.d.ts",
        "default": "./dist/routes/index.js"
      }
    },
    "./middleware": {
      "import": {
        "types": "./dist/middleware/index.d.ts",
        "default": "./dist/middleware/index.js"
      }
    },
    "./websocket": {
      "import": {
        "types": "./dist/websocket/index.d.ts",
        "default": "./dist/websocket/index.js"
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
    "build:watch": "pnpm build:lib --watch",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "keywords": [
    "mastra",
    "admin",
    "server",
    "api"
  ],
  "author": "Mastra",
  "license": "Apache-2.0",
  "peerDependencies": {
    "@mastra/admin": ">=0.1.0",
    "zod": "^3.25.0 || ^4.0.0"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "hono": "^4.11.3",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@mastra/admin": "workspace:*",
    "@types/node": "22.13.17",
    "@types/ws": "^8.5.13",
    "@vitest/coverage-v8": "catalog:",
    "@vitest/ui": "catalog:",
    "eslint": "^9.37.0",
    "tsup": "^8.5.0",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "zod": "^3.25.76"
  },
  "engines": {
    "node": ">=22.13.0"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mastra-ai/mastra.git",
    "directory": "packages/admin-server"
  },
  "bugs": {
    "url": "https://github.com/mastra-ai/mastra/issues"
  },
  "homepage": "https://mastra.ai"
}
```

### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/routes/index.ts',
    'src/middleware/index.ts',
    'src/websocket/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['@mastra/admin', 'zod'],
});
```

## Index Exports

```typescript
// src/index.ts

// Main exports
export { AdminServer } from './server';
export type {
  AdminServerConfig,
  AdminServerContext,
  ServerStatus,
  CorsOptions,
  RateLimitOptions,
  ErrorContext,
} from './types';

// Route exports
export { ADMIN_SERVER_ROUTES } from './routes';
export type { AdminServerRoute } from './routes';

// Middleware exports
export { createAuthMiddleware } from './middleware/auth';
export { createRBACMiddleware } from './middleware/rbac';
export { createTeamContextMiddleware } from './middleware/team-context';
export { createRequestLoggerMiddleware } from './middleware/request-logger';
export { errorHandler } from './middleware/error-handler';

// WebSocket exports
export { AdminWebSocketServer } from './websocket';
export type { WSMessage, WSClient } from './websocket';
export type { WSEvent, WSEventType } from './websocket/types';

// Worker exports
export { BuildWorker } from './worker/build-worker';
export { HealthCheckWorker } from './worker/health-checker';
```

## Usage Example

```typescript
import { MastraAdmin } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { LocalProcessRunner } from '@mastra/runner-local';
import { LocalEdgeRouter } from '@mastra/router-local';
import { LocalProjectSource } from '@mastra/source-local';
import { MastraAuthSupabase } from '@mastra/auth-supabase';
import { AdminServer } from '@mastra/admin-server';

// 1. Create MastraAdmin instance
const admin = new MastraAdmin({
  licenseKey: process.env.LICENSE_KEY!,
  auth: new MastraAuthSupabase({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
  }),
  storage: new PostgresAdminStorage({
    connectionString: process.env.DATABASE_URL!,
  }),
  runner: new LocalProcessRunner({
    workDir: '/var/mastra/builds',
  }),
  router: new LocalEdgeRouter({
    baseDomain: 'localhost',
    portRange: { start: 3001, end: 4000 },
  }),
  source: new LocalProjectSource({
    basePaths: ['/home/user/projects'],
  }),
});

// 2. Initialize admin
await admin.init();

// 3. Create and start server
const server = new AdminServer({
  admin,
  port: 3000,
  host: '0.0.0.0',
  basePath: '/api',
  cors: {
    origin: ['http://localhost:3001', 'https://admin.company.com'],
    credentials: true,
  },
  enableBuildWorker: true,
  enableHealthWorker: true,
  enableWebSocket: true,
});

await server.start();

// Server is now running:
// - API: http://0.0.0.0:3000/api
// - WebSocket: ws://0.0.0.0:3000/ws
// - Health: http://0.0.0.0:3000/health

// Graceful shutdown
process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});
```

## Testing Strategy

### Unit Tests

```typescript
// __tests__/server.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminServer } from '../server';
import { createMockMastraAdmin } from './test-utils';

describe('AdminServer', () => {
  let server: AdminServer;
  let mockAdmin: ReturnType<typeof createMockMastraAdmin>;

  beforeEach(() => {
    mockAdmin = createMockMastraAdmin();
    server = new AdminServer({
      admin: mockAdmin as any,
      port: 0, // Random port
      enableBuildWorker: false,
      enableHealthWorker: false,
      enableWebSocket: false,
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should start and stop cleanly', async () => {
    await server.start();
    expect(server.isHealthy()).toBe(true);

    await server.stop();
    expect(server.isHealthy()).toBe(false);
  });

  it('should return server status', async () => {
    await server.start();
    const status = server.getStatus();

    expect(status.running).toBe(true);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/teams.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AdminServer } from '../../server';
import { createTestAdmin, createTestUser, cleanup } from './test-helpers';

describe('Team Routes', () => {
  let server: AdminServer;
  let baseUrl: string;
  let authToken: string;

  beforeAll(async () => {
    const admin = await createTestAdmin();
    server = new AdminServer({ admin, port: 0 });
    await server.start();
    baseUrl = `http://localhost:${server.getStatus().port}/api`;

    // Create test user and get token
    const user = await createTestUser(admin);
    authToken = user.token;
  });

  afterAll(async () => {
    await server.stop();
    await cleanup();
  });

  it('POST /teams - should create a team', async () => {
    const response = await fetch(`${baseUrl}/teams`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Team',
        slug: 'test-team',
      }),
    });

    expect(response.status).toBe(201);
    const team = await response.json();
    expect(team.name).toBe('Test Team');
    expect(team.slug).toBe('test-team');
  });

  it('GET /teams - should list user teams', async () => {
    const response = await fetch(`${baseUrl}/teams`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    const teams = await response.json();
    expect(Array.isArray(teams)).toBe(true);
  });
});
```

## Implementation Checklist

### Phase 1: Core Server Setup
- [ ] Package structure and configuration
- [ ] AdminServer class implementation
- [ ] Basic middleware (error handler, CORS, timeout)
- [ ] Health and ready endpoints

### Phase 2: Authentication & Authorization
- [ ] Auth middleware implementation
- [ ] RBAC middleware implementation
- [ ] Team context middleware
- [ ] Request logging middleware

### Phase 3: Route Implementation
- [ ] Auth routes (login, logout, me, refresh)
- [ ] Team routes (CRUD, members, invites)
- [ ] Project routes (CRUD, env vars, tokens)
- [ ] Source routes (list, validate)
- [ ] Deployment routes (CRUD, deploy, stop, restart)
- [ ] Build routes (list, get, logs, cancel)
- [ ] Server routes (info, logs, health)
- [ ] Observability routes (traces, logs, metrics)
- [ ] Admin routes (users, teams, license)

### Phase 4: WebSocket Support
- [ ] WebSocket server setup
- [ ] Authentication for WS connections
- [ ] Build log streaming
- [ ] Server log streaming
- [ ] Health status broadcasting

### Phase 5: Background Workers
- [ ] Build worker implementation
- [ ] Health check worker implementation
- [ ] Graceful shutdown handling

### Phase 6: Testing
- [ ] Unit tests for server class
- [ ] Unit tests for middleware
- [ ] Unit tests for routes
- [ ] Integration tests
- [ ] E2E tests with real providers

### Phase 7: Documentation
- [ ] API documentation (OpenAPI spec)
- [ ] Usage examples
- [ ] Configuration guide

## Dependencies on Other Packages

| Package | Status | Notes |
|---------|--------|-------|
| `@mastra/admin` | Required | Core MastraAdmin class with business logic |
| `@mastra/admin-pg` | Optional | PostgreSQL storage (or other storage impl) |
| `@mastra/runner-local` | Optional | Local process runner |
| `@mastra/router-local` | Optional | Local edge router |
| `@mastra/source-local` | Optional | Local project source |
| `@mastra/auth-supabase` | Optional | Auth provider |

## Notes

1. **No Business Logic**: This package only handles HTTP concerns. All business logic is in `@mastra/admin`.

2. **Pattern Consistency**: Follows the same patterns as `@mastra/server` and `server-adapters/hono`.

3. **WebSocket for Real-time**: Build and server logs use WebSocket for efficient streaming. REST endpoints with `Accept: text/event-stream` can also stream.

4. **Workers are Optional**: Build and health workers can be disabled for testing or when running separately.

5. **Authentication Flexibility**: Auth middleware delegates to the auth provider configured in MastraAdmin, allowing different auth strategies.

6. **Error Handling**: All errors are converted to structured JSON responses with appropriate HTTP status codes.
