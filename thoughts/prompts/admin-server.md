# Admin Server - HTTP API Layer

Create implementation plan for @mastra/admin-server HTTP API layer.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**:
- admin-core (MastraAdmin class and types)
- All Layer 1 providers (admin-pg, runner-local, router-local, source-local, observability-*)

**Priority**: P0 (Required for Admin UI)

This is the HTTP server that exposes the MastraAdmin functionality via REST API, similar to how @mastra/server exposes Mastra functionality.

## Scope

1. Package setup (`packages/admin-server/`)
2. `AdminServer` class that wraps MastraAdmin and exposes HTTP endpoints
3. Authentication middleware (integrates with @mastra/auth-* providers)
4. RBAC middleware (checks permissions via RBACManager)
5. REST API endpoints:

### Auth Endpoints
- `POST /api/auth/login` - Login (delegates to auth provider)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token

### Team Endpoints
- `GET /api/teams` - List user's teams
- `POST /api/teams` - Create team
- `GET /api/teams/:teamId` - Get team details
- `PATCH /api/teams/:teamId` - Update team
- `DELETE /api/teams/:teamId` - Delete team
- `GET /api/teams/:teamId/members` - List team members
- `POST /api/teams/:teamId/members` - Invite member
- `DELETE /api/teams/:teamId/members/:userId` - Remove member
- `PATCH /api/teams/:teamId/members/:userId` - Update member role

### Project Endpoints
- `GET /api/teams/:teamId/projects` - List team's projects
- `POST /api/teams/:teamId/projects` - Create project
- `GET /api/projects/:projectId` - Get project details
- `PATCH /api/projects/:projectId` - Update project
- `DELETE /api/projects/:projectId` - Delete project
- `GET /api/projects/:projectId/env-vars` - List env vars
- `POST /api/projects/:projectId/env-vars` - Set env var
- `DELETE /api/projects/:projectId/env-vars/:key` - Delete env var

### Source Endpoints
- `GET /api/teams/:teamId/sources` - List available project sources
- `GET /api/sources/:sourceId` - Get source details
- `POST /api/sources/:sourceId/validate` - Validate source access

### Deployment Endpoints
- `GET /api/projects/:projectId/deployments` - List deployments
- `POST /api/projects/:projectId/deployments` - Create deployment (production/staging/preview)
- `GET /api/deployments/:deploymentId` - Get deployment details
- `PATCH /api/deployments/:deploymentId` - Update deployment config
- `DELETE /api/deployments/:deploymentId` - Delete deployment
- `POST /api/deployments/:deploymentId/deploy` - Trigger deploy
- `POST /api/deployments/:deploymentId/stop` - Stop deployment
- `POST /api/deployments/:deploymentId/restart` - Restart deployment

### Build Endpoints
- `GET /api/deployments/:deploymentId/builds` - List builds
- `GET /api/builds/:buildId` - Get build details
- `GET /api/builds/:buildId/logs` - Get build logs (supports streaming)
- `POST /api/builds/:buildId/cancel` - Cancel build

### Server Endpoints
- `GET /api/deployments/:deploymentId/server` - Get running server info
- `GET /api/servers/:serverId/logs` - Get server logs (supports streaming)
- `GET /api/servers/:serverId/health` - Get server health

### Observability Endpoints
- `GET /api/projects/:projectId/traces` - Query traces
- `GET /api/projects/:projectId/logs` - Query logs
- `GET /api/projects/:projectId/metrics` - Query metrics
- `GET /api/traces/:traceId` - Get trace details with spans

### Admin Endpoints (platform admin only)
- `GET /api/admin/users` - List all users
- `GET /api/admin/teams` - List all teams
- `GET /api/admin/license` - Get license info
- `POST /api/admin/license` - Update license

## Key Files to Create

```
packages/admin-server/
├── src/
│   ├── index.ts
│   ├── server.ts                    # AdminServer class
│   ├── middleware/
│   │   ├── auth.ts                  # Authentication middleware
│   │   ├── rbac.ts                  # RBAC permission checking
│   │   ├── error-handler.ts         # Error handling
│   │   └── request-context.ts       # Request context (user, team)
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── teams.ts
│   │   ├── projects.ts
│   │   ├── sources.ts
│   │   ├── deployments.ts
│   │   ├── builds.ts
│   │   ├── servers.ts
│   │   ├── observability.ts
│   │   └── admin.ts
│   ├── handlers/
│   │   ├── teams.ts
│   │   ├── projects.ts
│   │   ├── deployments.ts
│   │   └── ...
│   ├── websocket/
│   │   ├── index.ts                 # WebSocket server setup
│   │   ├── build-logs.ts            # Real-time build log streaming
│   │   └── server-logs.ts           # Real-time server log streaming
│   ├── validation/
│   │   └── schemas.ts               # Request validation schemas (zod)
│   └── types.ts
├── package.json
└── tsconfig.json
```

## Key Interfaces

```typescript
export interface AdminServerConfig {
  admin: MastraAdmin;
  port?: number;
  host?: string;
  basePath?: string;              // e.g., "/api"
  cors?: CorsOptions;
  rateLimit?: RateLimitOptions;
}

export class AdminServer {
  constructor(config: AdminServerConfig);

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;

  // For custom middleware/routes
  getApp(): Express;              // Or Hono/Fastify

  // Health check
  isHealthy(): boolean;
}

// Request context available in handlers
export interface AdminRequestContext {
  user: User;
  teamId?: string;
  team?: Team;
  permissions: Permission[];
}
```

## WebSocket Support

For real-time features:
- Build log streaming during deployments
- Server log tailing
- Deployment status updates
- Health status changes

```typescript
// WebSocket events
interface WSEvents {
  'build:log': { buildId: string; line: string; timestamp: Date };
  'build:status': { buildId: string; status: BuildStatus };
  'server:log': { serverId: string; line: string; timestamp: Date };
  'server:health': { serverId: string; status: HealthStatus };
  'deployment:status': { deploymentId: string; status: DeploymentStatus };
}
```

## Framework Choice

Consider using Hono for consistency with @mastra/server, or Express for familiarity. The server should:
- Be framework-agnostic in core logic
- Support middleware composition
- Handle graceful shutdown
- Support WebSocket connections

Save plan to: thoughts/shared/plans/2025-01-23-admin-server.md
