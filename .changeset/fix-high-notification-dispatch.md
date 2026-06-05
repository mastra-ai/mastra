---
'@mastra/core': patch
---

Dispatch due individual notifications by priority so high-priority notifications that already emitted summaries are delivered in full before lower-priority notifications can wake the same thread.
