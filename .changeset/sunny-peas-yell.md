---
'@mastra/inngest': patch
---

Explicitly cancelling a disconnected Inngest run or thread prevents the agent from starting another reply. Local-only thread cleanup leaves remote execution running.

Disconnecting a parked approval or suspended-tool observer preserves the run for resumption.
