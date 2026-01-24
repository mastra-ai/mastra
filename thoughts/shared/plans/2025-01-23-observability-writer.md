# LANE 3a: @mastra/observability-writer Implementation Plan

## Overview

This plan details the implementation of `@mastra/observability-writer`, a core package responsible for batching and writing observability events (traces, spans, logs, metrics, scores) to file storage as JSONL files.

**Package Location**: `observability/writer/`
**Package Name**: `@mastra/observability-writer`
**Priority**: P0 (MVP)
**Dependencies**: LANE 1 (Core Package) - for interfaces and types

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY WRITER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Mastra Projects          ObservabilityWriter         FileStorageProvider  │
│   ┌──────────────┐         ┌──────────────────┐        ┌─────────────────┐  │
│   │ recordTrace()│         │                  │        │                 │  │
│   │ recordSpan() │ ──────► │  EventBatcher    │ ─────► │ write(path,    │  │
│   │ recordLog()  │         │  ┌────────────┐  │        │   content)     │  │
│   │ recordMetric │         │  │ Buffer     │  │        │                 │  │
│   │ recordScore()│         │  │ (in-memory)│  │        │ Local FS / S3  │  │
│   └──────────────┘         │  └────────────┘  │        │ / GCS          │  │
│                            │       │          │        └─────────────────┘  │
│                            │       ▼          │                              │
│                            │  Flush triggers: │                              │
│                            │  - Batch size    │                              │
│                            │  - Flush interval│                              │
│                            │  - Max file size │                              │
│                            │  - shutdown()    │                              │
│                            └──────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
observability/writer/
├── src/
│   ├── index.ts              # Public exports
│   ├── writer.ts             # ObservabilityWriter class
│   ├── batcher.ts            # EventBatcher - handles buffering and flush triggers
│   ├── file-naming.ts        # File path/naming conventions
│   ├── serializer.ts         # JSONL serialization utilities
│   └── types.ts              # Package-specific types (re-export from @mastra/admin)
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── CHANGELOG.md
└── README.md
```

## Implementation Phases

### Phase 1: Package Setup

#### 1.1 Create package.json

**File**: `observability/writer/package.json`

```json
{
  "name": "@mastra/observability-writer",
  "version": "0.0.1",
  "description": "Observability event writer for MastraAdmin - batches and writes traces, spans, logs, metrics to file storage",
  "type": "module",
  "license": "Apache-2.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "CHANGELOG.md"
  ],
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
    "./package.json": "./package.json"
  },
  "scripts": {
    "build:lib": "tsup --silent --config tsup.config.ts",
    "build:watch": "pnpm build:lib --watch",
    "check": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "lint": "eslint ."
  },
  "peerDependencies": {
    "@mastra/admin": "workspace:*"
  },
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@internal/types-builder": "workspace:*",
    "@mastra/admin": "workspace:*",
    "@vitest/coverage-v8": "catalog:",
    "tsup": "^8.3.5",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "engines": {
    "node": ">=22.13.0"
  }
}
```

#### 1.2 Create tsconfig.json

**File**: `observability/writer/tsconfig.json`

```json
{
  "extends": "../../tsconfig.node.json",
  "include": ["src/**/*", "tsup.config.ts"],
  "exclude": ["node_modules", "**/*.test.ts"],
  "compilerOptions": {
    "lib": ["ES2023"],
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

#### 1.3 Create tsup.config.ts

**File**: `observability/writer/tsup.config.ts`

```typescript
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: { preset: 'smallest' },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
```

#### 1.4 Create vitest.config.ts

**File**: `observability/writer/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

#### 1.5 Create CHANGELOG.md

**File**: `observability/writer/CHANGELOG.md`

```markdown
# @mastra/observability-writer

## 0.0.1

### Features

- Initial release
- `ObservabilityWriter` class for batched event writing
- Support for traces, spans, logs, metrics, and scores
- Configurable batch size and flush intervals
- JSONL file format with automatic rotation
- Graceful shutdown with pending event flush
```

---

### Phase 2: Core Types

#### 2.1 Create types.ts

**File**: `observability/writer/src/types.ts`

```typescript
/**
 * Types for @mastra/observability-writer
 *
 * Note: Core event types (Trace, Span, Log, Metric, Score) are defined in
 * @mastra/admin and re-exported here for convenience.
 */

// Re-export types from @mastra/admin
export type {
  Trace,
  Span,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  ObservabilityEventType,
  FileStorageProvider,
  FileInfo,
} from '@mastra/admin';

/**
 * Configuration for the ObservabilityWriter
 */
export interface ObservabilityWriterConfig {
  /**
   * File storage provider for writing JSONL files.
   * Can be local filesystem, S3, GCS, etc.
   */
  fileStorage: import('@mastra/admin').FileStorageProvider;

  /**
   * Project ID for organizing files.
   * Files are written to: {type}/{projectId}/{timestamp}_{uuid}.jsonl
   */
  projectId: string;

  /**
   * Maximum number of events to buffer before flushing.
   * @default 1000
   */
  batchSize?: number;

  /**
   * Maximum time in milliseconds to wait before flushing buffered events.
   * @default 5000 (5 seconds)
   */
  flushIntervalMs?: number;

  /**
   * Maximum file size in bytes before rotating to a new file.
   * @default 10485760 (10MB)
   */
  maxFileSize?: number;

  /**
   * Base path for writing files.
   * @default 'observability'
   */
  basePath?: string;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Internal buffer state for a specific event type
 */
export interface EventBuffer {
  type: import('@mastra/admin').ObservabilityEventType;
  events: import('@mastra/admin').ObservabilityEvent[];
  currentFileSize: number;
  currentFilePath: string | null;
}

/**
 * Result of a flush operation
 */
export interface FlushResult {
  filesWritten: number;
  eventsWritten: number;
  errors: FlushError[];
}

/**
 * Error that occurred during flush
 */
export interface FlushError {
  type: import('@mastra/admin').ObservabilityEventType;
  error: Error;
  eventCount: number;
}

/**
 * Writer statistics
 */
export interface WriterStats {
  totalEventsBuffered: number;
  totalEventsWritten: number;
  totalFilesWritten: number;
  lastFlushAt: Date | null;
  buffersByType: Record<string, {
    eventCount: number;
    estimatedSize: number;
  }>;
}
```

---

### Phase 3: JSONL Serializer

#### 3.1 Create serializer.ts

**File**: `observability/writer/src/serializer.ts`

```typescript
import type { ObservabilityEvent } from './types.js';

/**
 * Serializes observability events to JSONL format.
 *
 * JSONL (JSON Lines) format:
 * - One JSON object per line
 * - Each line is a complete, valid JSON object
 * - Lines are separated by newline characters (\n)
 * - Easy to stream and parse incrementally
 */

/**
 * Serialize a single event to a JSON line (without trailing newline)
 */
export function serializeEvent(event: ObservabilityEvent): string {
  return JSON.stringify(event);
}

/**
 * Serialize multiple events to JSONL format
 * Returns a string with each event on its own line, ending with a newline
 */
export function serializeEvents(events: ObservabilityEvent[]): string {
  if (events.length === 0) {
    return '';
  }

  return events.map(serializeEvent).join('\n') + '\n';
}

/**
 * Estimate the serialized size of an event in bytes
 * Used for buffer size tracking without full serialization
 */
export function estimateEventSize(event: ObservabilityEvent): number {
  // Use JSON.stringify for accurate estimation
  // Add 1 for the newline character
  return Buffer.byteLength(JSON.stringify(event), 'utf8') + 1;
}

/**
 * Serialize events to a Buffer for binary writing
 */
export function serializeEventsToBuffer(events: ObservabilityEvent[]): Buffer {
  return Buffer.from(serializeEvents(events), 'utf8');
}

/**
 * Parse JSONL content back to events (for testing/validation)
 */
export function parseJsonl<T = ObservabilityEvent>(content: string): T[] {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  return lines.map(line => JSON.parse(line) as T);
}
```

---

### Phase 4: File Naming

#### 4.1 Create file-naming.ts

**File**: `observability/writer/src/file-naming.ts`

```typescript
import type { ObservabilityEventType } from './types.js';

/**
 * File naming conventions for observability data.
 *
 * Pattern: {basePath}/{type}/{projectId}/{timestamp}_{uuid}.jsonl
 *
 * Examples:
 * - observability/traces/proj_123/20250123T120000Z_abc123.jsonl
 * - observability/spans/proj_456/20250123T120500Z_def456.jsonl
 * - observability/logs/proj_123/20250123T121000Z_ghi789.jsonl
 */

/**
 * Generate a UUID v4 (simplified implementation)
 */
function generateUuid(): string {
  // Using crypto.randomUUID if available (Node.js 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }

  // Fallback for older environments
  return Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Format a date as ISO 8601 basic format (no separators)
 * Example: 20250123T120000Z
 */
function formatTimestamp(date: Date): string {
  return date.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Generate a file path for a new observability file
 */
export function generateFilePath(options: {
  basePath: string;
  type: ObservabilityEventType;
  projectId: string;
  timestamp?: Date;
}): string {
  const { basePath, type, projectId, timestamp = new Date() } = options;

  const timestampStr = formatTimestamp(timestamp);
  const uuid = generateUuid();
  const filename = `${timestampStr}_${uuid}.jsonl`;

  // Normalize path separators and remove trailing slashes
  const normalizedBase = basePath.replace(/\/+$/, '');

  return `${normalizedBase}/${type}/${projectId}/${filename}`;
}

/**
 * Generate the directory path for a specific event type and project
 */
export function generateDirectoryPath(options: {
  basePath: string;
  type: ObservabilityEventType;
  projectId: string;
}): string {
  const { basePath, type, projectId } = options;
  const normalizedBase = basePath.replace(/\/+$/, '');
  return `${normalizedBase}/${type}/${projectId}`;
}

/**
 * Parse a file path to extract metadata
 */
export function parseFilePath(filePath: string): {
  basePath: string;
  type: string;
  projectId: string;
  timestamp: string;
  uuid: string;
} | null {
  // Match pattern: {basePath}/{type}/{projectId}/{timestamp}_{uuid}.jsonl
  const match = filePath.match(
    /^(.+?)\/([^/]+)\/([^/]+)\/(\d{8}T\d{6}Z)_([a-f0-9]+)\.jsonl$/
  );

  if (!match) {
    return null;
  }

  const [, basePath, type, projectId, timestamp, uuid] = match;
  return { basePath, type, projectId, timestamp, uuid };
}

/**
 * Check if a file is in the "pending" state (not yet processed by ingestion worker)
 */
export function isPendingFile(filePath: string): boolean {
  return filePath.endsWith('.jsonl') && !filePath.includes('/processed/');
}

/**
 * Generate the processed file path (for moving after ingestion)
 */
export function getProcessedFilePath(filePath: string): string {
  // Insert 'processed' before the filename
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) {
    return `processed/${filePath}`;
  }

  const directory = filePath.slice(0, lastSlash);
  const filename = filePath.slice(lastSlash + 1);
  return `${directory}/processed/${filename}`;
}
```

---

### Phase 5: Event Batcher

#### 5.1 Create batcher.ts

**File**: `observability/writer/src/batcher.ts`

```typescript
import type {
  ObservabilityEvent,
  ObservabilityEventType,
  EventBuffer,
  FlushResult,
  FlushError,
  FileStorageProvider,
} from './types.js';
import { serializeEventsToBuffer, estimateEventSize } from './serializer.js';
import { generateFilePath } from './file-naming.js';

/**
 * Configuration for the EventBatcher
 */
export interface EventBatcherConfig {
  fileStorage: FileStorageProvider;
  projectId: string;
  batchSize: number;
  flushIntervalMs: number;
  maxFileSize: number;
  basePath: string;
  debug: boolean;
  onFlush?: (result: FlushResult) => void;
}

/**
 * Event type to buffer mapping
 */
const EVENT_TYPES: ObservabilityEventType[] = [
  'trace',
  'span',
  'log',
  'metric',
  'score',
];

/**
 * EventBatcher handles buffering and flushing of observability events.
 *
 * It maintains separate buffers for each event type and triggers flushes
 * based on:
 * - Batch size threshold
 * - Flush interval timeout
 * - Max file size threshold
 * - Manual flush() call
 * - Graceful shutdown
 */
export class EventBatcher {
  private buffers: Map<ObservabilityEventType, EventBuffer>;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private isShutdown = false;
  private flushPromise: Promise<void> | null = null;

  // Statistics
  private totalEventsWritten = 0;
  private totalFilesWritten = 0;
  private lastFlushAt: Date | null = null;

  constructor(private readonly config: EventBatcherConfig) {
    this.buffers = new Map();
    this.initializeBuffers();
    this.startFlushTimer();
  }

  /**
   * Initialize empty buffers for each event type
   */
  private initializeBuffers(): void {
    for (const type of EVENT_TYPES) {
      this.buffers.set(type, {
        type,
        events: [],
        currentFileSize: 0,
        currentFilePath: null,
      });
    }
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.config.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(error => {
          if (this.config.debug) {
            console.error('[ObservabilityWriter] Flush timer error:', error);
          }
        });
      }, this.config.flushIntervalMs);

      // Unref the timer so it doesn't prevent process exit
      if (this.flushTimer.unref) {
        this.flushTimer.unref();
      }
    }
  }

  /**
   * Stop the flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Add an event to the appropriate buffer
   */
  add(event: ObservabilityEvent): void {
    if (this.isShutdown) {
      throw new Error('Cannot add events after shutdown');
    }

    const buffer = this.buffers.get(event.type);
    if (!buffer) {
      throw new Error(`Unknown event type: ${event.type}`);
    }

    const eventSize = estimateEventSize(event);
    buffer.events.push(event);
    buffer.currentFileSize += eventSize;

    // Check if we should flush this buffer
    if (this.shouldFlushBuffer(buffer)) {
      // Trigger async flush (don't await)
      this.flushBuffer(buffer.type).catch(error => {
        if (this.config.debug) {
          console.error(`[ObservabilityWriter] Buffer flush error for ${buffer.type}:`, error);
        }
      });
    }
  }

  /**
   * Add multiple events
   */
  addMany(events: ObservabilityEvent[]): void {
    for (const event of events) {
      this.add(event);
    }
  }

  /**
   * Check if a buffer should be flushed
   */
  private shouldFlushBuffer(buffer: EventBuffer): boolean {
    // Flush if batch size exceeded
    if (buffer.events.length >= this.config.batchSize) {
      return true;
    }

    // Flush if file size exceeded
    if (buffer.currentFileSize >= this.config.maxFileSize) {
      return true;
    }

    return false;
  }

  /**
   * Flush a single buffer
   */
  private async flushBuffer(type: ObservabilityEventType): Promise<FlushResult> {
    const buffer = this.buffers.get(type);
    if (!buffer || buffer.events.length === 0) {
      return { filesWritten: 0, eventsWritten: 0, errors: [] };
    }

    const events = buffer.events;
    const eventCount = events.length;

    // Reset buffer immediately to allow new events
    buffer.events = [];
    buffer.currentFileSize = 0;
    buffer.currentFilePath = null;

    try {
      const filePath = generateFilePath({
        basePath: this.config.basePath,
        type,
        projectId: this.config.projectId,
      });

      const content = serializeEventsToBuffer(events);
      await this.config.fileStorage.write(filePath, content);

      this.totalEventsWritten += eventCount;
      this.totalFilesWritten += 1;

      if (this.config.debug) {
        console.log(`[ObservabilityWriter] Wrote ${eventCount} ${type} events to ${filePath}`);
      }

      return { filesWritten: 1, eventsWritten: eventCount, errors: [] };
    } catch (error) {
      const flushError: FlushError = {
        type,
        error: error instanceof Error ? error : new Error(String(error)),
        eventCount,
      };

      if (this.config.debug) {
        console.error(`[ObservabilityWriter] Failed to flush ${type} buffer:`, error);
      }

      // Re-add events to buffer on failure (best effort)
      buffer.events.unshift(...events);
      buffer.currentFileSize += events.reduce((sum, e) => sum + estimateEventSize(e), 0);

      return { filesWritten: 0, eventsWritten: 0, errors: [flushError] };
    }
  }

  /**
   * Flush all buffers
   */
  async flush(): Promise<FlushResult> {
    // Prevent concurrent flushes
    if (this.isFlushing) {
      if (this.flushPromise) {
        await this.flushPromise;
      }
      return { filesWritten: 0, eventsWritten: 0, errors: [] };
    }

    this.isFlushing = true;

    const flushOperation = async (): Promise<FlushResult> => {
      const results: FlushResult = {
        filesWritten: 0,
        eventsWritten: 0,
        errors: [],
      };

      // Flush all buffers in parallel
      const flushPromises = EVENT_TYPES.map(type => this.flushBuffer(type));
      const bufferResults = await Promise.all(flushPromises);

      for (const result of bufferResults) {
        results.filesWritten += result.filesWritten;
        results.eventsWritten += result.eventsWritten;
        results.errors.push(...result.errors);
      }

      this.lastFlushAt = new Date();

      if (this.config.onFlush) {
        this.config.onFlush(results);
      }

      return results;
    };

    this.flushPromise = flushOperation().finally(() => {
      this.isFlushing = false;
      this.flushPromise = null;
    });

    return this.flushPromise;
  }

  /**
   * Shutdown the batcher gracefully
   */
  async shutdown(): Promise<FlushResult> {
    if (this.isShutdown) {
      return { filesWritten: 0, eventsWritten: 0, errors: [] };
    }

    this.isShutdown = true;
    this.stopFlushTimer();

    // Wait for any in-progress flush to complete
    if (this.flushPromise) {
      await this.flushPromise;
    }

    // Final flush of all remaining events
    return this.flush();
  }

  /**
   * Get current buffer statistics
   */
  getStats(): {
    totalEventsBuffered: number;
    totalEventsWritten: number;
    totalFilesWritten: number;
    lastFlushAt: Date | null;
    buffersByType: Record<string, { eventCount: number; estimatedSize: number }>;
  } {
    const buffersByType: Record<string, { eventCount: number; estimatedSize: number }> = {};
    let totalEventsBuffered = 0;

    for (const [type, buffer] of this.buffers) {
      buffersByType[type] = {
        eventCount: buffer.events.length,
        estimatedSize: buffer.currentFileSize,
      };
      totalEventsBuffered += buffer.events.length;
    }

    return {
      totalEventsBuffered,
      totalEventsWritten: this.totalEventsWritten,
      totalFilesWritten: this.totalFilesWritten,
      lastFlushAt: this.lastFlushAt,
      buffersByType,
    };
  }

  /**
   * Check if the batcher has been shutdown
   */
  isShutdownComplete(): boolean {
    return this.isShutdown;
  }
}
```

---

### Phase 6: ObservabilityWriter Class

#### 6.1 Create writer.ts

**File**: `observability/writer/src/writer.ts`

```typescript
import type {
  Trace,
  Span,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  ObservabilityWriterConfig,
  FlushResult,
  WriterStats,
} from './types.js';
import { EventBatcher, type EventBatcherConfig } from './batcher.js';

/**
 * Default configuration values
 */
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_BASE_PATH = 'observability';

/**
 * ObservabilityWriter is the main class for recording observability events.
 *
 * It provides a simple API for recording traces, spans, logs, metrics, and scores.
 * Events are buffered in memory and periodically flushed to file storage as JSONL files.
 *
 * @example
 * ```typescript
 * import { ObservabilityWriter } from '@mastra/observability-writer';
 * import { LocalFileStorage } from '@mastra/observability-file-local';
 *
 * const writer = new ObservabilityWriter({
 *   fileStorage: new LocalFileStorage({ basePath: '/var/mastra/observability' }),
 *   projectId: 'proj_123',
 *   batchSize: 500,
 *   flushIntervalMs: 10000,
 * });
 *
 * // Record events
 * writer.recordTrace({ id: 'trace_1', projectId: 'proj_123', ... });
 * writer.recordSpan({ id: 'span_1', traceId: 'trace_1', ... });
 * writer.recordLog({ id: 'log_1', level: 'info', message: 'Hello', ... });
 *
 * // Graceful shutdown
 * await writer.shutdown();
 * ```
 */
export class ObservabilityWriter {
  private readonly batcher: EventBatcher;
  private readonly config: Required<ObservabilityWriterConfig>;

  constructor(config: ObservabilityWriterConfig) {
    // Apply defaults
    this.config = {
      fileStorage: config.fileStorage,
      projectId: config.projectId,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      flushIntervalMs: config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
      maxFileSize: config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
      basePath: config.basePath ?? DEFAULT_BASE_PATH,
      debug: config.debug ?? false,
    };

    // Validate configuration
    this.validateConfig();

    // Create the event batcher
    const batcherConfig: EventBatcherConfig = {
      fileStorage: this.config.fileStorage,
      projectId: this.config.projectId,
      batchSize: this.config.batchSize,
      flushIntervalMs: this.config.flushIntervalMs,
      maxFileSize: this.config.maxFileSize,
      basePath: this.config.basePath,
      debug: this.config.debug,
    };

    this.batcher = new EventBatcher(batcherConfig);
  }

  /**
   * Validate the configuration
   */
  private validateConfig(): void {
    if (!this.config.fileStorage) {
      throw new Error('fileStorage is required');
    }

    if (!this.config.projectId || typeof this.config.projectId !== 'string') {
      throw new Error('projectId is required and must be a string');
    }

    if (this.config.batchSize <= 0) {
      throw new Error('batchSize must be greater than 0');
    }

    if (this.config.flushIntervalMs < 0) {
      throw new Error('flushIntervalMs must be greater than or equal to 0');
    }

    if (this.config.maxFileSize <= 0) {
      throw new Error('maxFileSize must be greater than 0');
    }
  }

  /**
   * Record a trace event.
   *
   * Traces represent a complete request/operation from start to finish.
   * They contain spans which represent individual operations within the trace.
   *
   * @param trace - The trace event to record
   */
  recordTrace(trace: Trace): void {
    const event: ObservabilityEvent = {
      ...trace,
      type: 'trace',
      recordedAt: new Date().toISOString(),
    };
    this.batcher.add(event);
  }

  /**
   * Record a span event.
   *
   * Spans represent individual operations within a trace (e.g., LLM call, tool execution).
   *
   * @param span - The span event to record
   */
  recordSpan(span: Span): void {
    const event: ObservabilityEvent = {
      ...span,
      type: 'span',
      recordedAt: new Date().toISOString(),
    };
    this.batcher.add(event);
  }

  /**
   * Record a log event.
   *
   * Logs capture textual information with severity levels.
   *
   * @param log - The log event to record
   */
  recordLog(log: Log): void {
    const event: ObservabilityEvent = {
      ...log,
      type: 'log',
      recordedAt: new Date().toISOString(),
    };
    this.batcher.add(event);
  }

  /**
   * Record a metric event.
   *
   * Metrics capture numeric measurements (e.g., token counts, latency, costs).
   *
   * @param metric - The metric event to record
   */
  recordMetric(metric: Metric): void {
    const event: ObservabilityEvent = {
      ...metric,
      type: 'metric',
      recordedAt: new Date().toISOString(),
    };
    this.batcher.add(event);
  }

  /**
   * Record a score event.
   *
   * Scores capture evaluation results (e.g., quality scores, relevance scores).
   *
   * @param score - The score event to record
   */
  recordScore(score: Score): void {
    const event: ObservabilityEvent = {
      ...score,
      type: 'score',
      recordedAt: new Date().toISOString(),
    };
    this.batcher.add(event);
  }

  /**
   * Record multiple events at once.
   *
   * This is more efficient when you have multiple events to record
   * as it reduces function call overhead.
   *
   * @param events - Array of observability events to record
   */
  recordEvents(events: ObservabilityEvent[]): void {
    const timestampedEvents = events.map(event => ({
      ...event,
      recordedAt: event.recordedAt ?? new Date().toISOString(),
    }));
    this.batcher.addMany(timestampedEvents);
  }

  /**
   * Force flush all buffered events to storage.
   *
   * This is useful when you need to ensure events are persisted immediately,
   * for example before a deployment or at the end of a request.
   *
   * @returns Result of the flush operation including event counts and any errors
   */
  async flush(): Promise<FlushResult> {
    return this.batcher.flush();
  }

  /**
   * Shutdown the writer gracefully.
   *
   * This stops the flush timer and flushes all remaining buffered events.
   * After calling shutdown(), the writer cannot accept new events.
   *
   * @returns Result of the final flush operation
   */
  async shutdown(): Promise<FlushResult> {
    return this.batcher.shutdown();
  }

  /**
   * Get current writer statistics.
   *
   * Useful for monitoring and debugging.
   *
   * @returns Statistics about buffered and written events
   */
  getStats(): WriterStats {
    return this.batcher.getStats();
  }

  /**
   * Check if the writer has been shutdown.
   */
  isShutdown(): boolean {
    return this.batcher.isShutdownComplete();
  }

  /**
   * Get the project ID this writer is configured for.
   */
  getProjectId(): string {
    return this.config.projectId;
  }
}
```

---

### Phase 7: Main Exports

#### 7.1 Create index.ts

**File**: `observability/writer/src/index.ts`

```typescript
/**
 * @mastra/observability-writer
 *
 * Observability event writer for MastraAdmin.
 * Batches and writes traces, spans, logs, metrics, and scores to file storage as JSONL files.
 *
 * @packageDocumentation
 */

// Main class
export { ObservabilityWriter } from './writer.js';

// Types
export type {
  // Configuration
  ObservabilityWriterConfig,

  // Event types (re-exported from @mastra/admin)
  Trace,
  Span,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  ObservabilityEventType,

  // File storage (re-exported from @mastra/admin)
  FileStorageProvider,
  FileInfo,

  // Writer types
  EventBuffer,
  FlushResult,
  FlushError,
  WriterStats,
} from './types.js';

// Serializer utilities (for advanced usage and testing)
export {
  serializeEvent,
  serializeEvents,
  serializeEventsToBuffer,
  estimateEventSize,
  parseJsonl,
} from './serializer.js';

// File naming utilities (for advanced usage and testing)
export {
  generateFilePath,
  generateDirectoryPath,
  parseFilePath,
  isPendingFile,
  getProcessedFilePath,
} from './file-naming.js';

// Batcher (for advanced usage)
export { EventBatcher, type EventBatcherConfig } from './batcher.js';
```

---

### Phase 8: Tests

#### 8.1 Create serializer.test.ts

**File**: `observability/writer/src/serializer.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  serializeEvent,
  serializeEvents,
  serializeEventsToBuffer,
  estimateEventSize,
  parseJsonl,
} from './serializer.js';
import type { ObservabilityEvent } from './types.js';

