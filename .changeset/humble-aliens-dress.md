---
'@mastra/factory': patch
---

The Files tab now shows the session's live working directory instead of only files the agent touched. Each folder loads from the sandbox when you open it, a refresh button reloads open folders, and folders and the open file refresh after the agent writes, edits, deletes, or runs a command. Dotfiles are hidden until you toggle them on. `.git`, the sandbox's setup markers, and gitignored files inside a checkout (such as `.env` and `node_modules`) are never listed or served, including through a symlink. Symlinks show where they point (`CLAUDE.md → AGENTS.md`), and a symlinked folder opens its target instead of expanding in place.

Opening the panel never starts a sandbox. When none is running, the Files and Changes tabs show a **Wake sandbox** button that starts it without a model turn (`POST /web/user-sessions/:sessionId/sandbox/start`). The `/web/workspace/files` route is replaced by `GET /web/workspace/tree?workspacePath=&path=`.
