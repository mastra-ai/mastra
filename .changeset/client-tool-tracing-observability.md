---
'@mastra/observability': minor
---

Support ingesting client-side tool telemetry. Spans, logs, and duration metrics captured by the client SDK during tool execution are forwarded through the observability bus to your existing exporters. Client tool durations are reported via the existing `mastra_tool_duration_ms` metric with a `toolType: 'client'` label to distinguish them from server-side tool durations.
