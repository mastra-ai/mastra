---
'@mastra/pg': patch
---

Preserve a concurrent prompt draft when a duplicate initial creation fails. Only clean up a thin draft inserted by the same request.
