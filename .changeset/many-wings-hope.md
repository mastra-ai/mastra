---
'@mastra/core': minor
---

Added an opt-in `propagate` flag on the FGA actor signal. Set `actor: { actorKind: 'system', propagate: true }` when starting a workflow run and the actor is forwarded into the agent and tool calls made for declarative `.then(agent)` and `.then(tool)` steps, so system and scheduled runs no longer fail membership resolution. Propagation stays opt-in, skips custom step `execute` functions, and can be overridden per step. (#19064)
