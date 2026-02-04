# Observability Implementation Plan

**Date:** 2026-02-04
**Status:** Draft - Ready for Implementation

---

## Overview

World-class observability platform for Mastra with integrated Tracing, Metrics, and Logging (T/M/L). Designed for enterprise environments with high-volume ingestion, multi-tenancy, compliance, and integration with existing infrastructure.

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
   │  ScoreEvent    → onScoreEvent()              │
   │  FeedbackEvent → onFeedbackEvent()           │
   │  MetricEvent   → onMetricEvent()             │
   │  LogEvent      → onLogEvent()                │
   └──────────────────────┬───────────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    Exporters    │
                 │ (declare T/M/L/S/F) │
                 └─────────────────┘
```

**Key design decisions:**
- **Single ObservabilityBus** handles all event types and routes to appropriate handlers
- **Type-based routing**: Each event type routes to its dedicated handler (`onTracingEvent`, `onScoreEvent`, etc.)
- **ObservabilityBus cross-posts to MetricsBus** on span lifecycle events (auto-extracted metrics)
- **ObservabilityBus cross-posts to MetricsBus** on score/feedback events (score distribution metrics)
- **Each exporter declares** which signals it supports via `supportsTraces`, `supportsMetrics`, `supportsLogs`, `supportsScores`, `supportsFeedback`
- **Backward compatible**: Existing tracing code unchanged, buses are internal infrastructure
- **Storage-agnostic**: DefaultExporter writes to storage; other exporters send to external systems

---

## Context API

All execution contexts (tools, workflow steps, processors) gain unified observability access:

```typescript
interface ObservabilityContextMixin {
  tracing: TracingContext;     // always present, no-op if not configured
  logger: LoggerContext;       // always present, no-op if not configured
  metrics: MetricsContext;     // always present, no-op if not configured

  /** @deprecated Use `tracing` instead */
  tracingContext: TracingContext;  // alias, also always present
}
```

**Usage:**
```typescript
execute: async (input, { tracing, logger, metrics }) => {
  logger.info("Processing");
  metrics.counter("calls").add(1);
  const span = tracing.currentSpan;
}
```

**Note:** Existing NoOp tracing implementation to reuse/reference.

---

## LoggerContext Interface

```typescript
interface LoggerContext {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}
```

**Auto-injected into each log record:**
- `traceId`, `spanId` - from active trace
- `entityType`, `entityName`, `entityId` - agent/tool/workflow info
- `runId`, `sessionId`, `threadId` - execution context
- `environment`, `serviceName` - from config

---

## MetricsContext Interface

```typescript
interface MetricsContext {
  counter(name: string): Counter;
  gauge(name: string): Gauge;
  histogram(name: string): Histogram;
}

interface Counter {
  add(value: number, additionalLabels?: Record<string, string>): void;
}

interface Gauge {
  set(value: number, additionalLabels?: Record<string, string>): void;
}

interface Histogram {
  record(value: number, additionalLabels?: Record<string, string>): void;
}
```

**Auto-injected labels:**
- `agent`, `tool`, `workflow` - from entity context
- `env`, `service` - from config

---

## Event Bus Architecture

```typescript
interface EventBus<TEvent> {
  emit(event: TEvent): void;
  subscribe(handler: (event: TEvent) => void): () => void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

// Span lifecycle events (TracingBus)
type TracingEvent =
  | { type: 'span.started'; exportedSpan: AnyExportedSpan }
  | { type: 'span.updated'; exportedSpan: AnyExportedSpan }
  | { type: 'span.ended'; exportedSpan: AnyExportedSpan }
  | { type: 'span.error'; exportedSpan: AnyExportedSpan; error: SpanErrorInfo };

// Metrics (MetricsBus)
type MetricEvent = {
  type: 'metric';
  name: string;
  metricType: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
};

// Logs (LogsBus)
type LogEvent = {
  type: 'log';
  record: LogRecord;
};

// Scores (separate from TracingEvent for independent handling)
type ScoreEvent = {
  type: 'score';
  traceId: string;
  spanId?: string;
  score: ScoreInput;
  timestamp: Date;
};

// Feedback (separate from TracingEvent for independent handling)
type FeedbackEvent = {
  type: 'feedback';
  traceId: string;
  spanId?: string;
  feedback: FeedbackInput;
  timestamp: Date;
};
```

---

## Exporter Interface

```typescript
interface ObservabilityExporter {
  readonly name: string;

