---
'@mastra/core': minor
---

Added runtime governance controls for agent tool calls.

Use `toolGovernance` on `agent.generate()` or `agent.stream()` to configure allowlists, denylists, ordered policies, cost tracking, budget limits, circuit breakers, and structured audit events before Mastra executes tools.
