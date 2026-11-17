---
'@mastra/arthur': minor
---

Updated to the OpenTelemetry semantic conventions 1.41.0 attributes from `@mastra/otel-exporter`. Fixed the finish reason on model calls. It showed `stop` for every call, and now shows the real reason, such as `tool-calls` or `length`. Stop sequences now also appear in the invocation parameters.
