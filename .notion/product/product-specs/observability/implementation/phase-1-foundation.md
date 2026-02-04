# Phase 1: Foundation

**Status:** Planning
**Prerequisites:** None
**Estimated Scope:** Core infrastructure for unified observability

---

## Overview

Phase 1 establishes the foundational infrastructure for the unified observability system:
- Event bus architecture
- Exporter signal support declarations
- Context injection for `logger` and `metrics`
- DuckDB storage adapter for local development

---

## Package Change Strategy

Changes are organized by npm package to enable independent PRs and avoid cross-package breaking changes.

| PR | Package | Scope |
|----|---------|-------|
| PR 1.1 | `@mastra/core` | Interfaces, types, context changes |
| PR 1.2 | `@mastra/observability` | Event buses, base exporter updates |
| PR 1.3 | `stores/duckdb` | DuckDB observability storage |
| PR 1.4 | Individual exporters | Signal support declarations |

---

## PR 1.1: @mastra/core Changes

**Package:** `packages/core`
**Scope:** Interfaces, types, and context injection (no implementations)

### 1.1.1 Event Bus Interfaces

**File:** `packages/core/src/observability/types/bus.ts` (new)

```typescript
export interface ObservabilityEventBus<TEvent> {
  emit(event: TEvent): void;
  subscribe(handler: (event: TEvent) => void): () => void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

// Span lifecycle events only
export type TracingEventType =
  | 'span.started'
  | 'span.updated'
  | 'span.ended'
  | 'span.error';

export type TracingEvent =
  | { type: 'span.started'; exportedSpan: AnyExportedSpan }
  | { type: 'span.updated'; exportedSpan: AnyExportedSpan }
  | { type: 'span.ended'; exportedSpan: AnyExportedSpan }
  | { type: 'span.error'; exportedSpan: AnyExportedSpan; error: SpanErrorInfo };

export type MetricEvent = {
  type: 'metric';
  name: string;
  metricType: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
};

export type LogEvent = {
  type: 'log';
  record: LogRecord;
};

// Scores (separate from TracingEvent for independent handling/retention)
export type ScoreEvent = {
  type: 'score';
  traceId: string;
  spanId?: string;
  score: ScoreInput;
  timestamp: Date;
};

// Feedback (separate from TracingEvent for independent handling/retention)
export type FeedbackEvent = {
  type: 'feedback';
  traceId: string;
  spanId?: string;
  feedback: FeedbackInput;
  timestamp: Date;
};
```

**Tasks:**
- [ ] Create ObservabilityEventBus interface
- [ ] Define TracingEvent union type (span lifecycle only)
- [ ] Define MetricEvent type
- [ ] Define LogEvent type
- [ ] Define ScoreEvent type
- [ ] Define FeedbackEvent type
- [ ] Export from types index

### 1.1.2 Context Interfaces

**File:** `packages/core/src/observability/types/context.ts` (new)

```typescript
export interface LoggerContext {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface MetricsContext {
  counter(name: string): Counter;
  gauge(name: string): Gauge;
  histogram(name: string): Histogram;
}

export interface Counter {
  add(value: number, additionalLabels?: Record<string, string>): void;
}

export interface Gauge {
  set(value: number, additionalLabels?: Record<string, string>): void;
}

export interface Histogram {
  record(value: number, additionalLabels?: Record<string, string>): void;
}
```

**Tasks:**
- [ ] Create LoggerContext interface
- [ ] Create MetricsContext interface
- [ ] Create Counter, Gauge, Histogram interfaces
- [ ] Export from types index

### 1.1.3 Exporter Interface Extensions

**File:** `packages/core/src/observability/types/tracing.ts` (modify)

Add signal handlers to existing `ObservabilityExporter` interface. Handler presence = signal support (no separate flags needed).

