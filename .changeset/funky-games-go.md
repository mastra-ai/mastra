---
'@mastra/observability': patch
---

Fixed `SensitiveDataFilter` so it also redacts sensitive fields inside a span's `requestContext`. Secrets stored in `RequestContext` (for example a per-request API token that tools use) were exported to every tracing exporter in plain text, even when the key was listed in `sensitiveFields`. The filter now applies the same redaction to `requestContext` as it does to `attributes`, `metadata`, `input`, `output`, and `errorInfo`. Fixes https://github.com/mastra-ai/mastra/issues/23046
