---
'@mastra/factory': patch
---

Prevent terminal tool-result transitions from waiting on their own in-flight binding reconciliation during cleanup. Preserve trailing reconciliation of other bindings.
