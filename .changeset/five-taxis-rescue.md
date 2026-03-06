---
'@mastra/observability': patch
'@mastra/core': patch
---

Added `requestContext` field to span type interfaces (`BaseSpan`, `SpanData`, `ExportedSpan`). Workflow steps, tool calls, and LLM spans now pass `requestContext` through to child span creation, enabling per-span context snapshots.
