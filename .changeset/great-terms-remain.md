---
'@mastra/server': patch
---

Accepted and preserved the new `id`, `description`, and `metadata` fields on control-flow entries (`parallel`, `conditional`, `loop`, `foreach`, `sleep`, `sleepUntil`, `mapping`) in the dynamic workflow API schemas. Definitions posted over HTTP keep these fields instead of having them silently stripped.
