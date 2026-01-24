# MastraAdmin Development Session Learnings

This document captures key learnings from a development session setting up the full MastraAdmin UI with PostgreSQL backend, project discovery, and deployment functionality.

## Architecture Overview

### Core Components

1. **MastraAdmin** (`packages/admin/`) - Central orchestration class
   - Manages projects, deployments, builds
   - Contains `BuildOrchestrator` for build queue management
   - Has `getSource()`, `getOrchestrator()`, `getStorage()` methods

2. **AdminServer** (`packages/admin-server/`) - HTTP API server
   - Wraps MastraAdmin with Hono HTTP server
   - Contains `BuildWorker` that polls for queued builds
   - Routes in `src/routes/` directory

3. **PostgresAdminStorage** (`stores/admin-pg/`) - Database layer
   - Implements `AdminStorage` interface
   - Domain classes: `BuildsPG`, `DeploymentsPG`, `ProjectsPG`, etc.
   - Has `dequeue()` method for atomic build queue operations

4. **LocalProjectSource** (`sources/local/`) - Project discovery
   - Scans configured directories for Mastra projects
   - `listProjects(teamId)` returns discovered projects

5. **LocalProcessRunner** (`runners/local/`) - Build execution
   - Runs `pnpm install` and `pnpm build`
   - Starts Mastra servers on allocated ports

6. **LocalEdgeRouter** (`routers/local/`) - Route management
   - Two strategies: `port-mapping` (direct port access) and `reverse-proxy`
   - `reverse-proxy` requires `http-proxy` package (has dynamic import issues)

## Key Issues Fixed

### 1. Deploy Button Not Wired Up

**Location**: `packages/admin-ui/src/routes/dashboard/projects/[projectId]/deployments/[deploymentId]/index.tsx`

**Problem**: Deploy, Stop, Restart buttons were plain `<button>` elements with no `onClick` handlers.

**Fix**: Import and use the mutation hooks:

```typescript
import { useTriggerDeploy, useStopDeployment, useRestartDeployment } from '@/hooks/deployments/use-deployment';

const triggerDeploy = useTriggerDeploy(deploymentId!);
// Then wire up: onClick={() => triggerDeploy.mutate()}
```

### 2. Sources API Not Implemented

**Location**: `packages/admin-server/src/routes/sources.ts`

**Problem**: `LIST_SOURCES_ROUTE` returned empty array instead of calling `LocalProjectSource`.

**Fix**: Added `getSource()` method to `MastraAdmin` and updated routes:

```typescript
const sourceProvider = admin.getSource();
if (sourceProvider) {
  const allSources = await sourceProvider.listProjects(teamId);
  // ... pagination logic
}
```

### 3. Project Creation Required Manual Path

**Location**: `packages/admin-ui/src/routes/dashboard/teams/[teamId]/projects/new.tsx`

**Problem**: Form required manual path input instead of showing discovered projects.

**Fix**: Created `useSources` hook and updated form to show picker:

```typescript
const { data: sources } = useSources(teamId!);
// Show selectable list of discovered projects
```

### 4. Build Queue Not Processing (Server Restart Issue)

**Problem**: `BuildOrchestrator` uses in-memory queue. After server restart, queued builds in DB were lost.

**Fix**:

- Added `listQueuedBuilds()` to `BuildsPG` and `PostgresAdminStorage`
- Server startup recovers queued builds:

```typescript
const queuedBuilds = await storage.listQueuedBuilds();
for (const build of queuedBuilds) {
  await orchestrator.queueBuild(build.id);
}
```

### 5. envVarOverrides Not Array

**Location**: `packages/admin-server/src/routes/deployments.ts`

**Problem**: `deployment.envVarOverrides.map is not a function` - JSONB column wasn't always an array.

**Fix**: Use `Array.isArray()` check:

```typescript
envVarOverrides: Array.isArray(deployment.envVarOverrides)
  ? deployment.envVarOverrides.map(e => ({ ... }))
  : [],
```

### 6. CORS Configuration

**Location**: `examples/admin/src/server.ts`

**Problem**: UI on port 3002 was blocked by CORS.

**Fix**: Add all dev ports to CORS origins:

```typescript
cors: {
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173', 'http://127.0.0.1:3002'],
  credentials: true,
},
```

