---
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Accept `rootSpanName` in `tracingOptions` on agent and workflow HTTP routes so clients can set a per-run root span name. Related: https://github.com/mastra-ai/mastra/issues/24518
