---
'@mastra/observability': minor
---

**ObservabilityBus** — Added a central event bus that routes tracing, metric, and log events to registered exporters. Replaces fire-and-forget dispatch with tracked handler promises and two-phase flush (drain in-flight handlers, then call exporter.flush), ensuring no events are silently dropped during shutdown.

**Auto-extracted metrics** — Added automatic metric extraction from span lifecycle events. Agent runs, tool calls, model generations, and workflow runs now emit `_started`, `_ended`, and `_duration_ms` metrics with structured labels (entity hierarchy, model/provider, status).

**Structured logging context** — Added `LoggerContextImpl` which emits log events with automatic trace correlation (traceId, spanId), inherited tags, and entity metadata. Supports minimum log level filtering.

**Metrics context** — Added `MetricsContextImpl` with counter, gauge, and histogram instruments. All labels pass through a `CardinalityFilter` that blocks high-cardinality keys (trace_id, user_id, etc.) to protect metric backends.

**Consistent metric labels** — All metrics use a uniform label hierarchy: `entity_type`, `entity_name`, `parent_type`, `parent_name`, `root_type`, `root_name`, `model`, `provider`, and `service_name`.

**Renamed JsonExporter to TestExporter** — The test-only exporter now supports all signal types (tracing, metrics, logs) and is named `TestExporter` to reflect its purpose. The previous `JsonExporter` import path is removed.
