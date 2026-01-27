---
date: 2025-01-27T12:00:00-07:00
researcher: ryanhansen
git_commit: 45876f3bcb1a3905b05f35abfb117535ddba1070
branch: mastra-admin-rph-2
repository: mastra
topic: "MastraAdmin V2 PRD - Surgical Implementation Strategy"
tags: [research, prd, mastra-admin, enterprise, observability]
status: complete
last_updated: 2025-01-27
last_updated_by: ryanhansen
---

# MastraAdmin V2 PRD - Surgical Implementation Strategy

**Date**: 2025-01-27T12:00:00-07:00
**Researcher**: ryanhansen
**Git Commit**: 45876f3bcb1a3905b05f35abfb117535ddba1070
**Branch**: mastra-admin-rph-2
**Repository**: mastra

## Research Question

Analyze the `mastra-admin-example` branch implementation to extract learnings and create a more effective, surgical PRD for MastraAdmin that achieves the same result with less complexity.

## Executive Summary

After analyzing 50+ commits and ~110,000 lines of code from the `mastra-admin-example` branch, along with the original master plan and retrospective, this PRD proposes an **environment variable-based approach** that:

1. **Uses environment variables instead of code injection** - `MASTRA_CLOUD_TRACES_TARGET_DIR` activates FileExporter, `MASTRA_RUNNER_LOGS_TARGET_DIR` activates pino file target. No AdminBundler, works across all Mastra versions.

2. **Keeps full package structure** for adapter pluggability - Each adapter type (runner, router, source, storage) is a separate package so we can swap implementations later.

3. **Prioritizes file-based observability** - Traces and logs written to disk, ingested by worker into ClickHouse. No real-time streaming needed for observability (only for build logs during build).

4. **Uses subdomain-based routing** - `{project}-{branch}.{team}.mastra.local` from the start, backed by reverse proxy.

5. **Focuses on core flows** first: Teams → Projects → Deployments → Builds

---

## Vision & Purpose

### What MastraAdmin Does

**MastraAdmin is an enterprise-grade, self-hosted platform that enables organizations to run and operate many Mastra servers across their teams.**

### The Problem It Solves

| Open Source Mastra | Enterprise MastraAdmin |
|-------------------|------------------------|
| Single Mastra server | Many Mastra servers across teams |
| Self-managed deployment | Managed deployments with build queue |
| No multi-tenancy | Teams, users, RBAC |
| Manual observability setup | Centralized observability across all projects |
| DIY routing | Edge routing with human-readable URLs |
| No preview environments | Branch deployments and PR previews |

### The Enterprise Use Case

```
Company (Enterprise)
└── MastraAdmin (self-hosted)
    │
    ├── Team: Search Ranking
    │   └── Project: job-matching-agent
    │       ├── production → job-matching-agent.search.mastra.local
    │       └── preview/pr-456 → pr-456.job-matching-agent.search.mastra.local
    │
    └── Team: Customer Support
        └── Project: support-chatbot
            └── production → support-chatbot.support.mastra.local
```

---

## Key Learnings from Attempt 1

The `mastra-admin-example` branch revealed critical implementation gaps:

### 1. AdminBundler is a Dead End

**Problem**: Attempt 1 tried to inject `FileExporter` at build time via `AdminBundler`. This was a nightmare:
- Cross-version compatibility issues (Mastra v1 vs v2 APIs)
- Complex entry code generation
- Tight coupling between admin and deployed servers
- Version detection logic was fragile

**Solution for V2**: Environment variable-based configuration instead of build-time injection:
- `MASTRA_CLOUD_TRACES_TARGET_DIR` - When set, FileExporter writes spans to this directory
- `MASTRA_RUNNER_LOGS_TARGET_DIR` - When set, pino logger writes logs to this directory

The FileExporter is **baked into the default exporters** in `@mastra/observability`. When the env var is present, it activates automatically. No injection needed.

```typescript
// In deployed Mastra server, these env vars are set by the runner:
// MASTRA_CLOUD_TRACES_TARGET_DIR=/tmp/mastra/builds/build_123/observability/spans
// MASTRA_RUNNER_LOGS_TARGET_DIR=/tmp/mastra/builds/build_123/observability/logs

// The default observability system automatically:
// 1. Detects MASTRA_CLOUD_TRACES_TARGET_DIR and enables FileExporter
// 2. Detects MASTRA_RUNNER_LOGS_TARGET_DIR and configures pino to write there
```

### 2. File-Based Observability (Not Real-Time Streaming)

**Original Plan**: WebSocket streaming for logs and traces
**Reality**: File-based approach is more reliable and simpler

