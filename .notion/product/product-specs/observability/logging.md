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

Logs in Mastra are structured events (JSON) tied to spans/workflows:

```typescript
interface Log {
  id: string;
  projectId: string;
  buildId?: string;
  traceId?: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  logger?: string;
  attributes?: Record<string, unknown>;
  errorStack?: string;
  createdAt: Date;
}
```

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

A clean strategy for logs:
- "Logs are events attached to spans" (span events)
- Optionally exported to a separate log pipeline

This provides:
- Correlation by trace/span IDs
- A natural place to store "what happened" without bloating spans

### Log Event Example (Span Event)

```json
{
  "ts": "2026-01-26T12:34:56Z",
  "level": "warn",
  "message": "Tool call took longer than expected",
  "traceId": "abc...",
  "spanId": "def...",
  "attributes": {
    "tool": "http_request",
    "latency_ms": 9832
  }
}
```

---

## Logger API

Developers can emit logs using a simple API:

```typescript
log.info("Processing request", { userId: "123" });
log.warn("Tool call slow", { latency_ms: 5000 });
log.error("Failed to connect", { error: e.message });
```

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
  timestamp DateTime64(3),
  level Enum8('debug'=1, 'info'=2, 'warn'=3, 'error'=4, 'fatal'=5),
  message String,
  logger Nullable(String),
  attributes Nullable(String),
  error_stack Nullable(String),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
TTL timestamp + INTERVAL 30 DAY;
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

## Retention Considerations

### Questions to Answer

- Do we index everything?
- Do we store logs as trace span events only?
- Do we allow full-text search?

### Recommendations

- Configure retention policies per environment
- Consider log level-based retention (keep errors longer)
- Use sampling for high-volume debug logs

---

## Related Documents

- [Observability](./README.md) (parent)
- [Metrics](./metrics.md)
- [Tracing](./tracing.md)
- [Architecture & Configuration](./architecture-configuration.md)
