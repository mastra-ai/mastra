---
'@mastra/core': minor
---

Added optional `maxSteps` to `ScorerJudgeConfig` and `GoalConfig`, letting callers control the internal judge agent's agentic-loop iteration limit instead of relying on the implicit default of 5. Also fixed judge agent not receiving Mastra registration, which caused the observer's API key resolution to fail silently.
