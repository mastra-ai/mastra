---
'@mastra/core': minor
---

Added `prepareRun` and `filterRun` utilities for scorer input preparation, allowing scorers to filter and transform agent messages before scoring. Scorers can now declare a `prepareRun` hook or use the `filterRun` builder to select specific message part types and tool names before scoring runs.

Added sandbox experiment runner for isolated experiment execution with workspace snapshots, lifecycle hooks, and automatic teardown.

Added `getCurrentTraceId()` to Harness, which captures the observability trace ID from agent stream responses. This allows callers to correlate feedback and other annotations to the correct trace.