```typescript
export interface ObservabilityExporter {
  readonly name: string;

  // Signal handlers - implement the ones you support
  // Handler presence = signal support
  onTracingEvent?(event: TracingEvent): void | Promise<void>;
  onMetricEvent?(event: MetricEvent): void | Promise<void>;
  onLogEvent?(event: LogEvent): void | Promise<void>;
  onScoreEvent?(event: ScoreEvent): void | Promise<void>;
  onFeedbackEvent?(event: FeedbackEvent): void | Promise<void>;

  // Lifecycle
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;

  // EXISTING (keep for backward compat)
  exportTracingEvent?(event: TracingEvent): Promise<void>;
  init?(options: InitExporterOptions): void;
  __setLogger?(logger: IMastraLogger): void;

  /** @deprecated Use span.addScore() or trace.addScore() instead */
  addScoreToTrace?(args: {...}): Promise<void>;
}
```

**Tasks:**
- [ ] Add new event handler method signatures
- [ ] Keep existing methods for backward compat
- [ ] Add JSDoc deprecation notices where appropriate

### 1.1.4 NoOp Context Implementations

**File:** `packages/core/src/observability/no-op/context.ts` (new)

```typescript
import { LoggerContext, MetricsContext, Counter, Gauge, Histogram } from '../types/context';

const noOpCounter: Counter = { add() {} };
const noOpGauge: Gauge = { set() {} };
const noOpHistogram: Histogram = { record() {} };

export const noOpLoggerContext: LoggerContext = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export const noOpMetricsContext: MetricsContext = {
  counter() { return noOpCounter; },
  gauge() { return noOpGauge; },
  histogram() { return noOpHistogram; },
};
```

**Tasks:**
- [ ] Create NoOp LoggerContext
- [ ] Create NoOp MetricsContext
- [ ] Create NoOp Counter, Gauge, Histogram
- [ ] Export as singletons

### 1.1.5 ObservabilityContextMixin Interface

**File:** `packages/core/src/observability/types/context.ts` (add to existing)

Define the mixin interface that all execution contexts will extend:

```typescript
export interface ObservabilityContextMixin {
  /** Tracing context for span operations */
  tracing: TracingContext;
  /** Logger for structured logging */
  logger: LoggerContext;
  /** Metrics for counters, gauges, histograms */
  metrics: MetricsContext;
  /** @deprecated Use `tracing` instead */
  tracingContext: TracingContext;
}
```

**Tasks:**
- [ ] Add ObservabilityContextMixin interface
- [ ] Export from types index

### 1.1.6 Context Factory

**File:** `packages/core/src/observability/context-factory.ts` (new)

```typescript
import { TracingContext } from './types/tracing';
import { LoggerContext, MetricsContext, ObservabilityContextMixin } from './types/context';
import { noOpLoggerContext, noOpMetricsContext } from './no-op/context';

// NoOp tracing context (reference existing implementation)
const noOpTracingContext: TracingContext = { currentSpan: undefined };

/**
 * Creates an observability context mixin with real or no-op implementations.
 * Use this when constructing execution contexts for tools, workflow steps, etc.
 */
export function createObservabilityContext(
  tracingContext?: TracingContext,
  loggerContext?: LoggerContext,
  metricsContext?: MetricsContext,
): ObservabilityContextMixin {
  const tracing = tracingContext ?? noOpTracingContext;

  return {
    tracing,
    logger: loggerContext ?? noOpLoggerContext,
    metrics: metricsContext ?? noOpMetricsContext,
    tracingContext: tracing,  // deprecated alias
  };
}
```

**Tasks:**
- [ ] Create context factory function
- [ ] Export from observability index

### 1.1.7 Update Context Types to Extend Mixin

Update all execution context types to extend `ObservabilityContextMixin`:

**File:** `packages/core/src/tools/types.ts` (modify)

```typescript
import { ObservabilityContextMixin } from '../observability/types/context';

interface ToolExecutionContext<...> extends ObservabilityContextMixin {
  mastra?: MastraUnion;
  requestContext?: RequestContext<TRequestContext>;
  abortSignal?: AbortSignal;
  writer?: ToolStream;
  agent?: AgentToolExecutionContext<TSuspend, TResume>;
  workflow?: WorkflowToolExecutionContext<TSuspend, TResume>;
  mcp?: MCPToolExecutionContext;
}
```

**File:** `packages/core/src/workflows/step.ts` (modify)

