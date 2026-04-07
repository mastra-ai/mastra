---
'@mastra/observability': patch
---

Apply `deepClean()` to all observability signals (logs, metrics, scores, feedback) before fanning out to exporters and bridges. Previously only tracing spans were deep-cleaned at construction time, leaving free-form payload fields on other signals (e.g. `log.data`, `log.metadata`, `metric.metadata`, `metric.costContext.costMetadata`, `score.metadata`, `feedback.metadata`) susceptible to circular references, oversized strings, and other non-serializable values. Sanitization now happens centrally in `ObservabilityBus.emit()` so every signal leaving the bus is bounded and JSON-safe.
