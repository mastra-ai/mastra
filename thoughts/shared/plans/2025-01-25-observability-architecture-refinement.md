---
date: 2026-01-25T06:15:00Z
author: Claude
status: draft
topic: "Observability Architecture Refinement"
tags: [plan, observability, build-logs, server-logs, clickhouse]
---

# Observability Architecture Refinement Plan

## Overview

Refine the observability architecture to separate concerns:

1. **Build Logs** → Real-time WebSocket + File Storage (fs/s3/gcs)
2. **Server Logs + Observability** → File Storage → ClickHouse

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         BUILD LOGS FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   BuildWorker                    WebSocket                   File Storage        │
│   ┌──────────────┐              ┌──────────────┐            ┌─────────────────┐ │
│   │ Build        │   real-time  │ Broadcast to │            │ Local FS        │ │
│   │ stdout/stderr│ ───────────► │ subscribers  │            │ Amazon S3       │ │
│   │              │              └──────────────┘            │ Google GCS      │ │
│   │              │                                          └────────┬────────┘ │
│   │              │                                                   │          │
│   │ Build Done   │ ──── flush complete log ────────────────────────►│          │
│   └──────────────┘                                                              │
│                                                                                  │
│   Retrieval: GET /builds/:id/logs → Read from File Storage (full log)           │
│   No ClickHouse needed - simple file retrieval with adapter pattern             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                    SERVER LOGS + OBSERVABILITY FLOW                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Running Server           File Storage              Ingestion Worker            │
│   ┌──────────────┐        ┌─────────────────┐       ┌──────────────────────┐    │
│   │ stdout/stderr│        │ {tempDir}/       │       │ Watch for files      │    │
│   │ traces       │ ─────► │ .mastra/         │ ────► │ Bulk insert to CH    │    │
│   │ spans        │        │ observability/   │       │ Move to processed/   │    │
│   │ logs         │        │                  │       └──────────┬───────────┘    │
│   │ metrics      │        │ JSONL format     │                  │               │
│   │ scores       │        └─────────────────┘                  ▼               │
│   └──────────────┘                                   ┌──────────────────────┐    │
│                                                      │     ClickHouse       │    │
│                                                      │ - Aggregation        │    │
│                                                      │ - Sorting            │    │
│                                                      │ - Time-series        │    │
│                                                      └──────────────────────┘    │
│                                                                                  │
│   Retrieval: GET /projects/:id/logs|traces|metrics → Query ClickHouse           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                         TEMP DIRECTORY STRUCTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Uses os.tmpdir() for cross-platform system temp directory:                     │
│   - macOS: /var/folders/<user>/T/mastra/builds/{buildId}/                        │
│   - Linux: /tmp/mastra/builds/{buildId}/                                         │
│   - Windows: C:\Users\<user>\AppData\Local\Temp\mastra\builds\{buildId}\         │
│                                                                                  │
│   {os.tmpdir()}/mastra/builds/{buildId}/                                         │
│   ├── src/                      # Copied source code                             │
│   │   ├── package.json                                                           │
│   │   ├── src/                                                                   │
│   │   └── ...                                                                    │
│   ├── node_modules/             # Fresh install each build                       │
│   ├── .mastra/                  # Created by `mastra build` CLI                  │
│   │   ├── output/               # Build artifacts (index.mjs, etc.)              │
│   │   └── ...                   # Other build artifacts                          │
│   ├── observability/            # Server runtime observability (sibling to .mastra) │
│   │   ├── logs/                 # Server stdout/stderr logs                      │
│   │   │   └── {timestamp}_{uuid}.jsonl                                           │
│   │   ├── traces/               # Distributed traces                             │
│   │   │   └── {timestamp}_{uuid}.jsonl                                           │
│   │   └── metrics/              # Performance metrics                            │
│   │       └── {timestamp}_{uuid}.jsonl                                           │
│   └── .mastra-meta.json         # Build metadata (commit, env vars hash, etc.)   │
│                                                                                  │
│   Note: observability/ is created during deploy, not build, because             │
│   `mastra build` CLI recreates .mastra/ and would overwrite any subdirectories  │
│                                                                                  │
│   Configurable via config.buildBaseDir (defaults to os.tmpdir()/mastra)          │
│                                                                                  │
│   Benefits:                                                                      │
│   - Cross-platform (works on macOS, Linux, Windows)                              │
│   - System-managed cleanup policies                                              │
│   - Fresh node_modules each build                                                │
│   - Isolated observability per deployment                                        │
│   - Easy local debugging (inspect temp dirs - persist until reboot)              │
│   - Completely outside source directory                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Tasks