describe('serializer', () => {
  const mockTrace: ObservabilityEvent = {
    type: 'trace',
    id: 'trace_123',
    projectId: 'proj_456',
    name: 'test-trace',
    startTime: '2025-01-23T12:00:00.000Z',
    endTime: '2025-01-23T12:00:01.000Z',
    status: 'ok',
    recordedAt: '2025-01-23T12:00:01.000Z',
  };

  const mockSpan: ObservabilityEvent = {
    type: 'span',
    id: 'span_789',
    traceId: 'trace_123',
    projectId: 'proj_456',
    name: 'llm-call',
    startTime: '2025-01-23T12:00:00.000Z',
    endTime: '2025-01-23T12:00:00.500Z',
    status: 'ok',
    recordedAt: '2025-01-23T12:00:00.500Z',
  };

  describe('serializeEvent', () => {
    it('should serialize a single event to JSON string', () => {
      const result = serializeEvent(mockTrace);
      expect(result).toBe(JSON.stringify(mockTrace));
    });

    it('should not include trailing newline', () => {
      const result = serializeEvent(mockTrace);
      expect(result.endsWith('\n')).toBe(false);
    });
  });

  describe('serializeEvents', () => {
    it('should serialize multiple events to JSONL format', () => {
      const events = [mockTrace, mockSpan];
      const result = serializeEvents(events);

      expect(result).toBe(
        JSON.stringify(mockTrace) + '\n' + JSON.stringify(mockSpan) + '\n'
      );
    });

    it('should end with a newline', () => {
      const result = serializeEvents([mockTrace]);
      expect(result.endsWith('\n')).toBe(true);
    });

    it('should return empty string for empty array', () => {
      const result = serializeEvents([]);
      expect(result).toBe('');
    });
  });

  describe('serializeEventsToBuffer', () => {
    it('should return a Buffer with JSONL content', () => {
      const events = [mockTrace, mockSpan];
      const result = serializeEventsToBuffer(events);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString('utf8')).toBe(serializeEvents(events));
    });
  });

  describe('estimateEventSize', () => {
    it('should return the byte size including newline', () => {
      const size = estimateEventSize(mockTrace);
      const actualSize = Buffer.byteLength(JSON.stringify(mockTrace), 'utf8') + 1;
      expect(size).toBe(actualSize);
    });

    it('should handle events with unicode characters', () => {
      const eventWithUnicode: ObservabilityEvent = {
        ...mockTrace,
        name: 'テスト-trace-🚀',
      };
      const size = estimateEventSize(eventWithUnicode);
      const actualSize = Buffer.byteLength(JSON.stringify(eventWithUnicode), 'utf8') + 1;
      expect(size).toBe(actualSize);
    });
  });

  describe('parseJsonl', () => {
    it('should parse JSONL content back to events', () => {
      const events = [mockTrace, mockSpan];
      const jsonl = serializeEvents(events);
      const parsed = parseJsonl(jsonl);

      expect(parsed).toEqual(events);
    });

    it('should handle empty lines', () => {
      const jsonl = JSON.stringify(mockTrace) + '\n\n' + JSON.stringify(mockSpan) + '\n';
      const parsed = parseJsonl(jsonl);

      expect(parsed).toHaveLength(2);
    });

    it('should handle single event', () => {
      const jsonl = JSON.stringify(mockTrace) + '\n';
      const parsed = parseJsonl(jsonl);

      expect(parsed).toEqual([mockTrace]);
    });
  });
});
```

#### 8.2 Create file-naming.test.ts

**File**: `observability/writer/src/file-naming.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateFilePath,
  generateDirectoryPath,
  parseFilePath,
  isPendingFile,
  getProcessedFilePath,
} from './file-naming.js';

