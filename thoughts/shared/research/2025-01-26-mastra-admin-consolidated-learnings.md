---
date: 2026-01-26T12:20:13-08:00
researcher: ryanhansen
git_commit: 45876f3bcb1a3905b05f35abfb117535ddba1070
branch: mastra-admin-rph-2
repository: mastra-ai/mastra
topic: "MastraAdmin Consolidated Learnings from Attempt 1 and Master Plan v2"
tags: [research, mastra-admin, enterprise, retrospective, architecture]
status: complete
last_updated: 2026-01-26
last_updated_by: ryanhansen
---

# Research: MastraAdmin Consolidated Learnings

**Date**: 2026-01-26T12:20:13-08:00
**Researcher**: ryanhansen
**Git Commit**: 45876f3bcb1a3905b05f35abfb117535ddba1070
**Branch**: mastra-admin-rph-2
**Repository**: mastra-ai/mastra

## Research Question

Consolidate learnings from Attempt 1 retrospective and Master Plan v2 to create a guide for a successful implementation of MastraAdmin.

## Summary

This document synthesizes the learnings from the first implementation attempt (28 commits, ~8,700 lines added) and the improved Master Plan v2 to create a comprehensive guide for the next implementation attempt. The core insight is that **integration complexity was underestimated** - wiring components together required more code than the components themselves.

---

## Executive Summary: What MastraAdmin Is

MastraAdmin is an enterprise-grade, self-hosted platform for running multiple Mastra servers across teams:

| Open Source Mastra | Enterprise MastraAdmin |
|-------------------|------------------------|
| Single Mastra server | Many Mastra servers across teams |
| Self-managed deployment | Managed deployments with build queue |
| No multi-tenancy | Teams, users, RBAC |
| Manual observability setup | Centralized observability across all projects |
| DIY routing/exposure | Edge routing with Cloudflare/local support |

---

## Critical Learnings: What Failed in Attempt 1

### 1. UI Components Existed But Were Not Wired

**Reality**: UI components were built but not connected to API calls.

| Component | Missing Wiring |
|-----------|---------------|
| Deploy button | `onClick` handler not connected to mutation hook |
| Project creation | Form required manual path input instead of source picker |
| Sources list | `useSources()` hook didn't exist |
| Build logs | Line breaks not preserved in display |

**Action for This Attempt**: Before considering any UI component "done", verify:
- [ ] Button has onClick wired to mutation hook
- [ ] Loading state is handled
- [ ] Error state is displayed
- [ ] Success feedback is shown
- [ ] Form validation is implemented

### 2. In-Memory State Lost on Server Restart

**Reality**: The build queue was in-memory only:
```
server restart → in-memory queue = empty → builds stuck in "queued" status forever
```

**Solution**: Query DB for `status='queued'` builds on server startup and re-queue them.

**Action for This Attempt**: Every stateful component must answer:
- What state is lost on restart?
- How is state recovered?
- What happens to in-flight operations?

### 3. LocalProjectSource Didn't Copy Projects

**Reality**: `getProjectPath()` ignored the `targetDir` parameter entirely:
```typescript
async getProjectPath(source: ProjectSource, _targetDir: string): Promise<string> {
  // _targetDir intentionally ignored - builds in-place
  return source.path;
}
```

**Problems from building in-place**:
- No fresh `node_modules` installs
- Build artifacts pollute source directory
- No isolated observability directory
- Can't run concurrent builds of same project

**Action for This Attempt**: `getProjectPath()` MUST copy to targetDir, not build in-place.

### 4. Observability Injection Was Missing

**Reality**: How do deployed servers know where to write observability data?

The plan showed:
```
Mastra Server → ObservabilityWriter → FileStorage → ClickHouse
```

Missing:
```
How does the server know about ObservabilityWriter?
Where does FileStorage config come from?
How is this injected at build/deploy time?
```

**Solution**: AdminBundler generates entry code that includes FileExporter:
```typescript
// AdminBundler generates entry code that includes:
import { FileExporter } from '@mastra/observability';

const fileExporter = new FileExporter({
  outputPath: '${observabilityPath}',
  projectId: '${projectId}',
  deploymentId: '${deploymentId}',
});
```