### Phase 1: Temp Directory & Project Copy [x]

#### Task 1.1: Update LocalProjectSource to Copy to Target Directory [x]

**File**: `sources/local/src/provider.ts`

Change `getProjectPath()` to actually copy when targetDir is provided:

```typescript
async getProjectPath(source: ProjectSource, targetDir?: string): Promise<string> {
  if (!(await this.validateAccess(source))) {
    throw new Error(`Project path is not accessible: ${source.path}`);
  }

  // If no targetDir, return source path (for listing/validation only)
  if (!targetDir) {
    return source.path;
  }

  // Copy source to target directory
  await this.copyProject(source.path, targetDir);
  return targetDir;
}

private async copyProject(sourcePath: string, targetDir: string): Promise<void> {
  // Use rsync-like copy (exclude node_modules, .git, etc.)
  await fs.mkdir(targetDir, { recursive: true });

  const excludes = ['node_modules', '.git', 'dist', '.next', '.turbo', '.mastra'];

  // Could use fs-extra copySync with filter, or spawn rsync
  await copyDirectory(sourcePath, targetDir, { exclude: excludes });
}
```

#### Task 1.2: Update Runner to Use Temp Directory Structure [x]

**File**: `runners/local/src/runner.ts`

```typescript
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// In config
interface LocalProcessRunnerConfig {
  // ... existing config
  buildBaseDir?: string; // Defaults to os.tmpdir()/mastra
}

// In runner
private getBuildDir(buildId: string): string {
  const baseDir = this.config.buildBaseDir ?? join(tmpdir(), 'mastra');
  return join(baseDir, 'builds', buildId);
}

async build(project: Project, build: Build, options?: BuildOptions, onLog?: LogStreamCallback): Promise<Build> {
  // Build directory uses system temp (configurable)
  const buildDir = this.getBuildDir(build.id);
  const projectPath = await this.getProjectPath(project, buildDir);

  // Create .mastra subdirectories
  await fs.mkdir(path.join(projectPath, '.mastra/output'), { recursive: true });
  await fs.mkdir(path.join(projectPath, '.mastra/logs'), { recursive: true });
  await fs.mkdir(path.join(projectPath, '.mastra/observability'), { recursive: true });

  // Write build metadata
  await this.writeBuildMetadata(projectPath, build);

  // Run the build
  const result = await this.projectBuilder.build(project, build, projectPath, options, onLog);

  return result;
}

async deploy(project: Project, deployment: Deployment, build: Build, options?: RunOptions): Promise<RunningServer> {
  // Deploy from the build's temp directory
  const buildDir = this.getBuildDir(build.id);
  const outputDir = join(buildDir, '.mastra/output');
  const observabilityDir = join(buildDir, '.mastra/observability');

  // ... rest of deploy logic
}
```

### Phase 2: Build Logs to File Storage [x]

#### Task 2.1: Create BuildLogWriter [x]

**New File**: `packages/admin/src/logs/build-log-writer.ts`

