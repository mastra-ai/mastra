---
'@mastra/upstash': patch
---

Added run fencing for durable agents. Upstash stores now reject writes from a durable agent execution that lost its run to crash recovery, so it can't overwrite the recovered run's messages, threads, or workflow state ([#23734](https://github.com/mastra-ai/mastra/issues/23734)).

Claims are stored as keys in the same database, so no setup is needed.

Requires `@mastra/core` 1.76.0 or a later 1.x release.
