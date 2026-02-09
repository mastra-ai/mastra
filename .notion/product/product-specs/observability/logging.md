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

## Logging Architecture

Logs flow through a unified pipeline with automatic trace correlation:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOG SOURCES                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────┐     ┌──────────────────────────────┐  │
│  │  Context-Aware Logger    │     │   Direct Logger API          │  │
│  │  observability.info()    │     │   mastra.logger.info()       │  │
│  │  observability.error()   │     │   mastra.logger.error()      │  │
│  └──────────┬───────────────┘     └──────────────┬───────────────┘  │
│             │                                    │                  │
│             │ auto-correlates                    │ no trace         │
│             │ traceId, spanId,                   │ correlation      │
│             │ entity, runId, etc.                │                  │
│             ▼                                    ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 LogRecord (unified format)                   │   │
│  │    { level, message, data, traceId, spanId, timestamp }      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Signal Processors  │  (SensitiveDataFilter, etc.)
                    └──────────┬──────────┘
                               │
                               ▼
                    Exporters (that support logs)
```

### Why Two APIs?

- **Context-aware** (inside tools/workflows) — Auto-captures all correlation fields, enabling log → trace navigation
- **Direct** (outside trace context) — For startup logs, background jobs, or when no trace is active

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

---

## Sensitive Data Filtering

Logs pass through the same signal processor pipeline as traces, allowing automatic redaction of passwords, tokens, API keys, and other sensitive data before export.

→ See [Architecture & Configuration - Signal Processors](./architecture-configuration.md#signal-processors) for configuration

---

## Storage

Logs are stored via the observability storage domain alongside traces and metrics.

→ See [Architecture & Configuration](./architecture-configuration.md) for storage backends and retention policies

---

## Inline Logs in Trace UI (Future)

Logs will be displayed as events within their related spans in the tracing UI. Since logs are auto-correlated with `traceId` and `spanId`, navigating between logs and traces preserves full context.

→ See [Tracing - Inline Logs in Trace UI](./tracing.md#inline-logs-in-trace-ui-future) for details

---

## Related Documents

- [Observability](./README.md) (parent)
- [Metrics](./metrics.md)
- [Tracing](./tracing.md)
- [Architecture & Configuration](./architecture-configuration.md)
- [Plan Analysis](./plan-analysis.md) - Feature gap analysis
- [User Anecdotes](./user-anecdotes.md) - User feedback on observability needs
