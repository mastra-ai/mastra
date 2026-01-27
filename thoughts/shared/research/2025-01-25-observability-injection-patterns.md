---
date: 2025-01-25T09:30:00-07:00
researcher: Claude
git_commit: c27c9c1574d6685d15feddb05622f160e03b960b
branch: mastra-admin-example
repository: mastra-admin-example
topic: "Observability Writer Injection Patterns"
tags: [research, codebase, observability, deployers, dependency-injection]
status: complete
last_updated: 2025-01-25
last_updated_by: Claude
---

# Research: Observability Writer Injection Patterns

**Date**: 2025-01-25T09:30:00-07:00
**Researcher**: Claude
**Git Commit**: c27c9c1574d6685d15feddb05622f160e03b960b
**Branch**: mastra-admin-example
**Repository**: mastra-admin-example

## Research Question

How does deployers/cloud inject dependencies like loggers and storage, and how can we use similar patterns to inject ObservabilityWriter into the runner for server log persistence?

## Summary

The codebase uses two distinct patterns for dependency injection:

1. **Deployer Pattern (Build-time Code Generation)**: The CloudDeployer generates runtime entry point code via `getEntry()` that includes logger configuration, storage initialization, and observability setup. This code is bundled and executed when the server starts.

2. **MastraAdmin Pattern (Runtime Setter Injection)**: MastraAdmin uses constructor injection plus optional setter methods (`setSource()`, `setOnServerLog()`) to inject dependencies into the runner at runtime.

For injecting ObservabilityWriter into the runner, the **MastraAdmin/runner setter pattern** is the appropriate approach, not the deployer pattern. The runner needs a new `setObservabilityStorage()` or `setOnServerLogPersistence()` method.

## Detailed Findings

### Cloud Deployer Injection Pattern

The cloud deployer injects dependencies through runtime code generation, not runtime setter injection.

#### Code Generation via `getEntry()` (`deployers/cloud/src/index.ts:98-202`)

The `getEntry()` method returns a template string that becomes the server entry point:

```typescript
private getEntry(): string {
  return `
import { MultiLogger } from '@mastra/core/logger';
import { PinoLogger } from '@mastra/loggers';
import { HttpTransport } from '@mastra/loggers/http';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

// Logger injection at runtime (lines 124-144)
const transports = {}
if (process.env.CI !== 'true') {
  if (process.env.BUSINESS_API_RUNNER_LOGS_ENDPOINT) {
    transports.default = new HttpTransport({
      url: process.env.BUSINESS_API_RUNNER_LOGS_ENDPOINT,
      headers: { Authorization: 'Bearer ' + process.env.BUSINESS_JWT_TOKEN },
    });
  }
}
const logger = new PinoLogger({ name: 'MastraCloud', transports, level: 'debug' });
mastra.setLogger({ logger: combinedLogger });

// Storage injection at runtime (lines 146-164)
if (process.env.MASTRA_STORAGE_URL && process.env.MASTRA_STORAGE_AUTH_TOKEN) {
  const storage = new LibSQLStore({
    url: process.env.MASTRA_STORAGE_URL,
    authToken: process.env.MASTRA_STORAGE_AUTH_TOKEN,
  });
  await storage.init();
  mastra?.setStorage(storage);
}
`;
}
```

**Key Insight**: This pattern generates code at build time that executes at server start. It's not applicable to the admin server scenario where we need to inject dependencies into an already-running runner.

### MastraAdmin Setter Injection Pattern

MastraAdmin uses optional setter methods to inject dependencies into the runner at runtime.

#### Pattern 1: setSource() for Provider Injection (`packages/admin/src/mastra-admin.ts:294-298`)

```typescript
// In MastraAdmin.init()
if (this.#runner && this.#source && this.#runner.setSource) {
  this.#runner.setSource(this.#source);
  this.logger.info('Source provider injected into runner');
}
```

Interface definition (`packages/admin/src/runner/base.ts:56`):
```typescript
setSource?(source: ProjectSourceProvider): void;
```

#### Pattern 2: setOnServerLog() for Callback Injection (`packages/admin-server/src/server.ts:358-365`)

```typescript
// In AdminServer.start()
const runner = this.admin.getRunner();
if (runner?.setOnServerLog) {
  runner.setOnServerLog((serverId, line, stream) => {
    this.serverLogStreamer?.broadcastLog(serverId, line, stream);
  });
  console.info('Server log streaming enabled via WebSocket');
}
```

Interface definition (`packages/admin/src/runner/base.ts:64`):
```typescript
setOnServerLog?(callback: ServerLogCallback): void;
```

### Current Observability Configuration

MastraAdmin already accepts observability configuration, but doesn't pass it to the runner.

#### ObservabilityConfig Interface (`packages/admin/src/mastra-admin.ts:52-61`)

