---
'@mastra/core': patch
---

`@mastra/core`: patch

Added `spanId` alongside `traceId` across user-facing execution results that return tracing identifiers (including agent stream/generate and workflow run results) so integrations can query observability vendors by run root span ID
