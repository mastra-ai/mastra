---
'@mastra/core': minor
---

Added transferable AgentController thread ownership and a per-run owner snapshot in request context. New threads record their owner and creator, while ownership changes to the active thread become visible on the next run.