```typescript
import { ObservabilityContextMixin } from '../observability/types/context';

interface ExecuteFunctionParams<...> extends ObservabilityContextMixin {
  // existing properties...
}
```

**File:** `packages/core/src/processors/index.ts` (modify)

```typescript
import { ObservabilityContextMixin } from '../observability/types/context';

interface ProcessorContext extends ObservabilityContextMixin {
  // existing properties...
}
```

**Tasks:**
- [ ] Update ToolExecutionContext to extend ObservabilityContextMixin
- [ ] Update ExecuteFunctionParams to extend ObservabilityContextMixin
- [ ] Update ProcessorContext to extend ObservabilityContextMixin
- [ ] Add imports for ObservabilityContextMixin

### 1.1.8 Update Context Creation Points

**Files:**
- `packages/core/src/tools/tool-builder/builder.ts`
- `packages/core/src/workflows/handlers/step.ts`
- `packages/core/src/processors/runner.ts`

Use `createObservabilityContext()` when building execution contexts:

```typescript
import { createObservabilityContext } from '../observability/context-factory';

// In context creation code:
const context: ToolExecutionContext = {
  mastra,
  requestContext,
  ...createObservabilityContext(tracingCtx, loggerCtx, metricsCtx),
  // other properties...
};
```

**Tasks:**
- [ ] Use `createObservabilityContext()` in tool context creation
- [ ] Use `createObservabilityContext()` in workflow step context creation
- [ ] Use `createObservabilityContext()` in processor context creation
- [ ] Pass real contexts when observability is configured, no-ops otherwise

### 1.1.9 Storage Strategy Types

**File:** `packages/core/src/storage/domains/observability/types.ts` (modify)

Add strategy types for each signal (following existing `TracingStorageStrategy` pattern):

```typescript
// Existing
export type TracingStorageStrategy = 'realtime' | 'batch-with-updates' | 'insert-only';

// NEW: Logs storage strategies
export type LogsStorageStrategy = 'realtime' | 'batch';

// NEW: Metrics storage strategies
export type MetricsStorageStrategy = 'realtime' | 'batch';

// NEW: Scores storage strategies
export type ScoresStorageStrategy = 'realtime' | 'batch';

// NEW: Feedback storage strategies
export type FeedbackStorageStrategy = 'realtime' | 'batch';
```

**Strategy meanings:**
- `realtime` - Write immediately as events arrive
- `batch` - Buffer events and write in batches (better throughput)
- `batch-with-updates` - (tracing only) Batch writes with span update support
- `insert-only` - (tracing only) Append-only, no span updates (ClickHouse style)

**Tasks:**
- [ ] Add LogsStorageStrategy type
- [ ] Add MetricsStorageStrategy type
- [ ] Add ScoresStorageStrategy type
- [ ] Add FeedbackStorageStrategy type

### 1.1.10 Storage Strategy Getters

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

Add strategy getters for new signals. Note: `tracingStrategy` keeps its existing non-null default for backward compatibility.

```typescript
// Helper type for strategy getter return
type StrategyHint<T> = { preferred: T; supported: T[] } | null;

abstract class ObservabilityStorage extends StorageDomain {
  // EXISTING: Tracing - keeps non-null default for backward compat
  // If a store has ObservabilityStorage domain, it supports tracing
  // TODO(2.0): Change to return null by default for consistency with other signals
  public get tracingStrategy(): StrategyHint<TracingStorageStrategy> {
    return {
      preferred: 'batch-with-updates',
      supported: ['realtime', 'batch-with-updates', 'insert-only'],
    };
  }

  // NEW: Logs, Metrics, Scores, Feedback - null by default (opt-in)
  public get logsStrategy(): StrategyHint<LogsStorageStrategy> {
    return null;
  }

  public get metricsStrategy(): StrategyHint<MetricsStorageStrategy> {
    return null;
  }

  public get scoresStrategy(): StrategyHint<ScoresStorageStrategy> {
    return null;
  }

  public get feedbackStrategy(): StrategyHint<FeedbackStorageStrategy> {
    return null;
  }
}
```

