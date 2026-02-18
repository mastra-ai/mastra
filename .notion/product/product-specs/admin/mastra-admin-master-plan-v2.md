# MastraAdmin Master Plan v2

---

## Vision & Purpose

### Why MastraAdmin Exists

**MastraAdmin is an enterprise-grade, self-hosted platform that enables organizations to run and operate many Mastra servers across their teams.**

The open-source Mastra framework allows anyone to build and run a single Mastra server. Enterprises need more:

| Open Source Mastra | Enterprise MastraAdmin |
|--------------------|------------------------|
| Single Mastra server | Many Mastra servers across teams |
| Self-managed deployment | Managed deployments with build queue |
| No multi-tenancy | Teams, users, RBAC |
| Manual observability setup | Centralized observability across all projects |
| DIY routing/exposure | Edge routing with Cloudflare/local support |
| No preview environments | Branch deployments and PR previews |

### The Enterprise Use Case

```
Indeed (Enterprise)
└── MastraAdmin (self-hosted on Indeed's infrastructure)
    │
    ├── Team: Search Ranking
    │   ├── Users: alice@indeed.com, bob@indeed.com
    │   └── Project: job-matching-agent
    │       ├── production → job-matching-agent.indeed.internal
    │       ├── staging → staging--job-matching-agent.indeed.internal
    │       └── preview/pr-456 → pr-456--job-matching-agent.indeed.internal
    │
    ├── Team: Job Posting
    │   └── Project: posting-assistant
    │       └── production → posting-assistant.indeed.internal
    │
    └── Team: Customer Support
        └── Project: support-chatbot
            └── production → support-chatbot.indeed.internal
```

### Key User Personas

1. **Platform Admin** - Deploys MastraAdmin, configures auth/SSO, sets up runners and routing, monitors health
2. **Team Lead** - Creates team, invites members, manages secrets, reviews observability data
3. **Developer** - Connects projects, configures env vars, triggers builds, views logs/traces/metrics

### Licensing Model

MastraAdmin is enterprise and license-gated:
- License validation built into core
- Features tiered (local runner = base, K8s runner = enterprise+)
- Self-hosted deployments require valid license key

---

## Architecture Overview

