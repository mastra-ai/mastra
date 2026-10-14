---
'@mastra/redis': patch
---

Added run fencing for durable agents. Redis stores now reject writes from a durable agent execution that lost its run to crash recovery, so it can't overwrite the recovered run's messages, threads, or workflow state ([#23734](https://github.com/mastra-ai/mastra/issues/23734)).

Claims are stored as keys in the same database, so no setup is needed.

`storage.prune()` doesn't cover these keys on Redis yet, so they are kept.

Requires `@mastra/core` 1.76.0 or a later 1.x release.

Released run claims and retired fences now expire after 7 days, so stores no longer keep one record per run forever. Active claims and raised fences never expire.
