---
'@mastra/code-sdk': minor
'mastracode': patch
'@mastra/core': patch
---

Added native background-work lifecycle signaling and worker startup for Mastra Code agents. Read-only workspace tools can now run as deferred or awaited background work, including over Mastra Code's Unix socket PubSub transport. Deferred tools remain visible as persistent running rows, reconcile completion in place, and batch concurrent results into one follow-up response.