**Notes:**
- `ObservabilityStorage` is an optional domain - stores without it don't support any observability
- If domain exists: tracing supported by default (backward compat)
- New signals (logs/metrics/scores/feedback): `null` by default, must explicitly opt-in
- `null` = not supported, non-null = supported with preferred strategy
- Stores that want logs/metrics WITHOUT tracing can override `tracingStrategy` to return `null`

**Tasks:**
- [ ] Add StrategyHint type helper
- [ ] Add logsStrategy getter (default null)
- [ ] Add metricsStrategy getter (default null)
- [ ] Add scoresStrategy getter (default null)
- [ ] Add feedbackStrategy getter (default null)

### PR 1.1 Testing

**Tasks:**
- [ ] Test context factory with no-ops
- [ ] Test context factory with real contexts
- [ ] Test backward compat (tracingContext alias)
- [ ] Test type exports compile correctly
- [ ] Ensure existing tests still pass

---

## PR 1.2: @mastra/observability Changes

**Package:** `observability/mastra`
**Scope:** Event bus implementations, base exporter updates

### 1.2.1 Base ObservabilityEventBus Implementation

**File:** `observability/mastra/src/bus/base.ts` (new)

```typescript
import { ObservabilityEventBus } from '@mastra/core';

export class BaseObservabilityEventBus<TEvent> implements ObservabilityEventBus<TEvent> {
  private subscribers: Set<(event: TEvent) => void> = new Set();
  private buffer: TEvent[] = [];
  private bufferSize: number;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(options: { bufferSize?: number; flushIntervalMs?: number } = {}) {
    this.bufferSize = options.bufferSize ?? 100;
    if (options.flushIntervalMs) {
      this.flushInterval = setInterval(() => this.flush(), options.flushIntervalMs);
    }
  }

  emit(event: TEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  subscribe(handler: (event: TEvent) => void): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  async flush(): Promise<void> {
    const events = this.buffer.splice(0);
    await Promise.all(
      events.flatMap(event =>
        Array.from(this.subscribers).map(handler =>
          Promise.resolve(handler(event)).catch(err =>
            console.error('[ObservabilityEventBus] Handler error:', err)
          )
        )
      )
    );
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
    this.subscribers.clear();
  }
}
```

**Tasks:**
- [ ] Implement BaseObservabilityEventBus
- [ ] Add buffering support
- [ ] Add flush interval option
- [ ] Handle errors gracefully

### 1.2.2 ObservabilityBus Implementation

**File:** `observability/mastra/src/bus/observability.ts` (new)

The main event bus for all observability signals. Routes events to appropriate exporter handlers based on event type.

```typescript
import {
  TracingEvent, MetricEvent, LogEvent, ScoreEvent, FeedbackEvent,
  ObservabilityExporter
} from '@mastra/core';
import { BaseObservabilityEventBus } from './base';

// Union of all observability events
export type ObservabilityEvent =
  | TracingEvent
  | MetricEvent
  | LogEvent
  | ScoreEvent
  | FeedbackEvent;

export class ObservabilityBus extends BaseObservabilityEventBus<ObservabilityEvent> {
  private exporters: ObservabilityExporter[] = [];

  registerExporter(exporter: ObservabilityExporter): void {
    this.exporters.push(exporter);
  }

  emit(event: ObservabilityEvent): void {
    // Route to appropriate handler based on event type
    for (const exporter of this.exporters) {
      this.routeToHandler(exporter, event);
    }

    // Also buffer for batch processing if needed
    super.emit(event);
  }

  private routeToHandler(exporter: ObservabilityExporter, event: ObservabilityEvent): void {
    switch (event.type) {
      case 'span.started':
      case 'span.updated':
      case 'span.ended':
      case 'span.error':
        exporter.onTracingEvent?.(event);
        break;
      case 'metric':
        exporter.onMetricEvent?.(event);
        break;
      case 'log':
        exporter.onLogEvent?.(event);
        break;
      case 'score':
        exporter.onScoreEvent?.(event);
        break;
      case 'feedback':
        exporter.onFeedbackEvent?.(event);
        break;
    }
  }
}
```

