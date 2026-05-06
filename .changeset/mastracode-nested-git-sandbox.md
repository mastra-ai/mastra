---
'@mastra/core': patch
'mastracode': patch
---

Treat nested git trees (worktrees, submodules, vendored repos) inside the project root as separate sandboxes. The agent must now call `request_access` before reading or writing files inside them, just like for paths outside the project root. The system prompt surfaces a list of any nested trees it detects so the agent can plan around them. This prevents the agent from silently switching into a sibling worktree and stashing or deleting another session's uncommitted work.