describe('file-naming', () => {
  describe('generateFilePath', () => {
    it('should generate a valid file path', () => {
      const path = generateFilePath({
        basePath: 'observability',
        type: 'trace',
        projectId: 'proj_123',
      });

      expect(path).toMatch(/^observability\/trace\/proj_123\/\d{8}T\d{6}Z_[a-f0-9]+\.jsonl$/);
    });

    it('should use provided timestamp', () => {
      const timestamp = new Date('2025-01-23T12:00:00.000Z');
      const path = generateFilePath({
        basePath: 'observability',
        type: 'span',
        projectId: 'proj_456',
        timestamp,
      });

      expect(path).toContain('20250123T120000Z');
    });

    it('should handle different event types', () => {
      const types = ['trace', 'span', 'log', 'metric', 'score'] as const;

      for (const type of types) {
        const path = generateFilePath({
          basePath: 'obs',
          type,
          projectId: 'proj_1',
        });
        expect(path).toContain(`/${type}/`);
      }
    });

    it('should normalize trailing slashes in basePath', () => {
      const path = generateFilePath({
        basePath: 'observability/',
        type: 'log',
        projectId: 'proj_789',
      });

      expect(path).not.toContain('//');
      expect(path).toMatch(/^observability\/log\//);
    });
  });

  describe('generateDirectoryPath', () => {
    it('should generate directory path without filename', () => {
      const path = generateDirectoryPath({
        basePath: 'observability',
        type: 'metric',
        projectId: 'proj_123',
      });

      expect(path).toBe('observability/metric/proj_123');
    });
  });

  describe('parseFilePath', () => {
    it('should parse a valid file path', () => {
      const path = 'observability/trace/proj_123/20250123T120000Z_abc123def456.jsonl';
      const result = parseFilePath(path);

      expect(result).toEqual({
        basePath: 'observability',
        type: 'trace',
        projectId: 'proj_123',
        timestamp: '20250123T120000Z',
        uuid: 'abc123def456',
      });
    });

    it('should return null for invalid paths', () => {
      expect(parseFilePath('invalid/path.txt')).toBeNull();
      expect(parseFilePath('')).toBeNull();
      expect(parseFilePath('observability/trace/proj/file.json')).toBeNull();
    });

    it('should handle nested basePath', () => {
      const path = '/var/data/observability/span/proj_1/20250123T120000Z_xyz789.jsonl';
      const result = parseFilePath(path);

      expect(result).toEqual({
        basePath: '/var/data/observability',
        type: 'span',
        projectId: 'proj_1',
        timestamp: '20250123T120000Z',
        uuid: 'xyz789',
      });
    });
  });

  describe('isPendingFile', () => {
    it('should return true for pending JSONL files', () => {
      expect(isPendingFile('observability/trace/proj/file.jsonl')).toBe(true);
    });

    it('should return false for processed files', () => {
      expect(isPendingFile('observability/trace/proj/processed/file.jsonl')).toBe(false);
    });

    it('should return false for non-JSONL files', () => {
      expect(isPendingFile('observability/trace/proj/file.json')).toBe(false);
    });
  });

  describe('getProcessedFilePath', () => {
    it('should insert processed directory before filename', () => {
      const original = 'observability/trace/proj_123/20250123T120000Z_abc.jsonl';
      const processed = getProcessedFilePath(original);

      expect(processed).toBe('observability/trace/proj_123/processed/20250123T120000Z_abc.jsonl');
    });

    it('should handle file without directory', () => {
      const processed = getProcessedFilePath('file.jsonl');
      expect(processed).toBe('processed/file.jsonl');
    });
  });
});
```

#### 8.3 Create writer.test.ts

**File**: `observability/writer/src/writer.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObservabilityWriter } from './writer.js';
import type { FileStorageProvider, Trace, Span, Log, Metric, Score } from './types.js';
import { parseJsonl } from './serializer.js';