### 5. WebSocket Required Manual HTTP Server

**Reality**: Hono's built-in `serve()` doesn't support WebSocket upgrade.

**Solution**: Manually create HTTP server:
```typescript
const httpServer = createServer(/* ... */);
const wsServer = new WebSocketServer({ server: httpServer });
```

### 6. CORS for Multi-Port Development

**Reality**: Multiple ports needed explicit CORS configuration:
- Admin Server: port 3001
- Admin UI: port 3002 (Vite)
- Proxy: port 3100
- Deployed servers: ports 4100+

```typescript
cors: {
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'],
  credentials: true,
}
```

### 7. JSONB Columns Can Be Null or Empty Object

**Reality**: `envVarOverrides` assumed to always be an array, but JSONB could be null or empty object.

**Error**: `deployment.envVarOverrides.map is not a function`

**Solution**: Defensive array check:
```typescript
envVarOverrides: Array.isArray(deployment.envVarOverrides)
  ? deployment.envVarOverrides.map(...)
  : []
```

---

## Architecture: The Correct Approach

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MastraAdmin Architecture                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   @mastra/admin-server (Control Plane)                                           │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │  HTTP API (Hono) + WebSocket (manual HTTP server)                        │  │
│   │  POST /teams, GET /projects, POST /deployments/:id/deploy, etc.          │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                │                                                                 │
│                ▼                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │  MastraAdmin Class (from @mastra/admin)                                   │  │
│   │  • Business logic: createTeam(), deploy(), triggerBuild()                 │  │
│   │  • BuildOrchestrator for queue management                                 │  │
│   │  • RBAC and license validation                                            │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                │                                                                 │
│    ┌───────────┼───────────┬───────────────┬──────────────┐                     │
│    ▼           ▼           ▼               ▼              ▼                     │
│  Storage    Source      Runner          Router      Observability               │
│  (admin-pg) (source-    (runner-        (router-    (clickhouse)                │
│              local)      local)          local)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Package Structure

| Package | Location | Purpose |
|---------|----------|---------|
| `@mastra/admin` | `packages/admin/` | MastraAdmin class, types, RBAC, license |
| `@mastra/admin-server` | `packages/admin-server/` | HTTP API + WebSocket + Workers |
| `@mastra/admin-ui` | `packages/admin-ui/` | Dashboard UI |
| `@mastra/admin-pg` | `stores/admin-pg/` | PostgreSQL storage |
| `@mastra/runner-local` | `runners/local/` | Build + run servers locally |
| `@mastra/router-local` | `routers/local/` | Reverse proxy routing |
| `@mastra/source-local` | `sources/local/` | Local filesystem projects |
| `@mastra/observability-clickhouse` | `observability/clickhouse/` | ClickHouse queries + ingestion |

### Data Model

```typescript
interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;                    // Required - auto-generate from name
  sourceType: 'local' | 'github';
  sourceConfig: SourceConfig;
  defaultBranch: string;
  envVars: EncryptedEnvVar[];
}

interface Deployment {
  id: string;
  projectId: string;
  type: 'production' | 'staging' | 'preview';
  branch: string;
  slug: string;
  status: 'pending' | 'building' | 'running' | 'stopped' | 'failed';
  currentBuildId: string | null;
  publicUrl: string | null;
  envVarOverrides: EncryptedEnvVar[];  // JSONB - always check Array.isArray()
}

interface Build {
  id: string;
  deploymentId: string;
  trigger: 'manual' | 'webhook' | 'schedule';
  status: 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed';
  logPath: string | null;          // Path to log file in file storage
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}
```

---

## The AdminBundler: Solving Cross-Process Injection

### The Problem

MastraAdmin runs deployed Mastra servers as separate processes. These servers need observability to flow back, but:
1. Deployed servers are **user code** - can't require users to configure observability
2. The server process is **separate** from the admin process - no shared memory
3. Different Mastra versions may have **different observability APIs**

### The Solution: Build-Time Code Injection

AdminBundler generates a wrapper entry file:

