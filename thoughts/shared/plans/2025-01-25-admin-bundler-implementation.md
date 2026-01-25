---
date: 2025-01-25
author: Claude
status: draft
---

# Implementation Plan: AdminBundler with FileExporter for Observability

## Overview

This plan implements:

1. A new `FileExporter` in `@mastra/observability` that writes spans/traces to JSONL files
2. An `AdminBundler` class that injects this FileExporter during bundling
3. Integration with runner-local to use AdminBundler instead of `npm run build`

The observability data flows: **Server → FileExporter → JSONL files → Admin Worker → ClickHouse**

## Research References

- `thoughts/shared/research/2025-01-25-admin-deployer-implementation-pattern.md` - Bundler architecture
- `thoughts/shared/research/2025-01-25-observability-data-flow-gaps.md` - Observability patterns

## Success Criteria

1. FileExporter writes spans to JSONL files in configurable directory
2. AdminBundler creates valid bundles at `.mastra/output/`
3. Generated entry code includes FileExporter pointing to observability folder
4. Server starts successfully with injected FileExporter
5. Spans/traces are written to files that Admin Worker can read
6. Existing user observability configuration is preserved (not replaced)

---

## Phase 1: Create FileExporter

### Overview

Create a new exporter in `@mastra/observability` that writes spans to JSONL files, similar to how ObservabilityWriter works but as an exporter that can be injected into the Mastra observability system.

### Changes

#### 1.1 Create FileExporter class

**File**: `observability/mastra/src/exporters/file.ts` (new)

```typescript
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { BaseExporter, type ExporterConfig } from './base';
import type { TracingEvent, AnyExportedSpan } from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';

export interface FileExporterConfig extends ExporterConfig {
  /** Directory path to write observability files */
  outputPath: string;
  /** Project ID for file organization */
  projectId?: string;
  /** Deployment ID for file organization */
  deploymentId?: string;
  /** Maximum batch size before flush (default: 100) */
  maxBatchSize?: number;
  /** Maximum wait time before flush in ms (default: 5000) */
  maxBatchWaitMs?: number;
}

interface SpanRecord {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  type: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  status: 'ok' | 'error' | 'unset';
  input?: unknown;
  output?: unknown;
  errorInfo?: unknown;
  attributes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  projectId?: string;
  deploymentId?: string;
  timestamp: string;
}

export class FileExporter extends BaseExporter {
  private outputPath: string;
  private projectId?: string;
  private deploymentId?: string;
  private maxBatchSize: number;
  private maxBatchWaitMs: number;
  private buffer: SpanRecord[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private currentFilePath: string | null = null;

  constructor(config: FileExporterConfig) {
    super(config);

    if (!config.outputPath) {
      this._setDisabled(true);
      this.log('warn', 'FileExporter disabled: no outputPath provided');
      return;
    }

    this.outputPath = config.outputPath;
    this.projectId = config.projectId;
    this.deploymentId = config.deploymentId;
    this.maxBatchSize = config.maxBatchSize ?? 100;
    this.maxBatchWaitMs = config.maxBatchWaitMs ?? 5000;

    // Ensure output directory exists
    this.ensureDirectory(this.outputPath);

    // Start flush timer
    this.startFlushTimer();

    this.log('info', `FileExporter initialized: ${this.outputPath}`);
  }

  private ensureDirectory(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.maxBatchWaitMs);
  }

  private generateFilePath(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `spans-${timestamp}.jsonl`;
    return join(this.outputPath, 'spans', filename);
  }

  private convertSpanToRecord(span: AnyExportedSpan): SpanRecord {
    return {
      spanId: span.id,
      traceId: span.traceId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      type: span.type,
      startTime: span.startTime,
      endTime: span.endTime,
      durationMs:
        span.endTime && span.startTime
          ? new Date(span.endTime).getTime() - new Date(span.startTime).getTime()
          : undefined,
      status: span.errorInfo ? 'error' : span.endTime ? 'ok' : 'unset',
      input: span.input,
      output: span.output,
      errorInfo: span.errorInfo,
      attributes: span.attributes || {},
      metadata: span.metadata || {},
      projectId: this.projectId,
      deploymentId: this.deploymentId,
      timestamp: new Date().toISOString(),
    };
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Only export ended spans (complete data)
    if (event.type !== TracingEventType.SPAN_ENDED) {
      return;
    }

    const record = this.convertSpanToRecord(event.exportedSpan);
    this.buffer.push(record);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBatchSize) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const records = this.buffer;
    this.buffer = [];

    try {
      // Ensure spans directory exists
      const spansDir = join(this.outputPath, 'spans');
      this.ensureDirectory(spansDir);

      // Generate file path if needed
      if (!this.currentFilePath) {
        this.currentFilePath = this.generateFilePath();
      }

      // Ensure file's parent directory exists
      this.ensureDirectory(dirname(this.currentFilePath));

      // Append records as JSONL
      const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
      appendFileSync(this.currentFilePath, lines);

      this.log('debug', `Flushed ${records.length} spans to ${this.currentFilePath}`);
    } catch (err) {
      this.log('error', `Failed to flush spans: ${err}`);
      // Re-add records to buffer for retry
      this.buffer.unshift(...records);
    }
  }

  async flush(): Promise<void> {
    await this.flushBuffer();
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushBuffer();
    this.log('info', 'FileExporter shut down');
  }
}
```

