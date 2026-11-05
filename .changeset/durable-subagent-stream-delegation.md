---
'@mastra/core': patch
---

Fixed streaming supervisors that delegate to a durable or evented sub-agent. The sub-agent ran its tools, but the supervisor received a "Failed agent tool execution" error instead of the sub-agent's answer. When the sub-agent's tool needed approval, the supervisor's stream stalled instead of surfacing the approval request. `generate()` was not affected.
