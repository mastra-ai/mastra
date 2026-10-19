---
'@mastra/core': patch
---

Fixed durable and evented agents reporting no token usage for a step that suspends on a tool call. `generate()` results and `tool-call-approval` / `tool-call-suspended` chunks now include that step's usage, matching the regular agent.
