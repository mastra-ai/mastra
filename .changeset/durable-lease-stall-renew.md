---
'@mastra/core': patch
---

Fixed durable agent runs failing with `DURABLE_AGENT_EXECUTION_UNVERIFIED` after the event loop was blocked for longer than the execution lease, for example by a CPU-heavy synchronous tool. When storage holds run ownership, the heartbeat now renews the claim after a stall instead of giving up on its own clock. The run continues if no other execution claimed it in the meantime, and still stops as superseded if one did. Fixes #30669.