```
User's Project                      AdminBundler Output
───────────────                     ──────────────────

src/mastra/index.ts                 .mastra/output/index.mjs
┌────────────────────┐              ┌────────────────────────────────────────┐
│ export const mastra│              │ // Generated by AdminBundler           │
│   = new Mastra({   │              │                                        │
│   agents: [...],   │    ────►     │ import { mastra } from './mastra';     │
│   tools: [...],    │   bundle     │ import { FileExporter } from '...';    │
│ });                │              │ import { FileLogger } from '...';      │
└────────────────────┘              │                                        │
                                    │ // Inject observability                │
                                    │ const fileExporter = new FileExporter({│
                                    │   outputPath: '/tmp/.../observability',│
                                    │   projectId: 'proj_123',               │
                                    │   deploymentId: 'dep_456',             │
                                    │ });                                    │
                                    │                                        │
                                    │ mastra.addExporter(fileExporter);      │
                                    │ serve(mastra, { port: 4001 });         │
                                    └────────────────────────────────────────┘
```

### Cross-Version Handling

```typescript
class AdminBundler extends Bundler {
  async bundle(mastraDir: string, outputDir: string, options: AdminBundlerOptions) {
    const mastraVersion = await this.detectMastraVersion(mastraDir);
    const entryCode = this.generateEntry(mastraVersion, options);
    // ...
  }

  private generateEntry(version: string, options: AdminBundlerOptions): string {
    if (semver.satisfies(version, '>=2.0.0')) {
      return this.generateV2Entry(options);
    }
    return this.generateV1Entry(options);
  }
}
```

---

## Observability: The Correct Pattern

### Wrong Approach (Attempt 1)

Listen to child process stdout/stderr:
- Requires parent process to always be running
- Loses logs if parent restarts
- Tight coupling between runner and deployed server

### Correct Approach: File-Based Injection

```
Deployed Server                     File Storage                ClickHouse
──────────────                      ────────────                ──────────

┌─────────────────┐
│ Agent.generate()│
│      │          │
│      ▼          │
│ FileExporter    │ ──► {buildDir}/observability/spans/*.jsonl
│                 │                            │
│ console.log()   │                            │
│      │          │                            │   ┌──────────────────────┐
│      ▼          │                            │   │  IngestionWorker     │
│ FileLogger      │ ──► {buildDir}/observability/logs/*.jsonl             │
└─────────────────┘                            │   │  • Polls every 10s   │
                                               │   │  • Parses JSONL      │
                                               └──►│  • Bulk inserts      │
                                                   └──────────┬───────────┘
                                                              │
                                                              ▼
                                                   ┌──────────────────────┐
                                                   │  ClickHouse          │
                                                   │  • mastra_admin_spans│
                                                   │  • mastra_admin_logs │
                                                   └──────────────────────┘
```

**Key insight**: Deployed server writes logs directly to files. Works even if admin server restarts.

---

## Build Logs: Cache Adapter Pattern

### Requirements

1. **Real-time streaming** during build (WebSocket to UI)
2. **Persistence** after build completes (for later viewing)

### Interface

```typescript
interface BuildLogCache {
  append(buildId: string, line: string): void;
  getLines(buildId: string): string[];
  flush(buildId: string, storage: FileStorageProvider): Promise<string>;
  clear(buildId: string): void;
}
```

### Flow

```
BuildWorker
───────────

executeCommand(stdout/stderr)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BuildLogCache                                                          │
│  • InMemoryLogCache (default for dev)                                   │
│  • RedisLogCache (for HA/scale)                                         │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │ on build complete
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FileStorageProvider.write()                                            │
│  → builds/{buildId}/build.log                                           │
└─────────────────────────────────────────────────────────────────────────┘

Parallel: WebSocket broadcast for real-time UI
────────────────────────────────────────────

append() also calls:
  orchestrator.emit('build:log', buildId, line)
       │
       ▼
  BuildLogStreamer.broadcastLog(buildId, line)
       │
       ▼
  WebSocket → Admin UI (real-time)
```

---

## Directory Structures

### Build Directory (Temp)

```
{os.tmpdir()}/mastra/builds/{buildId}/
├── src/                          # Copied from source
│   ├── package.json
│   └── src/mastra/index.ts
├── node_modules/                 # Fresh install
├── .mastra/
│   └── output/                   # Build artifacts
│       └── index.mjs             # Generated by AdminBundler
└── observability/                # Created at deploy time (sibling to .mastra/)
    ├── spans/
    │   └── {timestamp}_{uuid}.jsonl
    └── logs/
        └── {timestamp}_{uuid}.jsonl
```