**Data Flow**:
```
Deployed Server → FileExporter → JSONL files → IngestionWorker → ClickHouse
```

**Benefits**:
- Survives admin server restarts
- Decoupled write/read paths
- Natural batching for ClickHouse bulk inserts
- No tight coupling between processes

### 3. Project Source MUST Copy to Temp Directory

**Problem in Attempt 1**: `getProjectPath()` returned source path directly, causing:
- Build artifacts in source directory
- No fresh `node_modules`
- Can't run concurrent builds

**Solution**: Always copy to `{os.tmpdir()}/mastra/builds/{buildId}/`

### 4. JSONB Columns Need Defensive Checks

**Error**: `deployment.envVarOverrides.map is not a function`
**Cause**: JSONB can be null, empty object, or malformed
**Solution**: Always use `Array.isArray()` before array methods

### 5. WebSocket Requires Manual HTTP Server

**Problem**: Hono's built-in `serve()` doesn't support WebSocket upgrade
**Solution**: Create HTTP server manually, attach WebSocket server

### 6. State Recovery on Restart

**Problem**: In-memory build queue lost on restart → builds stuck forever
**Solution**: Query DB for `status='queued'` builds on startup

---

## Architecture

### Package Strategy: Adapter Pattern Requires Full Separation

The package structure is **the most important part to get right**. Each adapter type needs its own package so we can plug in alternatives later (S3 storage, GitHub source, Kubernetes runner, Cloudflare router).

### Package Structure

```
packages/admin/                    → @mastra/admin (types, interfaces, MastraAdmin class)
packages/admin-server/             → @mastra/admin-server (HTTP API + WebSocket + Workers)
packages/admin-ui/                 → @mastra/admin-ui (Dashboard application)

stores/admin-pg/                   → @mastra/admin-pg (PostgreSQL storage adapter)

# Observability: File-based ingestion with storage adapters
observability/writer/              → @mastra/observability-writer (batched file writing)
observability/file-local/          → @mastra/observability-file-local (local filesystem adapter)
observability/file-s3/             → @mastra/observability-file-s3 (Amazon S3 - future)
observability/file-gcs/            → @mastra/observability-file-gcs (Google Cloud Storage - future)
observability/clickhouse/          → @mastra/observability-clickhouse (ClickHouse ingestion + queries)

# FileExporter baked into existing observability
observability/mastra/              → Add FileExporter to default exporters (env-var triggered)

runners/local/                     → @mastra/runner-local (LocalProcess runner)
runners/k8s/                       → @mastra/runner-k8s (Kubernetes runner - future)

routers/local/                     → @mastra/router-local (local reverse proxy with subdomain routing)
routers/cloudflare/                → @mastra/router-cloudflare (Cloudflare Tunnels - future)

sources/local/                     → @mastra/source-local (Local filesystem projects)
sources/github/                    → @mastra/source-github (GitHub App - future)
```

### Why Keep All Packages

1. **Adapter pluggability** - Swap `@mastra/runner-local` for `@mastra/runner-k8s` without changing admin-server
2. **Independent versioning** - Storage adapter bugs don't require admin-server release
3. **Clear boundaries** - Each package has single responsibility
4. **Testing isolation** - Test runner-local without spinning up full admin stack
5. **Future extensibility** - Add S3 file storage, GitHub source, etc.

---

## Core Data Model

### Entities

```typescript
interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;                    // Auto-generated from name
  sourceType: 'local' | 'github';
  sourceConfig: SourceConfig;      // JSONB
  defaultBranch: string;
  envVars: EncryptedEnvVar[];      // JSONB - ALWAYS check Array.isArray()
  createdAt: Date;
  updatedAt: Date;
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
  port: number | null;
  processId: number | null;
  envVarOverrides: EncryptedEnvVar[];  // JSONB - ALWAYS check Array.isArray()
  createdAt: Date;
  updatedAt: Date;
}

interface Build {
  id: string;
  deploymentId: string;
  trigger: 'manual' | 'webhook' | 'schedule';
  status: 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed';
  logPath: string | null;          // Path to log file (not stored in DB)
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}
```

### Relationships

```
Team (1) ─────┬───── (N) Project (1) ─────┬───── (N) Deployment (1) ─────── (N) Build
              │                           │
              └── TeamMember              └── envVarOverrides (JSONB)
```

---

## Implementation Phases

### Phase 1: Foundation [P0] - 2-3 days

**Goal**: Basic data model, storage, and project discovery working

**Tasks**:
1. Create `@mastra/admin` package with:
   - MastraAdmin class (central orchestrator)
   - Entity types (Team, Project, Deployment, Build)
   - Provider interfaces (AdminStorage, FileStorage, ProjectSourceProvider)
   - RBAC core implementation