### 7. Slug Required for Project Creation

**Problem**: API validation failed without `slug` field.

**Fix**: Auto-generate slug from project name in UI:

```typescript
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}
```

## Development Server Setup

### server.ts Configuration

```typescript
const admin = new MastraAdmin({
  licenseKey: 'dev',
  storage, // PostgresAdminStorage
  source, // LocalProjectSource
  runner, // LocalProcessRunner
  router, // LocalEdgeRouter
  observability: { fileStorage },
  auth, // DevAuthProvider (mock auth)
});
```

### DevAuthProvider

Simple mock auth that accepts any token:

```typescript
class DevAuthProvider implements AdminAuthProvider {
  async validateToken(token: string) {
    return { userId: DEMO_USER_ID };
  }
}
```

### Running the Stack

```bash
pnpm dev:full    # Runs server + UI concurrently
pnpm dev:server  # Server only (port 3001)
pnpm dev:ui      # UI only (port 3002)
```

## Build Flow

1. User clicks Deploy → `POST /api/deployments/:id/deploy`
2. `MastraAdmin.deploy()` creates build with `status: 'queued'`
3. `orchestrator.queueBuild(buildId)` adds to in-memory queue
4. `BuildWorker` polls every 5 seconds
5. `orchestrator.processNextBuild()` processes queued builds
6. `LocalProcessRunner.build()` runs pnpm install/build
7. `LocalProcessRunner.deploy()` starts server on allocated port
8. `LocalEdgeRouter.registerRoute()` registers the route
9. Build status updated to `succeeded`

## Reverse Proxy Setup (Fixed)

The `reverse-proxy` strategy in `LocalEdgeRouter` now works correctly.

**Previous Issue**: The dynamic `import('http-proxy')` was being bundled by tsup instead of being left as an external dependency, causing runtime import failures.

**Fix**: Added `external: ['http-proxy', 'selfsigned']` to `routers/local/tsup.config.ts` so these optional dependencies are resolved at runtime rather than bundled.

**Usage in server.ts**:

```typescript
const router = new LocalEdgeRouter({
  strategy: 'reverse-proxy',
  baseDomain: 'localhost',
  proxyPort: 3100, // Single entry point for all deployments
  portRange: { start: 4100, end: 4199 }, // Backend ports (hidden from user)
  logRoutes: true,
});

// After admin.init()
await router.startProxy();

// Access deployments via: http://localhost:3100/{subdomain}/...
```

**Benefits**:

- Single port to remember (3100) for all deployments
- Path-based routing: `http://localhost:3100/my-agent/api/...`
- Verifies edge router functionality works correctly

## Files Created/Modified

### Created

- `examples/admin/src/server.ts` - Development server
- `packages/admin-ui/src/hooks/sources/use-sources.ts` - Sources hook

### Modified

- `packages/admin/src/mastra-admin.ts` - Added `getSource()`
- `packages/admin/src/orchestrator/build-orchestrator.ts` - Added `getStorage()`, `processBuildById()`
- `packages/admin-server/src/routes/sources.ts` - Implemented source listing
- `packages/admin-server/src/routes/deployments.ts` - Fixed envVarOverrides
- `packages/admin-server/src/worker/build-worker.ts` - Added DB queue fallback
- `packages/admin-ui/src/routes/.../[deploymentId]/index.tsx` - Wired up buttons
- `packages/admin-ui/src/routes/.../projects/new.tsx` - Source picker
- `packages/admin-ui/src/lib/admin-client.ts` - Fixed sources response parsing
- `packages/admin-ui/src/lib/supabase.ts` - Dev mode support
- `stores/admin-pg/src/domains/builds.ts` - Added `listQueuedBuilds()`
- `stores/admin-pg/src/storage.ts` - Added `listQueuedBuilds()`

## Testing Gaps Identified

Unit tests mock storage, integration tests test DB separately, but no test covers:

1. Server restart with builds in DB queue
2. Full BuildWorker → DB → Orchestrator flow
3. End-to-end deploy flow

## Environment Variables

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mastra_admin
PROJECTS_DIR=/path/to/projects  # Optional, defaults to ../
VITE_DEV_MODE=true              # For admin-ui dev auth bypass
VITE_ADMIN_API_URL=http://localhost:3001/api
```
