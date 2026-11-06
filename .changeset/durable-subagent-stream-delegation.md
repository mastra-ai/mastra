---
'@mastra/core': patch
---

Fixed streaming supervisors that delegate to a durable or evented sub-agent. The sub-agent ran its tools, but the supervisor received a "Failed agent tool execution" error instead of the sub-agent's answer. When the sub-agent's tool needed approval, the supervisor's stream stalled instead of surfacing the approval request. After an approval or decline, the delegation now reports the sub-agent's original thread with its full transcript, and a declined tool call is no longer reported to the supervisor as a tool that never ran. `generate()` was not affected.
