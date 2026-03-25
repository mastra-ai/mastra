---
'@mastra/arthur': minor
'@mastra/openinference': minor
'@mastra/arize': patch
---

Added @mastra/arthur observability provider for exporting Mastra traces to Arthur AI using OpenInference semantic conventions. Supports zero-config setup via ARTHUR_API_KEY, ARTHUR_BASE_URL, and ARTHUR_TASK_ID environment variables.

Extracted the OpenInference OTLP trace exporter into @mastra/openinference as a shared package, enabling reuse across multiple observability providers. Refactored @mastra/arize to use @mastra/openinference as a dependency.
