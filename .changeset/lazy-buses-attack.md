---
'@mastra/evals': patch
---

Fixed trajectory scorer's blacklist and redundant-call checks silently missing violations nested inside an `agent_run`/`workflow_step` (e.g. a blacklisted tool called by a subagent, or the same tool called twice in a row inside a nested step). Both checks now look inside `children`, scoped per parent so unrelated branches of the trajectory tree are never treated as adjacent.
