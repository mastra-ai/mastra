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
export interface EventBus<TEvent> {
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
- [ ] Create EventBus interface
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

Add signal support declarations to existing `ObservabilityExporter` interface:

```typescript
export interface ObservabilityExporter {
  readonly name: string;

  // NEW: Signal support declarations (all optional, undefined = false)
  readonly supportsTraces?: boolean;
  readonly supportsMetrics?: boolean;
  readonly supportsLogs?: boolean;
  readonly supportsScores?: boolean;
  readonly supportsFeedback?: boolean;

  // NEW: Signal handlers (optional based on support)
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
- [ ] Add signal support properties to interface
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

### 1.1.5 Update ToolExecutionContext

**File:** `packages/core/src/tools/types.ts` (modify)

```typescript
interface ToolExecutionContext<...> {
  mastra?: MastraUnion;
  requestContext?: RequestContext<TRequestContext>;

  // Observability (always present, no-op if not configured)
  tracing: TracingContext;
  logger: LoggerContext;
  metrics: MetricsContext;

  /** @deprecated Use `tracing` instead */
  tracingContext: TracingContext;

  abortSignal?: AbortSignal;
  writer?: ToolStream;
  agent?: AgentToolExecutionContext<TSuspend, TResume>;
  workflow?: WorkflowToolExecutionContext<TSuspend, TResume>;
  mcp?: MCPToolExecutionContext;
}
```

**Tasks:**
- [ ] Add `tracing`, `logger`, `metrics` to interface (non-optional)
- [ ] Add deprecated `tracingContext` alias
- [ ] Update JSDoc comments

### 1.1.6 Update ExecuteFunctionParams (Workflow Steps)

**File:** `packages/core/src/workflows/step.ts` (modify)

**Tasks:**
- [ ] Add `tracing`, `logger`, `metrics` to ExecuteFunctionParams
- [ ] Add deprecated `tracingContext` alias
- [ ] Ensure existing `tracingContext` references still work

### 1.1.7 Update ProcessorContext

**File:** `packages/core/src/processors/index.ts` (modify)

**Tasks:**
- [ ] Add `tracing`, `logger`, `metrics` to ProcessorContext
- [ ] Add deprecated `tracingContext` alias

### 1.1.8 Context Factory

**File:** `packages/core/src/observability/context-factory.ts` (new)

```typescript
import { TracingContext } from './types/tracing';
import { LoggerContext, MetricsContext } from './types/context';
import { noOpLoggerContext, noOpMetricsContext } from './no-op/context';

export interface ObservabilityContextMixin {
  tracing: TracingContext;
  logger: LoggerContext;
  metrics: MetricsContext;
  /** @deprecated Use `tracing` instead */
  tracingContext: TracingContext;
}

// NoOp tracing context (reference existing implementation)
const noOpTracingContext: TracingContext = { currentSpan: undefined };

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
    tracingContext: tracing,
  };
}
```

**Tasks:**
- [ ] Create context factory function
- [ ] Export from observability index

### 1.1.9 Update Context Creation Points

**Files:**
- `packages/core/src/tools/tool-builder/builder.ts`
- `packages/core/src/workflows/handlers/step.ts`
- `packages/core/src/processors/runner.ts`

**Tasks:**
- [ ] Use `createObservabilityContext()` in tool context creation
- [ ] Use `createObservabilityContext()` in workflow step context creation
- [ ] Use `createObservabilityContext()` in processor context creation
- [ ] Pass real contexts when observability is configured, no-ops otherwise

### 1.1.10 Storage Interface Extensions

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

Add capability declarations:

```typescript
export interface StorageCapabilities {
  tracing: {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  };
  logs: {
    preferred?: 'realtime' | 'insert-only';
    supported: boolean;
  };
  metrics: {
    preferred?: 'realtime' | 'insert-only';
    supported: boolean;
  };
  scores: { supported: boolean };
  feedback: { supported: boolean };
}

abstract class ObservabilityStorage extends StorageDomain {
  // Existing methods...

  get capabilities(): StorageCapabilities {
    return {
      tracing: { preferred: 'batch-with-updates', supported: ['realtime', 'batch-with-updates', 'insert-only'] },
      logs: { supported: false },
      metrics: { supported: false },
      scores: { supported: false },
      feedback: { supported: false },
    };
  }
}
```

**Tasks:**
- [ ] Define StorageCapabilities interface
- [ ] Add capabilities getter to base class
- [ ] Document capability meanings

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

### 1.2.1 Base EventBus Implementation

**File:** `observability/mastra/src/bus/base.ts` (new)

```typescript
import { EventBus } from '@mastra/core';

