---
'@mastra/evals': patch
---

Fixed trajectory blacklist and redundant-call checks missing tool calls nested inside `agent_run` or `workflow_step` steps. `checkTrajectoryBlacklist` now flags blacklisted tools at any depth and blacklisted sequences within any nested step list, and `checkTrajectoryEfficiency` detects consecutive duplicate calls inside nested step lists. Trajectories with nested violations that previously passed will now score lower. Fixes #24925.
