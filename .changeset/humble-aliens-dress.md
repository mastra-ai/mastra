---
'@mastra/platform-workspace': patch
'@mastra/factory': patch
'@mastra/code-sdk': patch
'@mastra/e2b': patch
'@mastra/core': patch
---

The Files tab now shows the session's live checkout instead of only files the agent touched. Each folder loads from the sandbox when you open it, a refresh button reloads open folders, and folders and the open file refresh after the agent writes, edits, deletes, or runs a command. Opening the panel never starts a sandbox; when none is running, a **Wake sandbox** button starts it (`POST /web/user-sessions/:sessionId/sandbox/start`). `.git` and gitignored files (such as `.env` and `node_modules`) are neither listed nor served, and the `/web/workspace/files` route is replaced by `GET /web/workspace/tree?workspacePath=&path=`.
