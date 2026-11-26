---
'@mastra/core': patch
---

Fixed evented agent runs failing when multiple Mastra instances share an in-process pubsub. Local workflow steps now stay with the instance that owns the run.
