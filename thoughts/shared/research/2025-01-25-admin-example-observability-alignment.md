---
date: 2026-01-25T05:45:40Z
researcher: Claude
git_commit: 9036a754cc7573c4904ec05e7f9efe0ee2860dd7
branch: mastra-admin-example
repository: mastra-admin-example
topic: "Admin Example Alignment with Enterprise Use Case - Running Server Observability"
tags: [research, codebase, observability, admin, enterprise-use-case]
status: complete
last_updated: 2025-01-25
last_updated_by: Claude
---

# Research: Admin Example Alignment with Enterprise Use Case - Running Server Observability

**Date**: 2026-01-25T05:45:40Z
**Researcher**: Claude
**Git Commit**: 9036a754cc7573c4904ec05e7f9efe0ee2860dd7
**Branch**: mastra-admin-example
**Repository**: mastra-admin-example

## Research Question

Compare the `examples/admin` implementation against the Enterprise Use Case documented in `thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md`, specifically focusing on observability of running servers.

User reported: "While running the example I am able to see build logs but the observability overall of the running servers is not [working]."

## Summary

The `examples/admin` implementation has the **infrastructure** for running server observability but several critical connections are missing:

1. **Build logs work for real-time streaming** because the BuildWorker actively broadcasts logs via WebSocket during the build process
2. **Build logs stored in PostgreSQL, not file storage** - they should be flushed to file storage to flow through the observability pipeline (file → ClickHouse)
3. **Server logs don't work** because the REST API returns empty and the WebSocket streaming isn't connected to the runner's log collection
4. **Observability queries (traces/logs/metrics/scores) return empty** because ClickHouse isn't set up and no query provider is connected
5. **Health checks work** (enabled by default at 30s intervals) but the UI may not be receiving updates due to WebSocket subscription issues
6. **LocalProjectSource builds in-place** - ignores the targetDir parameter, meaning no fresh installs and no isolated directory for observability data

## Detailed Findings

### Master Plan Requirements for Observability

From `thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md:158-201`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY DATA FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│   Mastra Projects          ObservabilityWriter         FileStorageProvider  │
│   ┌──────────────┐         ┌──────────────────┐        ┌─────────────────┐  │
│   │ traces       │         │ - Batches events │        │ Local Filesystem│  │
│   │ spans        │ ──────► │ - Writes JSONL   │ ─────► │ Amazon S3       │  │
│   │ logs         │         │ - Rotates files  │        │ Google GCS      │  │
│   │ metrics      │         └──────────────────┘        └─────────────────┘  │
│   │ scores       │                                              │           │
│   └──────────────┘                                              │           │
│                                              ▼           │
│                          ┌──────────────────────────────────────────────┐   │
│                          │            Ingestion Worker                  │   │
│                          │  - Watches for new files                     │   │
│                          │  - Bulk inserts to ClickHouse                │   │
│                          └──────────────────────────────────────────────┘   │
│                                              │                              │
│                                              ▼                              │
│                          ┌──────────────────────────────────────────────┐   │
│                          │              ClickHouse                      │   │
│                          └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

The master plan expects:
- **Running Server monitoring**: Health checks, resource metrics, server logs
- **Application Observability**: Traces, spans, logs, metrics, scores → ClickHouse

### Current Implementation Status

