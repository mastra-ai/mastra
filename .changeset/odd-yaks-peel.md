---
'@mastra/langfuse': minor
'@mastra/datadog': minor
'@mastra/observability': minor
'@mastra/core': minor
---

Added scores to spans so that they flow through the observability pipeline and are accessible for all the registered exporters.

An `addScore` function was added onto the spans. Scores from live evaluations now flow through the observability pipeline. The scorer hook now calls `currentSpan.addScore()` to attach scores to spans, which then emits a SPAN_UPDATED event. This allows all configured exporters to receive and process scores.

DefaultExporter now handles score persistence by listening for scores on span.scores and saving them to the scores database.

LangfuseExporter and DatadogExporter now process scores from span.scores and submits them using the SDK's score API.