2. Create `@mastra/admin-pg` package with:
   - PostgreSQL schema and migrations
   - Domain methods for all entities
   - Defensive JSONB deserialization (Array.isArray checks)

3. Create `@mastra/source-local` package with:
   - `LocalProjectSource` implementing `ProjectSourceProvider`
   - `DirectoryScanner` for walking configured base paths
   - `MastraProjectDetector` for identifying valid Mastra projects
   - `getProjectPath()` that **copies source to targetDir** (critical - don't return source path directly)
   - Configuration: `basePaths`, `include/exclude`, `maxDepth`
   - Optional `ProjectWatcher` for dev mode file watching

**Verification**:
- [ ] Can create team, project, deployment via direct class calls
- [ ] JSONB columns handle null/empty gracefully
- [ ] Migrations run successfully
- [ ] `source.listProjects()` discovers Mastra projects in configured directories
- [ ] `source.getProjectPath(project, targetDir)` copies project to target directory
- [ ] Detector correctly identifies projects with `@mastra/core` dependency

### Phase 2: Build System [P0] - 3-4 days

**Goal**: Can build and run a Mastra server with observability

**Tasks**:
1. Modify `observability/mastra/` to add FileExporter:
   - Extends BaseExporter
   - **Activated by `MASTRA_CLOUD_TRACES_TARGET_DIR` env var**
   - Writes spans to JSONL files in that directory
   - Baked into default exporter list (no injection needed)

2. Modify pino logger configuration:
   - **When `MASTRA_RUNNER_LOGS_TARGET_DIR` is set**, write logs to that directory
   - JSONL format for ingestion worker compatibility

3. Create `@mastra/runner-local`:
   - `ProjectBuilder` - **uses `source.getProjectPath(project, buildDir)`** to copy source to temp dir, installs deps, runs `mastra build`
   - `ProcessManager` - spawns/stops server processes
   - `PortAllocator` - manages ports 4100-4199
   - **Sets env vars when starting server**:
     - `MASTRA_CLOUD_TRACES_TARGET_DIR={buildDir}/observability/spans`
     - `MASTRA_RUNNER_LOGS_TARGET_DIR={buildDir}/observability/logs`
     - `PORT={allocated_port}`

4. BuildOrchestrator with queue recovery:
   - In-memory queue with DB-backed recovery
   - Query `status='queued'` on startup
   - **Injects `ProjectSourceProvider` from MastraAdmin config**

**Verification**:
- [ ] Build completes successfully
- [ ] Server starts with env vars set
- [ ] Spans written to `observability/spans/` (FileExporter activated)
- [ ] Logs written to `observability/logs/` (pino file target activated)
- [ ] Restart recovery re-queues pending builds
- [ ] Build uses copied project (not source directory)

### Phase 3: API & Routing [P0] - 2-3 days

**Goal**: Full HTTP API and subdomain-based routing working

**Tasks**:
1. Create `@mastra/admin-server` HTTP routes:
   - Teams CRUD
   - Projects CRUD (with slug auto-generation)
   - **GET /api/sources/projects** - list available projects from `ProjectSourceProvider`
   - Deployments CRUD + deploy/stop actions
   - Builds list + logs

2. Create `@mastra/router-local` with subdomain routing:
   - Reverse proxy on port 80 (or configurable PROXY_PORT)
   - Pattern: `{project}-{branch}.{team}.mastra.local`
   - Route registration/deregistration on deploy/stop
   - Requires `/etc/hosts` or local DNS for `*.mastra.local`

3. Build log streaming:
   - InMemoryLogCache with flush to file storage
   - WebSocket for real-time streaming (manual HTTP server)
   - CORS for all dev ports

**Verification**:
- [ ] All CRUD operations work via HTTP
- [ ] Deploy triggers build via API
- [ ] Build logs stream via WebSocket
- [ ] Deployed server accessible via `{project}-{branch}.{team}.mastra.local`

### Phase 4: Observability Ingestion [P1] - 2-3 days

**Goal**: Spans visible in queries

**Tasks**:
1. Create `@mastra/observability-clickhouse`:
   - ClickHouse schema (spans, logs tables)
   - IngestionWorker (polls JSONL files, bulk inserts)
   - QueryProvider (getSpansByTrace, getSpansByProject)

2. Wire observability routes:
   - GET /api/observability/spans
   - GET /api/observability/logs

**Verification**:
- [ ] IngestionWorker picks up JSONL files
- [ ] Spans appear in ClickHouse after agent execution
- [ ] Query API returns spans with projectId/deploymentId

### Phase 5: Admin UI [P1] - 3-4 days

**Goal**: Full flow works from UI

**Tasks**:
1. Create `@mastra/admin-ui`:
   - Team/Project/Deployment management pages
   - **Project creation with source selector** (calls `/api/sources/projects` to list available projects from `source-local`)
   - Build logs viewer with WebSocket
   - Observability dashboard (spans/logs)

2. Wire all UI actions to API:
   - Verify every button has onClick handler
   - Verify loading/error states

**Verification**:
- [ ] Complete flow: Create team → **Select project from source** → Create project → Deploy → View logs
- [ ] Project selector shows discovered Mastra projects
- [ ] Observability data displays correctly
- [ ] UI handles errors gracefully

---

## Critical Implementation Details

### 1. FileExporter - Environment Variable Activation

**Key Insight**: Instead of injecting FileExporter at build time (AdminBundler nightmare), we bake it into the default exporters and activate via environment variable.

Location: `observability/mastra/src/exporters/file.ts`

```typescript
export class FileExporter extends BaseExporter {
  name = 'file-exporter';

  constructor(config: FileExporterConfig) {
    super(config);

    // Disabled if no output path
    if (!config.outputPath) {
      this.setDisabled('No outputPath provided');
      return;
    }

    this.outputPath = config.outputPath;
    this.projectId = config.projectId ?? process.env.MASTRA_PROJECT_ID ?? 'unknown';
    this.deploymentId = config.deploymentId ?? process.env.MASTRA_DEPLOYMENT_ID ?? 'unknown';
  }
}

// In default observability setup (observability/mastra/src/default.ts):
function createDefaultExporters(): ObservabilityExporter[] {
  const exporters: ObservabilityExporter[] = [
    new DefaultExporter(),
    new CloudExporter(),
  ];

  // FileExporter activated by environment variable
  const tracesDir = process.env.MASTRA_CLOUD_TRACES_TARGET_DIR;
  if (tracesDir) {
    exporters.push(new FileExporter({
      outputPath: tracesDir,
      projectId: process.env.MASTRA_PROJECT_ID,
      deploymentId: process.env.MASTRA_DEPLOYMENT_ID,
    }));
  }

  return exporters;
}
```

**File Format**:
- Path: `{MASTRA_CLOUD_TRACES_TARGET_DIR}/{timestamp}_{uuid}.jsonl`
- Content: `{ "type": "span", "data": { ...SpanData } }` per line

### 2. Pino Logger - File Target via Environment Variable

When `MASTRA_RUNNER_LOGS_TARGET_DIR` is set, pino writes logs to that directory:

```typescript
// In pino configuration:
function createPinoConfig(): LoggerOptions {
  const logsDir = process.env.MASTRA_RUNNER_LOGS_TARGET_DIR;

  if (logsDir) {
    return {
      transport: {
        targets: [
          // Still write to console
          { target: 'pino-pretty', level: 'info' },
          // Also write to file
          {
            target: 'pino/file',
            options: {
              destination: path.join(logsDir, `${Date.now()}_${uuid()}.jsonl`),
              mkdir: true,
            },
            level: 'debug',
          },
        ],
      },
    };
  }

  return { /* default console config */ };
}
```

**File Format**:
- Path: `{MASTRA_RUNNER_LOGS_TARGET_DIR}/{timestamp}_{uuid}.jsonl`
- Content: Standard pino JSON log lines

### 3. Runner Sets Environment Variables

The `@mastra/runner-local` sets these env vars when starting a deployed server:

```typescript
// In runner-local ProcessSpawner:
async startServer(build: Build, deployment: Deployment, port: number): Promise<ChildProcess> {
  const buildDir = this.getBuildDir(build.id);
  const observabilityDir = path.join(buildDir, 'observability');

  return spawn('node', ['.mastra/output/index.mjs'], {
    cwd: buildDir,
    env: {
      ...process.env,
      ...deployment.envVars,

      // Port assignment
      PORT: String(port),

      // Observability configuration - triggers FileExporter
      MASTRA_CLOUD_TRACES_TARGET_DIR: path.join(observabilityDir, 'spans'),
      MASTRA_RUNNER_LOGS_TARGET_DIR: path.join(observabilityDir, 'logs'),

      // Context for file naming
      MASTRA_PROJECT_ID: deployment.projectId,
      MASTRA_DEPLOYMENT_ID: deployment.id,
    },
  });
}
```

### 4. @mastra/source-local Package

**Location**: `sources/local/`
**Implements in Phase**: Phase 1 (Foundation) - needed before builds can work

The source-local package discovers and provides access to Mastra projects on the local filesystem.

#### ProjectSourceProvider Interface (defined in @mastra/admin)

```typescript
interface ProjectSourceProvider {
  readonly type: 'local' | 'github' | string;

  // List available projects from configured directories
  listProjects(teamId: string): Promise<ProjectSource[]>;

  // Get a specific project by ID
  getProject(projectId: string): Promise<ProjectSource>;

  // Validate that a project source is accessible
  validateAccess(source: ProjectSource): Promise<boolean>;

  // Get local path - MUST copy to targetDir if provided
  getProjectPath(source: ProjectSource, targetDir?: string): Promise<string>;

  // Optional: Watch for file changes (dev mode)
  watchChanges?(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void;
}

interface ProjectSource {
  id: string;
  name: string;
  type: 'local' | 'github' | string;
  path: string;
  defaultBranch?: string;
  metadata?: Record<string, unknown>;
}
```

#### Key Classes

**LocalProjectSource** - Main provider implementation:
- Scans configured `basePaths` for Mastra projects
- Caches discovered projects (30s TTL)
- Copies projects to temp directory for builds
- Optional file watching for dev mode

**DirectoryScanner** - Finds Mastra projects:
- Walks directories up to `maxDepth`
- Excludes `node_modules`, `.git`, `dist`, etc.
- Uses `MastraProjectDetector` to identify valid projects

**MastraProjectDetector** - Identifies Mastra projects:
- Checks for `@mastra/core` in dependencies
- Detects package manager (npm, pnpm, yarn, bun)
- Finds mastra config files
- Extracts project metadata

#### Configuration

```typescript
interface LocalProjectSourceConfig {
  basePaths: string[];           // Directories to scan (required)
  include?: string[];            // Glob patterns to include (default: ['*'])
  exclude?: string[];            // Patterns to exclude (default: ['node_modules', '.git', ...])
  maxDepth?: number;             // Scan depth (default: 2)
  watchChanges?: boolean;        // Enable file watching (default: false)
  watchDebounceMs?: number;      // Debounce interval (default: 300)
}
```

#### When It's Used

1. **Project Creation UI**: User selects from discovered projects
   ```typescript
   // Admin UI calls this to show available projects
   const projects = await source.listProjects(teamId);
   ```

2. **Build Trigger**: Runner gets project path for building
   ```typescript
   // Runner calls this to copy project to temp dir
   const buildDir = `/tmp/mastra/builds/${buildId}`;
   const projectPath = await source.getProjectPath(project, buildDir);
   // projectPath === buildDir (project copied there)
   ```

3. **Validation**: Before creating project record
   ```typescript
   const isValid = await source.validateAccess(projectSource);
   ```

#### Critical: getProjectPath MUST Copy

**This was a bug in Attempt 1** - `getProjectPath()` returned the source path directly.

Correct implementation:
```typescript
async getProjectPath(source: ProjectSource, targetDir?: string): Promise<string> {
  // If no targetDir, return source path (for listing/validation only)
  if (!targetDir) {
    return source.path;
  }

  // MUST copy source to target directory for builds
  await copyDirectory(source.path, targetDir, {
    exclude: ['node_modules', '.git', 'dist', '.next', '.mastra'],
  });

  return targetDir;
}
```

**Why copying is required**:
- Fresh `node_modules` install per build
- Isolated build artifacts (`.mastra/` directory)
- Separate observability directory per deployment
- Supports concurrent builds of same project
- No pollution of source directory

#### Package Structure

```
sources/local/
├── src/
│   ├── index.ts              # Main export
│   ├── provider.ts           # LocalProjectSource class
│   ├── scanner.ts            # DirectoryScanner
│   ├── detector.ts           # MastraProjectDetector
│   ├── watcher.ts            # ProjectWatcher (optional dev mode)
│   ├── types.ts              # LocalProjectSourceConfig, etc.
│   └── utils.ts              # copyDirectory, resolvePath, etc.
├── package.json
└── tsconfig.json
```

#### Integration with Admin

```typescript
// In MastraAdmin configuration
const admin = new MastraAdmin({
  storage: new PostgresAdminStorage(DATABASE_URL),
  source: new LocalProjectSource({
    basePaths: [process.env.PROJECTS_DIR || '../'],
    watchChanges: process.env.NODE_ENV === 'development',
  }),
  runner: new LocalRunner(),
  router: new LocalRouter(),
});
```

### 5. Build Directory Structure

```
{os.tmpdir()}/mastra/builds/{buildId}/
├── src/                          # Copied from source
│   ├── package.json
│   └── src/mastra/index.ts
├── node_modules/                 # Fresh install
├── .mastra/
│   └── output/                   # Build artifacts from `mastra build`
│       └── index.mjs             # Standard Mastra build output (no special injection)
└── observability/                # Created by runner, sibling to .mastra/
    ├── spans/
    │   └── {timestamp}_{uuid}.jsonl  # Written by FileExporter (env-var activated)
    └── logs/
        └── {timestamp}_{uuid}.jsonl  # Written by pino (env-var activated)
```

**Critical**: `observability/` is sibling to `.mastra/` because `mastra build` recreates `.mastra/`.

### 4. State Recovery Pattern

```typescript
// AdminServer.start()
async start() {
  // 1. Recover build queue
  const queuedBuilds = await this.storage.builds.list({ status: 'queued' });
  for (const build of queuedBuilds) {
    this.orchestrator.queueBuild(build.id);
  }

  // 2. Recover running servers
  const runningDeployments = await this.storage.deployments.list({ status: 'running' });
  for (const deployment of runningDeployments) {
    if (deployment.processId && await isProcessAlive(deployment.processId)) {
      this.processManager.reattach(deployment);
    } else {
      await this.storage.deployments.update(deployment.id, { status: 'stopped' });
    }
  }

  // 3. Start workers
  this.buildWorker.start();
  this.ingestionWorker.start();

  // 4. Start HTTP server
  this.httpServer.listen(3001);
}
```

### 5. JSONB Defensive Pattern

```typescript
// ALWAYS use this pattern for JSONB array columns
function safeArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  return Array.isArray(value) ? value : defaultValue;
}

// Usage
const envVars = safeArray(project.envVars);
const overrides = safeArray(deployment.envVarOverrides);
```

### 6. Port Allocation

| Component | Port | Purpose |
|-----------|------|---------|
| Admin Server | 3001 | HTTP API + WebSocket |
| Admin UI | 3002 | Vite dev server |
| Reverse Proxy | 80 (or PROXY_PORT) | Subdomain-based routing |
| Deployed servers | 4100-4199 | Individual Mastra servers |
| PostgreSQL | 5433 | Database |
| ClickHouse | 8123 | HTTP queries |

### 7. Subdomain-Based Routing

Pattern: `{project}-{branch}.{team}.mastra.local`

```
Request: http://job-agent-main.search.mastra.local/api/agents
         │       │      │     │        │
         │       │      │     │        └── Base domain
         │       │      │     └─────────── Team slug
         │       │      └───────────────── Branch
         │       └──────────────────────── Project slug
         └──────────────────────────────── Reverse proxy (port 80)

Proxy resolves to: http://localhost:4101/api/agents
```

**Local Development Setup**:
1. Add to `/etc/hosts`: `127.0.0.1 *.mastra.local` (or use dnsmasq)
2. Or use a local DNS like `*.localhost` which Chrome resolves automatically

**Route Registration**:
```typescript
// When deployment starts
await router.register({
  subdomain: `${project.slug}-${deployment.branch}.${team.slug}`,
  targetPort: deployment.port,
  targetHost: 'localhost',
});

// Generates publicUrl: https://job-agent-main.search.mastra.local
```

---

## Environment Variables

### Admin Server Configuration

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `DATABASE_URL` | - | Yes | PostgreSQL connection |
| `CLICKHOUSE_URL` | `http://localhost:8123` | No | ClickHouse HTTP endpoint |
| `PROJECTS_DIR` | `../` | No | Base directory for local projects |
| `FILE_STORAGE_PATH` | `./.mastra/storage` | No | File storage path |
| `ADMIN_PORT` | `3001` | No | Admin server port |
| `PROXY_PORT` | `80` | No | Reverse proxy port |

### Deployed Server Configuration (Set by Runner)

These env vars are set by `@mastra/runner-local` when starting a deployed server:

| Variable | Example Value | Purpose |
|----------|--------------|---------|
| `MASTRA_CLOUD_TRACES_TARGET_DIR` | `/tmp/mastra/builds/build_123/observability/spans` | Activates FileExporter, writes spans here |
| `MASTRA_RUNNER_LOGS_TARGET_DIR` | `/tmp/mastra/builds/build_123/observability/logs` | Activates pino file target, writes logs here |
| `MASTRA_PROJECT_ID` | `proj_abc123` | Included in span/log metadata |
| `MASTRA_DEPLOYMENT_ID` | `dep_xyz789` | Included in span/log metadata |
| `PORT` | `4101` | Server port (from PortAllocator) |

---

## Observability Data Flow (Environment Variable Approach)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENV VAR TRIGGERS FILE-BASED OBSERVABILITY                │
│                    (No code injection, works across all Mastra versions)    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Runner starts deployed server with env vars:                               │
│  ─────────────────────────────────────────────                              │
│  MASTRA_CLOUD_TRACES_TARGET_DIR=/tmp/mastra/builds/build_123/obs/spans      │
│  MASTRA_RUNNER_LOGS_TARGET_DIR=/tmp/mastra/builds/build_123/obs/logs        │
│  MASTRA_PROJECT_ID=proj_abc123                                              │
│  MASTRA_DEPLOYMENT_ID=dep_xyz789                                            │
│                                                                             │
│  Deployed Mastra Server (user's code, unchanged)                            │
│  ────────────────────────────────────────────────                           │
│  • Mastra core detects MASTRA_CLOUD_TRACES_TARGET_DIR                       │
│  • FileExporter automatically added to exporters                            │
│  • Pino detects MASTRA_RUNNER_LOGS_TARGET_DIR                               │
│  • Logs written to file instead of just console                             │
│                                                                             │
│  agent.generate() → FileExporter → {TRACES_DIR}/{timestamp}_{uuid}.jsonl   │
│  console.log()    → Pino file    → {LOGS_DIR}/{timestamp}_{uuid}.jsonl     │
│                                                   │                         │
│                                                   ▼                         │
│                               ┌──────────────────────────────────┐          │
│                               │    IngestionWorker (polls 10s)   │          │
│                               │    • Lists JSONL files           │          │
│                               │    • Parses lines                │          │
│                               │    • Attaches projectId, depId   │          │
│                               │    • Bulk inserts to ClickHouse  │          │
│                               │    • Deletes processed files     │          │
│                               └──────────────────────────────────┘          │
│                                                   │                         │
│                                                   ▼                         │
│                               ┌──────────────────────────────────┐          │
│                               │           ClickHouse             │          │
│                               │  • mastra_admin_spans            │          │
│                               │  • mastra_admin_logs             │          │
│                               └──────────────────────────────────┘          │
│                                                   │                         │
│                                                   ▼                         │
│                               ┌──────────────────────────────────┐          │
│                               │         Admin UI                 │          │
│                               │  • Queries via REST API          │          │
│                               │  • Look-forward polling for new  │          │
│                               │  • No WebSocket needed           │          │
│                               └──────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Build Log Architecture (Hybrid Approach)

Build logs need:
1. **Real-time streaming** during build (WebSocket to UI)
2. **Persistence** after build (for later viewing)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUILD LOGS: HYBRID STREAMING + PERSISTENCE               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BuildWorker.executeCommand()                                               │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  onLog callback                                                      │   │
│  │  ┌──────────────┐    ┌──────────────┐                               │   │
│  │  │ logCache     │    │ WebSocket    │                               │   │
│  │  │ .append()    │    │ .broadcast() │                               │   │
│  │  └──────────────┘    └──────────────┘                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                      │                                          │
│           │                      └──► Admin UI (real-time during build)     │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  On build complete:                                                  │   │
│  │  logCache.flush() → file-storage/builds/{buildId}/build.log          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  For historical viewing:                                                    │
│  GET /api/builds/:id/logs → fileStorage.read(build.logPath)                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What's Different from Attempt 1

| Aspect | Attempt 1 | V2 Approach |
|--------|-----------|-------------|
| **Observability injection** | AdminBundler (build-time code injection) | Environment variables (MASTRA_CLOUD_TRACES_TARGET_DIR) |
| **Runner logs** | Capture stdout/stderr | Pino writes to disk (MASTRA_RUNNER_LOGS_TARGET_DIR) |
| **Cross-version compat** | Version detection + different entry code | No version concerns - env vars work everywhere |
| **FileExporter activation** | Injected at build time | Baked into defaults, activated by env var |
| **Observability streaming** | WebSocket for everything | File-based for traces/logs, WebSocket only for build logs |
| **Routing** | Subdomain-based | Subdomain-based (same, but with better DNS docs) |
| **Package structure** | 14+ packages | Keep all packages for adapter pluggability |
| **State recovery** | Missing | Explicit startup recovery |
| **JSONB handling** | Assumed arrays | Defensive Array.isArray() checks |

### Key Insight: Environment Variables > Code Injection

The AdminBundler approach tried to generate different wrapper code for different Mastra versions. This was fragile because:
1. Mastra v1 and v2 have different observability APIs
2. Future versions might change again
3. Entry code generation is complex and error-prone

Environment variables are version-agnostic:
- Mastra core checks for `MASTRA_CLOUD_TRACES_TARGET_DIR`
- If present, FileExporter is added to exporters
- Works regardless of how user configured their Mastra instance
- No code generation needed

---

## Success Criteria

### Phase 1 Complete When:
- [ ] `pnpm build:admin` succeeds
- [ ] Database migrations create all tables
- [ ] Unit tests pass for storage layer

### Phase 2 Complete When:
- [ ] Build command completes successfully
- [ ] Server starts with MASTRA_CLOUD_TRACES_TARGET_DIR env var set
- [ ] FileExporter activates and writes spans to disk
- [ ] Pino writes logs to disk (MASTRA_RUNNER_LOGS_TARGET_DIR)
- [ ] Health check passes

### Phase 3 Complete When:
- [ ] All CRUD APIs work
- [ ] Deploy triggers build → server starts
- [ ] Build logs stream via WebSocket
- [ ] Deployed server accessible via subdomain (e.g., `myapp-main.team.mastra.local`)

### Phase 4 Complete When:
- [ ] IngestionWorker processes JSONL files
- [ ] Spans appear in ClickHouse
- [ ] Query API returns correct data

### Phase 5 Complete When:
- [ ] UI buttons all wired to API
- [ ] Full flow works end-to-end
- [ ] Error handling throughout

---

## Code References

### From mastra-admin-example Branch (Reference Only)

| Component | File | Notes |
|-----------|------|-------|
| FileExporter | `observability/mastra/src/exporters/file.ts` | Good reference, but needs env var activation |
| ProjectBuilder | `runners/local/src/build/builder.ts` | Useful patterns for build process |
| IngestionWorker | `observability/clickhouse/src/ingestion/worker.ts` | Keep this approach |
| Master Plan v1 | `thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md` | Historical reference |
| Master Plan v2 | `thoughts/shared/plans/2025-01-26-mastra-admin-master-plan-v2.md` | Historical reference |
| Retrospective | `thoughts/retro/mastra-admin-attempt-1.md` | Critical learnings |

### Existing Mastra Code to Modify

| Component | File | Change Needed |
|-----------|------|---------------|
| Default exporters | `observability/mastra/src/default.ts` | Add FileExporter when env var present |
| BaseExporter | `observability/mastra/src/exporters/base.ts` | Base class for FileExporter |
| Pino logger config | `packages/core/src/logger/` | Add file target when env var present |
| Server patterns | `packages/server/src/index.ts` | HTTP API patterns to follow |
| Storage patterns | `stores/pg/src/storage/index.ts` | PostgreSQL patterns to follow |

---

## Open Questions

1. **Local DNS for subdomains**: How do users configure `*.mastra.local` on their machines?
   - Option A: Edit `/etc/hosts` (doesn't support wildcards natively)
   - Option B: Use dnsmasq for wildcard resolution
   - Option C: Use `*.localhost` which Chrome resolves automatically
   - Need to document recommended approach

2. **GitHub source**: When implementing GitHub source, need webhook handling for auto-deploy. Defer to future phase.

3. **RBAC granularity**: Current plan has basic team/project/deployment permissions. More granular RBAC (e.g., per-environment) may be needed.

4. **License validation**: How does license key work? Need to define license tiers and feature gating.

5. **Pino file rotation**: When `MASTRA_RUNNER_LOGS_TARGET_DIR` is set, how do we handle log rotation? Need to ensure logs don't fill disk.

---

## Related Research

- `thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md` - Original comprehensive plan
- `thoughts/shared/plans/2025-01-26-mastra-admin-master-plan-v2.md` - Iteration with AdminBundler details
- `thoughts/retro/mastra-admin-attempt-1.md` - Learnings from implementation attempt

---

## Conclusion

This V2 approach improves on Attempt 1 by:

1. **Environment variables instead of code injection** - FileExporter activated by `MASTRA_CLOUD_TRACES_TARGET_DIR`, pino activated by `MASTRA_RUNNER_LOGS_TARGET_DIR`. No AdminBundler, no cross-version compatibility nightmares.

2. **File-based observability** - Simpler and more reliable than real-time streaming. IngestionWorker polls files and inserts to ClickHouse. UI uses look-forward polling for new data.

3. **Subdomain-based routing from start** - `{project}-{branch}.{team}.mastra.local` pattern with proper local DNS documentation.

4. **Full package structure for adapter pluggability** - Keep all packages separate so we can swap local runner for K8s, local router for Cloudflare, local source for GitHub, etc.

5. **Learning from attempt 1** - Defensive JSONB handling, explicit state recovery on restart, proper WebSocket setup.

The key insight is that **environment variables are version-agnostic**. The deployed Mastra server doesn't need any special build steps - it just needs the right env vars set when it starts, and the observability automatically flows to files that the admin system can ingest.