  // Signal support declarations (all optional, undefined = false)
  readonly supportsTraces?: boolean;
  readonly supportsMetrics?: boolean;
  readonly supportsLogs?: boolean;
  readonly supportsScores?: boolean;
  readonly supportsFeedback?: boolean;

  // Signal handlers (optional based on support)
  onTracingEvent?(event: TracingEvent): void | Promise<void>;
  onMetricEvent?(event: MetricEvent): void | Promise<void>;
  onLogEvent?(event: LogEvent): void | Promise<void>;
  onScoreEvent?(event: ScoreEvent): void | Promise<void>;
  onFeedbackEvent?(event: FeedbackEvent): void | Promise<void>;

  // Lifecycle
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;

  // DEPRECATED - use span.addScore() instead
  /** @deprecated Use span.addScore() or trace.addScore() instead */
  addScoreToTrace?(args: AddScoreToTraceArgs): Promise<void>;
}
```

---

## Storage Schemas

### Logs Schema

```typescript
const logRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  level: z.string(),
  message: z.string(),
  data: z.record(z.unknown()).optional(),

  // Correlation
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  runId: z.string().optional(),
  sessionId: z.string().optional(),
  threadId: z.string().optional(),
  requestId: z.string().optional(),

  // Entity context
  entityType: z.string().optional(),
  entityName: z.string().optional(),

  // Multi-tenancy
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  resourceId: z.string().optional(),

  // Environment
  environment: z.string().optional(),
  serviceName: z.string().optional(),
  source: z.string().optional(),

  // Filtering
  tags: z.array(z.string()).optional(),
});
```

### Metrics Schema (cardinality-safe)

```typescript
const metricRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  name: z.string(),
  type: z.string(),
  value: z.number(),

  labels: z.record(z.string()),

  organizationId: z.string().optional(),
  environment: z.string().optional(),
  serviceName: z.string().optional(),

  bucketBoundaries: z.array(z.number()).optional(),
  bucketCounts: z.array(z.number()).optional(),
});
```

### Score Schema

```typescript
const scoreRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  traceId: z.string(),
  spanId: z.string().optional(),

  scorerName: z.string(),
  score: z.number(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),

  organizationId: z.string().optional(),
  environment: z.string().optional(),
  serviceName: z.string().optional(),
});
```

**TODO:** Verify scores table alignment with existing evals scores schema.

### Feedback Schema

```typescript
const feedbackRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),

  traceId: z.string(),
  spanId: z.string().optional(),

  source: z.string(),
  feedbackType: z.string(),
  value: z.union([z.number(), z.string()]),
  comment: z.string().optional(),

  userId: z.string().optional(),
  organizationId: z.string().optional(),
  environment: z.string().optional(),
  serviceName: z.string().optional(),
});
```

**TODO:** Revisit table name `mastra_ai_trace_feedback`.

---

## ObservabilityStorage Interface

```typescript
abstract class ObservabilityStorage extends StorageDomain {
  // === Tracing (existing) ===
  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> { throw NOT_IMPLEMENTED; }
  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> { throw NOT_IMPLEMENTED; }
  async getSpan(args: GetSpanArgs): Promise<TraceSpan | null> { throw NOT_IMPLEMENTED; }
  async listTraces(args: ListTracesArgs): Promise<PaginatedResult<TraceSpan>> { throw NOT_IMPLEMENTED; }

  // === Logs (new) ===
  async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> { throw NOT_IMPLEMENTED; }
  async listLogs(args: ListLogsArgs): Promise<PaginatedResult<LogRecord>> { throw NOT_IMPLEMENTED; }

