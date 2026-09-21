---
'@mastra/core': patch
'@mastra/memory': patch
---

Reconcile client-echoed messages by stored record ID before persisting in standard and observational memory flows.

Unchanged echoes are not persisted again. Lossy client copies can no longer replace server content. Output-processor transformations, tool history, and metadata are retained. Only supported client-authored transitions are merged, such as a tool call advancing from `call` to `result`. An echoed message whose ID already belongs to a record on another thread is rejected instead of overwriting that record, and the rejection is now reported with a warning and a span attribute instead of happening silently. Fixes [#20836](https://github.com/mastra-ai/mastra/issues/20836).