```typescript
export interface ObservabilityConfig {
  /** File storage for JSONL event files */
  fileStorage: FileStorageProvider;
  /** Optional query provider (e.g., ClickHouse) */
  queryProvider?: ObservabilityQueryProvider;
  /** Optional pre-configured writer instance */
  writer?: ObservabilityWriterInterface;
}
```

#### Current Usage (`packages/admin/src/mastra-admin.ts:225, 368-374`)

```typescript
// Storage
this.#observability = config.observability;

// Accessors
getObservabilityQueryProvider(): ObservabilityQueryProvider | undefined {
  return this.#observability?.queryProvider;
}

getObservabilityFileStorage(): FileStorageProvider | undefined {
  return this.#observability?.fileStorage;
}
```

**Gap**: The `fileStorage` is stored but never passed to the runner. The runner has no way to create ObservabilityWriter instances for each deployment.

### Runner Implementation Analysis

The LocalProcessRunner (`runners/local/src/runner.ts`) currently has:

1. **setSource()** implementation (lines 182-185):
   ```typescript
   setSource(source: ProjectSourceProvider): void {
     this.source = source;
   }
   ```

2. **setOnServerLog()** implementation (lines 187-189):
   ```typescript
   setOnServerLog(callback: ServerLogCallback): void {
     this.onServerLog = callback;
   }
   ```

3. **LogCollector** wired to callback only (lines 248-254):
   ```typescript
   if (this.onServerLog) {
     logCollector.stream(line => {
       this.onServerLog!(serverId, line, 'stdout');
     });
   }
   ```

**Missing**: A `setObservabilityStorage()` method and wiring to create `ObservabilityWriter` instances.

## Architecture Documentation

### Existing Injection Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| `setSource(source)` | Runner | Inject source provider for project file access |
| `setOnServerLog(callback)` | Runner | Inject callback for real-time log streaming |
| `setOnLog(callback)` | Orchestrator | Inject callback for build log streaming |
| `setOnStatus(callback)` | Orchestrator | Inject callback for build status updates |

### Data Flow for Server Logs (Current)

```
Server Process
     ↓
LogCollector.append(line)
     ↓
LogCollector.stream() → listeners
     ↓
onServerLog callback (if set)
     ↓
ServerLogStreamer.broadcastLog()
     ↓
WebSocket clients
```

### Data Flow for Server Logs (Missing)

```
Server Process
     ↓
LogCollector.append(line)
     ↓
LogCollector.stream() → listeners
     ├── onServerLog callback → WebSocket (EXISTS)
     └── ObservabilityWriter.recordLog() → File Storage (MISSING)
                                                ↓
                                          IngestionWorker
                                                ↓
                                           ClickHouse
```

## Recommended Injection Approach

Based on the existing patterns, the recommended approach is:

### Option A: Add `setObservabilityStorage()` to Runner Interface

```typescript
// packages/admin/src/runner/base.ts
setObservabilityStorage?(storage: FileStorageProvider): void;
```

The runner would then create `ObservabilityWriter` instances per deployment in `deploy()`:

```typescript
// In deploy()
if (this.observabilityStorage) {
  const writer = new ObservabilityWriter({
    fileStorage: this.observabilityStorage,
    projectId: project.id,
    deploymentId: deployment.id,
  });

  logCollector.stream(line => {
    writer.recordLog({
      id: crypto.randomUUID(),
      projectId: project.id,
      deploymentId: deployment.id,
      level: this.detectLogLevel(line),
      message: line,
      timestamp: new Date(),
      attributes: {},
    });
  });

  this.observabilityWriters.set(serverId, writer);
}
```

### Wiring in MastraAdmin

```typescript
// In MastraAdmin.init()
if (this.#runner && this.#observability?.fileStorage && this.#runner.setObservabilityStorage) {
  this.#runner.setObservabilityStorage(this.#observability.fileStorage);
  this.logger.info('Observability storage injected into runner');
}
```

## Code References

- `deployers/cloud/src/index.ts:98-202` - CloudDeployer.getEntry() code generation
- `packages/admin/src/mastra-admin.ts:294-298` - setSource() injection pattern
- `packages/admin-server/src/server.ts:358-365` - setOnServerLog() injection pattern
- `packages/admin/src/runner/base.ts:56,64` - Runner interface setter definitions
- `runners/local/src/runner.ts:182-189` - Runner setter implementations
- `runners/local/src/runner.ts:248-254` - LogCollector to callback wiring
- `observability/writer/src/writer.ts:52-258` - ObservabilityWriter class

## Related Research

- `thoughts/shared/plans/2025-01-25-observability-architecture-refinement.md` - Implementation plan

## Open Questions

1. Should the runner create `ObservabilityWriter` per deployment, or should one writer handle all deployments?
2. Should the writer be passed directly (`setObservabilityWriter`) or should storage be passed (`setObservabilityStorage`)?
3. How should writer shutdown be handled when servers are stopped?