**Note**: `observability/` is sibling to `.mastra/` because `mastra build` recreates `.mastra/`.

### File Storage Structure

```
file-storage/
├── builds/
│   └── {buildId}/
│       └── build.log             # Build stdout/stderr
└── observability/
    ├── spans/
    │   └── {projectId}/
    │       └── {timestamp}_{uuid}.jsonl
    └── logs/
        └── {projectId}/
            └── {timestamp}_{uuid}.jsonl
```

---

## State Recovery: What Happens on Restart

| Component | State Lost | Recovery Strategy |
|-----------|------------|-------------------|
| BuildOrchestrator | Queued builds | Query DB for status='queued' builds |
| ProcessManager | Running server handles | Check PIDs, reattach or mark stopped |
| BuildLogCache | In-progress logs | Accept partial loss, or use Redis |
| WebSocket | Client subscriptions | Clients auto-reconnect |

### Recovery Code Pattern

```typescript
// AdminServer.start()
async start() {
  // 1. Recover build queue
  const queuedBuilds = await this.storage.listQueuedBuilds();
  for (const build of queuedBuilds) {
    this.orchestrator.queueBuild(build.id);
  }

  // 2. Recover running servers
  const runningServers = await this.storage.listRunningServers();
  for (const server of runningServers) {
    if (await this.runner.isProcessAlive(server.processId)) {
      this.runner.reattach(server);
    } else {
      await this.storage.markServerStopped(server.id);
    }
  }

  // 3. Start workers
  this.buildWorker.start();
  this.healthWorker.start();
  this.ingestionWorker.start();
}
```

---

## Provider Interfaces

### FileStorageProvider

```typescript
interface FileStorageProvider {
  readonly type: 'local' | 's3' | 'gcs';
  write(path: string, content: Buffer | string): Promise<void>;
  read(path: string): Promise<Buffer>;
  list(prefix: string): Promise<FileInfo[]>;
  delete(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
```

### ProjectSourceProvider

```typescript
interface ProjectSourceProvider {
  readonly type: 'local' | 'github';
  listProjects(teamId: string): Promise<ProjectSource[]>;
  validateAccess(source: ProjectSource): Promise<boolean>;
  getProjectPath(source: ProjectSource, targetDir: string): Promise<string>;
}
```

**Critical**: `getProjectPath()` MUST copy to targetDir, not build in-place.

---

## Environment Variables & Ports

### Environment Variables

| Variable | Default | Required | Component |
|----------|---------|----------|-----------|
| `DATABASE_URL` | - | Yes | admin-pg |
| `CLICKHOUSE_URL` | `http://localhost:8123` | No | observability |
| `PROJECTS_DIR` | `../` | No | source-local |
| `FILE_STORAGE_PATH` | `./.mastra/storage` | No | file storage |
| `REDIS_URL` | - | No | RedisLogCache |

### Port Allocation

| Component | Port | Purpose |
|-----------|------|---------|
| Admin Server | 3001 | HTTP API + WebSocket |
| Admin UI | 3002 | Vite dev server |
| Reverse Proxy | 3100 | Path-based routing |
| Deployed servers | 4100-4199 | Individual Mastra servers |
| PostgreSQL | 5433 | Database |
| ClickHouse | 8123 | HTTP queries |
| Redis | 6379 | Log cache (optional) |

---

## Implementation Phases

### Phase 1: Foundation [P0]

**Goal**: Basic data model and storage working

- [ ] `@mastra/admin` - MastraAdmin class, types, RBAC, license validation
- [ ] `@mastra/admin-pg` - PostgreSQL storage implementation
- [ ] **VERIFY**: Can create teams, projects, deployments via direct class calls

### Phase 2: Build & Deploy [P0]

**Goal**: Can build and run a Mastra server

- [ ] `@mastra/source-local` - Project discovery, **copy to temp directory**
- [ ] `@mastra/runner-local` - Build execution, process management
- [ ] BuildOrchestrator - Queue management **with recovery**
- [ ] **VERIFY**: Build completes, server starts, health check passes
- [ ] **VERIFY**: Project copied to temp dir, not built in-place