  // === Metrics (new) ===
  async batchRecordMetrics(args: BatchRecordMetricsArgs): Promise<void> { throw NOT_IMPLEMENTED; }
  async listMetrics(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> { throw NOT_IMPLEMENTED; }

  // === Scores (moved from separate system) ===
  async createScore(args: CreateScoreArgs): Promise<void> { throw NOT_IMPLEMENTED; }
  async listScores(args: ListScoresArgs): Promise<PaginatedResult<ScoreRecord>> { throw NOT_IMPLEMENTED; }

  // === Feedback (new) ===
  async createFeedback(args: CreateFeedbackArgs): Promise<void> { throw NOT_IMPLEMENTED; }
  async listFeedback(args: ListFeedbackArgs): Promise<PaginatedResult<FeedbackRecord>> { throw NOT_IMPLEMENTED; }

  // === Capabilities ===
  get capabilities(): StorageCapabilities {
    return {
      tracing: { preferred: 'batch-with-updates', supported: ['realtime', 'batch-with-updates', 'insert-only'] },
      logs: { preferred: 'insert-only', supported: ['realtime', 'insert-only'] },
      metrics: { preferred: 'insert-only', supported: ['realtime', 'insert-only'] },
      scores: { supported: true },
      feedback: { supported: true },
    };
  }
}
```

---

## Tracing Improvements

### Score/Feedback APIs

```typescript
interface Span {
  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
}

interface ScoreInput {
  scorerName: string;
  score: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

interface FeedbackInput {
  source: string;
  feedbackType: string;
  value: number | string;
  comment?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}
```

### Trace Retrieval

```typescript
interface Mastra {
  getTrace(traceId: string): Promise<Trace | null>;
}

interface Trace {
  traceId: string;
  spans: Span[];

  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
  getSpan(spanId: string): Span | null;
}
```

### SessionId Support

```typescript
interface TracingOptions {
  sessionId?: string;    // new: multi-turn conversation grouping
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
      blockedLabels?: string[];   // undefined = DEFAULT_BLOCKED_LABELS
      blockUUIDs?: boolean;        // default: true
    };
  };
}

const DEFAULT_BLOCKED_LABELS = [
  'trace_id', 'span_id', 'run_id',
  'request_id', 'user_id', 'resource_id'
];
```

---

## DuckDB Adapter

For local development - embedded, columnar, no external dependencies.

**Capabilities:**
```typescript
get capabilities(): StorageCapabilities {
  return {
    tracing: { preferred: 'realtime', supported: ['realtime', 'batch-with-updates'] },
    logs: { preferred: 'realtime', supported: ['realtime'] },
    metrics: { preferred: 'realtime', supported: ['realtime'] },
    scores: { supported: true },
    feedback: { supported: true },
  };
}
```

---

## ClickHouse Adapter

For production - high-volume ingestion, insert-only.

### Logs Table

```sql
CREATE TABLE mastra_ai_logs (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  LogId String CODEC(ZSTD(1)),
  Level LowCardinality(String) CODEC(ZSTD(1)),
  Message String CODEC(ZSTD(1)),
  Data Map(LowCardinality(String), String) CODEC(ZSTD(1)),

  TraceId String CODEC(ZSTD(1)),
  SpanId String CODEC(ZSTD(1)),

  ServiceName LowCardinality(String) CODEC(ZSTD(1)),
  EntityType LowCardinality(String) CODEC(ZSTD(1)),
  EntityName LowCardinality(String) CODEC(ZSTD(1)),
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),

  INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_data_key mapKeys(Data) TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_data_value mapValues(Data) TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, Level, toUnixTimestamp(Timestamp))