MastraAdmin is a **control plane** that orchestrates Mastra server deployments.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MastraAdmin Architecture                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   @mastra/admin-server (Control Plane)                                           │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │  HTTP API (Hono) + WebSocket                                              │  │
│   │  POST /teams, GET /projects, POST /deployments/:id/deploy, etc.           │  │
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
│                                                                                  │
│                         │                                                        │
│                         ▼                                                        │
│            ┌──────────────────────────────────────────────────────────┐         │
│            │              Running Mastra Servers                      │         │
│            │  job-matching-agent:4001, posting-assistant:4002, ...    │         │
│            │                                                          │         │
│            │  Each server has injected:                               │         │
│            │  • FileExporter (spans → JSONL)                          │         │
│            │  • FileLogger (logs → JSONL)                             │         │
│            └──────────────────────────────────────────────────────────┘         │
│                         │                                                        │
│                         ▼ writes JSONL files                                     │
│            ┌──────────────────────────────────────────────────────────┐         │
│            │  File Storage (fs / S3 / GCS)                            │         │
│            │  {buildDir}/observability/spans/*.jsonl                  │         │
│            │  {buildDir}/observability/logs/*.jsonl                   │         │
│            └──────────────────────────────────────────────────────────┘         │
│                         │                                                        │
│                         ▼ IngestionWorker polls                                  │
│            ┌──────────────────────────────────────────────────────────┐         │
│            │  ClickHouse                                              │         │
│            │  • mastra_admin_spans                                    │         │
│            │  • mastra_admin_logs                                     │         │
│            └──────────────────────────────────────────────────────────┘         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Packages

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

---

## Data Model

```
Team → TeamMember[]
     → Project[] → Deployment[] → Build[] → RunningServer
```

### Key Entities

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

## The AdminBundler: Cross-Process Configuration Injection

### The Core Problem

MastraAdmin runs deployed Mastra servers as separate processes. These servers need observability (spans, logs) to flow back to MastraAdmin, but:

1. Deployed servers are **user code** - we can't require users to configure observability
2. The server process is **separate** from the admin process - no shared memory
3. Different Mastra versions may have **different observability APIs**

### The Solution: Build-Time Code Injection

`AdminBundler` extends the standard Mastra bundler to inject configuration at build time. It generates a wrapper entry file that:

1. Imports the user's Mastra configuration
2. Adds a `FileExporter` for spans
3. Adds a `FileLogger` for logs
4. Wraps and serves the enhanced Mastra instance

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         AdminBundler: Build-Time Injection                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  User's Project                      AdminBundler Output                         │
│  ───────────────                     ──────────────────                          │
│                                                                                  │
│  src/mastra/index.ts                 .mastra/output/index.mjs                    │
│  ┌────────────────────┐              ┌────────────────────────────────────────┐  │
│  │ export const mastra│              │ // Generated by AdminBundler           │  │
│  │   = new Mastra({   │              │                                        │  │
│  │   agents: [...],   │    ────►     │ import { mastra } from './mastra';     │  │
│  │   tools: [...],    │   bundle     │ import { FileExporter } from '...';    │  │
│  │ });                │              │ import { FileLogger } from '...';      │  │
│  └────────────────────┘              │                                        │  │
│                                      │ // Inject observability                │  │
│                                      │ const fileExporter = new FileExporter({│  │
│                                      │   outputPath: '/tmp/.../observability',│  │
│                                      │   projectId: 'proj_123',               │  │
│                                      │   deploymentId: 'dep_456',             │  │
│                                      │ });                                    │  │
│                                      │                                        │  │
│                                      │ const fileLogger = new FileLogger({    │  │
│                                      │   outputPath: '/tmp/.../observability',│  │
│                                      │   projectId: 'proj_123',               │  │
│                                      │ });                                    │  │
│                                      │                                        │  │
│                                      │ // Enhance and serve                   │  │
│                                      │ mastra.addExporter(fileExporter);      │  │
│                                      │ mastra.setLogger(fileLogger);          │  │
│                                      │ serve(mastra, { port: 4001 });         │  │
│                                      └────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Cross-Version Complexity

The AdminBundler must handle different versions of `@mastra/core`:

| Mastra Version | Observability API | AdminBundler Approach |
|----------------|-------------------|----------------------|
| v1.x | `new Mastra({ telemetry: {...} })` | Inject into telemetry config |
| v2.x | `new Mastra({ observability: {...} })` | Inject into observability config |
| Future | Unknown | Version detection + adapter pattern |

**Strategy**: AdminBundler detects the Mastra version from `package.json` and generates version-appropriate injection code.

```typescript
class AdminBundler extends Bundler {
  async bundle(mastraDir: string, outputDir: string, options: AdminBundlerOptions) {
    const mastraVersion = await this.detectMastraVersion(mastraDir);
    const entryCode = this.generateEntry(mastraVersion, options);

    await this.prepare(outputDir);
    await this._bundle(entryCode, mastraEntryFile, { outputDirectory: outputDir });
  }

  private generateEntry(version: string, options: AdminBundlerOptions): string {
    if (semver.satisfies(version, '>=2.0.0')) {
      return this.generateV2Entry(options);
    }
    return this.generateV1Entry(options);
  }
}
```

### What AdminBundler Injects

1. **FileExporter** - Captures spans from agent/workflow execution, writes to JSONL
2. **FileLogger** - Captures structured logs, writes to JSONL
3. **Server wrapper** - Starts the Mastra server on the assigned port
4. **Health endpoint** - Standardized `/health` for the runner to monitor

---

## Observability Architecture

### Unified File-Based Ingestion

All observability data (spans, logs, metrics) follows the same pattern:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Observability: Unified File-Based Ingestion                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Deployed Server                     File Storage                ClickHouse      │
│  ──────────────                      ────────────                ──────────      │
│                                                                                  │
│  ┌─────────────────┐                                                             │
│  │ Agent.generate()│                                                             │
│  │      │          │                                                             │
│  │      ▼          │                                                             │
│  │ FileExporter    │ ──► {buildDir}/observability/spans/*.jsonl                  │
│  │                 │                            │                                │
│  │ console.log()   │                            │                                │
│  │      │          │                            │   ┌──────────────────────┐     │
│  │      ▼          │                            │   │  IngestionWorker     │     │
│  │ FileLogger      │ ──► {buildDir}/observability/logs/*.jsonl             │     │
│  └─────────────────┘                            │   │  • Polls every 10s   │     │
│                                                 │   │  • Parses JSONL      │     │
│                                                 └──►│  • Bulk inserts      │     │
│                                                     │  • Moves to processed│     │
│                                                     └──────────┬───────────┘     │
│                                                                │                 │
│                                                                ▼                 │
│                                                     ┌──────────────────────┐     │
│                                                     │  ClickHouse          │     │
│                                                     │  • mastra_admin_spans│     │
│                                                     │  • mastra_admin_logs │     │
│                                                     └──────────────────────┘     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Insight: No stdout/stderr Capture

**Wrong approach** (Attempt 1): Listen to child process stdout/stderr
- Requires parent process to always be running
- Loses logs if parent restarts
- Tight coupling between runner and deployed server

**Correct approach**: Inject FileLogger at build time
- Deployed server writes logs directly to files
- Works even if admin server restarts
- Same pattern as spans - unified ingestion

---

## Build Logs Architecture

### Cache Adapter Pattern

Build logs need:
1. **Real-time streaming** during build (WebSocket to UI)
2. **Persistence** after build completes (for later viewing)

**Wrong approach** (Attempt 1): Store as TEXT in PostgreSQL
- Inefficient for large logs
- No unified storage with observability data

**Correct approach**: Cache adapter with file storage flush

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Build Logs: Cache Adapter Pattern                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  BuildWorker                                                                     │
│  ───────────                                                                     │
│                                                                                  │
│  executeCommand(stdout/stderr)                                                   │
│           │                                                                      │
│           ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  BuildLogCache (adapter interface)                                       │    │
│  │                                                                          │    │
│  │  interface BuildLogCache {                                               │    │
│  │    append(buildId: string, line: string): void;                          │    │
│  │    getLines(buildId: string): string[];                                  │    │
│  │    flush(buildId: string): Promise<void>;  // Persist to file storage    │    │
│  │  }                                                                       │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│           │                                                                      │
│           │ implementations                                                      │
│           ▼                                                                      │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐            │
│  │ InMemoryLogCache  │  │ RedisLogCache     │  │ (future adapters) │            │
│  │ (default for dev) │  │ (for HA/scale)    │  │                   │            │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘            │
│           │                                                                      │
│           │ on build complete                                                    │
│           ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  FileStorageProvider.write()                                             │    │
│  │  → builds/{buildId}/build.log                                            │    │
│  │                                                                          │    │
│  │  Adapters: LocalFileStorage, S3FileStorage, GCSFileStorage               │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  Parallel: WebSocket broadcast for real-time UI                                  │
│  ────────────────────────────────────────────                                    │
│                                                                                  │
│  append() also calls:                                                            │
│    orchestrator.emit('build:log', buildId, line)                                 │
│         │                                                                        │
│         ▼                                                                        │
│    BuildLogStreamer.broadcastLog(buildId, line)                                  │
│         │                                                                        │
│         ▼                                                                        │
│    WebSocket → Admin UI (real-time)                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### BuildLogCache Interface

```typescript
interface BuildLogCache {
  // Append a log line (fast, buffered)
  append(buildId: string, line: string): void;

  // Get all lines for a build (for real-time streaming catchup)
  getLines(buildId: string): string[];

  // Flush to file storage (called when build completes)
  flush(buildId: string, fileStorage: FileStorageProvider): Promise<string>;

  // Clear from cache (after flush)
  clear(buildId: string): void;
}

// Default implementation for single-server deployment
class InMemoryLogCache implements BuildLogCache {
  private buffers = new Map<string, string[]>();

  append(buildId: string, line: string): void {
    if (!this.buffers.has(buildId)) {
      this.buffers.set(buildId, []);
    }
    this.buffers.get(buildId)!.push(line);
  }

  async flush(buildId: string, fileStorage: FileStorageProvider): Promise<string> {
    const lines = this.buffers.get(buildId) ?? [];
    const path = `builds/${buildId}/build.log`;
    await fileStorage.write(path, lines.join('\n'));
    return path;
  }
}

// For HA deployment with multiple admin servers
class RedisLogCache implements BuildLogCache {
  // Uses Redis lists for distributed caching
}
```

---

## Directory Structure

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
└── observability/                # Created at deploy time
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

## State Recovery

### Problem: In-Memory State Lost on Restart

Several components maintain in-memory state that must be recovered:

| Component | State Lost | Recovery Strategy |
|-----------|------------|-------------------|
| BuildOrchestrator | Queued builds | Query DB for status='queued' builds |
| ProcessManager | Running server handles | Check PIDs, reattach or mark stopped |
| BuildLogCache | In-progress logs | Accept partial loss, or use Redis |
| WebSocket | Client subscriptions | Clients auto-reconnect |

### Recovery on Server Start

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

## Implementation Phases

### Phase 1: Foundation [P0]

**Goal**: Basic data model and storage working

- [ ] `@mastra/admin` - MastraAdmin class, types, RBAC, license validation
- [ ] `@mastra/admin-pg` - PostgreSQL storage implementation
- [ ] **Verify**: Can create teams, projects, deployments via direct class calls

### Phase 2: Build & Deploy [P0]

**Goal**: Can build and run a Mastra server

- [ ] `@mastra/source-local` - Project discovery, copy to temp directory
- [ ] `@mastra/runner-local` - Build execution, process management
- [ ] BuildOrchestrator - Queue management with recovery
- [ ] **Verify**: Build completes, server starts, health check passes

### Phase 3: AdminBundler [P0]

**Goal**: Deployed servers emit observability data

- [ ] AdminBundler - Extend bundler with FileExporter/FileLogger injection
- [ ] FileExporter - Span exporter that writes JSONL
- [ ] FileLogger - Logger that writes JSONL
- [ ] Version detection for cross-version support
- [ ] **Verify**: Deployed server writes spans and logs to files

### Phase 4: API & Routing [P0]

**Goal**: Full HTTP API and WebSocket working

- [ ] `@mastra/admin-server` - HTTP routes + manual WebSocket setup
- [ ] `@mastra/router-local` - Reverse proxy (path-based routing)
- [ ] BuildLogCache - In-memory + file storage flush
- [ ] **Verify**: Can trigger deploy via API, build logs stream via WebSocket

### Phase 5: Observability Ingestion [P1]

**Goal**: Spans and logs visible in UI

- [ ] IngestionWorker - Poll files, insert to ClickHouse
- [ ] ClickHouseQueryProvider - Query spans and logs
- [ ] Observability routes - Wire to query provider
- [ ] **Verify**: Spans appear in ClickHouse after agent execution

### Phase 6: UI Integration [P1]

**Goal**: Full flow works from UI

- [ ] Wire all buttons to mutation hooks
- [ ] Source picker for project creation
- [ ] Build logs viewer with WebSocket
- [ ] Observability dashboard
- [ ] **Verify**: Complete flow from UI works

### Phase 7: Production Readiness [P2]

- [ ] Integration tests (restart, E2E deploy, WebSocket reconnect)
- [ ] RedisLogCache for HA deployments
- [ ] S3/GCS file storage adapters
- [ ] Documentation

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

### BuildLogCache

```typescript
interface BuildLogCache {
  append(buildId: string, line: string): void;
  getLines(buildId: string): string[];
  flush(buildId: string, storage: FileStorageProvider): Promise<string>;
  clear(buildId: string): void;
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

## Environment & Ports

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

## Learnings from Attempt 1

Key issues encountered and their solutions:

| Issue | Root Cause | Solution |
|-------|------------|----------|
| UI buttons not working | Not wired to mutation hooks | Always verify onClick handlers |
| Build queue lost on restart | In-memory only | Add DB query on startup |
| Source builds in-place | `getProjectPath()` ignored targetDir | Implement proper copy |
| WebSocket upgrade fails | Hono's serve() limitation | Manual HTTP server creation |
| CORS errors | Missing dev ports | Add all ports to CORS origin |
| envVarOverrides.map fails | JSONB not always array | Always use `Array.isArray()` |

See `thoughts/retro/mastra-admin-attempt-1.md` for full retrospective.
