---
'@mastra/core': patch
---

Fixed processor state not persisting between processOutputStream and processOutputResult when processors are wrapped in workflows. State set during stream processing is now correctly accessible in processOutputResult.
