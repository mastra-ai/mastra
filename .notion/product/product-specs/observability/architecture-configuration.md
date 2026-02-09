# Observability Architecture & Configuration

System architecture and configuration for Mastra's unified observability platform.

---

## Design Principles

- **Single configuration** - All observability (traces, metrics, logs) configured in one place
- **Exporters declare capabilities** - Each exporter specifies which signals (T/M/L) it supports
- **Automatic when enabled** - Enable observability to automatically get traces + metrics + logs
- **Zero-config instrumentation** - Built-in metrics emitted without additional configuration
- **Correlation by design** - All signals share common dimensions for cross-signal navigation
- **Pluggable storage** - Same storage domain pattern as other Mastra components
- **Export flexibility** - Support for Mastra Cloud, Grafana, OTLP, and custom exporters

---

## Unified Telemetry API

A single mental model for all three signals, with context-aware APIs that auto-capture correlation data.

### ObservabilityContext (Inside Tools/Workflows)

All three signals accessed through a unified `observability` context with flattened API:

```typescript
interface ObservabilityContext {
  // === Tracing ===
  currentSpan?: Span;
  createChildSpan(opts: SpanOptions): Span;

  // === Logging (flattened) ===
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;

  // === Metrics (flattened) ===
  counter(name: string): Counter;
  gauge(name: string): Gauge;
  histogram(name: string): Histogram;

  // === Correlation context (read-only) ===
  traceId?: string;
  spanId?: string;

  // === Underlying systems (for advanced use) ===
  logger: Logger;
  metrics: MetricsAPI;
}
```

**Usage:**

```typescript
execute: async (input, { observability }) => {
  // Logging - auto-correlates with traceId, spanId, tool, agent, etc.
  observability.info("Processing input", { inputSize: input.length });

  // Metrics - auto-labels with tool, agent, workflow, env
  observability.counter('my_custom_counter').add(1, {
    custom_label: 'foo'
  });

  // Tracing - child spans inherit context
  const span = observability.createChildSpan({
    name: "custom-operation",
  });
  // ... work ...
  span.end();

  return result;
}
```

**With destructuring:**

```typescript
execute: async (input, { observability: obs }) => {
  obs.info("Starting");
  obs.counter("calls").add(1);
}
```

### Direct APIs (Outside Trace Context)

For startup logs, background jobs, or other scenarios outside trace context:

```typescript
// Logging without trace correlation
mastra.logger.info("Application started", { version: "1.0.0" });
mastra.logger.warn("Config missing, using defaults");
mastra.logger.error("Background job failed", { jobId: "123" });

// Metrics without auto-labels
mastra.metrics.counter('background_jobs_total').add(1, { job_type: 'cleanup' });
mastra.metrics.gauge('queue_depth').set(42, { queue: 'high_priority' });
```

These APIs emit events through the ObservabilityBus but without trace correlation fields (no traceId/spanId) and without span-derived auto-labels.

### Signal Type Architecture

Each signal follows a three-tier type pattern to separate concerns:

| Tier | Purpose | Serializable | Examples |
|------|---------|--------------|----------|
| **Input** | User-facing API parameters | Not required | `ScoreInput`, `FeedbackInput`, method params |
| **Exported** | Event bus transport, exporter consumption | **Required** | `ExportedLog`, `ExportedMetric`, `ExportedScore` |
| **Record** | Storage format, database schemas | Required | `LogRecord`, `MetricRecord`, `ScoreRecord` |

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

**Signal type mappings:**

| Signal | Input | Exported | Record |
|--------|-------|----------|--------|
| Tracing | `Span` (runtime) | `AnyExportedSpan` | `SpanRecord` |
| Logs | method params | `ExportedLog` | `LogRecord` |
| Metrics | method params | `ExportedMetric` | `MetricRecord` |
| Scores | `ScoreInput` | `ExportedScore` | `ScoreRecord` |
| Feedback | `FeedbackInput` | `ExportedFeedback` | `FeedbackRecord` |

### Event Bus Architecture