// Mock file storage provider
function createMockFileStorage(): FileStorageProvider & {
  files: Map<string, Buffer>;
  getFiles(): Map<string, Buffer>;
} {
  const files = new Map<string, Buffer>();

  return {
    type: 'mock' as const,
    files,
    getFiles: () => files,

    async write(path: string, content: Buffer | string): Promise<void> {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      files.set(path, buffer);
    },

    async read(path: string): Promise<Buffer> {
      const content = files.get(path);
      if (!content) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },

    async list(prefix: string): Promise<Array<{ path: string; size: number; lastModified: Date }>> {
      const result: Array<{ path: string; size: number; lastModified: Date }> = [];
      for (const [path, content] of files) {
        if (path.startsWith(prefix)) {
          result.push({ path, size: content.length, lastModified: new Date() });
        }
      }
      return result;
    },

    async delete(path: string): Promise<void> {
      files.delete(path);
    },

    async move(from: string, to: string): Promise<void> {
      const content = files.get(from);
      if (content) {
        files.set(to, content);
        files.delete(from);
      }
    },

    async exists(path: string): Promise<boolean> {
      return files.has(path);
    },
  };
}

describe('ObservabilityWriter', () => {
  let fileStorage: ReturnType<typeof createMockFileStorage>;
  let writer: ObservabilityWriter;

  beforeEach(() => {
    fileStorage = createMockFileStorage();
    writer = new ObservabilityWriter({
      fileStorage,
      projectId: 'test_project',
      batchSize: 5,
      flushIntervalMs: 0, // Disable automatic flush for testing
      debug: false,
    });
  });

  afterEach(async () => {
    await writer.shutdown();
  });

  describe('constructor', () => {
    it('should create writer with valid config', () => {
      expect(writer).toBeInstanceOf(ObservabilityWriter);
      expect(writer.getProjectId()).toBe('test_project');
    });

    it('should throw on missing fileStorage', () => {
      expect(() => new ObservabilityWriter({
        fileStorage: null as any,
        projectId: 'test',
      })).toThrow('fileStorage is required');
    });

    it('should throw on missing projectId', () => {
      expect(() => new ObservabilityWriter({
        fileStorage,
        projectId: '',
      })).toThrow('projectId is required');
    });

    it('should throw on invalid batchSize', () => {
      expect(() => new ObservabilityWriter({
        fileStorage,
        projectId: 'test',
        batchSize: 0,
      })).toThrow('batchSize must be greater than 0');
    });
  });

  describe('recordTrace', () => {
    it('should record a trace event', async () => {
      const trace: Trace = {
        id: 'trace_1',
        projectId: 'test_project',
        name: 'test-trace',
        startTime: '2025-01-23T12:00:00.000Z',
        endTime: '2025-01-23T12:00:01.000Z',
        status: 'ok',
      };

      writer.recordTrace(trace);
      await writer.flush();

      const files = fileStorage.getFiles();
      expect(files.size).toBe(1);

      const [path, content] = [...files.entries()][0];
      expect(path).toContain('/trace/');

      const events = parseJsonl(content.toString('utf8'));
      expect(events[0]).toMatchObject({
        type: 'trace',
        id: 'trace_1',
        name: 'test-trace',
      });
    });
  });

  describe('recordSpan', () => {
    it('should record a span event', async () => {
      const span: Span = {
        id: 'span_1',
        traceId: 'trace_1',
        projectId: 'test_project',
        name: 'llm-call',
        startTime: '2025-01-23T12:00:00.000Z',
        endTime: '2025-01-23T12:00:00.500Z',
        status: 'ok',
      };

      writer.recordSpan(span);
      await writer.flush();

      const files = fileStorage.getFiles();
      const [path] = [...files.keys()];
      expect(path).toContain('/span/');
    });
  });

  describe('recordLog', () => {
    it('should record a log event', async () => {
      const log: Log = {
        id: 'log_1',
        projectId: 'test_project',
        level: 'info',
        message: 'Test log message',
        timestamp: '2025-01-23T12:00:00.000Z',
      };

      writer.recordLog(log);
      await writer.flush();

      const files = fileStorage.getFiles();
      const [path] = [...files.keys()];
      expect(path).toContain('/log/');
    });
  });

  describe('recordMetric', () => {
    it('should record a metric event', async () => {
      const metric: Metric = {
        id: 'metric_1',
        projectId: 'test_project',
        name: 'token_count',
        value: 150,
        timestamp: '2025-01-23T12:00:00.000Z',
      };

      writer.recordMetric(metric);
      await writer.flush();

      const files = fileStorage.getFiles();
      const [path] = [...files.keys()];
      expect(path).toContain('/metric/');
    });
  });

  describe('recordScore', () => {
    it('should record a score event', async () => {
      const score: Score = {
        id: 'score_1',
        projectId: 'test_project',
        traceId: 'trace_1',
        name: 'relevance',
        value: 0.95,
        timestamp: '2025-01-23T12:00:00.000Z',
      };

      writer.recordScore(score);
      await writer.flush();

      const files = fileStorage.getFiles();
      const [path] = [...files.keys()];
      expect(path).toContain('/score/');
    });
  });

  describe('recordEvents', () => {
    it('should record multiple events at once', async () => {
      const events = [
        { type: 'trace' as const, id: 't1', projectId: 'p1', name: 'trace1', startTime: '', endTime: '', status: 'ok' as const },
        { type: 'span' as const, id: 's1', traceId: 't1', projectId: 'p1', name: 'span1', startTime: '', endTime: '', status: 'ok' as const },
        { type: 'log' as const, id: 'l1', projectId: 'p1', level: 'info' as const, message: 'test', timestamp: '' },
      ];

      writer.recordEvents(events);
      await writer.flush();

      const files = fileStorage.getFiles();
      // Should have 3 files (one per event type)
      expect(files.size).toBe(3);
    });
  });

  describe('batch flushing', () => {
    it('should auto-flush when batch size is reached', async () => {
      // Batch size is 5
      for (let i = 0; i < 5; i++) {
        writer.recordTrace({
          id: `trace_${i}`,
          projectId: 'test_project',
          name: 'test',
          startTime: '',
          endTime: '',
          status: 'ok',
        });
      }

      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 100));

      const files = fileStorage.getFiles();
      expect(files.size).toBe(1);

      const [, content] = [...files.entries()][0];
      const events = parseJsonl(content.toString('utf8'));
      expect(events.length).toBe(5);
    });
  });

  describe('getStats', () => {
    it('should return current statistics', async () => {
      writer.recordTrace({
        id: 'trace_1',
        projectId: 'test_project',
        name: 'test',
        startTime: '',
        endTime: '',
        status: 'ok',
      });

      const statsBefore = writer.getStats();
      expect(statsBefore.totalEventsBuffered).toBe(1);
      expect(statsBefore.totalEventsWritten).toBe(0);

      await writer.flush();

      const statsAfter = writer.getStats();
      expect(statsAfter.totalEventsBuffered).toBe(0);
      expect(statsAfter.totalEventsWritten).toBe(1);
      expect(statsAfter.totalFilesWritten).toBe(1);
      expect(statsAfter.lastFlushAt).toBeInstanceOf(Date);
    });
  });

  describe('shutdown', () => {
    it('should flush remaining events on shutdown', async () => {
      writer.recordTrace({
        id: 'trace_1',
        projectId: 'test_project',
        name: 'test',
        startTime: '',
        endTime: '',
        status: 'ok',
      });

      expect(fileStorage.getFiles().size).toBe(0);

      await writer.shutdown();

      expect(fileStorage.getFiles().size).toBe(1);
      expect(writer.isShutdown()).toBe(true);
    });

    it('should reject new events after shutdown', async () => {
      await writer.shutdown();

      expect(() => writer.recordTrace({
        id: 'trace_1',
        projectId: 'test_project',
        name: 'test',
        startTime: '',
        endTime: '',
        status: 'ok',
      })).toThrow('Cannot add events after shutdown');
    });
  });
});
```

---

### Phase 9: README

#### 9.1 Create README.md

**File**: `observability/writer/README.md`

```markdown
# @mastra/observability-writer

