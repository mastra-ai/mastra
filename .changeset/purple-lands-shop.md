---
'@mastra/code-sdk': patch
---

Fixed per-agent-type subagent model selections (`subagentModelId_explore/plan/execute`) being stripped from session state by schema validation. Pack activation (`/models` → Activate or `--pack`) assigned subagent models, but the next session state update silently dropped them, so subagents fell back to their default models.
