---
'@mastra/core': patch
---

Fixed streaming supervisors that delegate to a durable or evented sub-agent. The sub-agent ran its tools, but the supervisor received a "Failed agent tool execution" error instead of the sub-agent's answer. `generate()` was not affected.