A single `ObservabilityBus` handles all event types and routes to appropriate exporter handlers. Cross-emission generates MetricEvents from TracingEvents for automatic metric extraction.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Observability                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    ObservabilityBus                          │   │
│  │                                                              │   │
│  │  TracingEvent  ──► onTracingEvent()  ──► (cross-emit metrics)│   │
│  │  LogEvent      ──► onLogEvent()                              │   │
│  │  MetricEvent   ──► onMetricEvent()                           │   │
│  │  ScoreEvent    ──► onScoreEvent()    ──► (cross-emit metrics)│   │
│  │  FeedbackEvent ──► onFeedbackEvent() ──► (cross-emit metrics)│   │
│  │                                                              │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│                      ┌─────────────┐                                │
│                      │  Exporters  │                                │
│                      │ (T/M/L/S/F) │                                │
│                      └─────────────┘                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key points:**
- Single ObservabilityBus routes all event types to appropriate handlers
- Handler presence = signal support (no separate capability flags)
- Cross-emission: TracingEvents generate MetricEvents (for built-in metric extraction)
- Cross-emission: ScoreEvents/FeedbackEvents generate MetricEvents (for score distribution)
- All event payloads use Exported types (serializable)

**TracingEvent format (existing codebase):**
```typescript
enum TracingEventType {
  SPAN_STARTED = 'span_started',
  SPAN_UPDATED = 'span_updated',
  SPAN_ENDED = 'span_ended',
}

type TracingEvent =
  | { type: TracingEventType.SPAN_STARTED; exportedSpan: AnyExportedSpan }
  | { type: TracingEventType.SPAN_UPDATED; exportedSpan: AnyExportedSpan }
  | { type: TracingEventType.SPAN_ENDED; exportedSpan: AnyExportedSpan };
```

**Note:** TracingEvent uses an enum with snake_case values (`span_started`) and the field is `exportedSpan` (not `span`).

**Auto-extracted metrics from scores/feedback:**

| Event | Metrics Emitted |
|-------|-----------------|
| `score.added` | `mastra_scores_total`, `mastra_score_value` (histogram) |
| `feedback.added` | `mastra_feedback_total`, `mastra_feedback_value` (histogram for numeric) |

---

## Storage Architecture

### Separation of Concerns

| Data Type | Storage | Purpose |
|-----------|---------|---------|
| Transactional (users, teams, projects) | PostgreSQL | OLTP operations |
| Observability (traces, spans, logs, metrics) | ClickHouse | OLAP analytics |

### Why ClickHouse for Observability?

- High-volume ingestion (millions of events/second)
- Optimized for time-series data
- 10-20x compression ratios
- Sub-second queries on billions of rows

---

## Storage Provider Safety

Telemetry has unique traits that not all databases handle well:
- Bursty writes
- Heavy cardinality
- High retention needs
- Read patterns: "scan & aggregate"

**Principle:** Observability ingestion should not be enabled on backends that can't cope with telemetry volume.

### Supported Storage Backends

| Backend | Tracing | Metrics | Logs | Role |
|---------|:-------:|:-------:|:----:|------|
| **DuckDB** | ✓ | ✓ | ✓ | Recommended local dev (columnar, good perf, npm-only) |
| **LibSQL** | ✓ | ✓ | ✓ | Legacy / simple demos |
| **PostgreSQL** | ✓ | ✓ | ✓ | MVP / low-volume production |
| **ClickHouse** | ✓ | ✓ | ✓ | Large scale production (recommended) |
| **MongoDB** | ✓ | ✗ | ✗ | Legacy tracing only - not recommended |
| **MSSQL** | ✓ | ✗ | ✗ | Legacy tracing only - not recommended |

**Recommendation hierarchy:** DuckDB (local) → ClickHouse (production)

**Note:** DuckDB is embedded (npm package only, no CLI required) with columnar storage, providing good analytical query performance for local development. DuckDB complements LibSQL well: use DuckDB for observability (OLAP workloads) and LibSQL for everything else (transactional data).

---

## Exporter Configuration

### Unified Configuration Model

All observability is configured through a single `Observability` instance. Exporters declare which signals they support.

```typescript
const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: "my-app",
        logLevel: 'info',  // Root level - ceiling for all log exporters
        exporters: [
          new DefaultExporter(),       // T ✓  M ✓  L ✓  → Storage
          new CloudExporter(),         // T ✓  M ✓  L ✓  → Mastra Cloud
          new PinoExporter({           // T ✗  M ✗  L ✓  → Console (pretty)
            level: 'debug',            // Adjusted to 'info' ⚠ (can't exceed root)
            pretty: true,
          }),
          new BraintrustExporter(),    // T ✓  M ✗  L ✓  → Braintrust
        ],
      },
    },
  }),
});
```

