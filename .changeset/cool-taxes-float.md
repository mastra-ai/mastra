---
'@mastra/core': patch
---

Added optional `tracingOptions` parameter to `Harness.sendMessage()`. This allows tracing context (trace ID, parent span ID, metadata, tags) to be forwarded to `agent.stream()`, `agent.approveToolCall()`, and `agent.declineToolCall()`, fixing orphaned root spans when using the Harness with observability backends like Datadog. See #13540.
