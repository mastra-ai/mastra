# PR 1.1: @mastra/core Changes

**Package:** `packages/core`
**Scope:** Interfaces, types, and context injection (no implementations)

---

## File Organization

Types are organized by signal to match the existing `tracing.ts` pattern:

```
packages/core/src/observability/types/
├── tracing.ts      # (existing) TracingContext, Span, ExportedSpan, SpanRecord, TracingEvent
├── logging.ts      # (new) LoggerContext, ExportedLog, LogEvent
├── metrics.ts      # (new) MetricsContext, ExportedMetric, MetricEvent, cardinality config
├── scores.ts       # (new) ScoreInput, ExportedScore, ScoreEvent
├── feedback.ts     # (new) FeedbackInput, ExportedFeedback, FeedbackEvent
├── bus.ts          # (new) ObservabilityEventBus interface, ObservabilityEvent union
├── context.ts      # (new) ObservabilityContextMixin (combines signal contexts)
└── index.ts        # re-exports all types
```

**Note:** Record types (LogRecord, MetricRecord, ScoreRecord, FeedbackRecord) are defined in Phase 6 as Zod schemas for storage/API validation.

---

## 1.1.1 Event Bus Interface

**File:** `packages/core/src/observability/types/bus.ts` (new)

```typescript
import { TracingEvent } from './tracing';
import { LogEvent } from './logging';
import { MetricEvent } from './metrics';
import { ScoreEvent } from './scores';
import { FeedbackEvent } from './feedback';

export interface ObservabilityEventBus<TEvent> {
  emit(event: TEvent): void;
  subscribe(handler: (event: TEvent) => void): () => void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

// Union of all observability events
export type ObservabilityEvent =
  | TracingEvent
  | LogEvent
  | MetricEvent
  | ScoreEvent
  | FeedbackEvent;
```

**Tasks:**
- [ ] Create ObservabilityEventBus interface
- [ ] Define ObservabilityEvent union (imports from signal files)
- [ ] Export from types index

---

## 1.1.2 Logging Types

**File:** `packages/core/src/observability/types/logging.ts` (new)

Follow the pattern established in `packages/core/src/observability/types/tracing.ts`:

```typescript
// ============================================================================
// Log Level
// ============================================================================

/** Log severity levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// ============================================================================
// LoggerContext (API Interface)
// ============================================================================

/**
 * LoggerContext - API for emitting structured logs.
 * Logs are automatically correlated with the current span's trace/span IDs.
 */
export interface LoggerContext {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

// ============================================================================
// ExportedLog (Event Bus Transport)
// ============================================================================

/**
 * Log data transported via the event bus.
 * Must be JSON-serializable (Date serializes via toJSON()).
 *
 * Context fields (runId, sessionId, userId, environment, etc.) are stored
 * in metadata, following the same pattern as tracing spans.
 */
export interface ExportedLog {
  /** When the log was emitted */
  timestamp: Date;

  /** Log severity level */
  level: LogLevel;

  /** Human-readable log message */
  message: string;

  /** Structured data associated with this log */
  data?: Record<string, unknown>;

  /** Trace ID for correlation (from current span) */
  traceId?: string;

  /** Span ID for correlation (from current span) */
  spanId?: string;

  /** Optional tags for filtering/categorization */
  tags?: string[];

  /**
   * User-defined metadata.
   * Context fields are stored here: runId, sessionId, userId, environment,
   * serviceName, organizationId, entityType, entityName, etc.
   * This follows the same pattern as BaseSpan.metadata in tracing.ts.
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// LogEvent (Event Bus Event)
// ============================================================================

/** Log event emitted to the ObservabilityBus */
export interface LogEvent {
  type: 'log';
  log: ExportedLog;
}
```

**Notes:**
- Follows the same metadata pattern as `BaseSpan` in tracing.ts
- Context fields go in `metadata` rather than separate fields
- LogRecord (storage format) is defined in Phase 6 with Zod schemas

