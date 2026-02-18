# Observability Implementation Plan

**Date:** 2026-02-05
**Status:** Draft - Ready for Implementation

---

## Overview

World-class observability platform for Mastra with integrated Tracing, Metrics, Logging, Scores, and Feedback (T/M/L/S/F). Designed for enterprise environments with high-volume ingestion, multi-tenancy, compliance, and integration with existing infrastructure.

---

## Type Architecture

Each signal follows a three-tier type pattern:

| Tier | Purpose | Serializable | Example |
|------|---------|--------------|---------|
| **Input** | User-facing API parameters | Not required | `ScoreInput`, method params |
| **Exported** | Event bus transport, exporter consumption | **Required** | `ExportedLog`, `ExportedMetric` |
| **Record** | Storage format, database schemas | Required | `LogRecord`, `MetricRecord` |

**Key principles:**
- **Input types** are ergonomic for users (can include functions, complex objects)
- **Exported types** are serializable (JSON-safe) for event bus and network transport
- **Record types** are optimized for storage (may differ per backend)
- Conversion happens at boundaries: Input → Exported (context APIs), Exported → Record (storage adapters)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Input     │ ──► │   Exported   │ ──► │   Record    │
│  (User API) │     │ (Event Bus)  │     │  (Storage)  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Exporters  │
                    │ (consume    │
                    │  Exported)  │
                    └─────────────┘
```

### Span Type Hierarchy

Tracing has a more complex hierarchy due to the need for both active spans and recorded (historical) spans:

```
BaseSpan<TType>           (core span fields - name, type, startTime, etc.)
    │
    ├── Span<TType>       (live span with lifecycle methods + parent object reference)
    │
    └── SpanData<TType>   (serializable span data - adds parentSpanId, isRootSpan, tags)
            │
            ├── ExportedSpan<TType>   (sent TO exporters via event bus)
            │
            └── RecordedSpan<TType>   (loaded FROM storage + addScore/addFeedback)
                    │
                    └── RecordedTrace   (collection of RecordedSpans in tree + flat format)
```

**SpanData** is the shared base type for both `ExportedSpan` and `RecordedSpan`, ensuring they have the same data shape while keeping their concerns separate:
- **ExportedSpan** = outbound (Mastra → Exporters)
- **RecordedSpan** = inbound (Storage → Mastra) with annotation methods

**RecordedSpan** interface:
```typescript
interface RecordedSpan<TType extends SpanType> extends SpanData<TType> {
  readonly parent?: AnyRecordedSpan;           // tree navigation: up
  readonly children: ReadonlyArray<AnyRecordedSpan>;  // tree navigation: down
  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
}
```

**RecordedTrace** interface:
```typescript
interface RecordedTrace {
  readonly traceId: string;
  readonly rootSpan: AnyRecordedSpan;                // tree entry point
  readonly spans: ReadonlyArray<AnyRecordedSpan>;    // flat for iteration (same objects)
  getSpan(spanId: string): AnyRecordedSpan | null;
  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
}
```

**Note:** Tree and flat access reference the same span objects - no memory duplication.

### Type Examples

**Tracing:**
```typescript
// Runtime: Live span with lifecycle methods
interface Span<TType> extends BaseSpan<TType> {
  end(): void;
  createChildSpan(): Span;
  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
  // ... other lifecycle methods
}

// Data: Shared serializable base (no methods, no circular refs)
interface SpanData<TType> extends BaseSpan<TType> {
  parentSpanId?: string;
  isRootSpan: boolean;
  tags?: string[];
}

// Exported: Sent to exporters via event bus
interface ExportedSpan<TType> extends SpanData<TType> {}

// Recorded: Loaded from storage with annotation methods + tree structure
interface RecordedSpan<TType> extends SpanData<TType> {
  readonly parent?: AnyRecordedSpan;
  readonly children: ReadonlyArray<AnyRecordedSpan>;
  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
}

// Record: Storage format
interface SpanRecord { ... }
```

**Logs:**
```typescript
// Input: Method parameters (not a separate type)
logger.info(message: string, data?: Record<string, unknown>)

// Exported: Serializable for event bus
interface ExportedLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  // ... correlation fields
}

// Record: Storage format
interface LogRecord {
  id: string;
  timestamp: Date;
  // ... similar to ExportedLog with DB-specific additions
}
```

**Metrics:**
```typescript
// Input: Method parameters
counter.add(value: number, labels?: Record<string, string>)

// Exported: Serializable for event bus
interface ExportedMetric {
  timestamp: Date;
  name: string;
  metricType: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels: Record<string, string>;
}

