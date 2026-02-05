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

### Type Examples

**Tracing (existing pattern to follow):**
```typescript
// Input: Runtime object with methods
interface Span { ... }

// Exported: Serializable data for event bus
interface ExportedSpan { ... }  // AnyExportedSpan

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

Events use the Exported types for transport:

```typescript
type TracingEvent =
  | { type: 'span.started'; span: AnyExportedSpan }
  | { type: 'span.updated'; span: AnyExportedSpan }
  | { type: 'span.ended'; span: AnyExportedSpan }
  | { type: 'span.error'; span: AnyExportedSpan; error: SpanErrorInfo };

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

### Phase 3: Logging
LoggerContext implementation - no exporter work (Phase 2 exporters already handle LogEvent).

- [ ] LoggerContext implementation with auto-correlation
- [ ] ExportedLog type finalization
- [ ] LogRecord schema (for storage in Phase 6)
- [ ] LogEvent emission to ObservabilityBus

### Phase 4: Metrics
MetricsContext implementation - no exporter work.

- [ ] MetricsContext implementation with auto-labels
- [ ] Cardinality protection (blocked labels, UUID detection)
- [ ] ExportedMetric type finalization
- [ ] MetricRecord schema (for storage in Phase 6)
- [ ] MetricEvent emission to ObservabilityBus
- [ ] TracingEvent → MetricEvent cross-emission (auto-extracted metrics)
- [ ] Built-in metrics catalog

### Phase 5: Scores & Feedback
Score/Feedback APIs - no exporter work.

- [ ] `span.addScore()` / `span.addFeedback()` APIs
- [ ] `trace.addScore()` / `trace.addFeedback()` APIs
- [ ] `mastra.getTrace(traceId)` for post-hoc attachment
- [ ] ExportedScore / ExportedFeedback type finalization
- [ ] ScoreRecord / FeedbackRecord schemas (for storage in Phase 6)
- [ ] ScoreEvent / FeedbackEvent emission to ObservabilityBus

### Phase 6: Stores & DefaultExporter
Storage adapters and the DefaultExporter that writes to storage.

- [ ] DefaultExporter: Exported → Record conversion, writes to storage
- [ ] DuckDB adapter: spans, logs, metrics, scores, feedback tables
- [ ] ClickHouse adapter: spans, logs, metrics, scores, feedback tables
- [ ] Storage strategy getters for each signal
- [ ] Batch write optimizations

### Phase 7: Server & Client APIs
HTTP APIs and client SDK for accessing stored data.

- [ ] Server routes for traces, logs, metrics, scores, feedback
- [ ] client-js SDK updates
- [ ] CloudExporter (writes to Mastra Cloud API)

### Phase 8: Third-Party Exporters
Expand third-party integrations to support additional signals.

- [ ] OtelExporter: logs, metrics support
- [ ] LangfuseExporter: logs, scores, feedback support
- [ ] BraintrustExporter: logs, scores, feedback support
- [ ] LangSmithExporter: scores, feedback support
- [ ] DatadogExporter: logs, metrics support
- [ ] ArizeExporter: traces, scores support
- [ ] Other exporters: audit and expand

### Phase 9: MomentExporter
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
Phase 3 (Logging) ──────┐
    ↓                   │
Phase 4 (Metrics) ──────┼── can run in parallel
    ↓                   │
Phase 5 (Scores/Feedback)┘
    ↓
Phase 6 (Stores & DefaultExporter)
    ↓
Phase 7 (Server & Client) ← depends on storage
    ↓
Phase 8 (3rd-Party Exporters) ← can start after Phase 2
    ↓
Phase 9 (MomentExporter)
```

**Notes:**
- Phases 3, 4, 5 can run in parallel after Phase 2
- Phase 8 can start after Phase 2 (exporters just need Exported types)
- Phase 6, 7, 9 must be sequential

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
| Phase 3 | [phase-3/](./phase-3/) | LoggerContext implementation |
| Phase 4 | [phase-4/](./phase-4/) | MetricsContext, auto-extraction |
| Phase 5 | [phase-5/](./phase-5/) | Score/Feedback APIs |
| Phase 6 | [phase-6/](./phase-6/) | Stores & DefaultExporter |
| Phase 7 | [phase-7/](./phase-7/) | Server & client-js |
| Phase 8 | [phase-8/](./phase-8/) | Third-party exporters |
| Phase 9 | [phase-9/](./phase-9/) | MomentExporter |

---

## Open TODOs

- [ ] Verify scores table alignment with existing evals scores schema
- [ ] Revisit table name `mastra_ai_trace_feedback`
- [ ] Reference existing NoOp tracing implementation
- [ ] Decide on changeset strategy (per-PR or per-phase)
- [ ] Create migration guide for deprecated `tracingContext`