Observability event writer for MastraAdmin. Batches and writes traces, spans, logs, metrics, and scores to file storage as JSONL files.

## Installation

```bash
npm install @mastra/observability-writer
```

## Prerequisites

- Node.js >= 22.13.0
- A `FileStorageProvider` implementation (e.g., `@mastra/observability-file-local`)

## Usage

### Basic Configuration

```typescript
import { ObservabilityWriter } from '@mastra/observability-writer';
import { LocalFileStorage } from '@mastra/observability-file-local';

const writer = new ObservabilityWriter({
  fileStorage: new LocalFileStorage({ basePath: '/var/mastra/observability' }),
  projectId: 'proj_123',
});

// Record events
writer.recordTrace({
  id: 'trace_1',
  projectId: 'proj_123',
  name: 'agent-execution',
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  status: 'ok',
});

writer.recordSpan({
  id: 'span_1',
  traceId: 'trace_1',
  projectId: 'proj_123',
  name: 'llm-call',
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  status: 'ok',
});

writer.recordLog({
  id: 'log_1',
  projectId: 'proj_123',
  level: 'info',
  message: 'Agent completed successfully',
  timestamp: new Date().toISOString(),
});

// Graceful shutdown (flushes remaining events)
await writer.shutdown();
```

### Advanced Configuration

