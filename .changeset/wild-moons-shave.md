---
'@mastra/code-sdk': patch
---

Include worktree identity (`worktree_path`, `branch`, `main_repo_path`) in `SessionStart` and `SessionEnd` hook payloads when a session runs in a git worktree, so hooks can provision and tear down per-worktree resources.
