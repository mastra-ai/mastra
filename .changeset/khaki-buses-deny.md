---
'@mastra/core': patch
---

Fixed an infinite retry loop in evented workflows when workflow storage is unavailable (for example when the workflows table does not exist). A failing workflow.fail event no longer republishes another workflow.fail after exhausting its retry budget, which previously flooded logs with endless "error processing event" entries.
