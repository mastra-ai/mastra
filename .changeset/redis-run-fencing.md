---
'@mastra/redis': patch
---

Added run fencing for durable agents. Redis stores now reject writes from a durable agent execution that lost its run to crash recovery, so it can't overwrite the recovered run's messages, threads, or workflow state ([#23734](https://github.com/mastra-ai/mastra/issues/23734)).

Claims are stored as keys in the same database, so no setup is needed.

Claims and memory fences expire on their own: a claim 7 days after its last claim, renewal or release, and a fence 7 days after it is retired. Running executions renew their claim every few seconds, and fences of unfinished runs never expire. `storage.prune()` doesn't manage these keys, and the 7 days aren't configurable.

Requires `@mastra/core` 1.76.0 or a later 1.x release.