**Tasks:**
- [ ] Create ObservabilityBus with type-based routing
- [ ] Add exporter registration
- [ ] Route events to appropriate handlers
- [ ] Handle all event types from the start (handlers are no-ops until implemented)

### 1.2.5 Update BaseExporter

**File:** `observability/mastra/src/exporters/base.ts` (modify)

```typescript
export abstract class BaseExporter implements ObservabilityExporter {
  // Default handler that delegates to existing method for backward compat
  onTracingEvent(event: TracingEvent): void | Promise<void> {
    return this.exportTracingEvent(event);
  }

  // Subclasses implement handlers for the signals they support
  // No onMetricEvent = doesn't support metrics
  // No onLogEvent = doesn't support logs
  // etc.

  // EXISTING methods remain unchanged
  // ...
}
```

**Tasks:**
- [ ] Add default onTracingEvent that calls existing method
- [ ] Document that handler presence = signal support

### 1.2.3 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

Refactor to use ObservabilityBus:

```typescript
export class BaseObservabilityInstance {
  private observabilityBus: ObservabilityBus;

  constructor(config: ObservabilityConfig) {
    // Initialize single bus for all signals
    this.observabilityBus = new ObservabilityBus();

    // Register exporters (bus routes events to appropriate handlers)
    for (const exporter of config.exporters) {
      this.observabilityBus.registerExporter(exporter);
    }
  }

  // Emit any observability event (bus routes to appropriate handlers)
  protected emit(event: ObservabilityEvent): void {
    this.observabilityBus.emit(event);
  }

  async flush(): Promise<void> {
    await this.observabilityBus.flush();
  }

  async shutdown(): Promise<void> {
    await this.observabilityBus.shutdown();
  }
}
```

**Tasks:**
- [ ] Create ObservabilityBus in constructor
- [ ] Register exporters with bus
- [ ] Add convenience emit methods for each event type
- [ ] Add flush/shutdown delegation

### PR 1.2 Testing

**Tasks:**
- [ ] Test BaseObservabilityEventBus emit/subscribe/flush
- [ ] Test ObservabilityBus routing to exporters
- [ ] Test exporter receives only events for handlers it implements
- [ ] Test backward compat with existing exporters

---

## PR 1.3: DuckDB Storage Adapter

**Package:** `stores/duckdb`
**Scope:** Add observability storage to existing DuckDB package

### 1.3.1 Package Structure

**Current structure:**
```
stores/duckdb/src/
├── index.ts
├── vector/
│   ├── index.ts
│   └── types.ts
```

**Add:**
```
stores/duckdb/src/
├── index.ts (modify - add exports)
├── storage/
│   ├── index.ts (DuckDBStore)
│   └── domains/
│       └── observability/
│           └── index.ts (ObservabilityDuckDB)
├── vector/
│   └── ...
```

### 1.3.2 Create DuckDBStore

**File:** `stores/duckdb/src/storage/index.ts` (new)

**Tasks:**
- [ ] Create DuckDBStore class extending MastraCompositeStore
- [ ] Initialize ObservabilityDuckDB domain
- [ ] Support `:memory:` and file-based persistence
- [ ] Follow PostgresStore/LibSQLStore patterns

### 1.3.3 Create ObservabilityDuckDB

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (new)

```typescript
import { ObservabilityStorage, TracingStorageStrategy } from '@mastra/core/storage';

export class ObservabilityDuckDB extends ObservabilityStorage {
  // Override to declare tracing support
  public override get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      preferred: 'batch-with-updates',  // Batch is more efficient
      supported: ['realtime', 'batch-with-updates'],
    };
  }

  // logsStrategy, metricsStrategy, etc. remain null (not supported in Phase 1)
  // Will be overridden in later phases when those features are added

  async init(): Promise<void> {
    // Create spans table...
  }

  // ... other method implementations
}
```

