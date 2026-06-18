---
'@mastra/core': patch
---

Fixed durable agents (`createDurableAgent` / `createEventedAgent`) producing no observability traces.

Durable agent runs previously emitted no traces at all because the durable execution path never opened an `AGENT_RUN` root span and the internal workflow spans were marked internal, so the whole trace was dropped on export. Durable runs now produce the same `AGENT_RUN`-rooted trace as non-durable agents — the model call, tool calls, and token usage all appear in the trace UI, nested correctly under the agent run.

No API changes are required; existing durable agents start emitting traces automatically once observability is configured.