```typescript
const writer = new ObservabilityWriter({
  fileStorage,
  projectId: 'proj_123',

  // Buffer up to 500 events before flushing
  batchSize: 500,

  // Flush every 10 seconds regardless of batch size
  flushIntervalMs: 10000,

  // Start a new file after 5MB
  maxFileSize: 5 * 1024 * 1024,

  // Custom base path for files
  basePath: 'custom/observability',

  // Enable debug logging
  debug: true,
});
```

### Recording Multiple Events

```typescript
writer.recordEvents([
  { type: 'trace', id: 't1', projectId: 'p1', ... },
  { type: 'span', id: 's1', traceId: 't1', projectId: 'p1', ... },
  { type: 'log', id: 'l1', projectId: 'p1', ... },
]);
```

### Manual Flush

```typescript
// Force flush all buffered events
const result = await writer.flush();
console.log(`Flushed ${result.eventsWritten} events to ${result.filesWritten} files`);
```

### Monitoring Statistics

```typescript
const stats = writer.getStats();
console.log('Events buffered:', stats.totalEventsBuffered);
console.log('Events written:', stats.totalEventsWritten);
console.log('Files written:', stats.totalFilesWritten);
console.log('Last flush:', stats.lastFlushAt);
```

## File Format

Events are written as JSONL (JSON Lines) files:

