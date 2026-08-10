---
'@mastra/core': patch
---

Fix `runEvals` type overloads so `gates` can be combined with a categorized scorer config (`AgentScorerConfig` / `WorkflowScorerConfig`). The runtime already ran gates independently of the scorer shape, but the TypeScript overloads only declared `gates` alongside a flat `ScorerEntry[]`, so calls like `runEvals({ target, data, gates, scorers: { trajectory: [...] } })` failed to compile with TS2769. Added the optional `gates` property to both the agent and workflow categorized-config overloads.
