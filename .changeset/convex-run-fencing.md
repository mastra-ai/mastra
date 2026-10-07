---
'@mastra/convex': patch
---

Added run fencing for durable agents. Convex stores now reject writes from a durable agent execution that lost its run to crash recovery, so it can't overwrite the recovered run's messages, threads, or workflow state ([#23734](https://github.com/mastra-ai/mastra/issues/23734)).

Claims are stored in the existing `mastra_documents` table, so no schema change is needed. Redeploy your Convex functions after upgrading. Until you do, durable agent runs fail with an error asking you to redeploy. Other writes keep working.

Requires `@mastra/core` 1.76.0 or later.
