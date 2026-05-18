---
'@mastra/core': patch
---

Fix `AgentExecutionOptions<undefined>` and `PublicAgentExecutionOptions<undefined>` so `structuredOutput` is not required when consumers compile with `strictNullChecks: false`.
