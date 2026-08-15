---
'@mastra/core': patch
---

Reject malformed model routing fields before they reach the model router, so invalid configurations produce Mastra's standard error instead of an internal runtime exception.