| Feature | Status | Details |
|---------|--------|---------|
| **Health Check Worker** | ✅ Working | Enabled by default, runs every 30s |
| **Resource Monitoring (CPU/Memory)** | ✅ Working | Via pidusage library |
| **WebSocket Infrastructure** | ✅ Working | AdminWebSocketServer with channel subscriptions |
| **Build Log Streaming** | ✅ Working | BuildWorker broadcasts via WebSocket |
| **Server Log Collection** | ✅ Implemented | LogCollector in runner with ring buffer |
| **Server Log REST API** | ❌ Returns Empty | Route doesn't call runner.getLogs() |
| **Server Log Streaming** | ❌ Not Connected | ServerLogStreamer exists but not wired to runner |
| **ClickHouse Setup** | ❌ Not Configured | docker-compose only has PostgreSQL |
| **Observability Queries** | ❌ Return Empty | No query provider connected |
| **Ingestion Worker** | ❌ Not Set Up | Master plan LANE 3c not implemented |
| **Build Logs to File Storage** | ❌ Goes to PostgreSQL | Should flush to file storage for observability pipeline |
| **Project Copy to Temp Dir** | ❌ Builds In-Place | LocalProjectSource ignores targetDir parameter |
| **Isolated Observability Dir** | ❌ Not Implemented | No clean location for run logs/metrics |

### Gap 1: Server Logs REST API Returns Empty

**File**: `packages/admin-server/src/routes/servers.ts:104-110`

```typescript
// Get logs - this would typically come from the runner
// For now, return empty logs
return {
  serverId,
  logs: '',
  hasMore: false,
};
```

The runner **does have** a `getLogs()` method at `runners/local/src/runner.ts:345-363`:

```typescript
async getLogs(
  server: RunningServer,
  options?: { tail?: number; since?: Date },
): Promise<string> {
  const tracked = this.processManager.get(server.id);
  if (!tracked) return '';

  if (options?.since) return tracked.logCollector.getSince(options.since);
  if (options?.tail) return tracked.logCollector.getTail(options.tail);
  return tracked.logCollector.getAll();
}
```

**What's Missing**: The route needs to call `runner.getLogs(server, { tail, since })` instead of returning empty.

### Gap 2: Server Log Streaming Not Connected

**Infrastructure exists**:
- `ServerLogStreamer` at `packages/admin-server/src/websocket/server-logs.ts:66-85`
- `LogCollector.stream()` at `runners/local/src/logs/collector.ts:81-87`

**What's Missing**: No code connects them. The runner's LogCollector notifies listeners when logs are appended, but nobody subscribes to it. Compare to build logs:

**Build logs work** because `packages/admin-server/src/server.ts:350-356`:
```typescript
orchestrator.on('build:log', (buildId, log) => {
  this.buildLogStreamer?.broadcastLog(buildId, log);
});
```

**Server logs would need** similar wiring:
```typescript
// Missing: When server starts, subscribe to log collector and broadcast
runner.streamLogs(server, (line) => {
  serverLogStreamer.broadcastLog(server.id, line);
});
```

### Gap 3: Observability Queries Return Empty

**File**: `packages/admin-server/src/routes/observability.ts:46-54, 109-117, 150-155, 189-198`

All observability routes return empty results with comments like:
```typescript
// Log queries would go through the query provider
// For now, return an empty result
return { data: [], total: 0, ... };
```

**What's Missing**:
1. ClickHouse not in docker-compose (`examples/admin/docker-compose.yml` only has PostgreSQL)
2. No `ClickHouseQueryProvider` instantiated
3. No routes connected to query provider

### Gap 4: No Ingestion Worker

The master plan's LANE 3c describes the Ingestion Worker that:
- Watches for new JSONL files from ObservabilityWriter
- Bulk inserts into ClickHouse
- Runs as background process or part of docker-compose

**Current state**: The example configures `LocalFileStorage` but there's no ingestion worker to process the files.

### What IS Working

#### Health Check Worker (`packages/admin-server/src/worker/health-checker.ts`)

The health check worker **is enabled by default** and:
- Runs every 30 seconds (configurable)
- Calls `runner.healthCheck()` for each running server
- Fetches resource usage via `runner.getResourceUsage()`
- Updates storage with health status
- Broadcasts via WebSocket to `server:{serverId}` channel

**Server startup** at `packages/admin-server/src/server.ts:371-378`:
```typescript
if (this.config.enableHealthWorker) {
  this.healthWorker = new HealthCheckWorker({
    admin: this.admin,
    wsServer: this.wsServer,
    intervalMs: this.config.healthCheckIntervalMs,
  });
  console.info(`Health check worker started (interval: ${this.config.healthCheckIntervalMs}ms)`);
}
```