**Tasks:**
- [ ] Extend ObservabilityStorage base class
- [ ] Override `tracingStrategy` getter to declare support
- [ ] Implement `init()` - create spans table
- [ ] Implement `batchCreateSpans()`
- [ ] Implement `batchUpdateSpans()`
- [ ] Implement `getSpan()`
- [ ] Implement `getRootSpan()`
- [ ] Implement `getTrace()`
- [ ] Implement `listTraces()`
- [ ] Implement `batchDeleteTraces()`
- [ ] Implement `dangerouslyClearAll()`

### 1.3.4 Spans Table Schema

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_spans (
  id VARCHAR PRIMARY KEY,
  trace_id VARCHAR NOT NULL,
  parent_span_id VARCHAR,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  status VARCHAR,
  input JSON,
  output JSON,
  metadata JSON,
  tags VARCHAR[],
  entity_type VARCHAR,
  entity_name VARCHAR,
  entity_id VARCHAR,
  user_id VARCHAR,
  organization_id VARCHAR,
  resource_id VARCHAR,
  run_id VARCHAR,
  session_id VARCHAR,
  thread_id VARCHAR,
  request_id VARCHAR,
  environment VARCHAR,
  service_name VARCHAR,
  source VARCHAR,
  error_info JSON,
  has_child_error BOOLEAN DEFAULT FALSE,
  scope JSON,
  attributes JSON
);

CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON mastra_ai_spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_started_at ON mastra_ai_spans(started_at DESC);
```

**Tasks:**
- [ ] Create table in `init()`
- [ ] Create indexes

### 1.3.5 Export Updates

**File:** `stores/duckdb/src/index.ts` (modify)

**Tasks:**
- [ ] Export DuckDBStore
- [ ] Export types

### PR 1.3 Testing

**Tasks:**
- [ ] Test spans CRUD operations
- [ ] Test listTraces with filters
- [ ] Test in-memory mode
- [ ] Test file persistence mode

---

## PR 1.4: Exporter Signal Declarations

**Packages:** Individual exporter packages
**Scope:** Add signal support declarations to existing exporters

### 1.4.1 DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts`

**Tasks:**
- [ ] Implement `onTracingEvent()` (delegates to existing method)
- [ ] Stub `onScoreEvent()` for Phase 4
- [ ] Other handlers added in later phases

### 1.4.2 JsonExporter

**File:** `observability/mastra/src/exporters/json.ts`

**Tasks:**
- [ ] Implement `onTracingEvent()` (output spans as JSON)
- [ ] Implement all handlers for debugging purposes

### 1.4.3 LangfuseExporter

**Package:** `observability/langfuse`

**Tasks:**
- [ ] Implement `onTracingEvent()` (existing functionality)
- [ ] Stub `onScoreEvent()` for Phase 4

### 1.4.4 BraintrustExporter

**Package:** `observability/braintrust`

**Tasks:**
- [ ] Implement `onTracingEvent()` handler

### 1.4.5 OtelExporter

**Package:** `observability/otel-exporter`

**Tasks:**
- [ ] Implement `onTracingEvent()` handler

### 1.4.6 Other Exporters

**Tasks:**
- [ ] Audit all exporters in `observability/` directory
- [ ] Add `onTracingEvent()` handler to each

### PR 1.4 Testing

**Tasks:**
- [ ] Verify each exporter loads without error
- [ ] Verify handlers are called correctly

---

## Dependencies Between PRs

```
PR 1.1 (@mastra/core)
    ↓
PR 1.2 (@mastra/observability) ← depends on core types
    ↓
PR 1.3 (stores/duckdb) ← depends on core storage interface
    ↓
PR 1.4 (exporters) ← depends on observability base
```

**Merge order:** 1.1 → 1.2 → 1.3 → 1.4

---

## Definition of Done

- [ ] All PRs merged
- [ ] All contexts have `tracing`, `logger`, `metrics` (with no-ops)
- [ ] Event buses implemented and wired
- [ ] All existing exporters declare signal support
- [ ] DuckDB adapter stores and retrieves spans
- [ ] Existing tests pass
- [ ] New tests for all added functionality

---

## Open Questions

1. Should we add a changeset for each PR, or one for the whole phase?
2. Do we need migration guides for the deprecated `tracingContext`?
3. Should DuckDB be the default storage for local dev automatically?