// Record: Storage format
interface MetricRecord { ... }
```

**Scores:**
```typescript
// Input: User-provided data
interface ScoreInput {
  scorerName: string;
  score: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// Exported: Serializable for event bus
interface ExportedScore {
  timestamp: Date;
  traceId: string;
  spanId?: string;
  scorerName: string;
  score: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// Record: Storage format
interface ScoreRecord { ... }
```

**Feedback:**
```typescript
// Input: User-provided data
interface FeedbackInput {
  source: string;
  feedbackType: string;
  value: number | string;
  comment?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

// Exported: Serializable for event bus
interface ExportedFeedback {
  timestamp: Date;
  traceId: string;
  spanId?: string;
  source: string;
  feedbackType: string;
  value: number | string;
  comment?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

// Record: Storage format
interface FeedbackRecord { ... }
```

---

## Event Types

Events use the Exported types for transport. **Note:** TracingEvent uses the existing `TracingEventType` enum with snake_case values and the `exportedSpan` field name (matching the current codebase).

```typescript
// Existing enum in @mastra/core (DO NOT CHANGE)
enum TracingEventType {
  SPAN_STARTED = 'span_started',
  SPAN_UPDATED = 'span_updated',
  SPAN_ENDED = 'span_ended',
}

// Existing type in @mastra/core (DO NOT CHANGE)
type TracingEvent =
  | { type: TracingEventType.SPAN_STARTED; exportedSpan: AnyExportedSpan }
  | { type: TracingEventType.SPAN_UPDATED; exportedSpan: AnyExportedSpan }
  | { type: TracingEventType.SPAN_ENDED; exportedSpan: AnyExportedSpan };

// NEW event types
type LogEvent = { type: 'log'; log: ExportedLog };
type MetricEvent = { type: 'metric'; metric: ExportedMetric };
type ScoreEvent = { type: 'score'; score: ExportedScore };
type FeedbackEvent = { type: 'feedback'; feedback: ExportedFeedback };

type ObservabilityEvent =
  | TracingEvent
  | LogEvent
  | MetricEvent
  | ScoreEvent
  | FeedbackEvent;
```

**Note:** Error handling uses `span.error()` method which ends the span with error info - there is no separate `span.error` event type.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Signal Sources                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Span Events  │  │ Direct API   │  │ User Logger  │           │
│  │ (existing)   │  │ (new metrics)│  │ Calls (new)  │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│  ┌──────┴───────┐         │                 │                    │
│  │Score/Feedback│         │                 │                    │
│  │Events (new)  │         │                 │                    │
│  └──────┬───────┘         │                 │                    │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
   ┌──────────────────────────────────────────────┐
   │             ObservabilityBus                  │
   │  (routes by event type to handlers)          │
   │                                              │
   │  TracingEvent  → onTracingEvent()            │
   │  LogEvent      → onLogEvent()                │
   │  MetricEvent   → onMetricEvent()             │
   │  ScoreEvent    → onScoreEvent()              │
   │  FeedbackEvent → onFeedbackEvent()           │
   └──────────────────────┬───────────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    Exporters    │
                 │ (implement handlers) │
                 └─────────────────┘
```

**Key design decisions:**
- **Single ObservabilityBus** handles all event types and routes to appropriate handlers
- **Type-based routing**: Each event type routes to its dedicated handler
- **Handler presence = support**: Exporters declare support by implementing the handler
- **Exported types are serializable**: All event payloads are JSON-safe
- **Storage conversion in storage layer**: Exported → Record happens in storage adapters
- **Cross-emission**: TracingEvents can generate MetricEvents (auto-extracted metrics)

---

## Context API

All execution contexts gain unified observability access:

```typescript
interface ObservabilityContextMixin {
  tracing: TracingContext;     // always present, no-op if not configured
  logger: LoggerContext;       // always present, no-op if not configured
  metrics: MetricsContext;     // always present, no-op if not configured

  /** @deprecated Use `tracing` instead */
  tracingContext: TracingContext;
}
```

### Direct APIs (Outside Trace Context)

For startup logs, background jobs, or other scenarios outside trace context:

```typescript
// Direct logging without trace correlation
mastra.logger.info("Application started", { version: "1.0.0" });
mastra.logger.warn("Config missing, using defaults");
mastra.logger.error("Background job failed", { jobId: "123" });

// Direct metrics without auto-labels
mastra.metrics.counter('background_jobs_total').add(1, { job_type: 'cleanup' });
mastra.metrics.gauge('queue_depth').set(42, { queue: 'high_priority' });
```

These APIs emit events through the ObservabilityBus but without trace correlation fields.

---

## Exporter Interface

```typescript
interface ObservabilityExporter {
  readonly name: string;

  // Signal handlers - implement the ones you support
  // Handler presence = signal support
  onTracingEvent?(event: TracingEvent): void | Promise<void>;
  onLogEvent?(event: LogEvent): void | Promise<void>;
  onMetricEvent?(event: MetricEvent): void | Promise<void>;
  onScoreEvent?(event: ScoreEvent): void | Promise<void>;
  onFeedbackEvent?(event: FeedbackEvent): void | Promise<void>;

  // Lifecycle
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}
```

---

## Observability Configuration

```typescript
interface ObservabilityConfig {
  serviceName: string;
  environment?: string;

  exporters: ObservabilityExporter[];

  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  sampling?: SamplingConfig;

  processors?: SignalProcessor[];

  metrics?: {
    cardinality?: {
      blockedLabels?: string[];
      blockUUIDs?: boolean;
    };
  };
}
```

---

## Implementation Phases

### Phase 1: Foundation
Core infrastructure - event bus, context injection, type definitions, configuration.

- [ ] Type architecture: Input, Exported, Record types for all signals
- [ ] ObservabilityEventBus interface and base implementation
- [ ] ObservabilityBus with type-based routing to handlers
- [ ] Exporter interface with signal handlers
- [ ] BaseExporter: `onTracingEvent()` delegates to existing `exportTracingEvent()`
- [ ] No-op LoggerContext and MetricsContext implementations
- [ ] Context mixin (`tracing`, `logger`, `metrics` on all contexts)
- [ ] Backward compat: `tracingContext` alias
- [ ] Unified ObservabilityConfig on Mastra

### Phase 2: Debug Exporters
Build exporters for ALL signals early to validate interfaces and provide developer visibility.

- [ ] JsonExporter: handlers for T/M/L/S/F (console output)
- [ ] GrafanaCloudExporter: handlers for T/M/L/S/F (Tempo/Loki/Mimir)
- [ ] Validate Exported type serialization works correctly
- [ ] `RecordedTrace.fromJSON()` / `RecordedTrace.fromSpans()` factory methods for round-tripping

### Phase 3: Logging, Metrics & Scores/Feedback
All signal context implementations in `@mastra/observability` - no exporter work (Phase 2 exporters already handle events).

**PR 3.1: Logging**
- [ ] LoggerContext implementation with auto-correlation
- [ ] `mastra.logger` direct API (outside trace context)
- [ ] LogEvent emission to ObservabilityBus
- [ ] Exporter updates for LogEvent

**PR 3.2: Metrics Context**
- [ ] MetricsContext implementation with auto-labels
- [ ] `mastra.metrics` direct API (outside trace context)
- [ ] Cardinality protection (blocked labels, UUID detection)
- [ ] MetricEvent emission to ObservabilityBus
- [ ] Exporter updates for MetricEvent

**PR 3.3: Auto-Extracted Metrics**
- [ ] TracingEvent → MetricEvent cross-emission (auto-extracted metrics)
- [ ] Token usage metrics from MODEL_GENERATION spans
- [ ] Duration metrics from span lifecycle

**PR 3.4: Scores & Feedback**
- [ ] `span.addScore()` / `span.addFeedback()` APIs
- [ ] `trace.addScore()` / `trace.addFeedback()` APIs
- [ ] `mastra.getTrace(traceId)` for post-hoc attachment
- [ ] RecordedSpanImpl and RecordedTraceImpl classes (tree + flat access)
- [ ] Tree structure with parent/children references
- [ ] ScoreEvent / FeedbackEvent emission to ObservabilityBus
- [ ] Exporter updates for ScoreEvent/FeedbackEvent

**PR 3.5: Score/Feedback Metrics**
- [ ] ScoreEvent → MetricEvent cross-emission (`mastra_scores_total`)
- [ ] FeedbackEvent → MetricEvent cross-emission (`mastra_feedback_total`)

### Phase 4: Stores & DefaultExporter
Storage adapters and the DefaultExporter that writes to storage.

- [ ] DefaultExporter: Exported → Record conversion, writes to storage
- [ ] DuckDB adapter: spans, logs, metrics, scores, feedback tables
- [ ] ClickHouse adapter: spans, logs, metrics, scores, feedback tables
- [ ] Storage strategy getters for each signal
- [ ] Batch write optimizations
- [ ] Record types (LogRecord, MetricRecord, ScoreRecord, FeedbackRecord) as Zod schemas

### Phase 5: Server & Client APIs
HTTP APIs and client SDK for accessing stored data.

- [ ] Server routes for traces, logs, metrics, scores, feedback
- [ ] client-js SDK updates
- [ ] CloudExporter (writes to Mastra Cloud API)

### Phase 6: Third-Party Exporters
Expand third-party integrations to support additional signals.

- [ ] OtelExporter: logs, metrics support
- [ ] LangfuseExporter: logs, scores, feedback support
- [ ] BraintrustExporter: logs, scores, feedback support
- [ ] LangSmithExporter: scores, feedback support
- [ ] DatadogExporter: logs, metrics support
- [ ] ArizeExporter: traces, scores support
- [ ] Other exporters: audit and expand

### Phase 7: MomentExporter
Internal event store for advanced use cases.

- [ ] Moment schema (event store approach)
- [ ] MomentExporter implementation
- [ ] ClickHouse pulse_moments table

---

## Phase Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (Debug Exporters) ← validates interfaces early
    ↓
Phase 3 (Logging, Metrics, Scores/Feedback)
    │   PR 3.1 → PR 3.2 → PR 3.3 → PR 3.4 → PR 3.5
    ↓
Phase 4 (Stores & DefaultExporter)
    ↓
Phase 5 (Server & Client) ← depends on storage
    ↓
Phase 6 (3rd-Party Exporters) ← can start after Phase 2
    ↓
Phase 7 (MomentExporter)
```

**Notes:**
- Phase 3 PRs are sequential: 3.1 → 3.2 → 3.3 → 3.4 → 3.5
- Phase 6 (3rd-party exporters) can start after Phase 2 (just need Exported types)
- Phase 4, 5, 7 must be sequential

## Changeset Strategy

**One changeset per PR.** Each PR should include its own changeset file describing the changes. This allows:
- Fine-grained version control
- Clear attribution of changes
- Easier rollback if needed
- Better changelog generation

---

## Backward Compatibility

- Existing tracing code works unchanged
- `tracingContext` alias for `tracing` (deprecated)
- Top-level `logger` config deprecated but still works
- All contexts gain `tracing`, `logger`, `metrics` (always present, no-op if not configured)
- BaseExporter delegates `onTracingEvent()` to existing `exportTracingEvent()`

---

## Storage Strategy Getters

```typescript
abstract class ObservabilityStorage extends StorageDomain {
  // Tracing: non-null default (backward compat)
  // TODO(2.0): Change to return null by default
  get tracingStrategy(): StrategyHint<TracingStorageStrategy> {
    return { preferred: 'batch-with-updates', supported: [...] };
  }