```

### Metrics Table

```sql
CREATE TABLE mastra_ai_metrics (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  MetricId String CODEC(ZSTD(1)),
  Name LowCardinality(String) CODEC(ZSTD(1)),
  Type LowCardinality(String) CODEC(ZSTD(1)),
  Value Float64 CODEC(ZSTD(1)),
  Labels Map(LowCardinality(String), String) CODEC(ZSTD(1)),

  ServiceName LowCardinality(String) CODEC(ZSTD(1)),
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),

  INDEX idx_labels_key mapKeys(Labels) TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_labels_value mapValues(Labels) TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (Name, toUnixTimestamp(Timestamp))
```

---

## MomentExporter (Pulse)

Internal-only exporter for event store experimentation.

**Moment Kinds:**
```typescript
type MomentKind =
  | 'span.started'
  | 'span.ended'
  | 'span.updated'
  | 'span.error'
  | 'score.added'
  | 'feedback.added'
  | 'log.added';
  // Future: 'deploy.completed', 'config.changed', 'metric.recorded', etc.
```

**Moment Schema (ClickHouse):**
```sql
CREATE TABLE pulse_moments (
  Id String,
  Timestamp DateTime64(9),
  Kind LowCardinality(String),

  TraceId String,
  SpanId String,
  ParentSpanId String,

  RunId String,
  SessionId String,
  ThreadId String,
  RequestId String,

  OrganizationId String,
  UserId String,

  ServiceName LowCardinality(String),
  Environment LowCardinality(String),
  EntityType LowCardinality(String),
  EntityName LowCardinality(String),

  Payload String,

  INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_span_id SpanId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_org_id OrganizationId TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (OrganizationId, Kind, toUnixTimestamp(Timestamp))
```

**Extensibility:** `Kind` is `LowCardinality(String)` - new kinds can be added without schema migration.

---

## Built-in Metrics Catalog

Auto-extracted from span lifecycle events.

### Agent Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_agent_runs_started` | counter | agent, env, service |
| `mastra_agent_runs_ended` | counter | agent, status, env, service |
| `mastra_agent_duration_ms` | histogram | agent, status, env, service |

### Model Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_model_requests_started` | counter | model, provider, agent |
| `mastra_model_requests_ended` | counter | model, provider, agent, status |
| `mastra_model_duration_ms` | histogram | model, provider, agent |
| `mastra_model_input_tokens` | counter | model, provider, agent, token_type |
| `mastra_model_output_tokens` | counter | model, provider, agent, token_type |

### Tool Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_tool_calls_started` | counter | tool, agent, env |
| `mastra_tool_calls_ended` | counter | tool, agent, status, env |
| `mastra_tool_duration_ms` | histogram | tool, agent, env |

### Workflow Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_workflow_runs_started` | counter | workflow, env |
| `mastra_workflow_runs_ended` | counter | workflow, status, env |
| `mastra_workflow_duration_ms` | histogram | workflow, status, env |

### Score/Feedback Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_scores_total` | counter | scorer, entity_type, entity_name, experiment |
| `mastra_feedback_total` | counter | feedback_type, source, experiment |

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Event bus infrastructure (TracingBus, MetricsBus, LogsBus)
- [ ] Exporter interface with signal support declarations
- [ ] Update existing exporters to declare `supportsTraces: true`
- [ ] No-op LoggerContext and MetricsContext implementations
- [ ] Context mixin (`tracing`, `logger`, `metrics` on all contexts)
- [ ] Backward compat: `tracingContext` alias
- [ ] DuckDB adapter: spans table (new adapter)

### Phase 1.5: Debug Exporters
- [ ] GrafanaCloudExporter (T/M/L) - for debugging/production visibility
- [ ] JsonExporter updates - ensure T/M/L debug output

### Phase 2: Logging
- [ ] LoggerContext implementation (auto-correlation)
- [ ] LogRecord schema and storage methods
- [ ] LogsBus → exporter routing
- [ ] DefaultExporter: logs support
- [ ] CloudExporter: logs support
- [ ] JsonExporter: logs support
- [ ] GrafanaCloudExporter: logs support (Loki)
- [ ] DuckDB adapter: logs table
- [ ] ClickHouse adapter: logs table

### Phase 3: Metrics
- [ ] MetricsContext implementation (auto-labels, cardinality protection)
- [ ] MetricRecord schema and storage methods
- [ ] MetricsBus → exporter routing
- [ ] TracingBus → MetricsBus cross-emission (auto-extracted metrics)
- [ ] Built-in metrics catalog
- [ ] DefaultExporter: metrics support
- [ ] CloudExporter: metrics support
- [ ] JsonExporter: metrics support
- [ ] GrafanaCloudExporter: metrics support (Mimir)
- [ ] DuckDB adapter: metrics table
- [ ] ClickHouse adapter: metrics table

### Phase 4: Scores & Feedback
- [ ] Rename TracingBus → ObservabilityBus (handles all event types)
- [ ] `span.addScore()` / `span.addFeedback()` APIs
- [ ] `trace.addScore()` / `trace.addFeedback()` APIs
- [ ] `mastra.getTrace(traceId)` for post-hoc attachment
- [ ] Score/Feedback schemas and storage methods
- [ ] ScoreEvent / FeedbackEvent types with separate handlers
- [ ] DefaultExporter: `onScoreEvent()` / `onFeedbackEvent()` handlers
- [ ] CloudExporter: scores/feedback support

### Phase 5: Tracing Improvements
- [ ] SessionId support in TracingOptions and span schema
- [ ] Unified ObservabilityConfig on Mastra
- [ ] Deprecate top-level `logger` config with migration path

### Phase 5.5: Exporter Expansion
- [ ] LangfuseExporter: logs, scores, feedback support
- [ ] BraintrustExporter: logs, scores, feedback support
- [ ] LangSmithExporter: scores, feedback support
- [ ] DatadogExporter: logs, metrics support
- [ ] OtelExporter: logs, metrics support
- [ ] Other exporters: audit and expand capabilities

### Phase 6: MomentExporter
- [ ] Moment schema (event store approach)
- [ ] MomentExporter implementation
- [ ] ClickHouse pulse_moments table

---

## Backward Compatibility

- Existing tracing code works unchanged
- `tracingContext` alias for `tracing` (deprecated)
- Top-level `logger` config deprecated but still works
- All contexts gain `tracing`, `logger`, `metrics` (always present, no-op if not configured)

---

## Detailed Phase Documents

Each phase has a detailed document with PR-by-package breakdowns, specific tasks, and code examples:

| Phase | Document | Scope |
|-------|----------|-------|
| Phase 1 | [phase-1-foundation.md](./phase-1-foundation.md) | Event buses, context injection, DuckDB adapter |
| Phase 1.5 | [phase-1.5-debug-exporters.md](./phase-1.5-debug-exporters.md) | GrafanaCloudExporter, JsonExporter |
| Phase 2 | [phase-2-logging.md](./phase-2-logging.md) | LoggerContext, LogRecord, storage |
| Phase 3 | [phase-3-metrics.md](./phase-3-metrics.md) | MetricsContext, auto-extraction, cardinality |
| Phase 4 | [phase-4-scores-feedback.md](./phase-4-scores-feedback.md) | Score/Feedback APIs, storage |
| Phase 5 | [phase-5-tracing-improvements.md](./phase-5-tracing-improvements.md) | SessionId, ObservabilityConfig |
| Phase 5.5 | [phase-5.5-exporter-expansion.md](./phase-5.5-exporter-expansion.md) | Langfuse, Datadog, OTel expansion |
| Phase 6 | [phase-6-moment-exporter.md](./phase-6-moment-exporter.md) | MomentExporter, pulse_moments |

---

## Open TODOs

- [ ] Verify scores table alignment with existing evals scores schema
- [ ] Revisit table name `mastra_ai_trace_feedback`
- [ ] Reference existing NoOp tracing implementation
- [ ] Decide on changeset strategy (per-PR or per-phase)
- [ ] Create migration guide for deprecated `tracingContext`
- [ ] Decide if DuckDB should be default for local dev