**Tasks:**
- [ ] Define `LogLevel` type
- [ ] Create LoggerContext interface
- [ ] Create ExportedLog interface with JSDoc comments
- [ ] Create LogEvent interface
- [ ] Export all types from types index

---

## 1.1.3 Metrics Types

**File:** `packages/core/src/observability/types/metrics.ts` (new)

Follow the pattern established in `packages/core/src/observability/types/tracing.ts`:

```typescript
// ============================================================================
// Metric Type
// ============================================================================

/** Types of metrics */
export type MetricType = 'counter' | 'gauge' | 'histogram';

// ============================================================================
// MetricsContext (API Interface)
// ============================================================================

/**
 * MetricsContext - API for emitting metrics.
 * Provides counter, gauge, and histogram metric types.
 */
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

// ============================================================================
// ExportedMetric (Event Bus Transport)
// ============================================================================

/**
 * Metric data transported via the event bus.
 * Represents a single metric observation.
 * Must be JSON-serializable (Date serializes via toJSON()).
 *
 * Environment fields (organizationId, environment, serviceName) are stored
 * in metadata, following the same pattern as tracing spans.
 *
 * Note: Histogram aggregation (bucket counts, sum, count) is computed at
 * the storage layer, not in the individual metric event.
 */
export interface ExportedMetric {
  /** When the metric was recorded */
  timestamp: Date;

  /** Metric name (e.g., mastra_agent_duration_ms) */
  name: string;

  /** Type of metric */
  metricType: MetricType;

  /** Metric value (single observation) */
  value: number;

  /** Metric labels for dimensional filtering */
  labels: Record<string, string>;

  /**
   * User-defined metadata.
   * Environment fields are stored here: organizationId, environment,
   * serviceName, etc. These are kept separate from labels to avoid
   * cardinality issues.
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MetricEvent (Event Bus Event)
// ============================================================================

/** Metric event emitted to the ObservabilityBus */
export interface MetricEvent {
  type: 'metric';
  metric: ExportedMetric;
}

// ============================================================================
// Cardinality Protection
// ============================================================================

/**
 * Default labels to block from metrics to prevent cardinality explosion.
 * These are high-cardinality fields that should not be used as metric labels.
 */
export const DEFAULT_BLOCKED_LABELS = [
  'trace_id',
  'span_id',
  'run_id',
  'request_id',
  'user_id',
  'resource_id',
  'session_id',
  'thread_id',
] as const;

/** Cardinality protection configuration */
export interface CardinalityConfig {
  /**
   * Labels to block from metrics.
   * Set to undefined to use DEFAULT_BLOCKED_LABELS.
   * Set to empty array to allow all labels.
   */
  blockedLabels?: string[];

  /**
   * Whether to block UUID-like values in labels.
   * @default true
   */
  blockUUIDs?: boolean;
}

/** Metrics-specific configuration */
export interface MetricsConfig {
  /** Whether metrics are enabled */
  enabled?: boolean;
  /** Cardinality protection settings */
  cardinality?: CardinalityConfig;
}
```

**Notes:**
- Follows the same metadata pattern as `BaseSpan` in tracing.ts
- Environment fields go in `metadata` (not `labels`) to avoid cardinality explosion
- ExportedMetric stores single observations; histogram aggregation computed at query time
- MetricRecord (storage format) is defined in Phase 6 with Zod schemas

**Tasks:**
- [ ] Define `MetricType` type
- [ ] Create MetricsContext interface
- [ ] Create Counter, Gauge, Histogram interfaces
- [ ] Create ExportedMetric interface with JSDoc comments
- [ ] Create MetricEvent interface
- [ ] Define `DEFAULT_BLOCKED_LABELS` constant
- [ ] Define `CardinalityConfig` interface
- [ ] Define `MetricsConfig` interface
- [ ] Export all types from types index

---

## 1.1.4 Scores Types

**File:** `packages/core/src/observability/types/scores.ts` (new)

Follow the pattern established in `packages/core/src/observability/types/tracing.ts`:

```typescript
// ============================================================================
// ScoreInput (User Input)
// ============================================================================

/**
 * User-provided score data for evaluating span/trace quality.
 * Used with span.addScore() and trace.addScore().
 */
export interface ScoreInput {
  /** Name of the scorer (e.g., "relevance", "accuracy", "toxicity") */
  scorerName: string;

  /** Numeric score value (typically 0-1 or 0-100) */
  score: number;

  /** Human-readable explanation of the score */
  reason?: string;

  /** Experiment identifier for A/B testing or evaluation runs */
  experiment?: string;

  /** Additional metadata specific to this score */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ExportedScore (Event Bus Transport)
// ============================================================================

/**
 * Score data transported via the event bus.
 * Must be JSON-serializable (Date serializes via toJSON()).
 *
 * Context fields (organizationId, userId, environment, etc.) are stored
 * in metadata, following the same pattern as tracing spans. The metadata
 * is inherited from the span/trace being scored.
 */
export interface ExportedScore {
  /** When the score was recorded */
  timestamp: Date;

  /** Trace being scored */
  traceId: string;

  /** Specific span being scored (undefined = trace-level score) */
  spanId?: string;

  /** Name of the scorer */
  scorerName: string;

  /** Numeric score value */
  score: number;

  /** Human-readable explanation */
  reason?: string;

  /** Experiment identifier for A/B testing */
  experiment?: string;

  /**
   * User-defined metadata.
   * Inherited from the span/trace being scored, merged with score-specific metadata.
   * Contains context fields: organizationId, userId, environment, serviceName,
   * entityType, entityName, etc.
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ScoreEvent (Event Bus Event)
// ============================================================================

/** Score event emitted to the ObservabilityBus */
export interface ScoreEvent {
  type: 'score';
  score: ExportedScore;
}
```

**Notes:**
- Follows the same metadata pattern as `BaseSpan` in tracing.ts
- Context is inherited from the span/trace being scored
- ScoreRecord (storage format) is defined in Phase 6 with Zod schemas

**Tasks:**
- [ ] Create ScoreInput interface with JSDoc comments
- [ ] Create ExportedScore interface with JSDoc comments
- [ ] Create ScoreEvent interface
- [ ] Export all types from types index

---

## 1.1.5 Feedback Types

**File:** `packages/core/src/observability/types/feedback.ts` (new)

Follow the pattern established in `packages/core/src/observability/types/tracing.ts`:

```typescript
// ============================================================================
// FeedbackInput (User Input)
// ============================================================================

/**
 * User-provided feedback data for human evaluation of span/trace quality.
 * Used with span.addFeedback() and trace.addFeedback().
 */
export interface FeedbackInput {
  /** Source of the feedback (e.g., "user", "admin", "qa") */
  source: string;

  /** Type of feedback (e.g., "thumbs", "rating", "correction") */
  feedbackType: string;

  /** Feedback value (e.g., "up"/"down", 1-5, correction text) */
  value: number | string;

  /** Optional comment explaining the feedback */
  comment?: string;

  /** User who provided the feedback */
  userId?: string;

  /** Experiment identifier for A/B testing or evaluation runs */
  experiment?: string;

  /** Additional metadata specific to this feedback */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ExportedFeedback (Event Bus Transport)
// ============================================================================

/**
 * Feedback data transported via the event bus.
 * Must be JSON-serializable (Date serializes via toJSON()).
 *
 * Context fields (organizationId, environment, etc.) are stored
 * in metadata, following the same pattern as tracing spans. The metadata
 * is inherited from the span/trace receiving feedback.
 */
export interface ExportedFeedback {
  /** When the feedback was recorded */
  timestamp: Date;

  /** Trace receiving feedback */
  traceId: string;

  /** Specific span receiving feedback (undefined = trace-level feedback) */
  spanId?: string;

  /** Source of the feedback */
  source: string;

  /** Type of feedback */
  feedbackType: string;

  /** Feedback value */
  value: number | string;

  /** Optional comment */
  comment?: string;

  /** Experiment identifier for A/B testing */
  experiment?: string;

  /**
   * User-defined metadata.
   * Inherited from the span/trace receiving feedback, merged with feedback-specific metadata.
   * Contains context fields: organizationId, environment, serviceName,
   * entityType, entityName, etc. The userId from FeedbackInput is also stored here.
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// FeedbackEvent (Event Bus Event)
// ============================================================================

/** Feedback event emitted to the ObservabilityBus */
export interface FeedbackEvent {
  type: 'feedback';
  feedback: ExportedFeedback;
}
```

