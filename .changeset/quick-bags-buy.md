---
'@mastra/core': patch
---

Durable agents now produce observability traces. Previously, createDurableAgent runs were invisible to trace exporters because no root span was created. Traces now appear for durable agent runs just like regular agent runs.
