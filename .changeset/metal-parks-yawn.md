---
'@mastra/langfuse': minor
'@mastra/otel-exporter': patch
---

Replaced deprecated `langfuse` SDK (v3) with official Langfuse v5 packages (`@langfuse/otel` + `@langfuse/client`). Tracing uses `LangfuseSpanProcessor` for span export, and `LangfuseClient` is exposed via `exporter.client` for scoring, prompt management, evaluations, and datasets. The existing public API (`LangfuseExporter`, `LangfuseExporterConfig`, `withLangfusePrompt`) is preserved. New config options: `environment` and `release`. Note: `withLangfusePrompt({ id })` id-only prompt linking is deprecated — Langfuse v5 requires `name` + `version`.
