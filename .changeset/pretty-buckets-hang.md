---
'@mastra/code-sdk': patch
'mastracode': patch
---

Renamed the `agent_signal_send` tool's `summary` parameter to `message`. The field carries the full message delivered to the peer, and the new name makes that clear to sending agents.
