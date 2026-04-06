---
'@mastra/langfuse': minor
'@mastra/otel-exporter': patch
---

Upgraded Langfuse integration to the official v5 SDK, replacing the deprecated v3 package.

**New features:**
- Access Langfuse's full platform via `exporter.client` — prompt management, datasets, evaluations, and scoring
- New `environment` and `release` config options for filtering traces in the Langfuse dashboard

**No breaking changes to your existing code** — `LangfuseExporter`, `LangfuseExporterConfig`, and `withLangfusePrompt()` work the same way. Just upgrade the package and your traces will use the latest Langfuse format.

**Note:** `withLangfusePrompt({ id })` is deprecated — Langfuse v5 requires `name` + `version` for prompt linking.
