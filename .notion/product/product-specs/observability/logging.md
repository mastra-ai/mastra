# Logging

Structured event capture for Mastra applications.

---

## Overview

Logs capture specific events and context from user code. Each log auto-correlates with the active trace via traceId/spanId. Logs answer: *"What happened? What was the input/output?"*

---

## Design Philosophy

Mastra logging exists alongside tracing and metrics, but avoids:
- Infinite unstructured text ingestion
- Expensive indexing
- Noisy/low-signal output

---

## Log Structure

Logs in Mastra are structured events with full correlation fields:

```typescript
interface LogRecord {
  // Core fields
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;

  // Auto-correlation (captured from trace context)
  traceId?: string;
  spanId?: string;
  entityType?: 'agent' | 'workflow' | 'tool' | 'processor';
  entityId?: string;
  entityName?: string;
  runId?: string;
  sessionId?: string;
  threadId?: string;
  userId?: string;
  environment?: string;
  serviceName?: string;

  // User data
  data?: Record<string, unknown>;

  // Error details
  errorStack?: string;
}
```

### Why Full Correlation?

All correlation fields are captured automatically when logging inside tools/workflows. This enables:
- Jump from log → trace
- Filter logs by agent/tool/workflow
- Group logs by session or thread
- Correlate with metrics via shared dimensions

---

## Log Levels

| Level | Description |
|-------|-------------|
| `debug` | Detailed debugging information |
| `info` | General informational messages |
| `warn` | Warning conditions |
| `error` | Error conditions |
| `fatal` | Critical failures |

---

## Trace Correlation

Logs are stored separately from traces but include correlation IDs for cross-referencing:

- **traceId** and **spanId** are automatically captured when logging inside tools/workflows
- Logs are NOT attached to spans as span events (separate storage)
- Correlation enables "jump from log → trace" in the UI

This provides:
- Independent retention for logs vs traces
- No bloating of trace data with verbose logs
- Full correlation when needed via shared IDs

### Log Record Example

```json
{
  "id": "log_123",
  "timestamp": "2026-01-26T12:34:56Z",
  "level": "warn",
  "message": "Tool call took longer than expected",
  "traceId": "abc...",
  "spanId": "def...",
  "entityType": "tool",
  "entityName": "http_request",
  "data": {
    "latency_ms": 9832
  }
}
```

---

## Logger API

### ObservabilityContext API (Inside Tools/Workflows)

Logging methods are flattened directly on the observability context for convenience:

```typescript
execute: async (input, { observability }) => {
  // Auto-captures: traceId, spanId, tool, agent, runId, etc.
  observability.info("Processing input", { inputSize: input.length });
  observability.warn("Slow external call", { latency_ms: 5000 });
  observability.error("Failed to connect", { error: e.message });

  // Or access underlying logger for advanced use
  observability.logger.debug("Detailed info");
}
```

**With destructuring:**

```typescript
execute: async (input, { observability: obs }) => {
  obs.info("Starting");
  obs.warn("Slow operation");
}
```

### Direct API (Outside Trace Context)

For startup logs, background jobs, or other non-trace scenarios:

```typescript
mastra.logger.info("Application started", { version: "1.0.0" });
mastra.logger.warn("Config missing, using defaults");
```

### Unified Exporter Model

Logs flow through the observability exporter system. Different exporters handle logs differently:

```typescript
const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        logLevel: 'info',  // Root level - ceiling for all log exporters
        exporters: [
          new DefaultExporter(),   // T ✓  M ✓  L ✓  → Storage (queryable)
          new PinoExporter({       // T ✗  M ✗  L ✓  → Console (pretty)
            level: 'debug',        // Adjusted to 'info' ⚠ (can't exceed root)
            pretty: true,
          }),
          new CloudExporter({      // T ✓  M ✓  L ✓  → Mastra Cloud
            level: 'warn',         // Filters down to warn+ only
          }),
        ],
      },
    },
  }),
});
```

**Note:** The top-level `logger` config in Mastra is deprecated. Use `PinoExporter` or `WinstonExporter` in the observability config instead.

### Log Level Filtering

Log levels follow a ceiling model:

- **Root `logLevel`** is the ceiling - filters before events enter the observability system
- **Per-exporter `level`** filters down from root (can be more restrictive, not less)
- If exporter level < root level → warn on startup, auto-adjust exporter up to root level

To get debug logs to a specific exporter, set root to 'debug' and let other exporters filter down.

---

## Auto-Instrumentation

When observability is enabled, Mastra automatically:
- Correlates logs with active traces
- Attaches traceId and spanId to log entries
- Captures HTTP request/response logs (Sentry-style)

---

## Sampling

Optional sampling strategies to control log volume:
- Sample by log level (e.g., always capture errors)
- Sample by ratio
- Custom sampling logic

---

## Storage

Logs are stored via the observability storage domain.

### ClickHouse Schema

```sql
CREATE TABLE logs (
  id String,
  project_id String,
  build_id Nullable(String),
  trace_id Nullable(String),
  span_id Nullable(String),
  entity_type Nullable(Enum8('agent'=1, 'workflow'=2, 'tool'=3, 'processor'=4)),
  entity_name Nullable(String),
  run_id Nullable(String),
  session_id Nullable(String),
  timestamp DateTime64(3),
  level Enum8('debug'=1, 'info'=2, 'warn'=3, 'error'=4, 'fatal'=5),
  message String,
  data Nullable(String),
  error_stack Nullable(String),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
TTL timestamp + INTERVAL 10 DAY;
```

---

## File-Based Logging (MastraAdmin)

For MastraAdmin deployments, logs flow through a file-based ingestion pipeline:

1. **FileLogger** - Injected at build time, writes structured logs to JSONL files
2. **File Storage** - Logs written to `{buildDir}/observability/logs/*.jsonl`
3. **IngestionWorker** - Polls files, parses JSONL, bulk inserts to ClickHouse

This approach:
- Works even if admin server restarts
- Provides consistent pattern with span ingestion
- Avoids tight coupling between runner and deployed server

---

## Retention

**Default retention:** 10 days

**Enforcement:** Manual via CLI (no background job infrastructure yet)

```bash
mastra logs cleanup --older-than 10d
```

**Future CLI expansion:**

```bash
mastra logs --search 'error'
mastra logs --trace-id abc123
mastra logs --level error --since 1h
```

**Considerations:**
- Configure retention policies per environment
- Consider log level-based retention (keep errors longer)
- Use sampling for high-volume debug logs

---

## Related Documents

- [Observability](./README.md) (parent)
- [Metrics](./metrics.md)
- [Tracing](./tracing.md)
- [Architecture & Configuration](./architecture-configuration.md)
- [Plan Analysis](./plan-analysis.md) - Feature gap analysis
- [User Anecdotes](./user-anecdotes.md) - User feedback on observability needs
