---
'@mastra/core': patch
'mastracode': patch
---

`LocalFilesystem` now accepts `disallowedPaths` (a deny-list of subtrees inside `basePath`) and an optional `disallowedPathHint` to customise the `PermissionError` message — useful for wiring up trust boundaries inside an otherwise-allowed workspace. Allowed paths still override disallowed ones, so per-call grants always win over the static block.

Mastra Code uses this to treat nested git trees (worktrees, submodules, vendored repos) inside the project root as separate sandboxes. The agent must now call `request_access` before reading or writing files inside them, just like for paths outside the project root. The system prompt surfaces a list of any nested trees it detects so the agent can plan around them. This prevents the agent from silently switching into a sibling worktree and stashing or deleting another session's uncommitted work.
