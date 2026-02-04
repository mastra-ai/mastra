# PR 1.1: @mastra/core Changes

**Package:** `packages/core`
**Scope:** Interfaces, types, and context injection (no implementations)

---

## 1.1.1 Event Bus Interfaces

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

---

## 1.1.2 Context Interfaces

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

---

## 1.1.3 Exporter Interface Extensions

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

---

## 1.1.4 NoOp Context Implementations

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

---

## 1.1.5 ObservabilityContextMixin Interface

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

---

## 1.1.6 Context Factory

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

---

## 1.1.7 Update Context Types to Extend Mixin

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

---

## 1.1.8 Update Context Creation Points

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

---

## 1.1.9 Storage Strategy Types

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

---

## 1.1.10 Storage Strategy Getters

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

---

## PR 1.1 Testing

**Tasks:**
- [ ] Test context factory with no-ops
- [ ] Test context factory with real contexts
- [ ] Test backward compat (tracingContext alias)
- [ ] Test type exports compile correctly
- [ ] Ensure existing tests still pass
