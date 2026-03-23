---
'@mastra/core': minor
---

Added `WORKSPACE_ACTION` span type for workspace tracing. All workspace tools (filesystem, sandbox, search) now create child spans with metadata including category, operation, file paths, commands, exit codes, bytes transferred, and duration. Added `startWorkspaceSpan()` utility for span creation with graceful no-op when tracing is inactive.
