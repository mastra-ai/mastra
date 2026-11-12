---
'@mastra/deployer': minor
---

Added `serverShutdownBudgetMs()` to `@mastra/deployer/build`: the longest a built server takes to exit after a shutdown signal for a given `server.drainTimeout`, which `mastra dev` waits for before it kills the server.
