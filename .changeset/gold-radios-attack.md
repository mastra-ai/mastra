---
'@mastra/server': patch
---

Fixed memory API endpoints (`/memory/config` and `/memory/threads/:threadId/working-memory`) returning 400 errors when agents don't have memory configured. These endpoints now return graceful null responses instead of throwing, preventing console error noise in the playground/studio. Fixes regression of #11765.
