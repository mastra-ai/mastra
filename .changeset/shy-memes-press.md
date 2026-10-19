---
'@mastra/factory': patch
---

Fix Factory branch pushes sending stale session refs when the agent commits on another branch. Safely advance ancestor session branches to the active HEAD, preserve dirty work, and refuse branches with session-only commits or another worktree owner.
