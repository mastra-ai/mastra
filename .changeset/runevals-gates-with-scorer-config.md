---
'@mastra/core': patch
---

`runEvals` now accepts `gates` together with a categorized scorer config (`AgentScorerConfig` / `WorkflowScorerConfig`) without a TypeScript error. Previously a call like `runEvals({ target, data, gates, scorers: { trajectory: [...] } })` failed to compile with TS2769 because the categorized-config overloads didn't declare `gates`, even though the runtime already ran gates independently of the scorer shape. The optional `gates` property was added to both the agent and workflow categorized-config overloads.
