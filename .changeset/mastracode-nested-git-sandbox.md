---
'mastracode': patch
---

Mastra Code now treats nested git trees inside the project root as separate sandboxes. The agent must call `request_access` before reading or writing files inside worktrees, submodules, or vendored repos, just like for paths outside the project root.

The system prompt lists nested trees detected at process startup so the agent can plan around them without repeatedly scanning the filesystem. Detection skips common build directories and paths ignored by the project root `.gitignore`, keeping the list focused on relevant nested trees.

Fixed `request_access` so nested git trees inside a project can be explicitly approved instead of being reported as already granted.