```typescript
import type { FileStorageProvider } from './file-storage';

export interface BuildLogWriterConfig {
  fileStorage: FileStorageProvider;
  basePath?: string; // Default: 'builds'
}

export class BuildLogWriter {
  private readonly fileStorage: FileStorageProvider;
  private readonly basePath: string;
  private buffers: Map<string, string[]> = new Map();

  constructor(config: BuildLogWriterConfig) {
    this.fileStorage = config.fileStorage;
    this.basePath = config.basePath ?? 'builds';
  }

  /**
   * Append a log line (buffered in memory).
   * Call flush() when build completes.
   */
  append(buildId: string, line: string): void {
    if (!this.buffers.has(buildId)) {
      this.buffers.set(buildId, []);
    }
    this.buffers.get(buildId)!.push(line);
  }

  /**
   * Flush all buffered logs to file storage.
   * Call this when build completes (success or failure).
   */
  async flush(buildId: string): Promise<string> {
    const lines = this.buffers.get(buildId) ?? [];
    const content = lines.join('\n');

    const path = `${this.basePath}/${buildId}/build.log`;
    await this.fileStorage.write(path, content);

    // Clear buffer
    this.buffers.delete(buildId);

    return path;
  }

  /**
   * Read complete build log from file storage.
   */
  async read(buildId: string): Promise<string> {
    const path = `${this.basePath}/${buildId}/build.log`;
    const content = await this.fileStorage.read(path);
    return content.toString('utf-8');
  }

  /**
   * Check if build log exists.
   */
  async exists(buildId: string): Promise<boolean> {
    const path = `${this.basePath}/${buildId}/build.log`;
    return this.fileStorage.exists(path);
  }

  /**
   * Delete build logs (for retention policy).
   */
  async delete(buildId: string): Promise<void> {
    const path = `${this.basePath}/${buildId}`;
    // Delete entire build directory
    const files = await this.fileStorage.list(path);
    for (const file of files) {
      await this.fileStorage.delete(file.path);
    }
  }
}
```

#### Task 2.2: Update BuildOrchestrator to Use BuildLogWriter [x]

**File**: `packages/admin/src/orchestrator/build-orchestrator.ts`

```typescript
export class BuildOrchestrator {
  #buildLogWriter?: BuildLogWriter;

  constructor(config: BuildOrchestratorConfig) {
    // ... existing init
    if (config.fileStorage) {
      this.#buildLogWriter = new BuildLogWriter({ fileStorage: config.fileStorage });
    }
  }

  private async executeBuild(buildId: string): Promise<void> {
    // ... existing setup

    const updatedBuild = await this.#runner.build(project, build, { envVars }, log => {
      // Buffer logs for file storage
      this.#buildLogWriter?.append(buildId, log);

      // Broadcast via WebSocket (real-time)
      this.#onLog?.(buildId, log);
    });

    // Flush to file storage when build completes
    if (this.#buildLogWriter) {
      const logPath = await this.#buildLogWriter.flush(buildId);
      await this.#storage.updateBuild(buildId, { logPath });
    }

    // ... rest of deploy logic
  }
}
```

#### Task 2.3: Update Build Logs Route to Read from File Storage [x]

**File**: `packages/admin-server/src/routes/builds.ts`

```typescript
export const GET_BUILD_LOGS_ROUTE: AdminServerRoute = {
  // ...
  handler: async params => {
    const { admin, userId } = params;
    const { buildId } = params as AdminServerContext & { buildId: string };

    const build = await admin.getBuild(userId, buildId);

    // If build has logPath, read from file storage
    if (build.logPath) {
      const fileStorage = admin.getFileStorage();
      const logs = await fileStorage.read(build.logPath);
      return {
        buildId,
        logs: logs.toString('utf-8'),
        complete: build.status !== 'building' && build.status !== 'queued',
      };
    }

    // Fallback to in-progress logs from buffer (during build)
    const orchestrator = admin.getOrchestrator();
    const bufferedLogs = orchestrator.getBufferedLogs(buildId);

    return {
      buildId,
      logs: bufferedLogs ?? '',
      complete: false,
    };
  },
};
```

### Phase 3: Server Logs to File Storage [x]

#### Task 3.1: Connect Runner Log Collector to File Writer

**File**: `runners/local/src/runner.ts`

```typescript
async deploy(/* ... */): Promise<RunningServer> {
  // ... existing setup

  const buildDir = this.getBuildDir(build.id);
  const observabilityDir = join(buildDir, '.mastra/observability');

  // Create ObservabilityWriter for this deployment
  const observabilityWriter = new ObservabilityWriter({
    fileStorage: new LocalFileStorage({ baseDir: observabilityDir }),
    projectId: project.id,
    deploymentId: deployment.id,
  });

  // Create log collector that also writes to observability
  const logCollector = new LogCollector(this.config.logRetentionLines);

  // Wire log collector to observability writer
  logCollector.stream((line) => {
    observabilityWriter.recordLog({
      id: crypto.randomUUID(),
      projectId: project.id,
      deploymentId: deployment.id,
      level: this.detectLogLevel(line),
      message: line,
      timestamp: new Date(),
      attributes: {},
    });
  });

  // Start the server process
  const proc = spawnCommand(process.execPath, [entryPoint], {
    cwd: outputDir,
    env: envVars,
    onOutput: (line: string) => logCollector.append(line),
  });

  // Store observability writer for cleanup
  this.observabilityWriters.set(serverId, observabilityWriter);

  // ... rest of deploy
}

async stop(server: RunningServer): Promise<void> {
  // Flush observability before stopping
  const writer = this.observabilityWriters.get(server.id);
  if (writer) {
    await writer.shutdown();
    this.observabilityWriters.delete(server.id);
  }

  // ... existing stop logic
}
```