#### Build Log Streaming (`packages/admin-server/src/worker/build-worker.ts`)

Build logs work because the BuildWorker:
1. Captures stdout/stderr during build process
2. Calls `broadcastLog()` for each line
3. WebSocket clients subscribed to `build:{buildId}` receive updates

## Code References

### Server Implementation
- `examples/admin/src/server.ts:107-126` - MastraAdmin configuration with observability
- `packages/admin-server/src/server.ts:371-378` - Health worker initialization

### Routes Returning Empty Data
- `packages/admin-server/src/routes/servers.ts:104-110` - Server logs (empty)
- `packages/admin-server/src/routes/observability.ts:46-54` - Traces (empty)
- `packages/admin-server/src/routes/observability.ts:109-117` - Logs (empty)
- `packages/admin-server/src/routes/observability.ts:150-155` - Metrics (empty)
- `packages/admin-server/src/routes/observability.ts:189-198` - Scores (empty)

### Existing Infrastructure (Not Connected)
- `runners/local/src/runner.ts:345-375` - getLogs() and streamLogs() methods
- `runners/local/src/logs/collector.ts:81-87` - LogCollector.stream() method
- `packages/admin-server/src/websocket/server-logs.ts:66-85` - ServerLogStreamer

### UI Components (Ready)
- `packages/admin-ui/src/components/servers/server-logs-viewer.tsx` - Log viewer
- `packages/admin-ui/src/components/servers/server-health-badge.tsx` - Health badge
- `packages/admin-ui/src/components/servers/server-status-card.tsx` - Status card
- `packages/admin-ui/src/components/servers/resource-usage.tsx` - CPU/Memory display
- `packages/admin-ui/src/hooks/servers/use-server-health-ws.ts` - WebSocket health hook
- `packages/admin-ui/src/hooks/servers/use-server-logs-ws.ts` - WebSocket logs hook

## Architecture Documentation

### Two Types of Observability

The master plan distinguishes between:

1. **Server Observability** (Infrastructure-level)
   - Health status of running processes
   - Resource usage (CPU, memory)
   - Server stdout/stderr logs
   - Lifecycle tracking (started, stopped)

2. **Application Observability** (Business logic-level)
   - Distributed traces and spans
   - Application logs (structured)
   - Performance metrics
   - Evaluation scores

The current implementation focuses on **server observability** infrastructure but has gaps in connecting the pieces. **Application observability** requires ClickHouse which isn't set up.

### Data Flow Comparison

**Working (Build Logs)**:
```
BuildWorker.executeCommand() → stdout/stderr
  → BuildWorker.broadcastLog()
  → BuildLogStreamer.broadcastLog()
  → WebSocket broadcast to build:{id}
  → UI receives via useBuildLogsWs()
```

**Not Working (Server Logs)**:
```
ChildProcess stdout/stderr
  → LogCollector.append()
  → [MISSING: nobody subscribes]
  → ServerLogStreamer.broadcastLog() [exists but never called]
  → WebSocket broadcast to server:{id}
  → UI would receive via useServerLogsWs()
```

## Related Research

- Master Plan: `thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md`
- LANE 3c (Ingestion Worker): Lines 1490-1584 of master plan
- LANE 9 (Admin UI): Lines 1923-2001 of master plan

## Additional Gaps (Follow-up Research)

### Gap 5: Build Logs Stored in PostgreSQL, Not File Storage

Build logs are currently stored directly to PostgreSQL via `storage.appendBuildLogs()`:

**File**: `packages/admin/src/orchestrator/build-orchestrator.ts:210-214`
```typescript
const updatedBuild = await this.#runner.build(project, build, { envVars }, log => {
  // Append logs as they come in
  void this.#storage.appendBuildLogs(buildId, log);
  // Broadcast via WebSocket if callback is set
  this.#onLog?.(buildId, log);
});
```

