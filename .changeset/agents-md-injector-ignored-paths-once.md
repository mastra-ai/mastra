---
'@mastra/core': patch
---

`AgentsMDInjector` now calls `getIgnoredInstructionPaths` once per model step instead of once for every instruction file the step checks. A callback that loads the session's instruction files, such as one reading them from a base branch with git, no longer repeats that work for each folder the agent has touched.