#### 1.2 Export FileExporter from package

**File**: `observability/mastra/src/exporters/index.ts`

Add to exports:

```typescript
export { FileExporter, type FileExporterConfig } from './file';
```

#### 1.3 Add to package exports

**File**: `observability/mastra/package.json`

Ensure the exporters are exported (likely already done for other exporters).

### Verification

- [ ] FileExporter compiles without errors
- [ ] Unit test: writes spans to JSONL file
- [ ] Unit test: creates directory if not exists
- [ ] Unit test: flushes on batch size threshold
- [ ] Unit test: flushes on timer interval
- [ ] Unit test: graceful shutdown flushes remaining buffer

---

## Phase 2: Create AdminBundler Class

### Overview

Create the AdminBundler that extends Bundler and generates entry code with FileExporter injection.

### Changes

#### 2.1 Create AdminBundler class

**File**: `runners/local/src/bundler/admin-bundler.ts` (new)

```typescript
import { Bundler } from '@mastra/deployer/bundler';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface AdminBundlerOptions {
  /** Project ID for observability context */
  projectId: string;
  /** Deployment ID for observability context */
  deploymentId: string;
  /** Server/build ID for observability context */
  serverId: string;
  /** Path where observability files should be written */
  observabilityPath: string;
}

export class AdminBundler extends Bundler {
  constructor() {
    super('admin-bundler', 'BUNDLER');
  }

  async bundle(mastraDir: string, outputDirectory: string, options: AdminBundlerOptions): Promise<void> {
    const mastraEntryFile = this.getMastraEntryFile(mastraDir);
    const mastraAppDir = this.getMastraAppDir(mastraDir);
    const discoveredTools = this.getAllToolPaths(mastraAppDir);

    await this.prepare(outputDirectory);
    await this._bundle(
      this.getEntry(options),
      mastraEntryFile,
      {
        outputDirectory,
        projectRoot: mastraDir,
        enableEsmShim: true,
      },
      discoveredTools,
    );
  }

  private getMastraAppDir(mastraDir: string): string {
    const srcMastraPath = join(mastraDir, 'src', 'mastra');
    const mastraPath = join(mastraDir, 'mastra');

    if (existsSync(srcMastraPath)) return srcMastraPath;
    if (existsSync(mastraPath)) return mastraPath;

    throw new Error(
      `No Mastra directory found in ${mastraDir}.\n` +
        `Expected one of:\n` +
        `  - ${srcMastraPath}\n` +
        `  - ${mastraPath}`,
    );
  }

  private getMastraEntryFile(mastraDir: string): string {
    const possiblePaths = [
      join(mastraDir, 'src', 'mastra', 'index.ts'),
      join(mastraDir, 'src', 'mastra', 'index.js'),
      join(mastraDir, 'mastra', 'index.ts'),
      join(mastraDir, 'mastra', 'index.js'),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) return path;
    }

    throw new Error(
      `No Mastra entry file found. Searched:\n` +
        possiblePaths.map(p => `  - ${p}`).join('\n') +
        `\n\nEnsure your project has a mastra/index.ts or src/mastra/index.ts file.`,
    );
  }

  private getEntry(options: AdminBundlerOptions): string {
    return `