export class BaseEventBus<TEvent> implements EventBus<TEvent> {
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
            console.error('[EventBus] Handler error:', err)
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
- [ ] Implement BaseEventBus
- [ ] Add buffering support
- [ ] Add flush interval option
- [ ] Handle errors gracefully

### 1.2.2 TracingBus Implementation

**File:** `observability/mastra/src/bus/tracing.ts` (new)

> **Note:** In Phase 4, TracingBus will be renamed to `ObservabilityBus` and extended to handle all event types (TracingEvent, ScoreEvent, FeedbackEvent) with type-based routing to appropriate handlers.

```typescript
import { TracingEvent } from '@mastra/core';
import { BaseEventBus } from './base';

export class TracingBus extends BaseEventBus<TracingEvent> {
  private metricsBus?: MetricsBus;

  setMetricsBus(bus: MetricsBus): void {
    this.metricsBus = bus;
  }

  emit(event: TracingEvent): void {
    super.emit(event);

    // Cross-emit to MetricsBus for auto-extracted metrics (Phase 3)
    // this.emitMetrics(event);
  }

  // Phase 3: Auto-extract metrics from span events
  // private emitMetrics(event: TracingEvent): void { ... }
}
```

**Tasks:**
- [ ] Create TracingBus extending BaseEventBus
- [ ] Add MetricsBus reference for cross-emission
- [ ] Stub cross-emission for Phase 3

### 1.2.3 MetricsBus Implementation

**File:** `observability/mastra/src/bus/metrics.ts` (new)

**Tasks:**
- [ ] Create MetricsBus extending BaseEventBus
- [ ] Stub for Phase 3 usage

### 1.2.4 LogsBus Implementation

**File:** `observability/mastra/src/bus/logs.ts` (new)

**Tasks:**
- [ ] Create LogsBus extending BaseEventBus
- [ ] Stub for Phase 2 usage

### 1.2.5 Update BaseExporter

**File:** `observability/mastra/src/exporters/base.ts` (modify)

```typescript
export abstract class BaseExporter implements ObservabilityExporter {
  // NEW: Default signal support (subclasses override)
  readonly supportsTraces: boolean = true;
  readonly supportsMetrics: boolean = false;
  readonly supportsLogs: boolean = false;
  readonly supportsScores: boolean = false;
  readonly supportsFeedback: boolean = false;

  // NEW: Default handlers that delegate to existing methods
  onTracingEvent(event: TracingEvent): void | Promise<void> {
    return this.exportTracingEvent(event);
  }

  onMetricEvent?(event: MetricEvent): void | Promise<void> {
    // Subclasses override if supportsMetrics
  }

  onLogEvent?(event: LogEvent): void | Promise<void> {
    // Subclasses override if supportsLogs
  }

  // EXISTING methods remain unchanged
  // ...
}
```

**Tasks:**
- [ ] Add default signal support properties
- [ ] Add default onTracingEvent that calls existing method
- [ ] Add stub onMetricEvent and onLogEvent

### 1.2.6 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

Refactor to use event buses:

```typescript
export class BaseObservabilityInstance {
  private tracingBus: TracingBus;
  private metricsBus: MetricsBus;
  private logsBus: LogsBus;

  constructor(config: ObservabilityConfig) {
    // Initialize buses
    this.tracingBus = new TracingBus();
    this.metricsBus = new MetricsBus();
    this.logsBus = new LogsBus();

    // Wire cross-bus emission
    this.tracingBus.setMetricsBus(this.metricsBus);

    // Subscribe exporters to appropriate buses
    this.subscribeExporters(config.exporters);
  }

  private subscribeExporters(exporters: ObservabilityExporter[]): void {
    for (const exporter of exporters) {
      if (exporter.supportsTraces && exporter.onTracingEvent) {
        this.tracingBus.subscribe(event => exporter.onTracingEvent!(event));
      }
      if (exporter.supportsMetrics && exporter.onMetricEvent) {
        this.metricsBus.subscribe(event => exporter.onMetricEvent!(event));
      }
      if (exporter.supportsLogs && exporter.onLogEvent) {
        this.logsBus.subscribe(event => exporter.onLogEvent!(event));
      }
    }
  }

  // Refactor existing exportTracingEvent to emit to bus
  protected async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.tracingBus.emit(event);
  }
}
```

**Tasks:**
- [ ] Create bus instances in constructor
- [ ] Subscribe exporters based on signal support
- [ ] Refactor exportTracingEvent to use TracingBus
- [ ] Add flush/shutdown to propagate to buses

### PR 1.2 Testing

**Tasks:**
- [ ] Test BaseEventBus emit/subscribe/flush
- [ ] Test TracingBus routing to exporters
- [ ] Test exporter receives only supported signals
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

**Tasks:**
- [ ] Extend ObservabilityStorage base class
- [ ] Implement `init()` - create spans table
- [ ] Implement `batchCreateSpans()`
- [ ] Implement `batchUpdateSpans()`
- [ ] Implement `getSpan()`
- [ ] Implement `getRootSpan()`
- [ ] Implement `getTrace()`
- [ ] Implement `listTraces()`
- [ ] Implement `batchDeleteTraces()`
- [ ] Implement `dangerouslyClearAll()`
- [ ] Declare capabilities (tracing only for now)

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
- [ ] Add `supportsTraces = true`
- [ ] Add `supportsMetrics = false` (Phase 3)
- [ ] Add `supportsLogs = false` (Phase 2)
- [ ] Add `supportsScores = true`
- [ ] Add `supportsFeedback = false` (Phase 4)

### 1.4.2 JsonExporter

**File:** `observability/mastra/src/exporters/json.ts`

**Tasks:**
- [ ] Add signal support declarations
- [ ] All signals true for debugging

### 1.4.3 LangfuseExporter

**Package:** `observability/langfuse`

**Tasks:**
- [ ] Add `supportsTraces = true`
- [ ] Add `supportsMetrics = false`
- [ ] Add `supportsLogs = false`
- [ ] Add `supportsScores = true`

### 1.4.4 BraintrustExporter

**Package:** `observability/braintrust`

**Tasks:**
- [ ] Add signal support declarations

### 1.4.5 OtelExporter

**Package:** `observability/otel-exporter`

**Tasks:**
- [ ] Add signal support declarations

### 1.4.6 Other Exporters

**Tasks:**
- [ ] Audit all exporters in `observability/` directory
- [ ] Add signal support declarations to each

### PR 1.4 Testing

**Tasks:**
- [ ] Verify each exporter loads without error
- [ ] Verify signal declarations are correct

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
