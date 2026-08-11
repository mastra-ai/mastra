---
'@mastra/core': patch
---

Reconcile client-echoed messages by stored record ID before persisting.

Unchanged echoes are not persisted again. Lossy client copies can no longer replace server content. Output-processor transformations, tool history, and metadata are retained. Only supported client-authored transitions are merged, such as a tool call advancing from `call` to `result`. Fixes [#20836](https://github.com/mastra-ai/mastra/issues/20836).