  // Others: null by default (opt-in)
  get logsStrategy(): StrategyHint<LogsStorageStrategy> { return null; }
  get metricsStrategy(): StrategyHint<MetricsStorageStrategy> { return null; }
  get scoresStrategy(): StrategyHint<ScoresStorageStrategy> { return null; }
  get feedbackStrategy(): StrategyHint<FeedbackStorageStrategy> { return null; }
}

type StrategyHint<T> = { preferred: T; supported: T[] } | null;
```

---

## Built-in Metrics Catalog

Auto-extracted from span lifecycle events (Phase 4).

| Metric | Type | Labels |
|--------|------|--------|
| `mastra_agent_runs_started` | counter | agent, env, service |
| `mastra_agent_runs_ended` | counter | agent, status, env, service |
| `mastra_agent_duration_ms` | histogram | agent, status, env, service |
| `mastra_model_requests_started` | counter | model, provider, agent |
| `mastra_model_requests_ended` | counter | model, provider, agent, status |
| `mastra_model_duration_ms` | histogram | model, provider, agent |
| `mastra_model_input_tokens` | counter | model, provider, agent |
| `mastra_model_output_tokens` | counter | model, provider, agent |
| `mastra_tool_calls_started` | counter | tool, agent, env |
| `mastra_tool_calls_ended` | counter | tool, agent, status, env |
| `mastra_tool_duration_ms` | histogram | tool, agent, env |
| `mastra_workflow_runs_started` | counter | workflow, env |
| `mastra_workflow_runs_ended` | counter | workflow, status, env |
| `mastra_workflow_duration_ms` | histogram | workflow, status, env |
| `mastra_scores_total` | counter | scorer, entity_type, experiment |
| `mastra_feedback_total` | counter | feedback_type, source, experiment |

---

## Detailed Phase Documents

| Phase | Document | Scope |
|-------|----------|-------|
| Phase 1 | [phase-1/](./phase-1/) | Foundation, event bus, config |
| Phase 2 | [phase-2/](./phase-2/) | Debug exporters (Json, GrafanaCloud) |
| Phase 3 | [phase-3/](./phase-3/) | Logging, Metrics, Scores/Feedback |
| Phase 4 | [phase-4/](./phase-4/) | Stores & DefaultExporter |
| Phase 5 | [phase-5/](./phase-5/) | Server & client-js |
| Phase 6 | [phase-6/](./phase-6/) | Third-party exporters |
| Phase 7 | [phase-7/](./phase-7/) | MomentExporter |

---

## Open TODOs

- [ ] Verify scores table alignment with existing evals scores schema
- [ ] Revisit table name `mastra_ai_trace_feedback`
- [ ] Reference existing NoOp tracing implementation
- [x] ~~Decide on changeset strategy (per-PR or per-phase)~~ → **Per-PR**
- [ ] Create migration guide for deprecated `tracingContext`
