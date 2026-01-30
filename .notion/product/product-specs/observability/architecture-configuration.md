# Observability Architecture & Configuration

System architecture and configuration for Mastra's unified observability platform.

---

## Design Principles

- **Automatic when enabled** - Enable observability to automatically get traces + metrics + logs
- **Zero-config instrumentation** - Built-in metrics emitted without additional configuration
- **Correlation by design** - All signals share common dimensions for cross-signal navigation
- **Pluggable storage** - Same storage domain pattern as other Mastra components
- **Export flexibility** - Support for Mastra Cloud, Grafana, OTLP, and custom exporters

---

## HTTP Server Instrumentation

All HTTP requests to the Mastra server are automatically instrumented with traces, metrics, and logs (Sentry-style). User-added endpoints get observability for free.

---

## Unified Telemetry API

A single mental model for:
- Trace spans
- Log events
- Metric points

**But** preserve backend-specific exporters.

### Instrumentation Example

```typescript
trace(...);
log.info(...);
metrics.counter(...).add(1);
metrics.histogram(...).record(value);
```

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

### Recommended Storage Tiers

| Use Case | Recommended Storage |
|----------|---------------------|
| Local development | LibSQL |
| Mid-size production | PostgreSQL |
| Large/cloud/distributed | ClickHouse |

---

## Query Language Goals

### Desired Portability

Support "same QL" across multiple backends:
- SQL counts as a QL for you
- PromQL is highly desirable (especially for Grafana)

### Grafana Integration Paths

| Path | Description |
|------|-------------|
| PromQL support | Prometheus-compatible storage layer |
| Grafana via SQL | ClickHouse/PG SQL queries shaped into time series |
| OTLP Pipeline | OTLP -> Grafana Alloy -> Mimir/Loki/Tempo |

---

## Exporter Configuration

### Basic Configuration

```typescript
observability: new Observability({
  configs: {
    default: {
      serviceName: "my-app",
      exporters: [
        new DefaultExporter(),     // Local storage
        new CloudExporter(),       // Mastra Cloud
        new LangfuseExporter(),    // Langfuse for LLM analytics
      ],
    },
  },
})
```

### Multiple Exporters

You can use multiple exporters simultaneously to send telemetry to different backends.

---

## Data Model Principles

### Attributes/Labels Are First-Class

To make metrics useful and avoid "multi-writer chaos":
- A metric isn't uniquely identified by name alone
- It's identified by: `name + attributes`

### Cardinality Management

Telemetry systems die by label cardinality.

**Recommended attribute keys:**
- workflow name
- step name
- tool name
- model provider / model name
- environment (dev/staging/prod)
- app/service name
- instance ID / process ID

**Careful with:**
- user/org (high cardinality!)

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

## ObservabilityProvider Interface

```typescript
abstract class ObservabilityProvider {
  abstract init(): Promise<void>;
  abstract shutdown(): Promise<void>;

  // Traces
  abstract createTrace(trace: CreateTraceInput): Promise<Trace>;
  abstract updateTrace(id: string, input: UpdateTraceInput): Promise<Trace>;
  abstract getTrace(id: string): Promise<Trace | null>;
  abstract listTraces(filter: TraceFilter): Promise<PaginatedResult<Trace>>;

  // Spans
  abstract createSpan(span: CreateSpanInput): Promise<Span>;
  abstract listSpans(traceId: string): Promise<Span[]>;

  // Logs
  abstract ingestLogs(logs: CreateLogInput[]): Promise<void>;
  abstract queryLogs(filter: LogFilter): Promise<PaginatedResult<Log>>;
  abstract streamLogs(filter: LogFilter): AsyncIterable<Log>;

  // Metrics
  abstract recordMetrics(metrics: CreateMetricInput[]): Promise<void>;
  abstract queryMetrics(query: MetricQuery): Promise<MetricResult[]>;

  // Scores
  abstract createScore(score: CreateScoreInput): Promise<Score>;
  abstract listScores(filter: ScoreFilter): Promise<PaginatedResult<Score>>;

  // Analytics
  abstract getProjectStats(projectId: string, timeRange: TimeRange): Promise<ProjectStats>;
  abstract getUsageByModel(projectId: string, timeRange: TimeRange): Promise<ModelUsage[]>;
  abstract getCostBreakdown(projectId: string, timeRange: TimeRange): Promise<CostBreakdown>;

  // Retention
  abstract applyRetentionPolicy(projectId: string, retentionDays: number): Promise<number>;
}
```

---

## Metric Entity Schema

```typescript
interface Metric {
  id: string;
  projectId: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  unit?: string;
  tags: Record<string, string>;
  timestamp: Date;
}
```

### ClickHouse Schema

```sql
CREATE TABLE metrics (
  id String,
  project_id String,
  name String,
  type Enum8('counter' = 1, 'gauge' = 2, 'histogram' = 3),
  value Float64,
  unit Nullable(String),
  tags Map(String, String),
  timestamp DateTime64(3),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, name, timestamp)
TTL timestamp + INTERVAL 90 DAY;
```

---

## Score Entity Schema

```typescript
interface Score {
  id: string;
  projectId: string;
  traceId: string;
  name: string;
  value: number;
  source: 'manual' | 'automatic' | 'user_feedback';
  createdAt: Date;
}
```

### ClickHouse Schema

```sql
CREATE TABLE scores (
  id String,
  project_id String,
  trace_id String,
  name String,
  value Float64,
  source Enum8('manual' = 1, 'automatic' = 2, 'user_feedback' = 3),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, trace_id, created_at, id)
TTL created_at + INTERVAL 365 DAY;
```

---

## Open Questions

### Minimum Viable Metric Set

- Standard system metrics?
- LLM-specific metrics?
- Do we provide "built-in dashboards"?

### Raw vs Aggregated Storage

- Raw: flexible but expensive
- Aggregated: smaller but less flexible

### Metric Identity

- name + attributes
- Do we enforce a naming convention?
- Do we namespace metrics per workflow/package?

### Grafana Integration

- PromQL support?
- "Grafana via SQL" patterns (ClickHouse/PG)
- OTLP -> Grafana Alloy -> Mimir/Loki/Tempo pipeline?

---

## Related Documents

- [Observability](./README.md) (parent)
- [Metrics](./metrics.md)
- [Tracing](./tracing.md)
- [Logging](./logging.md)
- [Exporters](./exporters.md)