```
{"type":"trace","id":"trace_1","projectId":"proj_123",...,"recordedAt":"2025-01-23T12:00:00.000Z"}
{"type":"trace","id":"trace_2","projectId":"proj_123",...,"recordedAt":"2025-01-23T12:00:01.000Z"}
```

### File Naming Convention

Files are organized by event type and project:

```
{basePath}/{type}/{projectId}/{timestamp}_{uuid}.jsonl
```

Example:
```
observability/traces/proj_123/20250123T120000Z_abc123def456.jsonl
observability/spans/proj_123/20250123T120500Z_789xyz000111.jsonl
```

## API Reference

### ObservabilityWriter

#### Constructor

```typescript
new ObservabilityWriter(config: ObservabilityWriterConfig)
```

#### Methods

| Method | Description |
|--------|-------------|
| `recordTrace(trace)` | Record a trace event |
| `recordSpan(span)` | Record a span event |
| `recordLog(log)` | Record a log event |
| `recordMetric(metric)` | Record a metric event |
| `recordScore(score)` | Record a score event |
| `recordEvents(events)` | Record multiple events |
| `flush()` | Force flush all buffered events |
| `shutdown()` | Gracefully shutdown the writer |
| `getStats()` | Get current writer statistics |
| `isShutdown()` | Check if writer has been shutdown |
| `getProjectId()` | Get the configured project ID |

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fileStorage` | `FileStorageProvider` | required | Storage provider for writing files |
| `projectId` | `string` | required | Project identifier for file organization |
| `batchSize` | `number` | 1000 | Max events to buffer before flushing |
| `flushIntervalMs` | `number` | 5000 | Max time between flushes (ms) |
| `maxFileSize` | `number` | 10MB | Max file size before rotation |
| `basePath` | `string` | 'observability' | Base path for files |
| `debug` | `boolean` | false | Enable debug logging |

## Related Packages

- `@mastra/admin` - Core types and interfaces
- `@mastra/observability-file-local` - Local filesystem storage
- `@mastra/observability-file-s3` - Amazon S3 storage
- `@mastra/observability-file-gcs` - Google Cloud Storage
- `@mastra/observability-clickhouse` - ClickHouse ingestion worker
```

