---
'@mastra/otel-exporter': patch
'@mastra/arize': patch
'@mastra/arthur': patch
'@mastra/sentry': patch
---

Renamed emitted OTel GenAI cache usage attributes to match the OpenTelemetry semantic conventions:

- `gen_ai.usage.cached_input_tokens` → `gen_ai.usage.cache_read.input_tokens`
- `gen_ai.usage.cache_write_tokens` → `gen_ai.usage.cache_creation.input_tokens`

`gen_ai.usage.input_tokens` is unchanged and remains the total prompt-token count. Cache attributes are emitted separately as subsets of that total.

Updated Arize, Arthur, and Sentry mappings so cache values continue to flow through those exporters.

Direct consumers should update any dashboards, alerts, or queries that reference the old attribute names.