**Notes:**
- Follows the same metadata pattern as `BaseSpan` in tracing.ts
- Context is inherited from the span/trace receiving feedback
- userId from FeedbackInput is stored in metadata
- FeedbackRecord (storage format) is defined in Phase 6 with Zod schemas

**Tasks:**
- [ ] Create FeedbackInput interface with JSDoc comments
- [ ] Create ExportedFeedback interface with JSDoc comments
- [ ] Create FeedbackEvent interface
- [ ] Export all types from types index

---

## 1.1.6 Update tracing.ts

**File:** `packages/core/src/observability/types/tracing.ts` (modify)

**Note:** TracingEvent and TracingEventType already exist in the codebase. We only need to add Score/Feedback methods to Span interface and add the Trace interface.

```typescript
import type { ScoreInput } from './scores';
import type { FeedbackInput } from './feedback';

// ============================================================================
// TracingEvent (EXISTING - DO NOT MODIFY)
// ============================================================================

// These already exist in the codebase:
// enum TracingEventType {
//   SPAN_STARTED = 'span_started',
//   SPAN_UPDATED = 'span_updated',
//   SPAN_ENDED = 'span_ended',
// }
//
// type TracingEvent =
//   | { type: TracingEventType.SPAN_STARTED; exportedSpan: AnyExportedSpan }
//   | { type: TracingEventType.SPAN_UPDATED; exportedSpan: AnyExportedSpan }
//   | { type: TracingEventType.SPAN_ENDED; exportedSpan: AnyExportedSpan };

// ============================================================================
// Span Interface (update existing)
// ============================================================================

export interface Span {
  // Existing properties...
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;

  // NEW: For score/feedback context inheritance
  readonly metadata?: Record<string, unknown>;
  readonly isRootSpan: boolean;

  // Existing methods...
  setStatus(status: SpanStatus): void;
  setAttribute(key: string, value: AttributeValue): void;
  addEvent(name: string, attributes?: Record<string, AttributeValue>): void;
  end(): void;

  // NEW: Score and Feedback
  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
}

// ============================================================================
// Trace Interface (new)
// ============================================================================

export interface Trace {
  readonly traceId: string;
  readonly spans: ReadonlyArray<Span>;

  /** Get a specific span by ID */
  getSpan(spanId: string): Span | null;

  /**
   * Add a score at the trace level.
   * Uses root span's metadata for context.
   */
  addScore(score: ScoreInput): void;

  /**
   * Add feedback at the trace level.
   * Uses root span's metadata for context.
   */
  addFeedback(feedback: FeedbackInput): void;
}
```

**Notes:**
- Span.metadata and Span.isRootSpan already exist in the codebase
- TracingEvent and TracingEventType already exist - no changes needed
- We only add `addScore()`, `addFeedback()` methods to Span interface
- Trace-level scores/feedback use root span's metadata for context

**Tasks:**
- [ ] Verify TracingEvent, TracingEventType, AnyExportedSpan already exported (no changes needed)
- [ ] Add `addScore(score: ScoreInput): void` to Span interface
- [ ] Add `addFeedback(feedback: FeedbackInput): void` to Span interface
- [ ] Add Trace interface
- [ ] Export Trace from types index

---

## 1.1.7 Exporter Interface Extensions

**File:** `packages/core/src/observability/types/exporter.ts` (new or modify existing)

Add signal handlers to `ObservabilityExporter` interface. Handler presence = signal support (no separate flags needed).

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

## 1.1.8 NoOp Context Implementations

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

## 1.1.9 ObservabilityContextMixin Interface