---

## Dependencies

### From LANE 1 (Core Package)

This package depends on the following types and interfaces from `@mastra/admin`:

```typescript
// Event types
export interface Trace {
  id: string;
  projectId: string;
  name: string;
  startTime: string;
  endTime: string;
  status: 'ok' | 'error' | 'unset';
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  projectId: string;
  name: string;
  startTime: string;
  endTime: string;
  status: 'ok' | 'error' | 'unset';
  spanKind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  attributes?: Record<string, unknown>;
  events?: SpanEvent[];
}

export interface Log {
  id: string;
  projectId: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: string;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
}

export interface Metric {
  id: string;
  projectId: string;
  name: string;
  value: number;
  timestamp: string;
  unit?: string;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
}

export interface Score {
  id: string;
  projectId: string;
  traceId?: string;
  spanId?: string;
  name: string;
  value: number;
  timestamp: string;
  comment?: string;
  attributes?: Record<string, unknown>;
}

export type ObservabilityEventType = 'trace' | 'span' | 'log' | 'metric' | 'score';

export type ObservabilityEvent =
  | (Trace & { type: 'trace'; recordedAt?: string })
  | (Span & { type: 'span'; recordedAt?: string })
  | (Log & { type: 'log'; recordedAt?: string })
  | (Metric & { type: 'metric'; recordedAt?: string })
  | (Score & { type: 'score'; recordedAt?: string });

// File storage interface
export interface FileStorageProvider {
  readonly type: 'local' | 's3' | 'gcs' | string;
  write(path: string, content: Buffer | string): Promise<void>;
  read(path: string): Promise<Buffer>;
  list(prefix: string): Promise<FileInfo[]>;
  delete(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface FileInfo {
  path: string;
  size: number;
  lastModified: Date;
}
```

---

## Success Criteria

### Automated Verification

- [ ] Package builds successfully: `pnpm build:lib` in `observability/writer/`
- [ ] TypeScript type checking passes: `pnpm typecheck`
- [ ] All unit tests pass: `pnpm test`
- [ ] ESLint passes: `pnpm lint`

### Manual Verification

- [ ] Can create `ObservabilityWriter` with valid configuration
- [ ] Configuration validation rejects invalid configs
- [ ] `recordTrace()` buffers trace events correctly
- [ ] `recordSpan()` buffers span events correctly
- [ ] `recordLog()` buffers log events correctly
- [ ] `recordMetric()` buffers metric events correctly
- [ ] `recordScore()` buffers score events correctly
- [ ] `recordEvents()` handles multiple event types
- [ ] Auto-flush triggers when batch size is reached
- [ ] Auto-flush triggers on flush interval timeout
- [ ] Auto-flush triggers when max file size is exceeded
- [ ] Manual `flush()` writes all buffered events
- [ ] `shutdown()` flushes remaining events and stops timers
- [ ] Writer rejects new events after shutdown
- [ ] `getStats()` returns accurate statistics
- [ ] JSONL files have correct format (one JSON per line)
- [ ] File paths follow naming convention
- [ ] Events include `recordedAt` timestamp

### Integration Testing (with file-local)

- [ ] Events written to local filesystem can be read back
- [ ] Multiple flush cycles create separate files
- [ ] Large batches are handled correctly
- [ ] Concurrent event recording is thread-safe

---

## Implementation Checklist

### Phase 1: Package Setup
- [ ] Create `observability/writer/` directory
- [ ] Create `package.json`
- [ ] Create `tsconfig.json`
- [ ] Create `tsup.config.ts`
- [ ] Create `vitest.config.ts`
- [ ] Create `CHANGELOG.md`

### Phase 2: Core Types
- [ ] Create `src/types.ts` with re-exports and package-specific types

### Phase 3: JSONL Serializer
- [ ] Create `src/serializer.ts`
- [ ] Create `src/serializer.test.ts`

### Phase 4: File Naming
- [ ] Create `src/file-naming.ts`
- [ ] Create `src/file-naming.test.ts`

### Phase 5: Event Batcher
- [ ] Create `src/batcher.ts`

### Phase 6: ObservabilityWriter
- [ ] Create `src/writer.ts`
- [ ] Create `src/writer.test.ts`

### Phase 7: Main Exports
- [ ] Create `src/index.ts`

### Phase 8: Documentation
- [ ] Create `README.md`

### Phase 9: Integration
- [ ] Add to `pnpm-workspace.yaml` if needed
- [ ] Add to turbo.json build dependencies if needed
- [ ] Verify builds from monorepo root