### Log Level Filtering

Log levels follow a ceiling model:

- **Root `logLevel`** is the ceiling - filters before events enter the observability system
- **Per-exporter `level`** filters down from root (can be more restrictive, not less)
- If exporter level < root level → warn on startup, auto-adjust exporter up to root level

```typescript
// Root: info
// ├── PinoExporter: debug  → adjusted to info ⚠
// ├── DefaultExporter: info → ok
// └── CloudExporter: warn  → ok (filtering down)
```

To get debug logs to a specific exporter, set root to 'debug' and let other exporters filter down.

### Exporter Signal Support

Each exporter declares which signals it handles. Some exporters also support scores and user feedback.

→ See [Exporters - Signal Support Matrix](./exporters.md#signal-support-matrix) for the full list

### Multiple Exporters

You can use multiple exporters simultaneously. Each signal is sent to all exporters that support it. This allows mixing:
- Storage for Studio/querying
- Cloud for managed observability
- Console for dev visibility
- External platforms for specific features

### Exporter Interface

→ See [Exporters - Exporter Interface](./exporters.md#exporter-interface) for the interface definition

### Migration from Top-Level Logger

The `logger` property at the Mastra config level is deprecated.

→ See [Exporters - Migration from Top-Level Logger](./exporters.md#migration-from-top-level-logger) for migration guide

---

## Sampling Strategies

Control which traces and logs are collected.

**Note:** Traces and logs are sampled together — when a trace is sampled in, all associated logs are included, and vice versa. This ensures complete observability for sampled executions. Separate trace/log sampling may be added in the future.

**Metrics are not sampled** — they capture aggregate data (counters, histograms) and should always be collected to ensure accurate measurements.

| Strategy | Config | Description |
|----------|--------|-------------|
| Always | `{ type: "always" }` | Capture 100% (default) |
| Never | `{ type: "never" }` | Disable entirely |
| Ratio | `{ type: "ratio", probability: 0.1 }` | Sample percentage (0-1) |
| Custom | `{ type: "custom", sampler: fn }` | Custom logic based on context |

### Custom Sampler Example

```typescript
sampling: {
  type: 'custom',
  sampler: (options) => {
    // Sample premium users at higher rate
    if (options?.metadata?.userTier === 'premium') {
      return Math.random() < 0.5; // 50%
    }
    return Math.random() < 0.01; // 1% default
  }
}
```

---

## Multi-Config Setup

Use `configSelector` for dynamic configuration selection:

```typescript
new Observability({
  configs: {
    development: { /* full tracing */ },
    production: { /* sampled tracing */ },
    debug: { /* detailed tracing */ },
  },
  configSelector: (context, availableConfigs) => {
    if (context.requestContext?.get("supportMode")) {
      return "debug";
    }
    return process.env.NODE_ENV || "development";
  },
})
```

**Note:** Only one config is used per execution, but a single config can have multiple exporters.

---

## Serverless Environments

In serverless environments, call `flush()` to ensure telemetry is exported before termination:

```typescript
export async function POST(req: Request) {
  const result = await agent.generate(await req.text());

  // Ensure telemetry is exported
  const observability = mastra.getObservability();
  await observability.flush();

  return Response.json(result);
}
```

### flush() vs shutdown()

| Method | Behavior | Use Case |
|--------|----------|----------|
| `flush()` | Exports buffered data, keeps exporters active | Serverless, periodic flushing |
| `shutdown()` | Exports buffered data, releases resources | Application termination |

---

## Data Model Principles

### Attributes/Labels Are First-Class

To make metrics useful and avoid "multi-writer chaos":
- A metric isn't uniquely identified by name alone
- It's identified by: `name + attributes`

### Cardinality Management

Telemetry systems die by label cardinality. Mastra enforces guardrails on **metric labels only** (logs and traces can have these fields in metadata).

**Blocked label keys (rejected):**
- `trace_id`, `span_id`, `run_id`, `request_id`, `user_id`
- Free-form strings, UUIDs

**Allowed labels (bounded cardinality):**
- `workflow`, `agent`, `tool`, `model`, `status`, `env`, `service`
- `step` (with caveats - see note below)

**Rejection behavior:**
- First occurrence: Reject + log warning
- Subsequent: Reject silently (no log spam)

**Override config (use with caution):**
```typescript
observability: new Observability({
  configs: {
    default: {
      exporters: [...],
      metrics: {
        // ⚠️ Allowing high-cardinality labels can severely degrade
        // query performance and storage efficiency. Use with caution.
        allowedLabels: ['user_id'],
      },
    },
  },
})
```

**Guardrails:**
- Denylist of blocked keys (hard reject)
- UUID pattern detection (reject)
- Runtime cardinality monitoring (warn at threshold)
- Value length cap (128 chars)

**Note:** Step labels in workflow mapping operations may need special handling - IDs/names can be generated and change on each run, causing cardinality explosion. This is flagged for deeper investigation during workflow implementation.

---

## Signal Processors

Signal processors transform, filter, or enrich telemetry data before export. Rather than having separate processor systems for each signal type, Mastra uses a unified approach.

### Processor Interface

```typescript
interface SignalProcessor {
  name: string;

  // Implement the signals you want to process
  processSpan?(span: Span): Span | null;      // null = drop
  processLog?(log: LogRecord): LogRecord | null;
  processMetric?(metric: MetricEvent): MetricEvent | null;

  shutdown(): Promise<void>;
}
```

### Built-in Processors

| Processor | Spans | Logs | Metrics | Description |
|-----------|:-----:|:----:|:-------:|-------------|
| **SensitiveDataFilter** | ✓ | ✓ | ✗ | Redacts passwords, tokens, API keys |

### Configuration

```typescript
new Observability({
  configs: {
    default: {
      exporters: [...],
      processors: [
        new SensitiveDataFilter(),
        new CustomProcessor(),
      ],
    },
  },
})
```

Processors run once before data is sent to exporters, affecting all exporters uniformly.

→ See [Tracing - Span Processors](./tracing.md#span-processors) for custom processor examples

---

## Testing Observability

### Shape-Based Testing

Use "shape-based" expectations rather than fragile exact byte matches:
- Ordering-insensitive comparisons
- Allowlist/denylist of fields
- Stable normalization (timestamps, ids)

### Record/Replay Approach

- Export trace output as JSON/YAML
- Compare to expected "TraceSpec" definition
- Fail if there are extra or missing spans

---

## ObservabilityStorage Interface

The observability storage follows the standard Mastra storage domain pattern, extending `StorageDomain`.

**Location:** `packages/core/src/storage/domains/observability/`

### Current API (Tracing)

```typescript
abstract class ObservabilityStorage extends StorageDomain {
  // Strategy hint for storage adapters
  readonly tracingStorageStrategy: 'realtime' | 'batch-with-updates' | 'insert-only';

  // Span Creation
  abstract createSpan(args: CreateSpanArgs): Promise<SpanRecord>;
  abstract batchCreateSpans(args: BatchCreateSpansArgs): Promise<SpanRecord[]>;

  // Span Retrieval
  abstract getSpan(args: GetSpanArgs): Promise<TraceSpan | null>;
  abstract getRootSpan(args: GetRootSpanArgs): Promise<TraceSpan | null>;
  abstract getTrace(args: GetTraceArgs): Promise<TraceSpan[]>;

  // Span Updates
  abstract updateSpan(args: UpdateSpanArgs): Promise<SpanRecord>;
  abstract batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<SpanRecord[]>;

  // Trace Listing (with filtering, pagination, ordering)
  abstract listTraces(args: ListTracesArgs): Promise<PaginatedResult<TraceSpan>>;

  // Deletion
  abstract batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void>;

  // Admin
  abstract dangerouslyClearAll(): Promise<void>;
}
```

### Filtering Support

`listTraces` supports comprehensive filtering:

```typescript
interface TracesFilter {
  // Time range
  startedAt?: { start?: Date; end?: Date };
  endedAt?: { start?: Date; end?: Date };

  // Span properties
  spanType?: SpanType;
  status?: 'ERROR' | 'RUNNING' | 'SUCCESS';
  hasChildError?: boolean;

  // Entity
  entityType?: EntityType;
  entityId?: string;
  entityName?: string;

  // Multi-tenancy
  userId?: string;
  organizationId?: string;
  resourceId?: string;

  // Correlation
  runId?: string;
  sessionId?: string;
  threadId?: string;
  requestId?: string;

  // Deployment
  environment?: string;
  source?: string;
  serviceName?: string;

  // Partial matching
  scope?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];  // All must match
}
```

### Planned: Logs API

```typescript
abstract class ObservabilityStorage extends StorageDomain {
  // ... existing tracing methods ...

  // Log Creation
  abstract createLog(args: CreateLogArgs): Promise<LogRecord>;
  abstract batchCreateLogs(args: BatchCreateLogsArgs): Promise<LogRecord[]>;

  // Log Retrieval
  abstract getLog(args: GetLogArgs): Promise<LogRecord | null>;
  abstract listLogs(args: ListLogsArgs): Promise<PaginatedResult<LogRecord>>;

  // Log Search
  abstract searchLogs(args: SearchLogsArgs): Promise<PaginatedResult<LogRecord>>;

  // Deletion
  abstract batchDeleteLogs(args: BatchDeleteLogsArgs): Promise<void>;
}
```

### Planned: Metrics API

```typescript
abstract class ObservabilityStorage extends StorageDomain {
  // ... existing tracing and logs methods ...

  // Metric Recording
  abstract recordMetric(args: RecordMetricArgs): Promise<MetricRecord>;
  abstract batchRecordMetrics(args: BatchRecordMetricsArgs): Promise<MetricRecord[]>;

  // Metric Querying
  abstract queryMetrics(args: QueryMetricsArgs): Promise<MetricResult[]>;
  abstract getMetricSeries(args: GetMetricSeriesArgs): Promise<MetricSeries>;

  // Aggregation
  abstract aggregateMetrics(args: AggregateMetricsArgs): Promise<void>;

  // Deletion
  abstract batchDeleteMetrics(args: BatchDeleteMetricsArgs): Promise<void>;
}
```

### Storage Strategy Hints

Adapters communicate their preferred tracing strategy:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `realtime` | Immediate writes, supports updates | Development, low volume |
| `batch-with-updates` | Batched writes, supports updates | Production with moderate volume |
| `insert-only` | Append-only, no updates | High volume, ClickHouse |

### Implementations

| Backend | Status | Notes |
|---------|--------|-------|
| In-Memory | ✓ Implemented | Testing, development |
| PostgreSQL | ✓ Implemented | MVP / low-volume production |
| LibSQL | ✓ Implemented | Legacy / simple demos |
| DuckDB | Planned | Local dev (OLAP) |
| ClickHouse | Planned | Production scale |

---

## Retention Policies

**Default retention periods:**

| Signal | Retention |
|--------|-----------|
| Traces | 10 days |
| Metrics (raw) | 10 days |
| Metrics (aggregated) | 90 days |
| Logs | 10 days |

**Enforcement:** Manual via CLI only (no background job infrastructure yet)

**CLI commands:**
```bash
mastra traces cleanup --older-than 10d
mastra logs cleanup --older-than 10d
mastra metrics cleanup --older-than 10d
mastra metrics aggregate --older-than 3d
```

**Future CLI expansion:**
```bash
mastra logs --search 'error'
mastra logs --trace-id abc123
mastra traces list --status error --since 24h
```

---

## Server Adapter Instrumentation

**Status:** Deferred for initial implementation

**Future goal:** Add observability middleware to server adapters:
- Auto-create trace for each HTTP request
- Emit HTTP metrics (`mastra_http_requests_total`, `mastra_http_duration_ms`)
- Capture request/response logs
- User-added endpoints get observability for free
- Handle path cardinality (`/users/:id` not `/users/123`)

---

## Related Documents

- [Observability](./README.md) (parent)
- [Metrics](./metrics.md)
- [Tracing](./tracing.md)
- [Logging](./logging.md)
- [Exporters](./exporters.md)
- [Plan Analysis](./plan-analysis.md) - Competitive analysis informing design
- [User Anecdotes](./user-anecdotes.md) - User feedback driving requirements