### Phase 3: AdminBundler [P0]

**Goal**: Deployed servers emit observability data

- [ ] AdminBundler - Extend bundler with FileExporter/FileLogger injection
- [ ] FileExporter - Span exporter that writes JSONL
- [ ] FileLogger - Logger that writes JSONL
- [ ] Version detection for cross-version support
- [ ] **VERIFY**: Deployed server writes spans and logs to files

### Phase 4: API & Routing [P0]

**Goal**: Full HTTP API and WebSocket working

- [ ] `@mastra/admin-server` - HTTP routes + **manual WebSocket setup**
- [ ] `@mastra/router-local` - Reverse proxy (path-based routing)
- [ ] BuildLogCache - In-memory + file storage flush
- [ ] **VERIFY**: Can trigger deploy via API, build logs stream via WebSocket
- [ ] **VERIFY**: CORS configured for all dev ports

### Phase 5: Observability Ingestion [P1]

**Goal**: Spans and logs visible in UI

- [ ] IngestionWorker - Poll files, insert to ClickHouse
- [ ] ClickHouseQueryProvider - Query spans and logs
- [ ] Observability routes - Wire to query provider
- [ ] **VERIFY**: Spans appear in ClickHouse after agent execution

### Phase 6: UI Integration [P1]

**Goal**: Full flow works from UI

- [ ] Wire **all buttons** to mutation hooks
- [ ] Source picker for project creation
- [ ] Build logs viewer with WebSocket
- [ ] Observability dashboard
- [ ] **VERIFY**: Every button has onClick handler wired

### Phase 7: Production Readiness [P2]

- [ ] Integration tests (restart, E2E deploy, WebSocket reconnect)
- [ ] RedisLogCache for HA deployments
- [ ] S3/GCS file storage adapters
- [ ] Documentation

---

## Verification Checklists

### For Every UI Component

Before marking complete, verify:
- [ ] Button has onClick wired to mutation/query hook
- [ ] Loading state is displayed
- [ ] Error state is handled and displayed
- [ ] Success feedback is shown
- [ ] Form validation is implemented (if applicable)

### For Every Stateful Component

Before marking complete, answer:
- [ ] What state is lost on restart?
- [ ] How is state recovered on startup?
- [ ] What happens to in-flight operations?

### For Every Database Column

Before marking complete:
- [ ] JSONB columns have `Array.isArray()` checks before `.map()`
- [ ] Default values are documented
- [ ] Nullable vs required is explicit

### For Every Provider Interface

Before marking complete:
- [ ] Interface method signature is finalized
- [ ] Critical methods (like `getProjectPath`) have explicit behavior documented
- [ ] At least one implementation exists and is tested

---

## Quick Reference: Issue → Solution

| Issue | Solution |
|-------|----------|
| UI buttons not working | Always verify onClick handlers wired to mutation hooks |
| Build queue lost on restart | Query DB for `status='queued'` on startup |
| Source builds in-place | `getProjectPath()` MUST copy to targetDir |
| WebSocket upgrade fails | Manual HTTP server creation, not Hono serve() |
| CORS errors | Add all dev ports to CORS origin list |
| `envVarOverrides.map` fails | Always `Array.isArray()` check before `.map()` |
| Observability not flowing | AdminBundler injects FileExporter at build time |
| Logs lost on admin restart | File-based logging, not stdout capture |

---

## Open Questions

1. **License validation** - Where should license keys be stored? How is validation performed?
2. **RBAC implementation** - What permission model? Team-based? Role-based?
3. **Secret management** - How are env vars encrypted? What key management?
4. **GitHub source** - How is OAuth handled? Where are tokens stored?

---

## Related Documents

- `/Users/ryanhansen/.superset/worktrees/mastra/mastra-admin-example/thoughts/retro/mastra-admin-attempt-1.md` - Full retrospective
- `/Users/ryanhansen/.superset/worktrees/mastra/mastra-admin-example/thoughts/shared/plans/2025-01-26-mastra-admin-master-plan-v2.md` - Improved master plan
