---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed rebuilt spans dropping their trace rules. A span restored with `rebuildSpan()` now keeps the `requestContextKeys`, `hideInput`, and `hideOutput` it was exported with, so spans created under it (for example every tool call and workflow in a durable agent run) still extract the configured request context keys and still hide input and output. Fixes #28111
