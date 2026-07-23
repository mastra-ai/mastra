---
'@mastra/code-sdk': minor
'mastracode': patch
'@mastra/core': patch
'@mastra/libsql': patch
---

Added native background-work lifecycle signaling and worker startup for Mastra Code agents. Read-only workspace tools and the Alexandria expert can opt into deferred or awaited background work, including over Mastra Code's Unix socket PubSub transport. Eligible tools remain foreground unless each call explicitly requests background execution. Deferred tools stay visible as persistent lifecycle rows, reconcile completion in place, preserve background provenance for the model and UI, and keep subscribed runs open through completion-driven follow-ups. LibSQL background-task updates now correctly persist primitive JSON results such as plain-text tool output.
