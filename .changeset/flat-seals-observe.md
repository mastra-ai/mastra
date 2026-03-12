---
'@mastra/core': patch
---

`@mastra/core`: patch

Added `spanId` alongside `traceId` on `agent.stream()`, `agent.generate()`, and workflow execution results so integrations can query observability vendors by run root span ID (for example, optimized Braintrust root span lookups)