#### Task 3.2: Wire Server Logs to WebSocket

**File**: `packages/admin-server/src/server.ts`

```typescript
async start(): Promise<void> {
  // ... existing setup

  // Wire runner log streaming to WebSocket
  const runner = this.admin.getRunner();
  if (runner && this.serverLogStreamer) {
    // When a new server starts, subscribe to its logs
    runner.on('server:started', (server: RunningServer) => {
      runner.streamLogs(server, (line) => {
        this.serverLogStreamer?.broadcastLog(server.id, line);
      });
    });
  }
}
```

### Phase 4: ClickHouse Integration [x]

#### Task 4.1: Add ClickHouse to docker-compose

**File**: `examples/admin/docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    # ... existing postgres config

  clickhouse:
    image: clickhouse/clickhouse-server:24
    container_name: mastra-admin-clickhouse
    environment:
      CLICKHOUSE_DB: mastra_observability
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: clickhouse
    ports:
      - "8123:8123"  # HTTP
      - "9000:9000"  # Native
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    healthcheck:
      test: ["CMD", "clickhouse-client", "--query", "SELECT 1"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  clickhouse_data:
```

#### Task 4.2: Create Ingestion Worker

**File**: `observability/clickhouse/src/ingestion/worker.ts`

Worker that:
1. Watches file storage for new JSONL files
2. Reads and parses files in batches
3. Bulk inserts into ClickHouse
4. Moves processed files to `processed/` directory

(Use existing implementation from `observability/clickhouse/` if available, or implement per master plan LANE 3c)

#### Task 4.3: Connect Observability Routes to ClickHouse

**File**: `packages/admin-server/src/routes/observability.ts`

Update routes to query ClickHouse instead of returning empty results.

### Phase 5: Example Updates [x]

#### Task 5.1: Update examples/admin/src/server.ts

```typescript
// Initialize file storage for build logs
const buildLogStorage = new LocalFileStorage({
  baseDir: resolve(process.cwd(), '.mastra/build-logs'),
});

// Initialize file storage for observability
const observabilityStorage = new LocalFileStorage({
  baseDir: resolve(process.cwd(), '.mastra/observability'),
});

// Create MastraAdmin
const admin = new MastraAdmin({
  // ... existing config
  buildLogs: {
    fileStorage: buildLogStorage,
  },
  observability: {
    fileStorage: observabilityStorage,
    // ClickHouse connection for queries
    clickhouse: {
      url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
      database: 'mastra_observability',
    },
  },
});
```

## File Changes Summary

| File | Change |
|------|--------|
| `sources/local/src/provider.ts` | Implement project copy to targetDir |
| `runners/local/src/runner.ts` | Use temp directory structure |
| `packages/admin/src/logs/build-log-writer.ts` | New - Build log file storage |
| `packages/admin/src/orchestrator/build-orchestrator.ts` | Use BuildLogWriter, flush on complete |
| `packages/admin-server/src/routes/builds.ts` | Read logs from file storage |
| `packages/admin-server/src/server.ts` | Wire server logs to WebSocket |
| `packages/admin-server/src/routes/observability.ts` | Connect to ClickHouse queries |
| `examples/admin/docker-compose.yml` | Add ClickHouse service |
| `examples/admin/src/server.ts` | Configure file storage adapters |

## Benefits

1. **Build logs**: Fast retrieval from file storage, easy retention policies (delete old files)
2. **Server logs + observability**: ClickHouse for powerful aggregation/sorting
3. **Temp directories**: Fresh installs, isolated observability, easy debugging
4. **Adapter pattern**: Swap fs/s3/gcs without code changes
5. **Real-time streaming**: WebSocket for live updates during builds