**File:** `packages/core/src/observability/types/context.ts` (new)

Define the mixin interface that combines all signal contexts:

```typescript
import { TracingContext } from './tracing';
import { LoggerContext } from './logging';
import { MetricsContext } from './metrics';

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
- [ ] Create context.ts with ObservabilityContextMixin
- [ ] Import context types from signal-specific files
- [ ] Export from types index

---

## 1.1.10 Context Factory

**File:** `packages/core/src/observability/context-factory.ts` (new)

```typescript
import { TracingContext } from './types/tracing';
import { LoggerContext } from './types/logging';
import { MetricsContext } from './types/metrics';
import { ObservabilityContextMixin } from './types/context';
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

## 1.1.11 Update Context Types to Extend Mixin

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

## 1.1.12 Update Context Creation Points

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

## 1.1.13 Storage Strategy Types

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

## 1.1.14 Storage Strategy Getters

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

## 1.1.15 Add Mastra.getTrace() API

**File:** `packages/core/src/mastra/types.ts` (modify)

```typescript
import type { Trace } from '../observability/types/tracing';

export interface Mastra {
  // Existing...

  /**
   * Retrieve a trace for post-hoc score/feedback attachment.
   * Returns null if trace not found or storage not configured.
   */
  getTrace(traceId: string): Promise<Trace | null>;
}
```

**Tasks:**
- [ ] Add `getTrace()` to Mastra interface
- [ ] Import Trace type

---

## 1.1.16 Add Mastra Direct Logger/Metrics APIs

**File:** `packages/core/src/mastra/types.ts` (modify)

Add direct APIs for logging and metrics outside of trace context:

```typescript
import type { LoggerContext } from '../observability/types/logging';
import type { MetricsContext } from '../observability/types/metrics';

export interface Mastra {
  // Existing...

  /**
   * Direct logger for use outside trace context.
   * Logs emitted via this API will not have trace correlation.
   * Use for startup logs, background jobs, or other non-traced scenarios.
   */
  readonly logger: LoggerContext;

  /**
   * Direct metrics API for use outside trace context.
   * Metrics emitted via this API will not have auto-labels from spans.
   * Use for background jobs, startup metrics, or other non-traced scenarios.
   */
  readonly metrics: MetricsContext;
}
```

**Usage:**

```typescript
// Startup logs (no trace context)
mastra.logger.info("Application started", { version: "1.0.0" });
mastra.logger.warn("Config missing, using defaults");

// Background job metrics (no trace context)
mastra.metrics.counter('background_jobs_total').add(1, { job_type: 'cleanup' });
mastra.metrics.gauge('queue_depth').set(42, { queue: 'high_priority' });
```

**Tasks:**
- [ ] Add `logger: LoggerContext` readonly property to Mastra interface
- [ ] Add `metrics: MetricsContext` readonly property to Mastra interface
- [ ] Import LoggerContext and MetricsContext types

---

## PR 1.1 Testing

**Tasks:**
- [ ] Test context factory with no-ops
- [ ] Test context factory with real contexts
- [ ] Test backward compat (tracingContext alias)
- [ ] Test type exports compile correctly
- [ ] Ensure existing tests still pass
- [ ] Verify LogLevel type includes all levels
- [ ] Verify ExportedLog can be created with metadata
- [ ] Verify LogEvent has correct discriminant
- [ ] Verify MetricType type includes all types
- [ ] Verify ExportedMetric can be created with single observation
- [ ] Verify MetricEvent has correct discriminant
- [ ] Verify cardinality config defaults work as expected
- [ ] Verify ScoreInput/ExportedScore include experiment field
- [ ] Verify ScoreEvent has correct discriminant
- [ ] Verify FeedbackInput/ExportedFeedback include experiment field
- [ ] Verify FeedbackEvent has correct discriminant
- [ ] Verify Span interface includes metadata, isRootSpan, addScore, addFeedback
- [ ] Verify Trace interface includes spans, getSpan, addScore, addFeedback
- [ ] Verify Mastra interface includes getTrace
