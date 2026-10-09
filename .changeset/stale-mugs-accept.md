---
'@mastra/core': minor
---

Added transferable AgentController thread ownership with compare-and-set updates and a per-run owner snapshot in request context. New threads record their owner and creator, while ownership changes become visible on the next run.
