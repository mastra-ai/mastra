---
'@mastra/editor': minor
---

Agent Builder now applies `memory: { observationalMemory: true }` as the baseline default for newly created stored agents when neither the user input nor the admin's `builder.configuration.agent.memory` specifies a memory config. Pass `memory: null` on create (or pin a different default via `builder.configuration.agent.memory`) to opt out.
