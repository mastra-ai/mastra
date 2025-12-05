---
'@mastra/braintrust': patch
'@mastra/langsmith': patch
---

Fix traceMap overwrite when multiple root spans share the same traceId

Previously, when multiple root spans shared the same traceId (e.g., multiple `agent.stream` calls in the same trace), the trace data would be overwritten instead of reused. This could cause spans to be orphaned or lost.

Now both exporters check if a trace already exists before creating a new one, matching the behavior of the Langfuse and PostHog exporters.