**Storage Implementation**: `stores/admin-pg/src/storage.ts:511-512`
```typescript
async appendBuildLogs(buildId: string, logs: string): Promise<void> {
  await this.buildsPg.appendBuildLogs(buildId, logs);
}
```

**What's Missing**: Build logs should flow through the same observability pipeline:
1. Write to file storage (JSONL via ObservabilityWriter)
2. Ingestion worker picks up files
3. Bulk insert to ClickHouse
4. Query provider reads from ClickHouse

This would provide consistency and allow build logs to be queried alongside application logs/traces.

### Gap 6: LocalProjectSource Builds In-Place (No Copy to Temp Directory)

The LocalProjectSource **ignores** the targetDir parameter and builds in the original source directory:

**File**: `sources/local/src/provider.ts:165-173`
```typescript
async getProjectPath(source: ProjectSource, _targetDir: string): Promise<string> {
  // For local source, just return the path directly
  // Runners use the project in-place
  if (!(await this.validateAccess(source))) {
    throw new Error(`Project path is not accessible: ${source.path}`);
  }

  return source.path;
}
```

Note the `_targetDir` has an underscore prefix indicating it's intentionally ignored.

**BuildOrchestrator does pass a targetDir**: `packages/admin/src/orchestrator/build-orchestrator.ts:200`
```typescript
const _sourceDir = await this.#source.getProjectPath(projectSource, `/tmp/builds/${buildId}`);
```

**Problems with building in-place**:
1. **No fresh installs** - node_modules from previous builds persist
2. **Source corruption risk** - build artifacts pollute the source directory
3. **No isolated observability directory** - can't write run logs and observability to an isolated location
4. **No concurrent builds** - same project can't build in parallel
5. **No rollback capability** - can't keep previous build artifacts for quick rollback

**Expected behavior (per master plan)**:
1. Copy source to temp directory (e.g., `/tmp/builds/{buildId}`)
2. Run `pnpm install` fresh in temp directory
3. Build in temp directory
4. Deploy from temp directory
5. Write observability data to `{tempDir}/.mastra/observability/`
6. Keep build artifacts for rollback or clean up after success

### Gap 7: No Isolated Directory for Run Logs and Observability

Without copying to a temp directory, there's no clean location for:
- Server stdout/stderr logs
- Application traces/spans
- Metrics collection
- Build artifacts

The runner currently uses `.mastra/output` relative to the source:

**File**: `runners/local/src/runner.ts:220`
```typescript
const outputDir = path.join(projectPath, '.mastra/output');
```

This means observability files would pollute the source directory.

## Revised Gap Summary

| Gap | Issue | Impact |
|-----|-------|--------|
| 1 | Server logs REST returns empty | No historical logs via API |
| 2 | Server log streaming not connected | No real-time server logs in UI |
| 3 | Observability queries return empty | No traces/logs/metrics in dashboard |
| 4 | No ClickHouse in docker-compose | No observability storage |
| 5 | Build logs to PostgreSQL not file storage | Build logs outside observability pipeline |
| 6 | LocalProjectSource builds in-place | No fresh installs, source pollution |
| 7 | No isolated directory for observability | Can't write logs/metrics to clean location |

## Open Questions

1. **Should server log streaming be opt-in?** Streaming all stdout/stderr to WebSocket could be noisy for high-volume servers.

2. **Should ClickHouse be required for MVP?** The observability routes could return data from PostgreSQL for a simpler MVP, with ClickHouse as a future optimization.

3. **How should server logs connect to application logs?** The master plan shows them as separate (file-based for application → ClickHouse, real-time for server), but the UI shows both under "Observability".

4. **Is the health check worker actually running?** User reports observability not working - need to verify if the WebSocket connection is established and subscriptions are working.

5. **Should LocalProjectSource copy for all builds or just production?** For development with hot reload, building in-place might be acceptable. The targetDir parameter could be respected only when provided.