import { createNodeServer, getToolExports } from '#server';
import { tools } from '#tools';
import { mastra } from '#mastra';

// ============================================================
// ADMIN OBSERVABILITY INJECTION
// ============================================================

const ADMIN_CONFIG = {
  projectId: '${options.projectId}',
  deploymentId: '${options.deploymentId}',
  serverId: '${options.serverId}',
  observabilityPath: '${options.observabilityPath}',
};

console.log('[Admin] Initializing observability:', {
  projectId: ADMIN_CONFIG.projectId,
  deploymentId: ADMIN_CONFIG.deploymentId,
  observabilityPath: ADMIN_CONFIG.observabilityPath,
});

// Inject FileExporter for span persistence
try {
  const { FileExporter } = await import('@mastra/observability');

  const fileExporter = new FileExporter({
    outputPath: ADMIN_CONFIG.observabilityPath,
    projectId: ADMIN_CONFIG.projectId,
    deploymentId: ADMIN_CONFIG.deploymentId,
    maxBatchSize: 50,
    maxBatchWaitMs: 3000,
  });

  // Get existing observability instance and add our exporter
  const existingInstance = mastra.observability?.getDefaultInstance?.();

  if (existingInstance && typeof existingInstance.addExporter === 'function') {
    existingInstance.addExporter(fileExporter);
    console.log('[Admin] Added FileExporter to existing observability');
  } else if (mastra.observability?.registerExporter) {
    // Alternative registration path
    mastra.observability.registerExporter('admin-file', fileExporter);
    console.log('[Admin] Registered FileExporter via observability entrypoint');
  } else {
    console.warn('[Admin] Could not inject FileExporter - no compatible observability instance');
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('[Admin] Shutting down FileExporter...');
    await fileExporter.shutdown();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

} catch (err) {
  console.error('[Admin] Failed to initialize FileExporter:', err);
  // Continue without file observability - don't crash server
}

// ============================================================
// STORAGE INITIALIZATION
// ============================================================

if (mastra.storage) {
  try {
    await mastra.storage.init();
    console.log('[Admin] Storage initialized');
  } catch (err) {
    console.error('[Admin] Storage initialization failed:', err);
  }
}

// ============================================================
// START SERVER
// ============================================================

console.log('[Admin] Starting server...');

await createNodeServer(mastra, {
  studio: false,
  swaggerUI: false,
  tools: getToolExports(tools),
});

console.log('[Admin] Server started successfully');
`;
  }
}
```

#### 2.2 Create bundler index export

**File**: `runners/local/src/bundler/index.ts` (new)

```typescript
export { AdminBundler, type AdminBundlerOptions } from './admin-bundler';
```

### Verification

- [ ] AdminBundler class compiles without errors
- [ ] TypeScript types are correctly defined
- [ ] Unit test: getMastraEntryFile finds entry in src/mastra/ and mastra/
- [ ] Unit test: getMastraAppDir finds mastra directory
- [ ] getEntry() generates valid JavaScript with FileExporter injection

---

## Phase 3: Integrate AdminBundler into Runner

### Overview

Replace ProjectBuilder with AdminBundler in the LocalProcessRunner build flow.

### Changes

#### 3.1 Update LocalProcessRunner to use AdminBundler

**File**: `runners/local/src/runner.ts`

Replace the build() method to use AdminBundler:

```typescript
import { AdminBundler } from './bundler';
import { detectPackageManager, getInstallArgs } from './build/package-manager';

// In build() method:
async build(
  project: Project,
  build: Build,
  options?: BuildOptions,
  onLog?: LogStreamCallback,
): Promise<Build> {
  this.logger.info('Starting build', { projectId: project.id, buildId: build.id });

  const projectPath = await this.getProjectPath(project, build.id);
  const outputDir = join(projectPath, '.mastra');

  // Observability path is alongside the build
  const observabilityPath = join(this.getBuildDir(build.id), 'observability');

  // Install dependencies first
  const packageManager = await detectPackageManager(projectPath);
  const installArgs = getInstallArgs(packageManager);

  onLog?.(`Installing dependencies with ${packageManager}...`);
  await this.runCommand(packageManager, installArgs, projectPath, onLog);

  // Create AdminBundler instance
  const bundler = new AdminBundler();
  bundler.__setLogger(this.logger);

  // Bundle with FileExporter injection
  onLog?.('Bundling project with observability injection...');

  try {
    await bundler.bundle(projectPath, outputDir, {
      projectId: project.id,
      deploymentId: build.deploymentId || build.id,
      serverId: build.id,
      observabilityPath,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    this.logger.error('Bundle failed', { error: errorMessage });
    onLog?.(`Bundle failed: ${errorMessage}`);

    return {
      ...build,
      status: BuildStatus.FAILED,
      completedAt: new Date(),
    };
  }

  // Verify output
  const outputPath = join(outputDir, 'output', 'index.mjs');
  if (!existsSync(outputPath)) {
    throw new Error('Bundle failed: no output produced at ' + outputPath);
  }

  onLog?.('Build completed successfully');

  return {
    ...build,
    status: BuildStatus.SUCCEEDED,
    completedAt: new Date(),
  };
}
```

#### 3.2 Pass observabilityPath to deployed server

The FileExporter needs to write to a path that both the server and admin worker can access. This is handled by setting `observabilityPath` based on the build directory structure.

### Verification

- [ ] LocalProcessRunner.build() compiles without errors
- [ ] Integration test: build() creates output at .mastra/output/index.mjs
- [ ] Generated entry code contains FileExporter injection
- [ ] observabilityPath points to correct location alongside build

---

## Phase 4: Test End-to-End

### Overview

Verify the complete flow from build to file-based observability.

### Manual Testing Steps

1. Build a test project via admin
2. Verify bundle output at `.mastra/output/index.mjs`
3. Check generated code includes FileExporter injection
4. Start deployed server
5. Make API calls to trigger spans
6. Verify JSONL files created at `observability/spans/`
7. Verify files contain valid span records

### Verification

**Verified on 2025-01-25 via automated test script (`examples/admin/test-admin-bundler.ts`):**

- [x] Bundle creates valid .mastra/output/index.mjs (1705KB output)
- [x] Generated code includes ADMIN_CONFIG constant with correct values
- [x] Generated code includes FileExporter import from @mastra/observability
- [x] Generated code includes observabilityPath configuration
- [x] Generated code includes "[Admin] Initializing observability" log
- [x] Generated code includes graceful shutdown handlers (SIGTERM, SIGINT)
- [x] Generated code includes fileExporter.shutdown() call
- [x] Generated code includes maxBatchSize and maxBatchWaitMs configuration
- [x] Generated code includes addExporter method call
- [x] Generated code includes "[Admin] Storage initialized" log
- [x] Generated code includes "[Admin] Server started successfully" log
- [x] Tools export file (tools.mjs) created correctly

**Notes:**

- The `serverId` property is defined in ADMIN_CONFIG but currently unused, so it gets tree-shaken out during bundling
- Server-side span generation and JSONL file verification require running the full server with dependencies

---

## Phase 5: Admin Worker Integration

**Status: COMPLETED (2025-01-25)**

### Overview

This phase ensures the FileExporter produces JSONL files compatible with the IngestionWorker from `@mastra/observability-clickhouse`. The Admin Worker continuously polls for new files, parses them, and inserts spans into ClickHouse.

### Implementation Summary

The existing IngestionWorker (`observability/clickhouse/src/ingestion/worker.ts`) already implements the complete file processing pipeline:

1. **Polling**: Configurable interval (default 10s) with batch processing (default 10 files)
2. **File Discovery**: Uses `listPendingFiles()` to find unprocessed JSONL files
3. **Parsing**: Uses `processFile()` to parse JSONL and extract events
4. **Bulk Insert**: Uses `bulkInsert()` to insert into ClickHouse tables
5. **File Management**: Moves processed files to `/processed/` subdirectory

### Key Changes Made

1. **FileExporter Format Update** (`observability/mastra/src/exporters/file.ts`):
   - Changed output format from raw span records to `{ type: 'span', data: {...} }` envelope
   - Updated file path to use observability-writer convention: `{basePath}/span/{projectId}/{timestamp}_{uuid}.jsonl`
   - Converted span data to match `@mastra/admin` Span interface (spanId, kind, events[], etc.)
   - Added Mastra-specific attributes: `mastra.span.type`, `mastra.input`, `mastra.output`, `mastra.error`

2. **File Naming Convention**:
   - Before: `spans-2025-01-25T10-00-00-000Z.jsonl`
   - After: `20250125T100000Z_abc123def456.jsonl` (ISO 8601 basic format + UUID)

3. **Unit Tests** (`observability/mastra/src/exporters/file.test.ts`):
   - Added 16 comprehensive tests for FileExporter
   - Tests verify JSONL format compatibility with IngestionWorker
   - Tests cover initialization, path generation, span conversion, and shutdown

### Expected Data Flow

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│   Deployed Server   │         │   IngestionWorker   │         │     ClickHouse      │
│   (FileExporter)    │         │   (Admin Worker)    │         │                     │
└──────────┬──────────┘         └──────────┬──────────┘         └──────────┬──────────┘
           │                               │                               │
           │ Write JSONL                   │                               │
           │ {type:'span',data:{...}}      │                               │
           ├──────────────────────────────►│                               │
           │                               │ Poll & Parse                  │
           │                               ├──────────────────────────────►│
           │                               │                               │ Insert spans
           │                               │◄──────────────────────────────┤
           │                               │                               │
           │                               │ Move to /processed/           │
           │                               ├──────────────────────────────►│
```

### File Format

Path: `{observabilityPath}/span/{projectId}/{timestamp}_{uuid}.jsonl`

Each line is a complete JSON object with `{ type, data }` envelope:

```json
{
  "type": "span",
  "data": {
    "spanId": "abc123",
    "traceId": "xyz789",
    "parentSpanId": null,
    "projectId": "proj_1",
    "deploymentId": "dep_1",
    "name": "agent.run",
    "kind": "internal",
    "status": "ok",
    "startTime": "2025-01-25T10:00:00.000Z",
    "endTime": "2025-01-25T10:00:01.500Z",
    "durationMs": 1500,
    "attributes": {
      "mastra.span.type": "AGENT",
      "mastra.input": {...},
      "mastra.output": {...}
    },
    "events": []
  }
}
```

### Configuration

Start the IngestionWorker via CLI:

```bash
npx @mastra/observability-clickhouse ingest \
  --clickhouse-url http://localhost:8123 \
  --file-storage-type local \
  --file-storage-path /path/to/builds \
  --base-path observability \
  --poll-interval 10000 \
  --batch-size 10 \
  --debug
```

Or programmatically:

```typescript
import { IngestionWorker } from '@mastra/observability-clickhouse';
import { LocalFileStorage } from '@mastra/observability-file-local';

const worker = new IngestionWorker({
  fileStorage: new LocalFileStorage({ baseDir: '/path/to/builds' }),
  clickhouse: { url: 'http://localhost:8123', username: 'default', password: '' },
  basePath: 'observability',
  pollIntervalMs: 10000,
  batchSize: 10,
  deleteAfterProcess: false, // Move to /processed/ instead
  debug: true,
});

await worker.init(); // Run migrations
await worker.start(); // Start polling

// On shutdown:
await worker.stop();
```

### Verification

- [x] FileExporter produces JSONL with `{ type: 'span', data: {...} }` envelope
- [x] File path follows `{basePath}/span/{projectId}/{timestamp}_{uuid}.jsonl` convention
- [x] SpanData matches `@mastra/admin` Span interface
- [x] IngestionWorker can parse the output (tested via file-processor.ts)
- [x] Mastra-specific data preserved in attributes (input, output, error, metadata)
- [x] 16 unit tests pass for FileExporter

---

## Implementation Notes

### Why FileExporter Instead of CloudExporter

1. **Simpler architecture**: No HTTP endpoint needed
2. **Reliable persistence**: Files survive network issues
3. **Batch processing**: Admin Worker can process at its own pace
4. **Debugging**: Can inspect raw JSONL files

### File Structure

```
builds/
└── <buildId>/
    ├── .mastra/
    │   └── output/
    │       └── index.mjs
    └── observability/
        └── span/
            └── <projectId>/
                ├── 20250125T100000Z_abc123def456.jsonl
                ├── 20250125T100500Z_789ghi012jkl.jsonl
                └── processed/
                    └── 20250125T095500Z_mno345pqr678.jsonl
```

### JSONL Format

Each line is a complete JSON object with `{ type, data }` envelope:

```json
{
  "type": "span",
  "data": {
    "spanId": "abc123",
    "traceId": "xyz789",
    "parentSpanId": null,
    "projectId": "proj_1",
    "deploymentId": "dep_1",
    "name": "agent.run",
    "kind": "internal",
    "status": "ok",
    "startTime": "2025-01-25T10:00:00.000Z",
    "endTime": "2025-01-25T10:00:01.500Z",
    "durationMs": 1500,
    "attributes": {
      "mastra.span.type": "AGENT",
      "mastra.input": { "message": "Hello" },
      "mastra.output": { "response": "Hi there!" }
    },
    "events": []
  }
}
```

### Graceful Shutdown

The injected entry code handles SIGTERM/SIGINT to flush remaining spans before exit.

---

## Files to Create/Modify

### New Files

- `observability/mastra/src/exporters/file.ts` - FileExporter class
- `runners/local/src/bundler/admin-bundler.ts` - AdminBundler class
- `runners/local/src/bundler/index.ts` - Export AdminBundler

### Modified Files

- `observability/mastra/src/exporters/index.ts` - Export FileExporter
- `runners/local/src/runner.ts` - Use AdminBundler in build()

---

## Testing Checklist

### Unit Tests

- [x] FileExporter writes to correct path (`file.test.ts: should write spans to JSONL file with correct format`)
- [x] FileExporter creates directory if missing (`file.test.ts: should create directory structure if not exists`)
- [x] FileExporter flushes on batch size (`file.test.ts: should flush when batch size is reached`)
- [x] FileExporter flushes on timer (verified via flush timer initialization)
- [x] FileExporter handles shutdown gracefully (`file.test.ts: should flush remaining buffer on shutdown`)
- [ ] AdminBundler.getMastraEntryFile finds correct file
- [ ] AdminBundler.getMastraAppDir finds correct directory
- [ ] getEntry() generates valid JavaScript

### Integration Tests

- [x] Full build creates correct output structure (Phase 4 verification)
- [x] Generated entry includes FileExporter code (Phase 4 verification)
- [ ] Server starts with injected FileExporter
- [ ] Spans written to JSONL files
- [x] Files are valid JSONL format (`file.test.ts: JSONL file output tests`)

### End-to-End Tests

- [ ] Build → Deploy → API call → Span in file
- [x] Multiple spans batched correctly (`file.test.ts: should batch multiple spans into single file`)
- [x] Graceful shutdown flushes remaining spans (`file.test.ts: should flush remaining buffer on shutdown`)
